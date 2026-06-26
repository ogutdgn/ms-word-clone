# Insert Tab — Feature Status

_Mixed completeness — most controls work, but several are stubs (Shapes, SmartArt, live Chart, Signature Line, 3D Models, Online Pictures). See [docs/bug-hunt/INSERT-COMPLETENESS.md](bug-hunt/INSERT-COMPLETENESS.md) for the authoritative per-control state._

## Pages

- ✅ gallery of 6 cover-page designs + Remove — **Cover Page**
- ✅ — **Blank Page**
- ✅ — **Page Break**

## Tables

- ✅ live grid + Insert Table dialog + Convert Text to Table (real bridge verb + "Separate text at" dialog) + right-click editing (insert/delete rows&cols, merge, split, delete table) — **Table** (Excel Spreadsheet sub-item is a ❌ stub — no OLE runtime)

## Illustrations

- 🟡 This Device inserts; Online Pictures is a no-op toast (no backend); Stock Images absent — **Pictures**
- ❌ gallery present, inserts nothing — auto-shape engine pending — **Shapes**
- ✅ searchable icon picker -> inline SVG — **Icons**
- 🟡 documented (no 3D runtime) — **3D Models**
- ❌ gallery present, inserts nothing — SmartArt diagram engine pending — **SmartArt**
- 🟡 Column/Bar/Line/Pie from entered data -> **static** chart image (interim; a live `c:chartSpace` + embedded workbook is a separate subsystem, not yet built) — **Chart**
- ✅ Screen Clipping via desktopCapturer — **Screenshot**

## Add-ins

- 🟡 documented (no Office.js runtime) — **Get Add-ins**
- 🟡 documented — **My Add-ins**

## Media

- 🟡 clickable thumbnail (embedded playback sandboxed) — **Online Video**

## Links

- ✅ — **Link**
- ✅ add/go-to/delete — **Bookmark**
- 🟡 to headings/bookmarks; only 2 of ~7 reference types exposed and Page-number emits the wrong field (REF \p above/below, not PAGEREF — BUG-013) — **Cross-reference**

## Comments

- ✅ — **Comment**

## Header & Footer

- 🟡 plain-text Edit Header modal only — no built-in gallery, no Remove — **Header**
- 🟡 plain-text Edit Footer modal only — no gallery/preset, no Remove — **Footer**
- 🟡 Top/Bottom/Current + Remove only; no Format Page Numbers dialog, no Page Margins, Current can't target body caret — **Page Number**

## Text

- 🟡 insert only — no built-in gallery; "Draw Text Box" is a no-op alias of Simple — **Text Box**
- 🟡 6 field shortcuts only — no Building Blocks Organizer, AutoText, or Ctrl+F9 — **Quick Parts**
- ✅ style gallery — **WordArt**
- 🟡 None/Dropped/In Margin; "Drop Cap Options..." absent, lines hard-coded to 3 — **Drop Cap**
- ❌ toast-only, inserts nothing — signature-line object pending — **Signature Line**
- ✅ format dialog + working "Update automatically" (unchecked = static text, checked = DATE field) — **Date & Time**
- 🟡 Text from File (OLE embedding documented) — **Object**

## Symbols

- 🟡 gallery + dialog insert Cambria-Math-italic styled TEXT, not real OOXML `<m:oMath>`; Ink Equation, Save-to-Gallery, Alt+= unimplemented — **Equation**
- 🟡 quick grid + 6 fixed subsets; no Font selector, no code-point entry, Special Characters tab absent — **Symbol**

## Known approximations

- **Header/Footer** are painted per-page by the paged engine (`header-footer.ts:295-296`); the prior "appear once on screen" note predated the paged migration.
- **3D Models**, **OLE Object embedding**, **Online Pictures search**, **cloud Add-ins**, and **embedded video playback** are documented stubs (no runtime/backend).
