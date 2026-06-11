// Slice 8: review surface — track changes + comments + view modes on the PM engine.
// Plan: docs/superpowers/plans/2026-06-11-phase2-slice-8-review.md (amendments A2/A3/A5-A7).
//
// A2: comments are driven through the DOCUMENT API (editor.doc.comments.*), NEVER the raw
//     fork commands — raw addComment only marks the selection and EMITS the content
//     (default no-op), addCommentReply/editComment are event-only, resolveComment never
//     stamps isDone, and export reads converter.comments, which raw commands never write.
//     The Document API path (document-api-adapters/plan-engine/comments-wrappers.ts) runs
//     the command AND upserts the entity store (=== converter.comments), so in-session
//     comments survive export/reimport.
// A3: view modes are fork-native ×3 + clone chrome ×1 — All Markup resets BOTH plugin
//     flags via disableTrackChangesShowOriginal (the SHOW_ONLY_ORIGINAL apply branch zeroes
//     onlyModifiedShown too, trackChangesBasePlugin.js:45-53); Original/No Markup are
//     enableTrackChangesShowOriginal/enableTrackChangesShowFinal; Simple Markup is the SAME
//     engine state as No Markup plus the clone-owned 'review-simple' container class, so the
//     'simple' vs 'none' distinction is latched bridge-side.
// Accept/reject go through the fork's review-decision commands (their dispatchReviewDecision
// path sets skipTrackChanges) — hand-rolled tr surgery would be re-tracked by Editor.ts's
// protectsExistingTrackedReviewState rewrite (Editor.ts:3119-3125) even with tracking off.
import { TextSelection } from '@/pm'
import { TrackChangesBasePluginKey } from '@extensions/track-changes/plugins/index.js'
import { CommentsPluginKey } from '@extensions/comment/comments-plugin.js'
import { getTrackChanges } from '@extensions/track-changes/trackChangesHelpers/getTrackChanges.js'
import { TrackInsertMarkName, TrackDeleteMarkName, TrackFormatMarkName } from '@extensions/track-changes/constants.js'
import { CommentMarkName } from '@extensions/comment/comments-constants.js'

type AnyEditor = any

export type ReviewView = 'all' | 'simple' | 'none' | 'original'

export interface ReviewState {
  tracking: boolean
  view: ReviewView
  engineFlags: { onlyOriginalShown: boolean; onlyModifiedShown: boolean }
  activeCommentId: string | null
}

export interface RevisionRow { id: string; author: string; type: 'insert' | 'delete' | 'format' | 'comment'; text: string }
// `date` = entity-store createdTime (epoch ms; null when absent) — the cards UI
// renders it in Word's "June 11, 2026 at 5:22 AM" format (task 4 / parity C3).
export interface CommentReply { id: string; author: string; text: string; date: number | null }
export interface CommentRow { id: string; importedId: string | null; author: string; text: string; date: number | null; resolved: boolean; active: boolean; replies: CommentReply[] }

const REVISION_TYPE: Record<string, RevisionRow['type']> = {
  [TrackInsertMarkName]: 'insert',
  [TrackDeleteMarkName]: 'delete',
  [TrackFormatMarkName]: 'format',
}

export function installReview(editor: AnyEditor, baseCmd: (name: string, ...args: unknown[]) => boolean) {
  // Restore PM focus after each verb (same invariant as commands.ts spec §7.4).
  const refocus = () => editor.view?.focus()

  const tcState = () => { try { return TrackChangesBasePluginKey.getState(editor.state) || null } catch { return null } }
  const cmPluginState = () => { try { return (CommentsPluginKey as any).getState(editor.state) || null } catch { return null } }

  // Bridge-side view latch (A3): 'simple' and 'none' are the SAME engine state
  // (onlyModifiedShown) — the distinction lives here, never in the plugin.
  let view: ReviewView = 'all'

  function reviewState(): ReviewState {
    const s = tcState() as any
    return {
      tracking: s?.isTrackChangesActive === true,
      view,
      // ENGINE truth (A3) — the fork TrackChangesBasePlugin flags, never an echo of `view`.
      engineFlags: {
        onlyOriginalShown: s?.onlyOriginalShown === true,
        onlyModifiedShown: s?.onlyModifiedShown === true,
      },
      activeCommentId: cmPluginState()?.activeThreadId ?? null,
    }
  }

  function setReviewView(mode: ReviewView): boolean {
    let ok: boolean
    if (mode === 'original') ok = editor.commands.enableTrackChangesShowOriginal() !== false
    else if (mode === 'none' || mode === 'simple') ok = editor.commands.enableTrackChangesShowFinal() !== false
    else if (mode === 'all') ok = editor.commands.disableTrackChangesShowOriginal() !== false // resets BOTH flags
    else return false
    view = mode
    // Clone-owned Simple Markup chrome flag (changed-line bars/balloons land in task 5).
    document.getElementById('pm-editor')?.classList.toggle('review-simple', mode === 'simple')
    refocus()
    return ok
  }

  // ---- tracked-change ranges: one row per contiguous same-id, same-type range ----
  type ChangeRange = { id: string; type: string; author: string; from: number; to: number; text: string }
  function changeRanges(): ChangeRange[] {
    let entries: Array<{ mark: any; node?: any; from: number; to: number }> = []
    try { entries = getTrackChanges(editor.state) || [] } catch { /* state not readable */ }
    const ranges: ChangeRange[] = []
    for (const { mark, node, from, to } of [...entries].sort((a, b) => a.from - b.from)) {
      const id = String(mark.attrs?.id ?? '')
      const text = (node?.isText ? node.text : node?.textContent) ?? ''
      const last = ranges[ranges.length - 1]
      if (last && last.id === id && last.type === mark.type.name && from <= last.to) {
        last.to = Math.max(last.to, to)
        last.text += text
      } else {
        ranges.push({ id, type: mark.type.name, author: String(mark.attrs?.author ?? ''), from, to, text })
      }
    }
    return ranges
  }

  // ---- comment anchors in document order (marks; commentRangeStart for resolved) ----
  type CommentAnchor = { id: string; from: number; to: number }
  function commentAnchors(): CommentAnchor[] {
    const byId = new Map<string, CommentAnchor>()
    try {
      editor.state.doc.descendants((node: any, pos: number) => {
        for (const m of node.marks || []) {
          if (m.type.name !== CommentMarkName) continue
          const id = m.attrs?.commentId || m.attrs?.importedId
          if (!id) continue
          const ex = byId.get(id)
          if (ex) { ex.from = Math.min(ex.from, pos); ex.to = Math.max(ex.to, pos + node.nodeSize) }
          else byId.set(id, { id, from: pos, to: pos + node.nodeSize })
        }
        // Resolved comments keep only commentRangeStart/End anchor nodes (marks removed).
        if (node.type.name === 'commentRangeStart') {
          const id = node.attrs?.['w:id']
          if (id && !byId.has(id)) byId.set(id, { id, from: pos, to: pos + node.nodeSize })
        }
      })
    } catch { /* doc not readable */ }
    return [...byId.values()].sort((a, b) => a.from - b.from)
  }

  // ---- comments via the Document API (A2) ----
  function getComments(): CommentRow[] {
    let items: any[] = []
    try { items = editor.doc.comments.list()?.items ?? [] } catch { return [] }
    const active = cmPluginState()?.activeThreadId ?? null
    // A2/MAJOR-5 filter: the converter projects TRACKED CHANGES into the comments
    // store as trackedChange===true rows — surfacing them here would grow phantom
    // comments on every export→open round-trip.
    const real = items.filter((it) => it.trackedChange !== true)
    const roots = real.filter((it) => !it.parentCommentId)
    return roots.map((it) => ({
      id: String(it.id),
      importedId: it.importedId != null ? String(it.importedId) : null,
      author: String(it.creatorName ?? ''),
      text: String(it.text ?? ''),
      date: typeof it.createdTime === 'number' ? it.createdTime : null,
      resolved: it.status === 'resolved',
      active: active != null && (active === it.id || active === it.importedId),
      replies: real
        .filter((r) => r.parentCommentId === it.id)
        .map((r) => ({
          id: String(r.id),
          author: String(r.creatorName ?? ''),
          text: String(r.text ?? ''),
          date: typeof r.createdTime === 'number' ? r.createdTime : null,
        })),
    }))
  }

  // Reviewing-pane provider (D8.4/T11): tracked changes + comment threads merged
  // in document order.
  function getRevisions(): RevisionRow[] {
    const rows: Array<RevisionRow & { pos: number }> = []
    for (const c of changeRanges()) {
      rows.push({ id: c.id, author: c.author, type: REVISION_TYPE[c.type] ?? 'format', text: c.text, pos: c.from })
    }
    const anchorPos = new Map(commentAnchors().map((a) => [a.id, a.from]))
    for (const c of getComments()) {
      rows.push({ id: c.id, author: c.author, type: 'comment', text: c.text, pos: anchorPos.get(c.id) ?? Number.MAX_SAFE_INTEGER })
    }
    rows.sort((a, b) => a.pos - b.pos)
    return rows.map(({ pos: _pos, ...row }) => row)
  }

  // ---- caret helpers ----
  const setCaret = (pos: number): boolean => {
    try {
      editor.view?.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)))
      refocus()
      return true
    } catch { return false }
  }

  // Word parity (A2): a comment from a collapsed caret anchors EXACTLY the containing
  // word. The fork's addComment hard-requires a non-collapsed selection, so expand first.
  // The caret's immediate parent is the fork's inline `run` wrapper (not the paragraph),
  // and run boundaries add PM tokens without text chars \u2014 so climb to the TEXTBLOCK
  // ancestor and walk per-character PM positions instead of doing offset arithmetic.
  function expandCaretToWord(): boolean {
    const { from, empty } = editor.state.selection
    if (!empty) return true
    const $pos = editor.state.doc.resolve(from)
    let depth = $pos.depth
    while (depth > 0 && !$pos.node(depth).isTextblock) depth--
    if (!$pos.node(depth).isTextblock) return false
    const chars: Array<{ ch: string; pos: number }> = []
    editor.state.doc.nodesBetween($pos.start(depth), $pos.end(depth), (node: any, pos: number) => {
      if (!node.isText || !node.text) return
      for (let i = 0; i < node.text.length; i++) chars.push({ ch: node.text[i], pos: pos + i })
    })
    const isWord = (ch: string) => /[\p{L}\p{N}_]/u.test(ch)
    let idx = chars.findIndex((c) => c.pos >= from)
    if (idx < 0) idx = chars.length
    let a = idx
    let b = idx
    while (a > 0 && isWord(chars[a - 1].ch)) a--
    while (b < chars.length && isWord(chars[b].ch)) b++
    if (a === b) return false // caret not inside/adjacent to a word
    try {
      editor.view?.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, chars[a].pos, chars[b - 1].pos + 1)))
      return true
    } catch { return false }
  }

  // SHADOWS the raw fork command name (bridge resolution wins — see installBridge).
  function addComment(text: string): boolean {
    if (typeof text !== 'string' || !text.trim()) return false
    if (!expandCaretToWord()) return false
    try {
      const target = editor.doc.selection.current()?.target
      if (!target) return false
      const r = editor.doc.comments.create({ text, target })
      refocus()
      return r?.success === true
    } catch { return false }
  }

  function replyComment(parentId: string, text: string): boolean {
    if (!parentId || typeof text !== 'string' || !text.trim()) return false
    try {
      const r = editor.doc.comments.create({ text, parentCommentId: String(parentId) })
      refocus()
      return r?.success === true
    } catch { return false }
  }

  // SHADOWS the raw fork name — the Document API patch stamps isDone/resolvedTime
  // in the entity store (the raw command never does).
  function resolveComment(id: string): boolean {
    if (!id) return false
    try {
      const r = editor.doc.comments.patch({ commentId: String(id), status: 'resolved' })
      refocus()
      return r?.success === true
    } catch { return false }
  }

  // SHADOWS the raw fork editComment (event-only — A2): the Document API patch
  // runs the command AND updates the entity store, so the edit survives export.
  // Consumed by the cards UI's inline edit pencil (task 4 / parity C3).
  function editComment(id: string, text: string): boolean {
    if (!id || typeof text !== 'string' || !text.trim()) return false
    try {
      const r = editor.doc.comments.patch({ commentId: String(id), text })
      refocus()
      return r?.success === true
    } catch { return false }
  }

  function deleteComment(id: string): boolean {
    if (!id) return false
    try {
      const r = editor.doc.comments.delete({ commentId: String(id) })
      refocus()
      return r?.success === true
    } catch { return false }
  }

  // SHADOWS the raw fork name (same engine command, but argument-normalized: the raw
  // command takes an options object). NO refocus: focusing the view can dispatch a DOM
  // selection-sync transaction whose position-based detection overwrites the
  // just-activated thread (see comments-plugin.js setCursorById note).
  function setActiveComment(id: string | null): boolean {
    try { return editor.commands.setActiveComment({ commentId: id ?? null }) !== false } catch { return false }
  }

  // ---- review decisions (fork review-decision commands ONLY — see header) ----
  const changeIdAtCaret = (): string | null => {
    const pos = editor.state.selection.from
    const hit = changeRanges().find((c) => pos >= c.from && pos <= c.to)
    return hit ? hit.id : null
  }

  function acceptChange(): boolean {
    const id = changeIdAtCaret()
    if (!id) return false
    const ok = editor.commands.acceptTrackedChangeById(id) !== false
    refocus()
    return ok
  }

  function rejectChange(): boolean {
    const id = changeIdAtCaret()
    if (!id) return false
    const ok = editor.commands.rejectTrackedChangeById(id) !== false
    refocus()
    return ok
  }

  function acceptSelection(): boolean {
    const ok = editor.commands.acceptTrackedChangeBySelection() !== false
    refocus()
    return ok
  }

  function rejectSelection(): boolean {
    const ok = editor.commands.rejectTrackedChangeOnSelection() !== false
    refocus()
    return ok
  }

  function acceptAll(): boolean {
    const ok = editor.commands.acceptAllTrackedChanges() !== false
    refocus()
    return ok
  }

  function rejectAll(): boolean {
    const ok = editor.commands.rejectAllTrackedChanges() !== false
    refocus()
    return ok
  }

  // ---- group-split navigation (A4): Changes Prev/Next ≠ Comments Prev/Next ----
  function nextChange(): boolean {
    const ranges = changeRanges()
    if (!ranges.length) return false
    const pos = editor.state.selection.from
    const next = ranges.find((c) => c.from > pos) ?? ranges[0] // wrap
    return setCaret(next.from)
  }

  function prevChange(): boolean {
    const ranges = changeRanges()
    if (!ranges.length) return false
    const pos = editor.state.selection.from
    const prev = [...ranges].reverse().find((c) => c.to < pos) ?? ranges[ranges.length - 1] // wrap
    return setCaret(prev.from)
  }

  function nextComment(): boolean {
    const anchors = commentAnchors()
    if (!anchors.length) return false
    const pos = editor.state.selection.from
    const next = anchors.find((a) => a.from > pos) ?? anchors[0] // wrap
    if (!setCaret(next.from)) return false
    setActiveComment(next.id) // cards/list UI follows the caret jump
    return true
  }

  function prevComment(): boolean {
    const anchors = commentAnchors()
    if (!anchors.length) return false
    const pos = editor.state.selection.from
    const prev = [...anchors].reverse().find((a) => a.to < pos) ?? anchors[anchors.length - 1] // wrap
    if (!setCaret(prev.from)) return false
    setActiveComment(prev.id)
    return true
  }

  // ---- cmd registry: bridge names resolve FIRST, raw fork names fall through ----
  const reviewCmds: Record<string, (...args: any[]) => boolean> = {
    setReviewView: (mode: ReviewView) => setReviewView(mode),
    acceptChange, rejectChange, acceptSelection, rejectSelection, acceptAll, rejectAll,
    nextChange, prevChange,
    addComment: (text: string) => addComment(text),
    replyComment: (id: string, text: string) => replyComment(id, text),
    editComment: (id: string, text: string) => editComment(id, text),
    resolveComment: (id: string) => resolveComment(id),
    deleteComment: (id: string) => deleteComment(id),
    setActiveComment: (id: string | null) => setActiveComment(id),
    nextComment, prevComment,
  }

  function cmd(name: string, ...args: unknown[]): boolean {
    const fn = reviewCmds[name]
    if (fn) return fn(...args) !== false
    return baseCmd(name, ...args)
  }

  return { cmd, reviewState, setReviewView, getRevisions, getComments }
}
