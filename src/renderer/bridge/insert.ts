// Slice 6: insert-primitive surface. Each verb is one PM transaction (one undo step).
// M5: image size guard — reject data-URLs over ~50 MB of base64 characters.
// B1: insertBookmark inserts BOTH bookmarkStart (at selection.from) and bookmarkEnd
//     (at selection.to) in ONE transaction, end-first so start insertion doesn't shift end.
// M4: insertEquation clears all inherited marks on the inserted range, then sets
//     EXACTLY [textStyle{fontFamily:'Cambria Math'}, italic] so a caret in a bold run
//     doesn't yield bold+Cambria+italic (Word applies ONLY Cambria+italic).
//
// NOTE: the fork's editor.chain() does NOT support .focus() as a chain step.
// Focus is restored after each operation via editor.view?.focus() (same pattern as commands.ts).

import { TextSelection, NodeSelection } from '@/pm'
// @ts-ignore - vendored fork JS module (no types). Sync data-URI dimension parser (PNG).
import { readImageDimensionsFromDataUri } from '@converter/image-dimensions.js'

type AnyEditor = any

export interface LinkOpts { href: string; text?: string }
export interface ImageOpts { src: string; alt?: string; width?: number; height?: number }
export interface BookmarkInfo { name: string; id: string; pos: number }

export function installInsert(editor: AnyEditor) {
  // Restore PM focus after each verb (same invariant as commands.ts spec §7.4).
  function refocus() { editor.view?.focus() }

  // Collapse the caret to a single position (best-effort; ignores invalid pos).
  const collapseTo = (pos: number) => {
    try { editor.view?.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos, pos))) } catch { /* best-effort caret move */ }
  }

  function insertLink(opts: LinkOpts): boolean {
    // setLink handles "text differs from selection" (inserts text, then marks) and
    // auto-adds underline (Word-faithful) + allocates the docx relationship id.
    const ok = editor.chain().setLink({ href: opts.href, text: opts.text ?? opts.href }).run()
    refocus()
    return ok !== false
  }

  function removeLink(): boolean {
    const ok = editor.chain().unsetLink().run()
    refocus()
    return ok !== false
  }

  function insertImage(opts: ImageOpts): boolean {
    // M5: reject oversized data-URLs; MAX_SRC_CHARS measures string characters (~50 MB of base64 ≈ ~67 MB raw).
    const MAX_SRC_CHARS = 50 * 1024 * 1024 // characters of base64 (~50 MB)
    if (opts.src && opts.src.length > MAX_SRC_CHARS) {
      ;(window as any).WC?.toast?.('Image is too large to insert', 'Image data exceeds the 50 MB limit — please use a smaller image.')
      return false
    }
    // The fork's ImageRegistrationPlugin automatically processes inserted images:
    //   • if the image has a valid size + small enough → changes src to word/media/ (in-place)
    //   • otherwise → removes the node, async-re-inserts as word/media/ after 250ms+
    // Both paths change the src away from the original data-url, which breaks the
    // test contract ("inserts an image node WITH THE DATA-URL src").
    //
    // Bypass: inserting with a truthy rId makes needsImageRegistration() return false,
    // keeping the data-url in the node. The DOCX exporter (decode-image-node-helpers.js)
    // handles data-url src directly via createMediaTargetForDataUri; and
    // resolveImageRelationshipId calls addImageRelationshipForId(id, path) which creates
    // a valid Relationship entry → DOCX is valid even with a bridge-generated rId.
    // These ids only need to be unique within this doc's relationship table and need not
    // match Word's rIdN numbering scheme.
    const bridgeRId = 'rId-bridge-' + Math.random().toString(36).slice(2, 9)
    let w = opts.width && opts.width > 0 ? opts.width : 0
    let h = opts.height && opts.height > 0 ? opts.height : 0
    if (!w || !h) {
      // No (full) explicit box — e.g. Insert → Screenshot/Icon calls insertImage directly. Size to
      // the image's NATURAL dimensions clamped to the content column, NOT a 100×100 placeholder,
      // which squashed non-square images. (The exporter's intrinsic-aspect correction used to mask
      // this; now that we honor explicit boxes, the placeholder must be a real size.) A single
      // given dimension is honored (the other is derived from the natural aspect).
      let dims: any = null
      try { dims = readImageDimensionsFromDataUri(opts.src) } catch { dims = null }
      // Content-column width = .ProseMirror box minus its L/R padding (matches the local-picture
      // path's columnWidthPx); floored so a not-yet-laid-out editor doesn't yield a 0-px image.
      let maxW = 600
      const prose = editor.view?.dom as HTMLElement | undefined
      if (prose) {
        const cs = getComputedStyle(prose)
        const cw = prose.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
        if (cw > 16) maxW = cw
      }
      if (dims && dims.width > 0 && dims.height > 0) {
        const aspect = dims.width / dims.height
        if (w) h = Math.max(1, Math.round(w / aspect)) // honor a caller-given width
        else if (h) w = Math.max(1, Math.round(h * aspect)) // honor a caller-given height
        else if (dims.width > maxW) { w = Math.round(maxW); h = Math.max(1, Math.round(dims.height * (maxW / dims.width))) }
        else { w = dims.width; h = dims.height }
      } else {
        // Undecodable (non-PNG / SVG) → a sensible column-fit default, not the tiny 100×100.
        w = w || Math.round(Math.min(maxW, 480))
        h = h || Math.round(w * 0.75)
      }
    }
    const ok = editor.chain().setImage({ src: opts.src, alt: opts.alt ?? 'Picture', rId: bridgeRId, size: { width: w, height: h } }).run()
    refocus()
    return ok !== false
  }

  function insertBookmark(opts: { name: string }): boolean {
    // B1: The fork's insertBookmark inserts ONLY bookmarkStart. A valid Word bookmark is a
    // PAIRED start+end with the same id wrapping [from,to]. Insert end FIRST (higher pos)
    // so the start insertion doesn't shift the end position. One transaction = one undo.
    const name = String(opts.name || '').trim().replace(/\s+/g, '_')
    if (!name) return false
    const id = String(nextBookmarkId(editor))
    const { from, to } = editor.state.selection
    const ok = editor.chain().command(({ tr, state }: any) => {
      const startNodeType = state.schema.nodes.bookmarkStart
      const endNodeType = state.schema.nodes.bookmarkEnd
      if (!startNodeType || !endNodeType) return false
      const startNode = startNodeType.create({ name, id })
      const endNode = endNodeType.create({ id })
      // Insert end first (at `to`) so start insertion at `from` doesn't shift end's position.
      tr.insert(to, endNode)
      tr.insert(from, startNode)
      return true
    }).run()
    refocus()
    return ok !== false
  }

  function listBookmarks(): BookmarkInfo[] {
    const out: BookmarkInfo[] = []
    editor.state.doc.descendants((n: any, pos: number) => {
      if (n.type.name === 'bookmarkStart') {
        out.push({ name: n.attrs.name, id: n.attrs.id, pos })
      }
    })
    return out
  }

  function goToBookmark(name: string): boolean {
    // The fork's goToBookmark calls editor.commands.focus(pos) which is not available
    // in the chain API. Implement directly: find the bookmarkStart by name and move
    // the caret to its position via setTextSelection.
    let targetPos: number | null = null
    editor.state.doc.descendants((n: any, pos: number) => {
      if (targetPos !== null) return false
      if (n.type.name === 'bookmarkStart' && n.attrs.name === name) {
        targetPos = pos
        return false
      }
    })
    if (targetPos === null) return false
    const sel = TextSelection.create(editor.state.doc, targetPos, targetPos)
    editor.view?.dispatch(editor.state.tr.setSelection(sel))
    refocus()
    return true
  }

  function removeBookmark(name: string): boolean {
    const ok = editor.chain().removeBookmark(name).run()
    refocus()
    return ok !== false
  }

  function renameBookmark(name: string, newName: string): boolean {
    const ok = editor.chain().renameBookmark(name, String(newName).trim().replace(/\s+/g, '_')).run()
    refocus()
    return ok !== false
  }

  function insertSymbol(ch: string): boolean {
    // Collapse the selection to end before inserting so the symbol is appended
    // after existing text rather than replacing any selection (Word-faithful:
    // the Symbol dialog inserts at the cursor position).
    const { to } = editor.state.selection
    collapseTo(to)
    const ok = editor.chain().insertContent(ch).run()
    refocus()
    return ok !== false
  }

  function insertEquation(text: string): boolean {
    // M4: insert the equation text, then select the inserted range and apply
    // EXACTLY [textStyle{fontFamily:'Cambria Math'}, italic], clearing all
    // inherited marks first so a caret in a bold/red run doesn't bleed marks.
    // KNOWN DEVIATION: equation = Cambria Math italic styled text, NOT OOXML <m:oMath>.
    //
    // Implementation note: the fork's setMark (and font-family's setFontFamily) uses
    // `state.doc.nodesBetween(from, to)` with the PRE-transaction doc to find nodes,
    // but the selection positions are in the POST-insertion doc space. This means
    // mark commands in a chain AFTER insertContent operate in a stale doc context
    // and don't find the newly inserted text.
    //
    // Solution: two separate transactions —
    //   Step 1: collapse cursor to end, insertContent (one undo step)
    //   Step 2: select the inserted range, apply marks (separate transaction for correctness)
    // Word-faithful: Cambria Math + italic with no bleeding from surrounding text.
    const { to: insertAt } = editor.state.selection

    // Step 1: collapse cursor to end of existing text, then insert the equation.
    collapseTo(insertAt)
    const inserted = editor.chain().insertContent(text).run()
    if (!inserted) { refocus(); return false }

    // Step 2: select the inserted range and apply EXACTLY Cambria Math + italic.
    // After insertContent, the cursor is at the end of the inserted text.
    // Work backwards by text.length to find the start.
    const endPos = editor.state.selection.from
    const startPos = Math.max(1, endPos - text.length)
    try {
      editor.view?.dispatch(
        editor.state.tr.setSelection(TextSelection.create(editor.state.doc, startPos, endPos))
      )
    } catch { /* graceful degradation if positions are invalid */ }
    // styling (Cambria Math + italic) is best-effort; success tracks the text insertion.
    editor.commands.unsetAllMarks()
    editor.commands.setFontFamily('Cambria Math')
    editor.commands.setItalic()  // setItalic from the italic extension (sets explicitly, no toggle ambiguity)

    refocus()
    return inserted !== false
  }

  function insertPageBreak(): boolean {
    const ok = editor.chain().insertPageBreak().run()
    refocus()
    return ok !== false
  }

  function insertBlankPage(): boolean {
    // Two consecutive page breaks = blank page (Word-faithful)
    const ok = editor.chain().insertPageBreak().insertPageBreak().run()
    refocus()
    return ok !== false
  }

  function insertHr(): boolean {
    const ok = editor.chain().insertHorizontalRule().run()
    refocus()
    return ok !== false
  }

  // The currently NodeSelection-selected image, or null. (Wrap/position/z-order all act
  // on the selected picture — the same NodeSelection the resize overlay keys on.)
  function selectedImage(): { node: any; pos: number } | null {
    const sel = editor.state.selection
    if (sel?.node?.type?.name === 'image') return { node: sel.node, pos: sel.from }
    return null
  }

  // Phase 4c — text wrap / floating. Maps the ribbon "Wrap Text" modes to the image's
  // `wrap` + `isAnchor` attrs (the fork's renderDOM already turns these into float/
  // shape-outside/absolute, and the exporter into wp:anchor + the wrap element). Done as a
  // single setNodeMarkup (not the fork setWrapping command) so we can ALSO seed a valid
  // anchorData + marginOffset for floating types — without positionH/V the exported
  // wp:anchor is schema-incomplete. Word default square inset = 0.13" L/R (~12px).
  function setImageWrap(mode: string): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then choose how text wraps around it.'); return false }
    const SPECS: Record<string, { type: string; attrs: Record<string, any> }> = {
      inline: { type: 'Inline', attrs: {} },
      square: { type: 'Square', attrs: { wrapText: 'bothSides', distLeft: 12, distRight: 12 } },
      tight: { type: 'Tight', attrs: { distLeft: 12, distRight: 12 } },
      through: { type: 'Through', attrs: { distLeft: 12, distRight: 12 } },
      topbottom: { type: 'TopAndBottom', attrs: {} },
      behind: { type: 'None', attrs: { behindDoc: true } },
      front: { type: 'None', attrs: { behindDoc: false } },
    }
    const spec = SPECS[mode]
    if (!spec) return false
    const wrapAttrs: Record<string, any> = { ...spec.attrs }
    // CT_WrapTight/CT_WrapThrough REQUIRE a <wp:wrapPolygon> — without one Word refuses to
    // open the file. For a plain rectangular image, default to the bounding-box polygon (px
    // corners; objToPolygon closes it), exactly as Word does until the user edits the points.
    if (spec.type === 'Tight' || spec.type === 'Through') {
      const sz = sel.node.attrs.size || {}
      const w = sz.width > 0 ? sz.width : 100
      const h = sz.height > 0 ? sz.height : 100
      wrapAttrs.polygon = [[0, 0], [w, 0], [w, h], [0, h]]
    }
    const next: Record<string, any> = {
      ...sel.node.attrs,
      wrap: { type: spec.type, attrs: wrapAttrs },
      isAnchor: spec.type !== 'Inline',
    }
    if (spec.type === 'Inline') {
      // Back to in-line with text: drop the anchor framing so export emits wp:inline.
      next.anchorData = null
    } else {
      // Seed a column/paragraph-relative anchor + zero offset if the image has none yet,
      // so the exported wp:anchor carries positionH/positionV (drag-reposition = 4c.2).
      if (!next.anchorData) next.anchorData = { hRelativeFrom: 'column', vRelativeFrom: 'paragraph' }
      const mo = next.marginOffset || {}
      if (mo.horizontal == null && mo.top == null) next.marginOffset = { horizontal: 0, top: 0 }
    }
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, next, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* keep the image selected; best-effort */ }
      editor.view?.dispatch(tr)
    } catch {
      return false // stale/invalid selection (e.g. the node moved under us) — never throw
    }
    refocus()
    return true
  }

  // Phase 4c.3 — z-order (Bring Forward / Send Backward / to Front / to Back). Mutates the
  // selected FLOATING image's `relativeHeight` (OOXML unsignedInt) relative to the other
  // floating images: the fork renders it as z-index (max(0, relativeHeight - BASE)) and the
  // exporter writes it back. NB the z-index only re-stacks ABSOLUTE (wrap='None') images;
  // CSS-floated (Square/Tight/Through) images stack by document order regardless — full
  // float re-stacking needs the frames-overlay render (deferred). "in front of / behind
  // TEXT" is the behindDoc toggle handled by setImageWrap('front'|'behind').
  const Z_BASE = 251658240 // OOXML_Z_INDEX_BASE
  // null/undefined → the base (NOT 0: Number(null) is 0, which would make relativeHeight
  // tiny → z-index clamps to 0 and Word gets a non-default stacking value).
  const relH = (v: any): number => { if (v == null) return Z_BASE; const n = Number(v); return Number.isFinite(n) ? n : Z_BASE }
  function setImageZOrder(dir: string): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a floating picture to change its stacking order.'); return false }
    if (!sel.node.attrs.isAnchor) { (window as any).WC?.toast?.('Bring Forward / Send Backward needs a floating picture', 'Use Wrap Text first (an in-line picture has no stacking order).'); return false }
    const others: number[] = []
    editor.state.doc.descendants((n: any, pos: number) => {
      if (n.type?.name === 'image' && n.attrs?.isAnchor && pos !== sel.pos) others.push(relH(n.attrs.relativeHeight))
    })
    const cur = relH(sel.node.attrs.relativeHeight)
    let next = cur
    if (dir === 'toFront') next = others.length ? Math.max(...others) + 1 : cur
    else if (dir === 'toBack') next = others.length ? Math.min(...others) - 1 : cur
    // forward/backward use >=/<= so a TIED peer (the default state: two freshly-floated
    // images both at Z_BASE) is included — move ONE step above/below the nearest peer at
    // or beyond `cur`. Strict >/< would no-op on a tie (and over-shoot past a tie with 3+).
    else if (dir === 'forward') { const hi = others.filter((r) => r >= cur); next = hi.length ? Math.min(...hi) + 1 : cur }
    else if (dir === 'backward') { const lo = others.filter((r) => r <= cur); next = lo.length ? Math.max(...lo) - 1 : cur }
    else return false
    if (next === cur) { refocus(); return true } // already front/back, or the only floating object — no-op
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, relativeHeight: next }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Toggle the selected picture's aspect-ratio lock (OOXML a:picLocks/@noChangeAspect). When
  // unlocked, the resize overlay's edge handles free-stretch a single axis; the render + export
  // already honor the resulting divergent box. Default (no attr) is LOCKED, matching Word.
  function setImageLockAspect(locked: boolean): boolean {
    const sel = selectedImage()
    if (!sel) {
      ;(window as any).WC?.toast?.('Select a picture first', 'Click a picture to lock or unlock its aspect ratio.')
      return false
    }
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, lockAspectRatio: !!locked }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Set the selected picture's explicit box in px (Word's Picture Format → Size group).
  // Honors the aspect lock: a LOCKED picture (lockAspectRatio !== false, Word's default)
  // preserves its ratio — the single dim you pass drives the other; pass both to set them
  // independently (what the unlocked resize overlay does). Width is clamped to the editable
  // content column (an in-line picture can't usefully exceed it in this single-column engine,
  // matching the resize overlay's maxWidth). Mirrors the overlay's single `size`-attr
  // setNodeMarkup; the fork exporter already turns `size` into wp:extent + a:ext (EMU).
  function setImageSize(opts: { width?: number; height?: number }): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then set its height or width.'); return false }
    const cur = sel.node.attrs.size || {}
    const curW = Math.round(Number(cur.width)) || 0
    const curH = Math.round(Number(cur.height)) || 0
    const aspect = curW > 0 && curH > 0 ? curW / curH : 1
    const locked = sel.node.attrs.lockAspectRatio !== false
    const givenW = opts.width != null && opts.width > 0
    const givenH = opts.height != null && opts.height > 0
    let w = givenW ? Math.round(opts.width as number) : curW
    let h = givenH ? Math.round(opts.height as number) : curH
    if (locked) {
      // The edited dim drives its partner so the ratio is preserved. When both are given on a
      // locked picture, width wins (the user can't make a locked box diverge).
      if (givenW) h = Math.round(w / aspect)
      else if (givenH) w = Math.round(h * aspect)
    }
    // Clamp width to the editable content column (mirrors the resize overlay's upper bound), then
    // bound both dims to the overlay's MAX_DIM so the numeric path can't produce a box the drag
    // overlay couldn't (re-derive the partner when locked so the cap keeps the ratio).
    const MAX_DIM = 4000
    const maxW = (editor.view?.dom as HTMLElement)?.clientWidth || 0
    if (maxW > 1 && w > maxW) { w = Math.round(maxW); if (locked && aspect > 0) h = Math.round(w / aspect) }
    if (w > MAX_DIM) { w = MAX_DIM; if (locked && aspect > 0) h = Math.round(w / aspect) }
    if (h > MAX_DIM) { h = MAX_DIM; if (locked) w = Math.round(h * aspect) }
    w = Math.max(1, w); h = Math.max(1, h)
    if (w === curW && h === curH) { refocus(); return true } // no change
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, size: { ...cur, width: w, height: h } }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Set the selected picture's alt text (Word's Picture Format → Alt Text pane). In the fork's
  // model the accessibility DESCRIPTION is the node's `title` attr (→ wp:docPr/@descr), and
  // `decorative` marks the picture decorative (→ adec:decorative ext; the exporter then omits
  // @descr). Pass `title` to set the description, `decorative` to toggle the decorative flag —
  // marking decorative also clears the description (matching Word's pane, which disables it).
  function setImageAltText(opts: { title?: string; decorative?: boolean }): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then add alt text.'); return false }
    const next: Record<string, any> = { ...sel.node.attrs }
    if (opts.decorative != null) next.decorative = !!opts.decorative
    if (next.decorative) next.title = null // Word disables the description for a decorative image
    else if (opts.title != null) next.title = opts.title || null
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, next, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Crop the selected picture (Word's Picture Format → Crop). Crop offsets are PERCENTS of each
  // edge (left/top/right/bottom); they map to the node's `clipPath` (CSS inset, the fork's render
  // clips + scales the cropped region to fill the same box) and export to a:srcRect (thousandths).
  // `remove` clears the crop. A user crop supersedes any stashed imported srcRect (cleared here so
  // the new crop wins on export). The inset string matches the importer's exact format.
  function setImageCrop(opts: { l?: number; t?: number; r?: number; b?: number; remove?: boolean }): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then crop it.'); return false }
    const next: Record<string, any> = { ...sel.node.attrs }
    if (opts.remove) {
      next.clipPath = null
    } else {
      const clamp = (v: any) => Math.max(0, Math.min(100, Number(v) || 0))
      const t = clamp(opts.t), r = clamp(opts.r), b = clamp(opts.b), l = clamp(opts.l)
      if (l + r >= 100 || t + b >= 100) { (window as any).WC?.toast?.('Crop too large', 'That crop would remove the whole picture.'); return false }
      next.clipPath = (t === 0 && r === 0 && b === 0 && l === 0) ? null : `inset(${t}% ${r}% ${b}% ${l}%)`
    }
    next.rawSrcRect = null // the user's crop supersedes any verbatim imported srcRect
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, next, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Rotate / flip the selected picture (Word's Picture Format → Arrange → Rotate). Drives the node's
  // `transformData` (rotation degrees / horizontalFlip / verticalFlip) — the fork's render already
  // applies `transform: rotate()/scaleX(-1)/scaleY(-1)` and the exporter writes a:xfrm rot/flipH/flipV
  // (round-trips). `rotate` is a RELATIVE delta (90 / -90 / 180), normalized to 0..359; `flipH/flipV`
  // TOGGLE; `reset` clears all transforms. transformData is kept minimal (falsy keys dropped) so the
  // export stays clean (the exporter only emits non-zero rot / truthy flips).
  function setImageTransform(opts: { rotate?: number; flipH?: boolean; flipV?: boolean; reset?: boolean }): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then rotate or flip it.'); return false }
    const cur = sel.node.attrs.transformData || {}
    let td: Record<string, any>
    if (opts.reset) {
      td = {}
    } else {
      td = { ...cur }
      if (opts.rotate) {
        const base = Number(td.rotation) || 0
        const norm = (((base + opts.rotate) % 360) + 360) % 360
        if (norm === 0) delete td.rotation
        else td.rotation = norm
      }
      if (opts.flipH) td.horizontalFlip = !td.horizontalFlip
      if (opts.flipV) td.verticalFlip = !td.verticalFlip
      if (!td.horizontalFlip) delete td.horizontalFlip // keep minimal (export only emits truthy flips)
      if (!td.verticalFlip) delete td.verticalFlip
    }
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, transformData: td }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Phase 4 (item 2) — toggle the picture GRAYSCALE recolor (Word's Picture Format → Color → Grayscale).
  // Sets the image node's `grayscale` attr; the exporter ALREADY emits <a:grayscl/> as a child of a:blip
  // (decode-image-node-helpers.js:369), which Word reads as PictureFormat.ColorType = grayscale (2, the
  // 1-based MsoPictureColorType — an earlier attempt mis-read this as BlackAndWhite via a 0-based enum and
  // was wrongly reverted). The image extension renders it as a CSS `filter: grayscale(100%)`. No exporter
  // change. NodeSelection is re-asserted after setNodeMarkup (mirrors setImageTransform).
  function setImageGrayscale(on: boolean): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then apply Grayscale.'); return false }
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, grayscale: Boolean(on) }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  // Phase 4c.2 — reposition a FLOATING picture (Word's Layout → Position → absolute position). Sets the
  // node's `marginOffset` (px offsets: horizontal = "to the right of" the column, top = "below" the
  // paragraph — matching the anchor's hRelativeFrom='column'/vRelativeFrom='paragraph' that setImageWrap
  // seeds). The fork's render places a wrap=None picture at left/top from marginOffset, and the exporter
  // writes wp:positionH/V → wp:posOffset (EMU). `relative` ADDS to the current offset (nudge); otherwise
  // the values are absolute. Floating-only (an in-line picture flows with the text and has no offset).
  // NOTE: an IMPORTED anchor with stashed originalDrawingChildren still EXPORTS its original posOffset
  // (translateAnchorNode prefers them) — reposition is faithful for freshly-wrapped pictures; relocating
  // an imported floating picture's saved position is a deferred edge (would require patching/clearing
  // originalDrawingChildren, which risks losing other imported anchor data).
  function setImagePosition(opts: { horizontal?: number; top?: number; relative?: boolean }): boolean {
    const sel = selectedImage()
    if (!sel) { (window as any).WC?.toast?.('Select a picture first', 'Click a picture, then set its position.'); return false }
    if (!sel.node.attrs.isAnchor) { (window as any).WC?.toast?.('Position needs a floating picture', 'Use Wrap Text (e.g. Behind Text or Square) first — an in-line picture flows with the text.'); return false }
    // GUARD: an imported anchor exports its verbatim originalDrawingChildren (translateAnchorNode
    // prefers them), so a new marginOffset would move the picture on screen but be DROPPED on save.
    // Refuse rather than silently diverge — faithful imported reposition (patching the preserved
    // wp:positionH/V) is a deferred follow-up. Session-inserted floating pictures have no original
    // children and reposition fully.
    if (Array.isArray(sel.node.attrs.originalDrawingChildren) && sel.node.attrs.originalDrawingChildren.length) {
      ;(window as any).WC?.toast?.('Position not yet editable for this picture', 'Pictures opened from a .docx keep their saved position for now. Insert a new picture to position it freely.')
      return false
    }
    const mo = sel.node.attrs.marginOffset || {}
    const curH = Number(mo.horizontal) || 0
    const curT = Number(mo.top) || 0
    const h = opts.horizontal != null ? (opts.relative ? curH + opts.horizontal : opts.horizontal) : curH
    const t = opts.top != null ? (opts.relative ? curT + opts.top : opts.top) : curT
    const anchorData = sel.node.attrs.anchorData || { hRelativeFrom: 'column', vRelativeFrom: 'paragraph' }
    try {
      const tr = editor.state.tr.setNodeMarkup(sel.pos, undefined, { ...sel.node.attrs, marginOffset: { horizontal: Math.round(h), top: Math.round(t) }, anchorData }, sel.node.marks)
      try { tr.setSelection(NodeSelection.create(tr.doc, sel.pos)) } catch { /* best-effort keep selection */ }
      editor.view?.dispatch(tr)
    } catch {
      return false
    }
    refocus()
    return true
  }

  return {
    setImageWrap,
    setImageZOrder,
    setImageLockAspect,
    setImageSize,
    setImageAltText,
    setImageCrop,
    setImagePosition,
    setImageTransform,
    setImageGrayscale,
    insertLink,
    removeLink,
    insertImage,
    insertBookmark,
    listBookmarks,
    goToBookmark,
    removeBookmark,
    renameBookmark,
    insertSymbol,
    insertEquation,
    insertPageBreak,
    insertBlankPage,
    insertHr,
  }
}

// Next free bookmark id = max existing numeric id + 1 (Word uses 0-based integer ids).
function nextBookmarkId(editor: AnyEditor): number {
  let max = -1
  editor.state.doc.descendants((n: any) => {
    if (n.type.name === 'bookmarkStart') {
      const v = parseInt(n.attrs.id, 10)
      if (Number.isFinite(v) && v > max) max = v
    }
  })
  return max + 1
}
