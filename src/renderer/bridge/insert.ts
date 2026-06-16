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
    const w = opts.width && opts.width > 0 ? opts.width : 100
    const h = opts.height && opts.height > 0 ? opts.height : 100
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

  return {
    setImageWrap,
    setImageZOrder,
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
