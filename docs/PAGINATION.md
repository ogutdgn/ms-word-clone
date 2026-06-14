# Pagination Engine

> ⚠️ **RETIRED ENGINE — historical reference.** Everything below describes the
> **legacy `contenteditable` pagination engine** (`WC.Editor.repaginate()` in the old
> `editor.js`), which was **removed in slice 11** along with the rest of the legacy world.
> It is kept here because the *geometry* (US-Letter 816×1056 @96dpi, 1″ margins, the
> ~26-Aptos-12-lines-per-page calibration validated against real Word) and the page-sheet
> CSS still inform the current design.
>
> **Current state (single PM world):** the document is a **ProseMirror editor** mounted
> at `#pm-editor` rendered into a **continuous-flow page sheet** (`.page` in
> `src/renderer/public/styles/editor.css`; geometry vars in `.../styles/base.css`). There
> is **no `repaginate()` engine today** — real, model-driven multi-page sheets (line-level
> splitting, per-sheet headers/footers, page-number fields) are **Phase-4-gated** (the
> pagination / layout engine; re-sequenced 2026-06-14 from old "Phase 7 / last"), to be
> rebuilt as an owned PM decoration/plugin validated against the oracle (see
> [docs/decisions/](decisions/) C1 and `docs/plan/deferrals.md` class A). The rest of this
> document is the prior art for that work.

---

## 1. The single-contenteditable model

There is exactly **one** editable surface: `#editor`. It is a single
`contenteditable` element that holds the entire document flow. The clone does
**not** create a separate DOM node per page. Instead, page sheets are an
*illusion* painted on top of one continuous flow:

- `#editor` has `min-height: var(--page-h)` and is styled as a white sheet with a
  shadow (`src/renderer/styles/editor.css`), so an empty document already looks
  like one page.
- Margins are realized as `padding: var(--page-margin)` on `#editor` — there is
  no inner content box; the padding *is* the margin.
- When content overflows a page, `repaginate()` injects **in-flow gap spacers**
  (see §5) that push the following lines down by exactly one inter-page gap plus
  two margins, so the flow visually reads as page 1, gap, page 2, gap, ….

This single-flow design is what makes the engine hard: a page break can land in
the **middle of a paragraph**, even in the middle of an unbreakable string, so
the engine cannot just break between block elements — it has to find the exact
line and split there.

---

## 2. Page geometry

Geometry comes from CSS custom properties (`src/renderer/styles/base.css`),
read at runtime by `pageMetrics()`:

```css
--page-w: 816px;     /* US Letter @96dpi  (8.5in × 96) */
--page-h: 1056px;    /*                   (11in  × 96) */
--page-margin: 96px; /* 1in */
--page-gap: 14px;    /* gray space between sheets */
```

`pageMetrics()` (`editor.js`) derives the working numbers:

```js
pageMetrics() {
  const cs = getComputedStyle(document.documentElement);
  const margin = parseFloat(cs.getPropertyValue('--page-margin')) || 96;
  const gap    = parseFloat(cs.getPropertyValue('--page-gap'))    || 14;
  const pageH  = this.pageH;                       // 1056 (portrait)
  const contentH = Math.max(48, pageH - 2 * margin);   // 864
  return { margin, gap, pageH, contentH, pitch: pageH + gap };
}
```

| Quantity   | Value (Letter portrait) | Meaning                                   |
|------------|-------------------------|-------------------------------------------|
| `pageH`    | `1056`                  | full sheet height                         |
| `margin`   | `96`                    | top = bottom margin (also left/right)     |
| `contentH` | `864`                   | usable text height = `pageH - 2*margin`   |
| `gap`      | `14`                    | gray band drawn between two sheets        |
| `pitch`    | `1070`                  | `pageH + gap` — center-to-center stride between pages |

`contentH` is clamped to a `Math.max(48, …)` floor: if a user sets margins ≥ half
the page height, the content height would go to zero or negative and the spacer
loop would run away inserting infinite pages. The floor keeps at least one line
of usable height.

`this.pageH` is **not** hard-wired to 1056. Orientation and paper size flip it:
the Layout tab handlers in `commands.js` set both the `--page-w`/`--page-h` CSS
vars **and** `E().pageH`, then call `repaginate()` — e.g. Landscape does
`E().pageH = 816`. So all the math above re-derives for the active paper.

### 2.1 Validated against real Word via COM

The line height was not guessed — it was **validated against a live Microsoft
Word instance over COM automation**. Word fits about **26 single-line Aptos-12
paragraphs per page**. The clone's default font is Aptos 12pt (`#editor`
`font-size: 12pt`), but **Aptos is proprietary and unavailable on Linux**, so a
substitute font from the fallback chain (`Calibri`, `Carlito`, `Segoe UI`, …)
renders more compactly. To compensate, the body paragraph line height is bumped
so a page holds the same ~26 lines as real Word:

```css
#editor          { line-height: 1.15; }
#editor p        { margin: 0 0 8pt; line-height: 1.4; }  /* tuned to match Word */
```

The `line-height: 1.4` on `#editor p` is the calibration constant: with the
fallback font it reproduces Word's per-page line count even though the exact
glyphs differ. This is a deliberate approximation — see §11.

---

## 3. The repaginate entry point

`repaginate()` is a re-entrancy guard around `_repaginate()`:

```js
repaginate() {
  if (this._repaginating) return this._pageCount || 1;
  this._repaginating = true;
  try { return this._repaginate(); }
  catch (e) { console.warn('repaginate failed:', e); return this._pageCount || 1; }
  finally { this._repaginating = false; }
},
```

The guard matters because `_repaginate()` mutates the DOM, and those mutations
fire `input`/`selectionchange` listeners that would otherwise call back into
`repaginate()` mid-pass. Any thrown error is swallowed and the last good page
count is returned, so a layout glitch can never crash typing.

`repaginate()` is called on virtually every mutation: debounced `input`
(80 ms — `WC.debounce` in `init()`), after every `exec()`/`insertHTML`/inline-
and block-style apply, on `setHTML()`, on `setView()`, and after images decode
(`setHTML` re-paginates `img.onload` so image-heavy docs don't undercount).

---

## 4. What counts as content (and what is excluded)

`_repaginate()` defines `isContent(n)` to decide which children participate in
the height calculation. It **excludes** everything that is not part of the normal
text flow:

```js
const isContent = (n) => n && n.nodeType === 1 && n.tagName !== 'svg' &&
  !(n.classList && (
    n.classList.contains('wc-header')   || n.classList.contains('wc-footer') ||
    n.classList.contains('wc-page-border') ||
    n.classList.contains('ink-layer')   ||   // SVG draw overlay
    n.classList.contains('wc-page-gap') ||   // our own spacers
    n.classList.contains('manual-break')||
    n.classList.contains('wc-gap-band')));
```

Why each exclusion:

- **`svg` / `.ink-layer`** — the Draw-tab ink overlay is `position: absolute`
  (`editor.css`: `#editor .ink-layer { position: absolute; … }`). Absolutely
  positioned nodes have an `offsetTop` of `0`/`NaN`, which previously broke the
  single-page fast path (a `NaN` comparison). They don't define page height, so
  they're skipped.
- **`.wc-header` / `.wc-footer` / `.wc-page-border`** — chrome, not body flow.
- **`.wc-page-gap` / `.manual-break` / `.wc-gap-band`** — the engine's *own*
  layout artifacts. They must be excluded so a re-run measures real content, not
  the spacers a previous run inserted.

---

## 5. The in-flow gap spacers

A page break is rendered by inserting a spacer element directly into the flow.
There are two kinds, but both produce the same visual: **bottom margin + gray gap
band + top margin**, full sheet width.

- **`<span class="wc-page-gap" contenteditable="false">`** — an automatic break.
  It is a `<span>` specifically so it can sit **mid-paragraph**, between two
  lines of the same `<p>`, via `Range.insertNode`.
- **`<div class="manual-break">`** — a user-inserted hard break (§9).

Their CSS (`editor.css`) makes them span the *full sheet width* even though
`#editor` has 96px padding, using negative margins to bleed out past the padding:

```css
.wc-page-gap, .manual-break {
  display: block;
  position: relative;
  width: calc(100% + 2 * var(--page-margin));
  margin-left:  calc(-1 * var(--page-margin));
  margin-right: calc(-1 * var(--page-margin));
  background: transparent;     /* transparent body → white margins show through */
  pointer-events: none;
  user-select: none;
}
```

The spacer body is **transparent**, so the white sheet's bottom and top margins
show through. The gray gap itself is painted by a child band:

```css
.wc-gap-band {
  position: absolute; left: 0; right: 0;
  background: var(--canvas);   /* #E6E6E6 — same gray as the canvas */
  box-shadow: 0 -6px 7px -4px rgba(0,0,0,.18),
              0  6px 7px -4px rgba(0,0,0,.18);  /* shadows = two sheet edges */
  z-index: 2;
}
```

The band's `box-shadow` paints the drop-shadows of the **bottom edge of the page
above** and the **top edge of the page below**, so the seam reads as two
discrete sheets. The band is added by the `addBand(parent, offY)` helper, which
positions it at the gap's vertical offset inside the spacer and gives it the gap
height.

### Spacer height math

For a break that ends page `p`, the spacer height is set so the next line lands
exactly at the top of page `p+1`'s content area:

```js
const sheetBottom     = (pg) => pg * pitch + pageH;            // visual bottom of sheet pg
const nextContentTop  = (pg) => margin + (pg + 1) * pitch;     // content top of page pg+1
…
sp.style.height = Math.max(gap, nextContentTop(p) - lineTop) + 'px';
addBand(sp, sheetBottom(p) - lineTop);
```

`nextContentTop(p) - lineTop` is "distance from where this line currently sits to
where the next page's content should start" — i.e. bottom margin + gap + top
margin. The band is placed at `sheetBottom(p) - lineTop` (the gap's position
relative to the spacer's own top). `Math.max(gap, …)` guards against a negative
height.

---

## 6. The single-page fast path

The most common case — a short document on one page while the user types — must
be cheap and, critically, must **not touch the caret**. `_repaginate()` short-
circuits before any DOM surgery:

```js
const hasArtifacts = !!node.querySelector('.wc-page-gap, .manual-break, .pagebreak-guide');
let lastFlow = null;
for (let i = node.children.length - 1; i >= 0; i--)
  { if (isContent(node.children[i])) { lastFlow = node.children[i]; break; } }
const contentBottom = lastFlow ? lastFlow.offsetTop + lastFlow.offsetHeight : 0;
if (printView && !hasArtifacts && contentBottom <= margin + contentH + 2) {
  this._pageCount = 1;
  …
  return 1;
}
```

Key points:

- Content height is measured from the **last flow child's**
  `offsetTop + offsetHeight`, *not* `node.scrollHeight`. `scrollHeight` is
  inflated by `#editor`'s one-page `min-height`, so it would always read ≥ 1056
  and never trigger the fast path.
- The fast path deliberately does **not** call `node.normalize()` and does
  **not** save/restore the caret. Doing either while the user is mid-line would
  yank the caret (e.g. back to the end of the previous line). On the slow path,
  caret save/restore is required *because* of the surgery — but here there is no
  surgery, so the caret is left untouched.
- It only applies in **print view** with **no existing artifacts**. If a previous
  pass left spacers (or a manual break exists), the engine must run the full pass
  to rebuild or remove them.

---

## 7. The full pagination pass

When the fast path doesn't fire, `_repaginate()`:

1. **Captures the caret** by absolute character offset (`_caretCharOffset()`,
   §8) — *before* touching the DOM.
2. **Tears down prior artifacts**: removes all `.pagebreak-guide` and
   `.wc-page-gap` nodes, resets every `.manual-break` to `height: 0` and strips
   its bands, then `node.normalize()` to rejoin text nodes that a previous pass
   split with `Range.insertNode`.
3. **Continuous views bail early**: Web / Draft / Outline / Read are continuous
   flows with no sheets, so the page count is just
   `Math.ceil(node.scrollHeight / pageH)`; the caret is restored and the function
   returns. (CSS hides any stale spacers in these views — see the
   `view-web .wc-page-gap { display: none }` rules.)
4. **Sweeps top-to-bottom** with a `while (guard++ < 600)` loop (the guard caps
   runaway pagination at 600 pages), inserting one spacer per page boundary.
5. **Restores the caret** with `_setCaretCharOffset(caretOff)` and returns
   `p + 1`.

Per iteration, `boundaryY = margin + p*pitch + contentH` is the content bottom of
page `p`. The loop then:

1. **Checks for a manual break** on this page first (§9) — it ends the page
   earlier than the automatic boundary.
2. If `node.scrollHeight <= boundaryY + 2`, nothing overflows → **done**.
3. Otherwise finds the block that **straddles** the boundary (top above, bottom
   below) or, failing that, the first block entirely **below** it (`nextBlock`).
4. Inserts a `wc-page-gap` span and sizes it (§5).

### Line-level splitting via binary search

When a block straddles the boundary, the engine must find the precise character
at which to break — Word never leaves a half-line dangling off the page. It
binary-searches the character offset whose line bottom still fits:

```js
const txt = straddle.textContent, len = txt.length;
let lo = 0, hi = len, best = 0;
while (lo <= hi) {
  const mid = (lo + hi) >> 1;
  const b = bottomAt(straddle, mid, eTop);      // content-coord bottom of run [0..mid]
  if (b != null && b <= boundaryY) { best = mid; lo = mid + 1; } else hi = mid - 1;
}
```

`bottomAt(block, charOff, eTop)` builds a `Range` from the block start to the DOM
position of `charOff` (mapped via `domPos`, a `TreeWalker` over text nodes) and
reads `range.getBoundingClientRect().bottom`, converted to content coordinates
(`(rect.bottom - eTop) / zoom`). So the search is over **real rendered line
positions**, accounting for zoom.

**Word-boundary snapping**: the split is nudged back to the previous whitespace
so a word is never cut in half — but only if a boundary exists:

```js
let splitOff = Math.min(best + 1, len);
let snapOff  = splitOff;
while (snapOff > 0 && snapOff < len && !/\s/.test(txt[snapOff - 1])) snapOff--;
if (snapOff > 0) splitOff = snapOff;
```

**Char-level fallback**: a single unbroken string (e.g. `"testtesttest…"`) has no
whitespace, so `snapOff` walks all the way to `0`; the `if (snapOff > 0)` guard
then keeps the raw character-level `splitOff`. This matches Word, which also
breaks a too-long unbreakable string character-by-character. CSS
`overflow-wrap: break-word` / `word-wrap: break-word` on `#editor` is what makes
that string wrap at the margin in the first place (instead of running off the
sheet), which is also what lets pagination split it.

The spacer is then inserted at the computed DOM position:

```js
const pos = domPos(straddle, splitOff);
const r = document.createRange();
try { r.setStart(pos.node, pos.offset); r.collapse(true); r.insertNode(sp); }
catch (e) { straddle.parentNode.insertBefore(sp, straddle.nextSibling); }
```

**Unsplittable guard**: after insertion, if the spacer landed at or above the top
of the current page (`lineTop <= margin + p*pitch + 1`), the block can't actually
be split here (e.g. a single giant element). The spacer is removed, `p` is
advanced, and the loop continues — preventing an infinite zero-progress loop.

---

## 8. Caret preservation by absolute character offset

The DOM surgery (inserting/removing spacer nodes, `normalize()`) would destroy a
caret stored as a `(node, offset)` pair — the very nodes it points into get
split, merged, or removed. So the engine stores the caret as an **absolute
character offset** from the start of `#editor`, which is invariant to all of
that (the spacers are empty/zero-width and `normalize()` only rejoins text).

`_caretCharOffset()` measures both ends of the selection:

```js
_caretCharOffset() {
  const sel = window.getSelection();
  if (!sel.rangeCount || !this.node.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0);
  const measure = (cont, off) => {
    const pre = document.createRange();
    pre.selectNodeContents(this.node);
    try { pre.setEnd(cont, off); } catch (e) { return null; }
    return pre.toString().length;          // chars before this point
  };
  return { start: measure(r.startContainer, r.startOffset),
           end:   measure(r.endContainer,   r.endOffset) };
}
```

It captures the **full selection** (start *and* end), not just a collapsed caret,
so a highlighted range survives repagination intact.

`_posAtOffset(off)` walks the text nodes to convert an offset back to a
`(node, offset)`, and `_setCaretCharOffset(o)` rebuilds the `Range`:

```js
_setCaretCharOffset(o) {
  if (!o) return;
  const s = this._posAtOffset(o.start);
  const e = o.end === o.start ? s : this._posAtOffset(o.end);
  if (!s || !e) return;
  try {
    const r = document.createRange();
    r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r); this.saveRange();
  } catch (err) {}
}
```

Note the offset math counts **only text characters** — the empty spacer spans
contribute zero text, so adding or removing them never shifts the offset. This is
the linchpin that lets the engine rewrite the page layout on every keystroke
without the caret ever jumping.

---

## 9. Manual page breaks and blank pages

Users insert hard breaks from the Insert/Layout menus
(`src/renderer/js/commands.js`):

```js
function insertPageBreak() {
  E().insertHTML('<div class="manual-break" contenteditable="false" '
    + 'style="break-after:page;page-break-after:always"></div><p><br></p>');
}
function insertBlankPage() {
  E().insertHTML('<div class="manual-break blank-page" contenteditable="false" '
    + 'style="break-after:page;page-break-after:always"></div><p><br></p>');
}
```

Each inserts a zero-height `.manual-break` marker plus a fresh empty paragraph.
The marker carries `break-after:page` / `page-break-after:always` purely so that
**PDF export** (`main.js` → `webContents.printToPDF`) paginates at the same spots
the screen does — Chromium's print engine honors those properties even though the
on-screen layout is driven by the spacer height.

In `_repaginate()`, a manual break is detected *before* the automatic boundary
each iteration. It is grown to fill the rest of the current page (and, for a
`blank-page`, an additional full page):

```js
const blank = mb.classList.contains('blank-page');
let hgt = nextContentTop(p) - mbTop; if (blank) hgt += pitch;
mb.style.height = Math.max(gap, hgt) + 'px';
addBand(mb, sheetBottom(p) - mbTop);
if (blank) addBand(mb, sheetBottom(p) - mbTop + pitch);   // second seam for the blank sheet
p += blank ? 2 : 1;
```

So `insertPageBreak()` advances one page; `insertBlankPage()` advances two (the
inserted blank sheet plus the page the following content starts on) and paints
two gap bands.

---

## 10. Stripping artifacts on save (`getHTML` / `setHTML`)

The spacers and bands are **layout-only**; they must never reach a saved file.
`getHTML()` clones the editor and scrubs them:

```js
getHTML() {
  const clone = this.node.cloneNode(true);
  clone.querySelectorAll('.pagebreak-guide,.wc-page-gap,.wc-gap-band,.find-hit')
    .forEach((n) => {
      if (n.classList.contains('find-hit')) n.replaceWith(...n.childNodes); // unwrap, keep text
      else n.remove();
    });
  // Don't bake the computed manual-break height into the file — it is recomputed
  // on load; break-after:page still drives PDF pagination.
  clone.querySelectorAll('.manual-break').forEach((b) => { b.style.height = ''; });
  return clone.innerHTML.replace(/​/g, '');   // also strip zero-width spacer chars
}
```

- Automatic `.wc-page-gap` spacers and their `.wc-gap-band`s are **removed
  entirely** — they're recomputed on the next `repaginate()`.
- `.find-hit` highlights are **unwrapped** (text kept, wrapper dropped).
- `.manual-break` nodes are **kept** (they are real document structure), but their
  *computed height is cleared* so the file stores a clean zero-height marker; the
  height is recomputed on load while `break-after:page` continues to drive PDF
  pagination.
- The zero-width-space sentinel (`U+200B`, used by inline-style helpers) is
  stripped from the output.

`setHTML(html)` does the inverse on load: it injects the HTML (defaulting to
`<p><br></p>` so there's always at least one paragraph), wires up `img.onload` to
re-paginate once images decode, then calls `repaginate()` to rebuild all the
spacers from scratch. Because the artifacts are reconstructed deterministically
from geometry, the save/load round-trip is lossless for layout.

---

## 11. Page lookup helpers

Two helpers map a vertical position back to a page number, both using the same
formula `floor((y - margin) / pitch) + 1`, clamped to `[1, pageCount]`:

- **`currentPage()`** — page of the caret. Reads the selection's bounding rect;
  if it's the empty `(0,0,0,0)` rect a collapsed caret often returns, it falls
  back to the containing element's rect.
- **`pageOfElement(el)`** — page of an arbitrary element by its own position
  (used by headers/footers, fields, comments to know which page they sit on).

Both convert client coordinates to content coordinates by subtracting
`#editor`'s top and dividing by `this.zoom`.

---

## 12. Known approximations

- **Line-height calibration, not font fidelity.** Because Aptos is unavailable on
  Linux, page breaks match Word's *line count* (~26 single-line paragraphs/page)
  via the `#editor p { line-height: 1.4 }` constant rather than true Aptos
  metrics. With a different substitute font installed, the per-page count can
  drift slightly.
- **Word-boundary snapping is whitespace-only.** It snaps to the previous ASCII
  whitespace (`/\s/`); it does not implement full Unicode line-breaking (no
  hyphenation, no break-opportunity after `-`/`/`, no CJK rules). A long
  no-space string falls back to a raw character split.
- **Block-internal granularity.** Splitting is line-accurate *within* a single
  block's text, but the engine treats a straddling block as one text run; it does
  not separately handle widow/orphan control, "keep with next", or table-row
  splitting across pages.
- **600-page guard.** Pagination hard-stops at 600 pages (the `while` guard).
- **`scrollHeight`-based count in continuous views.** Web/Draft/Outline/Read
  report `ceil(scrollHeight / pageH)`, an estimate that ignores margins and
  manual breaks (those views have no real sheets anyway).
- **Re-entrancy + debounce.** Pagination runs on an 80 ms debounce and is
  guarded against re-entry, so the displayed page count can lag a keystroke by up
  to one debounce interval.
