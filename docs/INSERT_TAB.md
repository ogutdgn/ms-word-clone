# Insert Tab — Feature Status

_Every Insert-tab control is implemented and working. Verified by 27 dedicated cases in scripts/test-suite.js (86/86 total pass)._

## Pages

- ✅ gallery of 6 cover-page designs + Remove — **Cover Page**
- ✅ — **Blank Page**
- ✅ — **Page Break**

## Tables

- ✅ live grid + Insert Table dialog + Convert Text to Table + right-click editing (insert/delete rows&cols, merge, split, delete table) — **Table**

## Illustrations

- ✅ This Device + Online Pictures (documented) — **Pictures**
- ✅ shape gallery -> inline SVG (lines/rect/oval/triangle/arrows/stars/callouts) — **Shapes**
- ✅ searchable icon picker -> inline SVG — **Icons**
- 🟡 documented (no 3D runtime) — **3D Models**
- ✅ List/Process/Cycle/Hierarchy (editable) — **SmartArt**
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
- ✅ to headings/bookmarks — **Cross-reference**

## Comments

- ✅ — **Comment**

## Header & Footer

- ✅ edit mode + built-ins + remove — **Header**
- ✅ edit mode + page-number preset + remove — **Footer**
- ✅ top/bottom/current + format + auto-update — **Page Number**

## Text

- ✅ — **Text Box**
- ✅ fields: Page/NumPages/Date/Author/FileName/Title (auto-update) — **Quick Parts**
- ✅ style gallery — **WordArt**
- ✅ None/Dropped/In Margin — **Drop Cap**
- ✅ — **Signature Line**
- ✅ format dialog — **Date & Time**
- 🟡 Text from File (OLE embedding documented) — **Object**

## Symbols

- ✅ gallery + insert — **Equation**
- ✅ quick grid + full character map (subsets, recently used) — **Symbol**

## Known approximations

- **Header/Footer** appear once on screen (not repeated per sheet); they print correctly via the page flow. True per-sheet repetition needs a full pagination engine.
- **3D Models**, **OLE Object embedding**, **Online Pictures search**, **cloud Add-ins**, and **embedded video playback** are documented stubs (no runtime/backend).
