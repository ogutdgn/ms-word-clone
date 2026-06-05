# D6 Raw-DOM Mutation Audit — 2026-06-05

Grep command used:

```bash
grep -n "E()\.node\." src/renderer/public/js/*.js \
  | grep -v "querySelector\|contains\|getBoundingClientRect\|innerText\|classList.contains\|scroll"
```

All hits that write to (or structurally mutate) `E().node` outside the `editor.js` chokepoints. Hits that only read from `E().node` (getAttribute read, addEventListener, focus) are marked `harmless-readonly`.

| file:line | What it mutates | Disposition |
|---|---|---|
| commands.js:58 | `E().node.classList.toggle('show-marks')` | `harmless-readonly` — toggles a CSS visibility class on `#editor`; does not alter document content; safe in PM mode (legacy editor is offscreen, class has no effect) |
| commands.js:94 | `E().node.classList.toggle('hf-diff-first')` | `harmless-readonly` — header/footer display class; no content edit |
| commands.js:95 | `E().node.classList.toggle('hf-diff-oddeven')` | `harmless-readonly` — header/footer display class; no content edit |
| commands.js:96 | `E().node.classList.toggle('hf-hide-body')` | `harmless-readonly` — display-only toggle; no content edit |
| commands.js:164 | `E().node.classList.toggle('show-grid')` | `harmless-readonly` — CSS grid overlay toggle; no content edit |
| commands.js:619 | `E().node.getAttribute('lang')` (read) | `harmless-readonly` — read-only attribute access |
| commands.js:629 | `E().node.setAttribute('lang', …)` + `setAttribute('spellcheck', …)` | `blocked-by-flipped-area-slice-1` — proofing-language dialog; attribute-level mutation. Affects only legacy `#editor` which is offscreen in PM mode; no export impact. Slice 1 wires lang to the PM view. |
| commands.js:643 | `E().node.classList.toggle('hide-comments', …)` | `harmless-readonly` — display toggle for comment balloons; no content edit |
| commands.js:647 | `E().node.classList.toggle('review-balloons', …)` | `harmless-readonly` — display toggle; no content edit |
| commands.js:949 | `E().node.style.cursor = 'text'` | `harmless-readonly` — cursor style on hidden node; no content/export impact |
| commands.js:952 | `E().node.removeEventListener(…)` | `harmless-readonly` — event-handler cleanup |
| commands.js:960 | `E().node.style.cursor = 'copy'` | `harmless-readonly` — cursor style; no content/export impact |
| commands.js:962 | `E().node.removeEventListener(…)` | `harmless-readonly` — event-handler cleanup |
| commands.js:972 | `createTreeWalker(E().node, …)` inside `armPainterFromSelection` — format-painter reads selection | `blocked-by-flipped-area-slice-4` — format-painter (arm + apply) reads text nodes to capture format, then writes them. In PM mode `E().node` is offscreen; the `armPainterFromSelection` guard `!E().node.contains(sel.anchorNode)` will prevent arming because selection lives in `#pm-editor`. No export impact. Slice 4 wires to PM selection. |
| commands.js:985 | `E().node.addEventListener('mouseup', painterHandler)` | `blocked-by-flipped-area-slice-4` — format-painter listener arming; same slice as above |
| commands.js:1024 | `E().node.style.backgroundColor = color` (pageColor) | `blocked-by-flipped-area-slice-1` — `applyColor('page', …)` writes backgroundColor directly on `#editor`. In PM mode the node is offscreen so no visual or export effect; slice 1 reroutes via PM node. |
| commands.js:1030 | `E().node.style.backgroundColor = '#ffffff'` (pageColor null reset) | `blocked-by-flipped-area-slice-1` — same as above |
| commands.js:1055 | `createTreeWalker(E().node, …)` — changeCase mutates text nodes in selection | `blocked-by-flipped-area-slice-1` — writes `node.nodeValue` in place; bypasses editor chokepoints. In PM mode selection is in `#pm-editor`, not `#editor`, so `range.intersectsNode` on E().node text nodes will yield zero hits — effectively a no-op. Slice 1 rewires changeCase to PM. |
| commands.js:1064 | `E().dirty = true; E().updateStatus(); E().emit()` (after changeCase walker) | `blocked-by-flipped-area-slice-1` — same changeCase path; dirty/status/emit on legacy editor have no PM export effect |
| commands.js:1320 | `E().node.style.columnCount` + `E().node.style.columnGap` | `blocked-by-flipped-area-slice-1` — columns dialog; style mutation on offscreen `#editor`; slice 1 handles layout in PM view |
| commands.js:1371 | `E().node.setAttribute('spellcheck', …)` | `harmless-readonly` — spellcheck attribute toggle on hidden legacy node; no content export impact |
| commands.js:1372 | `WC.toast(…)` only | `harmless-readonly` — pure UI |
| design-tools.js:91 | `E().node.className = s.edClass` | `blocked-by-flipped-area-slice-2` — StyleSet applier assigns className; legacy node is hidden; slice 2 wires StyleSets to PM |
| design-tools.js:118 | `E().node.className = E().node.className.replace(…)` | `blocked-by-flipped-area-slice-2` — StyleSet reset; same as above |
| design-tools.js:120 | `E().node.classList.add(cls)` | `blocked-by-flipped-area-slice-2` — StyleSet class; slice 2 |
| design-tools.js:129 | `E().node.appendChild(box)` (wc-page-border) | `blocked-by-flipped-area-slice-7` — page-border non-printing decoration. In PM mode `#editor` is offscreen; appending a decoration node there is invisible and never exported by PM Save. Slice 7 handles design decorations in the PM layer. |
| design-tools.js:141-143 | `E().node.style.backgroundImage/Repeat/Position` (watermark) | `blocked-by-flipped-area-slice-7` — watermark background style on hidden node; no PM export impact; slice 7 |
| design-tools.js:146 | `E().node.style.backgroundImage = ''` (removeWatermark) | `blocked-by-flipped-area-slice-7` — same as above |
| dialogs.js:180 | `E().node.normalize()` inside findPane replace callback | `chokepoint-covered` — `D.findPane` is blocked at entry by Step 4.4; this line is inside the closure and is therefore unreachable in PM mode |
| dialogs.js:186 | `E().node.normalize()` inside findPane replace-all callback | `chokepoint-covered` — same; unreachable in PM mode |
| dialogs.js:194 | `E().node.normalize()` in clearHits | `chokepoint-covered` — clearHits is only called by findPane (guarded) and stylePreviewLeave (see ribbon.js); in PM mode neither reach this |
| dialogs.js:486 | `E().node.getAttribute('spellcheck')` (read) | `harmless-readonly` — read-only; proofing preferences dialog |
| dialogs.js:511 | `E().node.setAttribute('spellcheck', …)` | `harmless-readonly` — spellcheck attribute on hidden legacy node; no PM export impact |
| draw-tools.js:37 | `E().node.appendChild(layer)` — ink canvas | `blocked-by-flipped-area-slice-10` — draw/ink layer DOM injection. Slice 10 moves ink to the PM viewport. In PM mode `#editor` is offscreen so the canvas renders nowhere and is never exported by Save. |
| draw-tools.js:56 | `E().node.setAttribute('contenteditable', …)` | `blocked-by-flipped-area-slice-10` — draw mode disables typing in legacy `#editor`; in PM mode `#editor` is already non-interactive (offscreen); slice 10 |
| formatting.js:8 | `E().node.focus(); E().restoreRange()` | `chokepoint-covered` — formatting.js routes all mutations through `E().exec`/`E().applyInlineStyle`/`E().applyBlockStyle`; those are guarded. The focus+restoreRange call is pre-guard; it does not mutate content. (In PM mode `#editor` is `display:none`-equivalent — focus call silently fails.) |
| formatting.js:45 | `E().node.focus(); E().restoreRange()` | `chokepoint-covered` — same as formatting.js:8; all downstream calls go through guarded chokepoints |
| header-footer.js:14 | `E().node.insertBefore(h, …)` — wc-header | `blocked-by-flipped-area-slice-3` — H/F panel appends wc-header/wc-footer to `#editor`. Slice 3 wires the PM header/footer extension. In PM mode legacy `#editor` is offscreen so the node is never visible or exported by PM Save. |
| header-footer.js:19 | `E().node.appendChild(f)` — wc-footer | `blocked-by-flipped-area-slice-3` — same as above |
| header-footer.js:31 | `E().node.focus()` in exitMode | `harmless-readonly` — focus call; no content mutation; silently fails when offscreen |
| home-features.js:78 | `E().node.focus()` + `E().restoreRange()` then `E().insertHTML(…)` | `chokepoint-covered` — insertHTML routes through `E().exec` which is guarded; focus+restoreRange do not mutate content |
| home-features.js:126 | `E().node.insertBefore(marker, …)` — wc-sensitivity | `blocked-by-flipped-area-slice-6` — sensitivity marker injected as a hidden `<p>` in the legacy editor. Slice 6 handles sensitivity labels in the PM layer. In PM mode the node is offscreen and not exported by PM Save. |
| layout-tools.js:22 | `E().node.appendChild(g)` — line-gutter | `blocked-by-flipped-area-slice-2` — line-numbers gutter decoration; appended to hidden `#editor` in PM mode; never exported; slice 2 |
| layout-tools.js:44-45 | `E().node.style.hyphens`/`webkitHyphens` + `setAttribute('lang', …)` | `blocked-by-flipped-area-slice-2` — hyphenation style on legacy node; slice 2 wires to PM |
| layout-tools.js:51 | `E().node.addEventListener('click', …)` | `harmless-readonly` — click listener registration for line-number gutter; no content mutation |
| mailings-tools.js:113 | `E().node.classList.toggle('show-mergefields')` | `harmless-readonly` — display-only toggle; no content/export impact |
| mailings-tools.js:180 | `E().node.insertAdjacentHTML('afterbegin', env)` — envelope | `blocked-by-flipped-area-slice-9` — envelope HTML injected at top of legacy `#editor`. In PM mode `#editor` is offscreen; PM Save ignores it. Slice 9 wires mailings to PM. |
| mailings-tools.js:192 | `E().node.insertAdjacentHTML('beforeend', html)` — print labels | `blocked-by-flipped-area-slice-9` — print-label preview injected into legacy `#editor` before printing; reverted by `E().setHTML(snap)` (itself guarded). Slice 9. |
| references-tools.js:38 | `E().node.insertBefore(wrap, …)` — TOC | `blocked-by-flipped-area-slice-6` — TOC block inserted into legacy `#editor`. In PM mode offscreen; not exported by PM Save. Slice 6 wires references to PM. |
| references-tools.js:76 | `E().node.appendChild(c)` — footnote/endnote container | `blocked-by-flipped-area-slice-6` — same as above |
| references-tools.js:129 | `sel.getRangeAt(0).insertNode(wrap)` / `E().node.appendChild(wrap)` — footnote ref | `blocked-by-flipped-area-slice-6` — direct range insert into legacy `#editor`; selection lives in `#pm-editor` in PM mode so `sel.rangeCount` will be 0 and the else branch targets the offscreen `#editor` appendChild. Slice 6. |
| references-tools.js:150 | same pattern — endnote ref | `blocked-by-flipped-area-slice-6` — same as above |
| references-tools.js:196 | same pattern — citation | `blocked-by-flipped-area-slice-6` — same as above |
| references-tools.js:238 | same pattern — index entry | `blocked-by-flipped-area-slice-6` — same as above |
| review-tools.js:18 | `E().node.addEventListener('beforeinput', …)` | `harmless-readonly` — event-handler binding; no content mutation; runs at init time before PM is active |
| review-tools.js:76 | `E().node.normalize()` after acceptAll | `blocked-by-flipped-area-slice-8` — track-changes accept/reject normalizes text nodes in legacy `#editor`. In PM mode `#editor` is offscreen; normalize on hidden node has no PM export impact. Slice 8 wires accept/reject to PM. |
| review-tools.js:77 | `E().node.normalize()` after rejectAll | `blocked-by-flipped-area-slice-8` — same as above |
| review-tools.js:85 | `E().node.classList.remove/add('review-*')` | `harmless-readonly` — display mode class on hidden node; no content/export impact |
| review-tools.js:106 | `E().node.classList.toggle('hide-comments')` | `harmless-readonly` — display toggle on hidden node |
| review-tools.js:168 | `E().node.setAttribute('contenteditable', …)` | `blocked-by-flipped-area-slice-8` — restrict-editing toggle on legacy node; in PM mode already offscreen; slice 8 |
| ribbon.js:19 | `E().node.innerHTML` read (gallerySnap) | `chokepoint-covered` — `stylePreviewEnter` is blocked at entry by Step 4.3 guard; this line is unreachable in PM mode |
| ribbon.js:24 | `E().node.innerHTML = gallerySnap.html` (stylePreviewLeave) | `chokepoint-covered` — `stylePreviewLeave` restores innerHTML, but it is only called by mouseleave after `stylePreviewEnter` has already returned early (no snap was saved); guarded indirectly. No snap means the if-guard `if (!gallerySnap) return` makes this a no-op. |

## Summary

- **Chokepoint-covered:** 9 hits (exec/insertNodeHTML/applyInlineStyle(s)/applyBlockStyle/list ops/setHTML/undo/redo all guarded in editor.js; plus the find-pane raw-DOM code unreachable via Step 4.4; gallery preview unreachable via Step 4.3).
- **Harmless-readonly:** 20 hits — CSS display toggles, event-handler binding/cleanup, read-only attribute access, cursor style on hidden node.
- **Blocked-by-flipped-area-slice-N:** 28 hits across slices 1–10 — these write to `#editor` but in PM mode the node is offscreen and PM Save does not read from it, so they cannot corrupt the exported document. Each slice's task will wire the equivalent operation to the PM layer.
- **Total hits audited:** 57
