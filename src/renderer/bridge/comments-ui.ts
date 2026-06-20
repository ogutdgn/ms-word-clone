// Slice 8 task 4 (D8.3): Word-style modern comments UI on the PM engine.
// Plan: docs/superpowers/plans/2026-06-11-phase2-slice-8-review.md (+ amendment A2);
// parity contract: .oracle-probes/slice8/parity.md C1-C12 (captures word-ref/01-06).
//
// Three clone-owned DOM surfaces, fed by the fork comments plugin + the bridge:
//   1. CONTEXTUAL margin overlay (#wc-comments-overlay, inside #pages so it scrolls
//      and zoom-scales with the page): one collapsed GLYPH per unresolved thread at
//      its anchor line (C7); the ACTIVE thread expands to a full card (C3/C5) with
//      author header, text, timestamp, threaded replies, Reply input and per-comment
//      actions ("..." menu / edit pencil / like chip).
//   2. COMPOSER card (C1/C2): WC.CommentsUI.compose() opens it at the caret anchor --
//      "Start a conversation" placeholder, "Tip: Press Ctrl+Enter to post." line,
//      post (disabled until text) + close. Posting drives the bridge 'addComment'
//      cmd (A2 Document API path; the bridge expands a collapsed caret to its word).
//   3. LIST pane (C10): right-docked "Comments" taskpane (legacy pane shell classes)
//      with collapse/close header, New button, "N items" count, filter icon and the
//      same card component stacked in document order.
//
// Content comes from WC.PM.getComments() (entity-store projection -- A2); geometry
// comes from the plugin's 'comment-positions' events (anchor start positions) with
// a render-time view.coordsAtPos so cards track the LIVE layout (plan section 5
// store-anchor-drift note). Re-render triggers: 'commentsUpdate' +
// 'comment-positions' + 'transaction', debounce-coalesced.
//
// PM-ONLY by construction: installCommentsUI is called from installBridge AFTER its
// legacyBoot early-return, so none of this DOM ever exists under --legacy, and the
// legacy WC.Comments pane (public/js/comments.js) is never touched.
//
// Reactions (C4): SESSION-ONLY module map. comments.patch validates an allowlist of
// mutation fields (text/target/status/isInternal -- document-api comments.ts
// PATCH_COMMENT_ALLOWED_KEYS), so there is no metadata slot to persist a reaction;
// OOXML round-trip of reactions is the recorded ledger-C deviation (D8.3).

type AnyEditor = any
type ViewMode = 'contextual' | 'list'

import { CommentMarkName } from '@extensions/comment/comments-constants.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

// ---- module singletons (installCommentsUI re-runs on Open/New -- see install) ----
let editor: AnyEditor = null
let viewMode: ViewMode = 'contextual'
let positions: Record<string, { start: number; end: number }> = {}
const reactions = new Map<string, number>() // session-only (ledger C -- see header)
let composerOpen = false
let composerAnchor = 1
let composerDraft = ''
let editingId: string | null = null
let editDrafts: Record<string, string> = {}
let replyDrafts: Record<string, string> = {}
let paneCollapsed = false
let accessorDone = false
let renderTimer: ReturnType<typeof setTimeout> | null = null
let pagedRelayoutBound = false // M4a: bind the window 'wc:paged-relayout' listener exactly once

const w = () => window as any
// Live-bridge accessor (NOT a captured closure): the probe/tests may swap PM impls.
const PM = () => { const pm = w().WC?.PM; return pm && pm.active && pm.ready ? pm : null }

// ---- tiny DOM helpers (user text always lands via textContent, never innerHTML) ----
function elx(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
const svg = (inner: string, size = 16) =>
  '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor"' +
  ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'
// Icons icons.js lacks (monoline, same 24x24 grammar). The balloon reuses P.comment's shape.
const IC = {
  comment: '<path d="M4 5h16v11H9l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  edit: '<path d="M5 19h3L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  like: '<path d="M4 11h3v9H4z"/><path d="M7 19v-8l4-7c1.6 0 2.6 1.1 2.1 3l-.5 2.2H18a2 2 0 0 1 1.9 2.6l-1.6 5A2 2 0 0 1 16.4 20H7z"/>',
  send: '<path d="M4 12 20 4l-4 16-4.5-5.5z"/><path d="M11.5 14.5 20 4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
}

function initials(name: string): string {
  const parts = String(name || '').replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[1][0] || '' : '')).toUpperCase()
}

function userName(): string {
  return String(editor?.options?.user?.name || 'Word User')
}

// Word's card timestamp format: "June 11, 2026 at 5:22 AM" (capture 02).
function formatDate(ms: any): string {
  const n = typeof ms === 'number' ? ms : NaN
  if (!isFinite(n)) return ''
  const d = new Date(n)
  let h = d.getHours()
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' at ' + h + ':' + min + ' ' + ap
}

// ---- geometry: anchor pos (plugin 'comment-positions' cache, doc-scan fallback)
//      -> #pages-local Y via a FRESH coordsAtPos (zoom-scale corrected) ----
function pagesEl(): HTMLElement | null { return document.getElementById('pages') }

function anchorStart(row: any): number | null {
  const hit = positions[row.id] || (row.importedId ? positions[row.importedId] : undefined)
  if (hit && typeof hit.start === 'number') return hit.start
  let found: number | null = null
  try {
    editor.state.doc.descendants((node: any, pos: number) => {
      if (found != null) return false
      for (const m of node.marks || []) {
        if (m.type.name !== CommentMarkName) continue
        const id = m.attrs?.commentId || m.attrs?.importedId
        if (id === row.id || (row.importedId && id === row.importedId)) { found = pos; return false }
      }
      return undefined
    })
  } catch { /* doc not readable mid-replace */ }
  return found
}

function localY(pos: number): number | null {
  // M4a: route through the WC.PM.coords seam so the Y is painted-page-correct in paged mode. The helper
  // is this exact formula with the only change being view.coordsAtPos → the seam's posToClientRect, so
  // overlay output is byte-identical. (See src/renderer/layout/coordinate-adapter.ts posToOverlayLocalY.)
  return ((window as any).WC?.PM?.coords?.posToOverlayLocalY?.(pos)) ?? null
}

// ---- debounced re-render (transactions fire per keystroke -- coalesce) ----
function schedule() {
  if (renderTimer != null) return
  renderTimer = setTimeout(() => { renderTimer = null; render() }, 80)
}

// ---- actions ----
function activateThread(id: string) {
  const pm = PM()
  if (!pm) return
  pm.cmd('setActiveComment', id)
  if (viewMode === 'list') {
    setTimeout(() => {
      const escId = (window as any).CSS?.escape ? (window as any).CSS.escape(id) : id
      document.querySelector('#wc-comments-pane .wc-cc-card[data-comment-id="' + escId + '"]')
        ?.scrollIntoView({ block: 'nearest' })
    }, 120)
  }
}

function compose(): boolean {
  const pm = PM()
  if (!pm) return false
  composerOpen = true
  composerDraft = ''
  try { composerAnchor = editor.state.selection.from } catch { composerAnchor = 1 }
  render()
  const ta = document.querySelector('textarea[data-key="composer"]') as HTMLTextAreaElement | null
  ta?.focus()
  return true
}

function composerPost() {
  const pm = PM()
  if (!pm) return
  const text = composerDraft.trim()
  if (!text) return
  const before = new Set<string>((pm.getComments() || []).map((r: any) => String(r.id)))
  if (pm.cmd('addComment', text)) {
    composerOpen = false
    composerDraft = ''
    // Word keeps the just-posted thread expanded (capture 02): activate it.
    const added = (pm.getComments() || []).find((r: any) => !before.has(String(r.id)))
    if (added) pm.cmd('setActiveComment', added.id)
  } else {
    // addComment refuses when the caret isn't in/next to a word (A2 expand failed).
    // Keep the draft so the user's text is never lost.
    w().WC?.toast?.('Place the cursor in a word (or select text) to comment on it.')
  }
  render()
}

function composerCancel() {
  composerOpen = false
  composerDraft = ''
  render()
  editor?.view?.focus?.()
}

function postReply(rootId: string) {
  const pm = PM()
  if (!pm) return
  const text = (replyDrafts[rootId] || '').trim()
  if (!text) return
  if (pm.cmd('replyComment', rootId, text)) {
    delete replyDrafts[rootId]
    pm.cmd('setActiveComment', rootId) // thread stays expanded (capture 03)
  }
  render()
}

function commitEdit(id: string) {
  const pm = PM()
  if (!pm) return
  const text = (editDrafts[id] || '').trim()
  if (!text) return
  if (pm.cmd('editComment', id, text)) {
    editingId = null
    delete editDrafts[id]
  }
  render()
}

function cancelEdit(id: string) {
  editingId = null
  delete editDrafts[id]
  render()
}

// Posted-state "..." menu. Word set per D8.3: Delete thread | Resolve thread |
// Link to comment (disabled -- cloud share-link). The captured posted-state menu
// was only partially enumerated (parity.md preamble) -- recorded in the report.
function moreMenu(btn: HTMLElement, row: any) {
  const WCg = w().WC
  if (!WCg?.flyout) return
  WCg.flyout(btn, (fly: HTMLElement) => {
    fly.appendChild(WCg.flyItem('Delete thread', { onClick: () => { PM()?.cmd('deleteComment', row.id) } }))
    fly.appendChild(WCg.flyItem('Resolve thread', { onClick: () => { PM()?.cmd('resolveComment', row.id) } }))
    fly.appendChild(WCg.flySep())
    fly.appendChild(WCg.flyItem('Link to comment', { disabled: true }))
  })
}

// ---- card pieces ----
function actionBtn(cls: string, inner: string, title: string, onClick: (btn: HTMLElement) => void): HTMLElement {
  const b = elx('button', 'wc-cc-iconbtn ' + cls) as HTMLButtonElement
  b.type = 'button'
  b.innerHTML = svg(inner, 14)
  b.title = title
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b) })
  return b
}

function likeBtn(id: string): HTMLElement {
  const n = reactions.get(id) || 0
  const b = elx('button', 'wc-cc-iconbtn wc-cc-like' + (n > 0 ? ' on' : '')) as HTMLButtonElement
  b.type = 'button'
  b.title = 'Like'
  b.innerHTML = svg(IC.like, 14) + (n > 0 ? '<span class="wc-cc-likecount">' + n + '</span>' : '')
  b.addEventListener('click', (e) => { e.stopPropagation(); reactions.set(id, n > 0 ? 0 : 1); render() })
  return b
}

function editArea(item: { id: string; text: string }): HTMLElement {
  const box = elx('div', 'wc-cc-editbox')
  const ta = elx('textarea', 'wc-cc-input') as HTMLTextAreaElement
  ta.rows = 2
  ta.dataset.key = 'edit:' + item.id
  ta.value = editDrafts[item.id] ?? item.text
  ta.addEventListener('input', () => { editDrafts[item.id] = ta.value })
  ta.addEventListener('keydown', (e) => {
    // stopPropagation on BOTH: app.js's document-level chords treat a bubbled
    // Ctrl+Enter as Insert Page Break (app.js:74) -- it would replace the very
    // text the comment anchors (caught by probe-comments-ui leg 2).
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); commitEdit(item.id) }
    else if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(item.id) }
  })
  const foot = elx('div', 'wc-cc-foot')
  const save = actionBtn('wc-cc-post', IC.send, 'Save (Ctrl+Enter)', () => commitEdit(item.id))
  const cancel = actionBtn('wc-cc-cancel', '', 'Cancel', () => cancelEdit(item.id))
  cancel.innerHTML = w().WC?.icon ? w().WC.icon('win_close', 10) : 'x'
  foot.append(save, cancel)
  box.append(ta, foot)
  return box
}

// One author block (root comment or reply): avatar+name header, action icons,
// body text (or inline edit box) and the timestamp line.
function entry(item: { id: string; author: string; text: string; date: number | null }, opts: { isRoot: boolean; resolved: boolean; row?: any }): HTMLElement {
  const wrap = elx('div', 'wc-cc-entry' + (opts.isRoot ? '' : ' wc-cc-reply'))
  const head = elx('div', 'wc-cc-head')
  head.appendChild(elx('span', 'wc-cc-avatar', initials(item.author)))
  head.appendChild(elx('span', 'wc-cc-author', item.author))
  const actions = elx('span', 'wc-cc-actions')
  if (opts.isRoot) actions.appendChild(actionBtn('wc-cc-more', IC.more, 'More thread actions', (b) => moreMenu(b, opts.row)))
  if (!opts.resolved) {
    actions.appendChild(actionBtn('wc-cc-edit', IC.edit, 'Edit comment', () => {
      editingId = item.id
      editDrafts[item.id] = item.text
      render()
      ;(document.querySelector('textarea[data-key="edit:' + item.id + '"]') as HTMLTextAreaElement | null)?.focus()
    }))
  }
  actions.appendChild(likeBtn(item.id))
  head.appendChild(actions)
  wrap.appendChild(head)
  if (editingId === item.id && !opts.resolved) {
    wrap.appendChild(editArea({ id: item.id, text: item.text }))
  } else {
    wrap.appendChild(elx('div', 'wc-cc-text', item.text))
    const ts = formatDate(item.date)
    if (ts) wrap.appendChild(elx('div', 'wc-cc-time', ts))
  }
  return wrap
}

// Full thread card (root + replies + Reply input). `placement` only affects CSS
// (overlay cards are absolutely positioned, pane cards stack statically).
function buildCard(row: any, placement: 'overlay' | 'pane'): HTMLElement {
  const card = elx('div', 'wc-cc-card' + (row.active ? ' active' : '') + (row.resolved ? ' resolved' : ''))
  card.dataset.commentId = String(row.id)
  card.appendChild(entry(
    { id: String(row.id), author: row.author, text: row.text, date: row.date ?? null },
    { isRoot: true, resolved: row.resolved === true, row },
  ))
  for (const rep of row.replies || []) {
    card.appendChild(entry(
      { id: String(rep.id ?? ''), author: rep.author, text: rep.text, date: rep.date ?? null },
      { isRoot: false, resolved: row.resolved === true },
    ))
  }
  if (!row.resolved) {
    const inp = elx('textarea', 'wc-cc-input wc-cc-replyinput') as HTMLTextAreaElement
    inp.rows = 1
    inp.placeholder = 'Reply'
    inp.title = 'Tip: Press Ctrl+Enter to post.'
    inp.dataset.key = 'reply:' + row.id
    inp.value = replyDrafts[row.id] || ''
    inp.addEventListener('input', () => { replyDrafts[row.id] = inp.value })
    inp.addEventListener('keydown', (e) => {
      // stopPropagation: a bubbled Ctrl+Enter hits app.js's page-break chord.
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); postReply(String(row.id)) }
      else if (e.key === 'Escape') {
        e.stopPropagation()
        delete replyDrafts[row.id]
        render()
        editor?.view?.focus?.()
      }
    })
    card.appendChild(inp)
  }
  card.addEventListener('click', (e) => {
    if ((e.target as Element)?.closest?.('button, textarea, input')) return
    activateThread(String(row.id))
  })
  if (placement === 'pane' && row.resolved) card.title = 'Resolved'
  return card
}

// Composer card (C1): avatar+author, "Start a conversation", tip line, post+close.
function composerCard(): HTMLElement {
  const card = elx('div', 'wc-cc-card wc-cc-composer active')
  const head = elx('div', 'wc-cc-head')
  head.appendChild(elx('span', 'wc-cc-avatar', initials(userName())))
  head.appendChild(elx('span', 'wc-cc-author', userName()))
  card.appendChild(head)
  const ta = elx('textarea', 'wc-cc-input') as HTMLTextAreaElement
  ta.rows = 1
  ta.placeholder = 'Start a conversation'
  ta.dataset.key = 'composer'
  ta.value = composerDraft
  card.appendChild(ta)
  card.appendChild(elx('div', 'wc-cc-tip', 'Tip: Press Ctrl+Enter to post.'))
  const foot = elx('div', 'wc-cc-foot')
  const post = actionBtn('wc-cc-post', IC.send, 'Post comment (Ctrl+Enter)', () => composerPost()) as HTMLButtonElement
  post.disabled = !composerDraft.trim()
  const close = actionBtn('wc-cc-cancel', '', 'Cancel', () => composerCancel())
  close.innerHTML = w().WC?.icon ? w().WC.icon('win_close', 10) : 'x'
  foot.append(post, close)
  card.appendChild(foot)
  ta.addEventListener('input', () => {
    composerDraft = ta.value
    post.disabled = !composerDraft.trim()
  })
  ta.addEventListener('keydown', (e) => {
    // stopPropagation: a bubbled Ctrl+Enter hits app.js's page-break chord and
    // would replace the anchor word with a hardBreak before addComment runs.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); composerPost() }
    else if (e.key === 'Escape') { e.stopPropagation(); composerCancel() }
  })
  return card
}

// List pane shell (C10) -- legacy taskpane classes (tp-head/tp-title/tp-body) so it
// inherits the clone's pane look; comment-specific toolbar row under the header.
function buildPaneShell(): HTMLElement {
  const pane = elx('div', 'taskpane right')
  pane.id = 'wc-comments-pane'
  const head = elx('div', 'tp-head')
  head.appendChild(elx('div', 'tp-title', 'Comments'))
  const btns = elx('div', 'wc-cmp-headbtns')
  const collapse = actionBtn('wc-cmp-collapse', '', 'Collapse the pane', () => {
    paneCollapsed = !paneCollapsed
    pane.classList.toggle('collapsed', paneCollapsed)
  })
  collapse.innerHTML = w().WC?.icon ? w().WC.icon('chevron_down', 12) : 'v'
  const close = actionBtn('wc-cmp-close', '', 'Close', () => { w().WC.commentsViewMode = 'contextual' })
  close.innerHTML = w().WC?.icon ? w().WC.icon('win_close', 12) : 'x'
  btns.append(collapse, close)
  head.appendChild(btns)
  const bar = elx('div', 'wc-cmp-toolbar')
  const newBtn = elx('button', 'wc-cmp-new') as HTMLButtonElement
  newBtn.type = 'button'
  newBtn.innerHTML = svg(IC.comment, 14) + '<span>New</span>'
  newBtn.addEventListener('click', () => compose())
  const count = elx('span', 'wc-cmp-count', '0 items')
  const filter = elx('button', 'wc-cc-iconbtn wc-cmp-filter') as HTMLButtonElement
  filter.type = 'button'
  filter.innerHTML = svg(IC.filter, 14)
  filter.title = 'Filter'
  filter.disabled = true // Word's filter menu -- out of slice-8 task-4 scope (no toast)
  bar.append(newBtn, count, filter)
  const body = elx('div', 'tp-body')
  pane.append(head, bar, body)
  if (paneCollapsed) pane.classList.add('collapsed')
  return pane
}

// ---- render ----
function render() {
  try { renderInner() } catch (e) { console.error('[WC.CommentsUI] render failed', e) }
}

function renderInner() {
  const pm = PM()
  const workarea = document.getElementById('workarea')
  const pages = pagesEl()
  if (!pm || !editor || !workarea || !pages) return
  const rows: any[] = (typeof pm.getComments === 'function' && pm.getComments()) || []
  const unresolved = rows.filter((r) => !r.resolved)

  // Focus continuity: re-rendering replaces the input the user is typing in --
  // snapshot the focused data-key + caret and restore after the rebuild.
  const ae = document.activeElement as any
  const focusKey = ae && ae.dataset?.key && ae.closest?.('#wc-comments-overlay, #wc-comments-pane')
    ? ae.dataset.key : null
  const selStart = focusKey && ae.selectionStart != null ? ae.selectionStart : 0
  const selEnd = focusKey && ae.selectionEnd != null ? ae.selectionEnd : 0

  // Right gutter reservation (C1 page shift, captures 01-02): only while the
  // contextual margin actually holds cards/glyphs.
  workarea.classList.toggle('wc-comments-gutter',
    viewMode === 'contextual' && (composerOpen || unresolved.length > 0))

  // ---- margin overlay: glyphs (both modes) + active card/composer (contextual) ----
  let ov = document.getElementById('wc-comments-overlay')
  if (!ov) { ov = elx('div'); ov.id = 'wc-comments-overlay'; pages.appendChild(ov) }
  ov.innerHTML = ''
  const anchored = unresolved
    .map((r) => ({ r, pos: anchorStart(r) }))
    .filter((x): x is { r: any; pos: number } => x.pos != null)
    .map((x) => ({ r: x.r, pos: x.pos, y: localY(x.pos) }))
    .filter((x): x is { r: any; pos: number; y: number } => x.y != null)
    .sort((a, b) => a.y - b.y)
  for (const { r, y } of anchored) {
    const g = elx('button', 'wc-cc-glyph' + (r.active ? ' active' : '')) as HTMLButtonElement
    g.type = 'button'
    g.innerHTML = svg(IC.comment, 14)
    g.title = 'Comment by ' + r.author
    g.dataset.commentId = String(r.id)
    g.style.top = Math.max(0, y - 4) + 'px'
    g.addEventListener('click', (e) => { e.stopPropagation(); activateThread(String(r.id)) })
    ov.appendChild(g)
  }
  if (viewMode === 'contextual') {
    let blockBottom = -Infinity
    if (composerOpen) {
      const c = composerCard()
      ov.appendChild(c)
      const y = localY(composerAnchor) ?? 16
      c.style.top = Math.max(0, y) + 'px'
      blockBottom = y + c.offsetHeight
    }
    const act = anchored.find((x) => x.r.active === true)
    if (act) {
      const card = buildCard(act.r, 'overlay')
      ov.appendChild(card)
      let top = act.y
      if (composerOpen && top < blockBottom + 8) top = blockBottom + 8
      card.style.top = Math.max(0, top) + 'px'
    }
  }

  // ---- list pane ----
  let pane = document.getElementById('wc-comments-pane')
  if (viewMode !== 'list') {
    if (pane) pane.remove()
  } else {
    if (!pane) { pane = buildPaneShell(); workarea.appendChild(pane) }
    const count = pane.querySelector('.wc-cmp-count')
    if (count) count.textContent = rows.length + (rows.length === 1 ? ' item' : ' items')
    const body = pane.querySelector('.tp-body') as HTMLElement
    body.innerHTML = ''
    if (composerOpen) body.appendChild(composerCard())
    const order = rows
      .map((r) => ({ r, pos: anchorStart(r) ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.pos - b.pos)
    for (const { r } of order) body.appendChild(buildCard(r, 'pane'))
    if (!rows.length && !composerOpen) body.appendChild(elx('div', 'wc-cmp-empty', 'No comments in this document.'))
  }

  if (focusKey) {
    const next = document.querySelector('[data-key="' + focusKey + '"]') as HTMLTextAreaElement | null
    if (next) {
      next.focus()
      try { next.setSelectionRange(selStart, selEnd) } catch { /* non-text inputs */ }
    }
  }
}

// ---- install (re-entrant: replaceEditor re-runs installBridge on Open/New;
// the old editor's listeners die with editor.destroy()) ----
export function installCommentsUI(ed: AnyEditor) {
  editor = ed
  positions = {}
  composerOpen = false
  composerDraft = ''
  editingId = null
  editDrafts = {}
  replyDrafts = {}
  const WCg = w().WC
  if (!accessorDone) {
    accessorDone = true
    // H.showComments latches WC.commentsViewMode as a plain write (commands.js) --
    // promote it to an accessor so a mode pick re-renders this UI immediately.
    let pending: any
    try { pending = WCg.commentsViewMode; delete WCg.commentsViewMode } catch { /* plain prop */ }
    if (pending === 'list') viewMode = 'list'
    Object.defineProperty(WCg, 'commentsViewMode', {
      configurable: true,
      get: () => viewMode,
      set: (m: any) => { viewMode = m === 'list' ? 'list' : 'contextual'; render() },
    })
  }
  WCg.CommentsUI = {
    compose, // H.newComment PM branch + Ctrl+Alt+M route here (commands.js/app.js)
    refresh: () => render(),
    setView: (m: ViewMode) => { WCg.commentsViewMode = m },
  }
  ed.on?.('commentsUpdate', schedule)
  ed.on?.('comment-positions', (p: any) => {
    const all = p?.allCommentPositions || {}
    const next: Record<string, { start: number; end: number }> = {}
    for (const k of Object.keys(all)) {
      const v = all[k]
      if (v && typeof v.start === 'number') next[k] = { start: v.start, end: typeof v.end === 'number' ? v.end : v.start }
    }
    positions = next
    schedule()
  })
  ed.on?.('transaction', schedule)
  // M4a: in paged mode, reposition when PE re-paginates without a transaction (zoom/reflow). Bound ONCE
  // to the window event; schedule() is a module singleton that reads the live `editor`, so it's remount-safe.
  if (!pagedRelayoutBound) { pagedRelayoutBound = true; window.addEventListener('wc:paged-relayout', schedule) }
  schedule()
}
