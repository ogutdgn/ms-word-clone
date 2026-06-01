# Technical Strategy (from research)

## Editor core: contenteditable+execCommand vs ProseMirror/TipTap vs Lexical vs Quill

**Recommendation:** For a one-session, no-bundler build in an Electron renderer with nodeIntegration + raw require(), pick ProseMirror core (prosemirror-model 1.x, prosemirror-state 1.x, prosemirror-view 1.41.x, prosemirror-transform, prosemirror-schema-basic, prosemirror-commands, prosemirror-keymap, prosemirror-history) loaded via require(). It is the only credible Word-fidelity option whose packages I empirically confirmed require() cleanly in plain CommonJS with zero bundler. Second choice for speed-of-build is raw contenteditable + a thin command layer (NOT document.execCommand). Avoid TipTap, Lexical-as-primary, and Quill for this specific constraint set.

**Rationale:** I verified module formats against the live npm registry and then actually ran require() in a clean Node CJS sandbox (mirrors Electron renderer w/ nodeIntegration doing bare require). Results: require('prosemirror-model'/'prosemirror-state'/'prosemirror-view') => OK; require('lexical') => OK (0.45.0 ships dist/Lexical.js CJS main); require('quill') => FAIL with ERR_REQUIRE_ESM (Quill 2.0.3 is now an ESM-only package — its require entry is gone; you can only get it via the UMD dist/quill.js script tag, not require). ProseMirror gives a real document model + schema + transactions, which is what Word fidelity (styles, marks, block structure, tables via prosemirror-tables) actually needs; you serialize to/from HTML with DOMSerializer/DOMParser which dovetails with the mammoth import and html-to-docx export paths. document.execCommand is officially deprecated (MDN/WHATWG), behaves inconsistently, produces garbage nested spans, and has no undo/redo model you can trust — it is a dead end for anything Word-like. Lexical IS require()-able and is excellent, but its real power is the @lexical/react binding + a constellation of @lexical/* plugin packages; using core-only by hand in one session is more friction than ProseMirror core, and its node/transform API churns between 0.x releases.

**Libraries:** prosemirror-model@1.x; prosemirror-state@1.x; prosemirror-view@1.41.8; prosemirror-transform@1.x; prosemirror-commands@1.x; prosemirror-keymap@1.x; prosemirror-history@1.x; prosemirror-schema-basic@1.x; prosemirror-schema-list@1.x; prosemirror-tables@1.x; lexical@0.45.0 (require-able alternative); @tiptap/core@3.24.0 (ESM/bundler-oriented; not for no-bundler); quill@2.0.3 (ESM-only package: use UMD dist/quill.js via <script>, NOT require)

**Pitfalls:**

- Quill 2.0.3 cannot be require()'d (ERR_REQUIRE_ESM confirmed empirically) — if you insist on Quill, drop the UMD build in via a <script> tag and use the global, do not require() it. Also Quill has no native tables in 2.0 and its Delta model is lossy vs Word.
- document.execCommand is deprecated and non-deterministic across selections/browsers; do not build the editor on it. If you go raw-contenteditable, implement formatting via Range/Selection + your own command + undo stack, not execCommand.
- TipTap is technically ProseMirror under the hood and @tiptap/core@3.24.0 / @tiptap/pm resolve CJS, but TipTap's idiomatic usage (extensions, @tiptap/react|vue) assumes a build step; using it without a bundler fights the framework. If you want ProseMirror, use ProseMirror directly.
- ProseMirror in the renderer: bare require('prosemirror-view') resolves from node_modules only because nodeIntegration gives the renderer Node's resolver — this works, but each prosemirror-* is a separate package (no single bundle), so you require ~9 packages individually.
- Lexical's public node/transform APIs are explicitly unstable across 0.x; pin the exact version (0.45.0) and don't expect API stability.
- Whatever you pick, the editor model is NOT the page-layout model — see pagination topic; the editor produces a single logical flow, pagination is a separate rendering concern.

## WYSIWYG pagination: discrete fixed-size pages (US Letter/A4) with margins from a contenteditable flow

**Recommendation:** Do NOT try to make contenteditable itself paginate. Use a two-layer model: (1) a single continuous editable flow (the ProseMirror doc / one contenteditable) as the source of truth; (2) a separate non-editable 'page view' renderer that measures the flow and slices it into fixed-size .page elements (US Letter 8.5x11in = 816x1056px @96dpi; A4 = 794x1123px) with CSS padding for margins, styled with box-shadow on a gray canvas. For the one-session build, implement measurement-based pagination: render content into a hidden page-height box, walk block children, and emit a page break (move to next .page) when accumulated height exceeds the content box height. Drive print/export off CSS @page + page-break-before, not off the on-screen slicing.

**Rationale:** Confirmed by the discuss.prosemirror 'Paginated Editing' thread and multiple write-ups (Wax/Hacker News, TOAST UI) that true in-place pagination of contenteditable is effectively a 'near impossible' DOM problem and is why Google Docs/Zoho render their own layout out of the browser's control. The DOM gives you no layout state (you cannot ask 'where does line 3 end' without expensive Range.getBoundingClientRect measurements), and CSS page-break-* is a print-time construct, not an interactive one. The pragmatic, achievable-in-one-session approach is the measure-and-slice page view: fixed pixel page dimensions + getBoundingClientRect height accumulation per block to decide breaks. This is the approach paginated-ProseMirror plugins and 'A4 contenteditable' demos converge on.

**Libraries:** No mature drop-in npm lib is reliable here — hand-roll it.; Reference approaches: prosemirror-pagination-style community plugins (treat as reference, not dependency); CSS only: @page { size: Letter; margin: 1in } + .page { width:816px; min-height:1056px; padding:96px } for the 1in-margin US Letter case

**Pitfalls:**

- Editing inside sliced pages breaks the editor: keep ONE editable flow as source of truth and re-paginate into read-only page DOM, or accept jank. Trying to make each .page independently contenteditable creates cursor-jump and selection-across-pages nightmares.
- Splitting a block (paragraph/table row) across a page boundary mid-element is the genuinely hard part — naive block-level slicing leaves big gaps at page bottoms. Word splits lines within a paragraph; replicating that needs line-box measurement, which is slow and fiddly.
- px<->inch is dpi-dependent. Use 96px/in for screen, but the printed PDF uses real inches via @page — keep the two coordinate systems separate and don't expect pixel-perfect parity between screen pagination and printed pagination.
- Re-pagination on every keystroke is expensive (forced layout/reflow from getBoundingClientRect). Debounce, and paginate incrementally from the changed block forward.
- Tables, images, and headers/footers each need special break handling; for a one-session build, scope to paragraph/heading/list flow first.
- On-screen page breaks will NOT match print breaks unless you drive both from the same CSS; prefer letting Chromium do print pagination via @page for the actual PDF rather than reusing your screen slices.

## .docx round-trip: import (docx->HTML) and export (HTML->docx)

**Recommendation:** Import: mammoth@1.12.0 (require('mammoth').convertToHtml) — confirmed require()-able CJS. Export: pick by need. For an HTML-in/docx-out pipeline that matches your contenteditable content with the least code, use html-to-docx@1.8.0 (TurboDocx fork; require() returns a function — confirmed). For maximum fidelity/control of the output document, use docx@9.7.1 (require('docx') OK via dist/index.umd.cjs) and build the document programmatically from your model. Avoid html-docx-js for cross-app compatibility. Treat .docx round-trip as lossy by design and do not expect byte-perfect fidelity.

**Rationale:** Versions confirmed against npm registry and require() confirmed in a clean CJS sandbox: mammoth 1.12.0 (lib/index.js CJS, BSD-2), html-to-docx 1.8.0 (UMD main, require => function, MIT), docx 9.7.1 (UMD cjs main + actively maintained, MIT). mammoth is the de-facto docx->HTML importer; it intentionally targets semantic HTML driven by Word styles, which pairs well with a ProseMirror schema. html-to-docx is explicitly an html-docx-js successor that fixes the altchunks compatibility problem (html-docx-js wraps HTML in an altChunk that Google Docs/LibreOffice render poorly), so it's the better HTML->docx converter. docx is the gold standard when you control the model and want real Word constructs (sections, styles, headers/footers, page size/margins, tables) rather than HTML-guessed output.

**Libraries:** mammoth@1.12.0 (import docx->HTML; require OK); html-to-docx@1.8.0 (export HTML->docx; require OK; TurboDocx fork); docx@9.7.1 (export model->docx, highest fidelity; require OK via UMD cjs); html-docx-js@0.3.1 (avoid: altChunks => poor LibreOffice/Google Docs compatibility)

**Pitfalls:**

- Round-trip is fundamentally lossy: docx and HTML have mismatched models. mammoth's own docs say complex docs won't convert perfectly and it works best when the source uses Word styles semantically.
- mammoth does NO sanitization of source docx — dangerous with untrusted files; fine for a single-user trusted local app but never on untrusted input.
- mammoth output is an HTML fragment (no <meta charset>), so non-ASCII can render wrong if you drop it into a file without forcing UTF-8.
- mammoth's document-transform API is explicitly unstable across versions — pin 1.12.0.
- mammoth drops/approximates tables, embedded media, columns, text boxes, and exact spacing; you lose layout, keep structure.
- html-to-docx maps a constrained subset of CSS — complex CSS (flex/grid, absolute positioning, custom fonts) won't translate; style with simple block HTML + inline-ish CSS it understands.
- html-docx-js uses Word's altChunks feature: Word opens it but Google Docs/LibreOffice render it badly — this is the specific reason to prefer html-to-docx.
- For best fidelity, don't HTML-convert at all on export: serialize your editor model straight into docx@9.7.1 constructs (Paragraph/TextRun/Table/SectionProperties with pageSize+margins).
- html-to-docx 1.8.0 has a long-stale changelog history; validate output in real Word/LibreOffice before shipping.

## Print to physical printer / PDF in Electron

**Recommendation:** Use webContents.printToPDF(options) for 'Save as PDF' and webContents.print(options, cb) for physical printing. For correct US Letter/A4 page geometry, set pageSize ('Letter'/'A4' or an object with width/height in MICRONS), margins (the modern object form {top,bottom,left,right} in inches, or the legacy marginsType), printBackground:true (so page shadows/fills/colors appear), and landscape as needed. Add displayHeaderFooter + headerTemplate/footerTemplate for page numbers (use the .pageNumber/.totalPages/.title/.date/.url injected classes). Print from a hidden/offscreen BrowserWindow that loads a print-specific stylesheet with @page rules, rather than printing the on-screen paginated editor.

**Rationale:** Confirmed against current Electron webContents docs/issues: printToPDF accepts pageSize (named or microns), landscape, margins, printBackground, pageRanges ('1-5, 8, 11-13'), displayHeaderFooter, headerTemplate, footerTemplate (with class hooks date/title/url/pageNumber/totalPages). printToPDF returns a Promise<Buffer> in modern Electron. Driving print off a dedicated print stylesheet + @page lets Chromium's print engine handle pagination correctly, which is far more reliable than reusing the screen-sliced pages.

**Libraries:** Electron built-in: webContents.printToPDF(options) -> Promise<Buffer>; Electron built-in: webContents.print(options, callback); Use latest Electron stable (Electron 3x line, e.g. 35/36+ in 2025/2026); printToPDF header/footer support is in current versions

**Pitfalls:**

- landscape is IGNORED if the page uses a CSS @page rule — let @page own size/orientation OR use the option, not both conflictingly.
- printBackground defaults to false: without it, page backgrounds/box-shadows/fills won't print, so the PDF won't match the editor.
- headerTemplate/footerTemplate are finicky: they render at a tiny default font, need explicit inline font-size, and the document body margins must leave room or header/footer overlap content — a long-standing source of bugs.
- Custom pageSize is in microns (1 inch = 25400 microns), NOT pixels — a frequent mistake that yields wrong-sized pages.
- Print the actual document at print DPI via @page, not your 96dpi screen slices; screen pagination and print pagination can differ in line/page breaks.
- marginsType is the older API (0 default / 1 none / 2 minimum); the object margins form is clearer — pick one and be consistent.
- webContents.print silent printing/printer selection options vary; if you need a specific printer or silent print, pass deviceName/silent and test on the target OS.

## Electron security posture for a local, trusted, single-user app

**Recommendation:** Recognize the explicit tradeoff: the OFFICIALLY recommended secure baseline is contextIsolation:true, nodeIntegration:false, sandbox:true, with Node access only via a preload script using contextBridge.exposeInMainWorld. For your stated one-session constraint (nodeIntegration + bare require() of CJS npm packages in the renderer), you are deliberately running the INSECURE-by-Electron's-standards config. That is defensible ONLY because: single user, no remote content, only local packaged files loaded, no untrusted input rendered. If you accept that scope, ship nodeIntegration:true + contextIsolation:false to get require() in the renderer for the fast build. The moment the app loads any remote URL, opens untrusted .docx-derived HTML without sanitization, or gains multi-user/network features, migrate to the secure baseline (preload + contextBridge) and move docx/mammoth/file IO into the main process behind IPC.

**Rationale:** Confirmed from Electron's official security tutorial and the long-running defaults discussion (issue #23506): contextIsolation has been on by default since Electron 12 and is recommended for all apps; true isolation requires contextIsolation:true alongside nodeIntegration:false; the canonical pattern exposes only audited functions via contextBridge. The risk that nodeIntegration:true mitigates against is remote/untrusted content escalating to full Node/OS access — a threat that essentially doesn't exist for a single-user app that only ever loads its own bundled local HTML and never renders untrusted markup. So the tradeoff is real and the relaxed posture is justifiable within that narrow envelope, with a clear migration trigger.

**Libraries:** Electron contextBridge + ipcMain/ipcRenderer (the secure path, if/when you migrate); No third-party security lib required; rely on Electron BrowserWindow webPreferences

**Pitfalls:**

- nodeIntegration:true + contextIsolation:false means ANY script the renderer executes has full Node/OS access — one injected/untrusted string of HTML (e.g. from an imported .docx via mammoth, which does NO sanitization) becomes RCE. This is the single biggest risk and directly intersects the docx-import topic.
- If you ever render imported/Word HTML, sanitize it (e.g. DOMPurify) regardless of posture — mammoth explicitly does not sanitize.
- Don't half-migrate: contextIsolation:true with nodeIntegration:true is a known foot-gun; pick a coherent posture.
- Set webPreferences explicitly — defaults changed across Electron majors (contextIsolation default true since 12, sandbox default true since 20), so relying on defaults gives different behavior per Electron version.
- If you relax security for the build, isolate it: never set this window to load external URLs, set a strict CSP, and keep navigation locked to local files (will-navigate / setWindowOpenHandler).
- Plan the IPC seam now even if you ship the relaxed config: keep file open/save, docx import (mammoth) and export (docx/html-to-docx) in functions you can later move to the main process behind contextBridge with minimal refactor.

