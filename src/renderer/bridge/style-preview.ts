// PM-native styles-gallery hover preview (slice 3): apply on hover as a throwaway
// transaction, restore the exact prior EditorState on leave. The legacy mechanism
// (innerHTML snapshot/restore, ribbon.js stylePreview*) has no PM analogue — and the
// restore MUST go through the Editor wrapper: the fork double-books state in a
// private _state field (Editor.ts:607; `get state()` 1709-1711) that only
// #dispatchTransaction/setState write. A raw view.updateState would restore the VIEW
// only — the next dispatch then applies against the stale preview _state and throws
// RangeError('Applying a mismatched transaction'). editor.setState (Editor.ts:
// 1758-1763) sets _state AND the view, and emits nothing.
//
// TRAP: NEVER route the preview through editor.commands.* — the CommandService
// dispatches its own tr WITH history. We build the tr ourselves and reuse the
// engine's applier (applyLinkedStyleToTransaction, exported via
// linked-styles/index.js → helpers.js).
import { applyLinkedStyleToTransaction } from '@extensions/linked-styles/index.js'

type AnyEditor = any

export const PREVIEW_META = 'wcStylePreview'

export function installStylePreview(editor: AnyEditor) {
  // Snapshot = the authoritative editor state PLUS the converter metadata the
  // docChanged path mutates (documentModified/documentGuid live on the converter,
  // OUTSIDE EditorState — Editor.ts:3205-3214 — so setState alone can't revert them).
  let snap: { state: any; documentModified: any; documentGuid: any } | null = null

  function restore() {
    if (!snap) return
    editor.setState(snap.state) // restores _state AND the view (see header note)
    if (editor.converter) {
      editor.converter.documentModified = snap.documentModified
      editor.converter.documentGuid = snap.documentGuid
    }
    snap = null
    // setState emits NOTHING (documented) — this dispatch exists to fire the
    // 'transaction' event (emitted on EVERY dispatch, docChanged or not), which is
    // what schedules state-sync's rAF tick so toggles/highlight re-read the restored
    // state. Do NOT remove it: setState alone leaves the ribbon frozen on preview
    // state. docChanged=false → no 'update' event → dirty untouched; applies cleanly
    // (prevState === snap.state).
    editor.view?.dispatch(editor.view.state.tr.setMeta(PREVIEW_META, true))
  }

  function stylePreviewEnter(styleId: string): boolean {
    // Hop contract: ALWAYS restore a live preview first (covers a missed mouseleave),
    // THEN evaluate the new cell — an unresolvable style must never strand the
    // previous cell's preview.
    restore()
    const view = editor.view
    if (!view || !styleId) return false
    const style = editor.helpers?.linkedStyles?.getStyleById?.(styleId)
    if (!style) return false
    snap = {
      state: editor.state,
      documentModified: editor.converter?.documentModified,
      documentGuid: editor.converter?.documentGuid,
    }
    const tr = editor.state.tr
    tr.setMeta('addToHistory', false) // prosemirror-history: never an undo step
    tr.setMeta(PREVIEW_META, true)    // io.ts dirty guard
    if (!applyLinkedStyleToTransaction(tr, editor, style)) { snap = null; return false }
    view.dispatch(tr)
    return true
  }

  // Real input mid-preview must WIN: the gallery never blurs the view (cells
  // preventDefault mousedown; focus.ts guards #ribbon), so a keystroke can land on
  // top of the preview — cancel it BEFORE the input applies or the leave-restore
  // would silently discard the user's edit (real Word drops the preview on typing
  // too). Capture phase = ahead of PM's own handlers. Listeners die with the editor
  // view on replaceEditor — same lifecycle as every install* binding.
  editor.view?.dom?.addEventListener('keydown', () => { if (snap) restore() }, true)
  editor.view?.dom?.addEventListener('beforeinput', () => { if (snap) restore() }, true)

  return {
    stylePreviewEnter,
    stylePreviewLeave: () => restore(),
    // Click path: restore FIRST, then the caller (Commands.applyStyle) applies for
    // real through the normal path — one clean history transaction from the
    // pre-preview state.
    stylePreviewCommitRestore: () => restore(),
  }
}
