// Slice 8 task 5 (D8.2/D8.4): tracked-changes chrome on the PM engine --
// changed-line bars (T7), format balloons (T6), Simple-Markup chrome (D8.2)
// and the Word-anatomy Revisions pane (T11).
// Plan: docs/superpowers/plans/2026-06-11-phase2-slice-8-review.md (+ A3);
// parity contract: .oracle-probes/slice8/parity.md T6/T7/T9/T10/T11
// (captures word-ref/07, 09, 14).
//
// Clone-owned DOM surfaces, fed by the bridge providers (review.ts):
//   1. #wc-track-chrome -- an absolute overlay covering #pages (sibling of
//      #pm-editor, the task-4 comments-overlay pattern: it scrolls and
//      zoom-scales with the page, and geometry comes from a render-time
//      view.coordsAtPos divided back through the #pages scale()).
//      - .wc-track-bar: one bar per run of changed LINES (tracked changes
//        only, never comments -- T7). Grey in All Markup, RED + thicker in
//        Simple Markup (capture 09); clicking toggles simple<->all (real
//        Word's bar-click behavior; the required leg is simple->all).
//        Hidden in none/original views.
//      - .wc-track-balloon + .wc-track-connector: All-Markup right-column
//        balloon per trackFormat range -- author header + 'Formatted: <desc>'
//        + a connector line to the range (capture 07). Balloons share Word's
//        right markup area with the task-4 comment cards; CARDS take
//        precedence: balloons are pushed below any overlapping card (both
//        overlays use #pages-local coords, so offsetTop comparisons line up).
//   2. #wc-review-pane -- the left-docked 'Revisions' pane (D8.4, capture 14):
//      tp-head 'Revisions' title + close, then the 'N revisions' live-count
//      row with a collapse chevron + refresh icon; entries 'Author
//      Added/Deleted/Formatted/Commented' (bold author, type label, content
//      below); entry click moves the selection to the revision (comment rows
//      also activate their thread). Vertical = left dock; Horizontal = the
//      same pane bottom-docked (T11 menu).
//
// Markup filters (T9): reads the task-3 WC.pmMarkup latches (commands.js) --
// insDel=false drops ins/del bars (the inline ins/del hiding itself is CSS,
// track-chrome-pm.css 'pm-hide-insdel'); formatting=false drops format
// balloons + format bars; balloons='inline' collapses the balloon column
// (T10 'Show All Revisions Inline'). 'Show Revisions in Balloons' renders as
// the default formatting-only set (recorded scope decision -- ins/del stay
// inline).
//
// Render triggers mirror comments-ui: 'transaction' + 'commentsUpdate' +
// 'comment-positions', debounce-coalesced -- at 120ms, AFTER the comment
// overlay's 80ms tick, so balloon stacking reads settled card geometry.
// PM-ONLY by construction: installTrackChrome is called from installBridge
// after its legacyBoot early-return, so none of this DOM exists under
// --legacy and the legacy Reviewing pane (review-tools.js) is untouched.

type AnyEditor = any
type PaneOrientation = 'vertical' | 'horizontal'

// ---- module singletons (installTrackChrome re-runs on Open/New) ----
let editor: AnyEditor = null
let paneOpen = false
let paneOrientation: PaneOrientation = 'vertical'
let paneCollapsed = false
let renderTimer: ReturnType<typeof setTimeout> | null = null

const w = () => window as any
// Live-bridge accessor (NOT a captured closure): probes/tests may swap PM impls.
const PM = () => { const pm = w().WC?.PM; return pm && pm.active && pm.ready ? pm : null }
// Task-3 Show Markup latches (commands.js exposes the object on WC -- task 5).
const markup = () => w().WC?.pmMarkup || { insDel: true, formatting: true, balloons: 'formatting' }

// ---- tiny DOM helpers (user/doc text lands via textContent, never innerHTML) ----
function elx(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
const svg = (inner: string, size = 14) =>
  '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor"' +
  ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'
// icons.js lacks a refresh glyph -- same 24x24 monoline grammar as comments-ui.
const IC = {
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>',
}

function iconBtn(cls: string, title: string, html: string, onClick: () => void): HTMLElement {
  const b = elx('button', 'wc-rvp-iconbtn ' + cls) as HTMLButtonElement
  b.type = 'button'
  b.title = title
  b.innerHTML = html
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
  return b
}

// ---- geometry: PM pos -> #pages-local rect (zoom-scale corrected; the
// comments-ui localY pattern extended with bottom/left) ----
function pagesEl(): HTMLElement | null { return document.getElementById('pages') }

function localRect(pos: number): { top: number; bottom: number; left: number } | null {
  const pages = pagesEl()
  if (!pages || !editor?.view) return null
  try {
    const max = editor.state.doc.content.size
    const c = editor.view.coordsAtPos(Math.max(1, Math.min(pos, max)))
    if (!c || (c.top === 0 && c.bottom === 0)) return null // hidden/unlaid-out run
    const r = pages.getBoundingClientRect()
    const scale = pages.offsetWidth ? r.width / pages.offsetWidth : 1
    return {
      top: (c.top - r.top) / (scale || 1),
      bottom: (c.bottom - r.top) / (scale || 1),
      left: (c.left - r.left) / (scale || 1),
    }
  } catch { return null }
}

// Rect for a range END/START with a fallback to the neighbouring position --
// Simple Markup css-hides tracked deletions, so coordsAtPos inside the hidden
// run can fail; the line still gets its red bar (Word does).
function rectWithFallback(pos: number, fallback: number): { top: number; bottom: number; left: number } | null {
  return localRect(pos) || localRect(fallback)
}

// ---- debounced re-render ----
function schedule() {
  if (renderTimer != null) return
  renderTimer = setTimeout(() => { renderTimer = null; render() }, 120)
}

function render() {
  try { renderInner() } catch (e) { console.error('[WC.TrackChrome] render failed', e) }
}

function renderInner() {
  const pm = PM()
  const pages = pagesEl()
  if (!pm || !editor || !pages) return
  const view = (typeof pm.reviewState === 'function' && pm.reviewState().view) || 'all'
  const mk = markup()
  const ranges: any[] = (typeof pm.getChangeRanges === 'function' && pm.getChangeRanges()) || []

  let ov = document.getElementById('wc-track-chrome')
  if (!ov) { ov = elx('div'); ov.id = 'wc-track-chrome'; pages.appendChild(ov) }
  ov.innerHTML = ''
  ov.classList.toggle('simple', view === 'simple')

  // ---- changed-line bars (T7): tracked changes only; hidden in none/original ----
  if (view === 'all' || view === 'simple') {
    const barRanges = ranges.filter((r) =>
      r.type === 'format' ? mk.formatting !== false : mk.insDel !== false)
    const spans: Array<{ top: number; bottom: number }> = []
    for (const r of barRanges) {
      const a = rectWithFallback(r.from, r.from - 1)
      const b = rectWithFallback(Math.max(r.from, r.to - 1), r.from)
      if (!a || !b) continue
      spans.push({ top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) })
    }
    spans.sort((x, y) => x.top - y.top)
    // Contiguous changed lines merge into one visual bar (exactly Word's look:
    // per-line bars on adjacent lines abut into a continuous strip).
    const merged: Array<{ top: number; bottom: number }> = []
    for (const s of spans) {
      const last = merged[merged.length - 1]
      if (last && s.top <= last.bottom + 2) last.bottom = Math.max(last.bottom, s.bottom)
      else merged.push({ top: s.top, bottom: s.bottom })
    }
    for (const s of merged) {
      const bar = elx('div', 'wc-track-bar')
      bar.style.top = Math.max(0, s.top) + 'px'
      bar.style.height = Math.max(8, s.bottom - s.top) + 'px'
      bar.title = view === 'simple' ? 'Show All Markup' : 'Show Simple Markup'
      // T7 click behavior: Simple bar -> All Markup (required leg); All bar ->
      // Simple (real Word's bar click toggles between the two).
      bar.addEventListener('click', () => { PM()?.cmd('setReviewView', view === 'simple' ? 'all' : 'simple') })
      ov.appendChild(bar)
    }
  }

  // ---- format balloons (T6): All Markup only. formatting=false (T9) and
  // 'Show All Revisions Inline' (T10) both collapse the column. ----
  if (view === 'all' && mk.formatting !== false && mk.balloons !== 'inline') {
    const pagesW = pages.offsetWidth
    // Comment cards take precedence in the shared right markup area: collect
    // their occupied y-intervals (overlay-local coords).
    const blocked: Array<{ top: number; bottom: number }> = []
    document.querySelectorAll('#wc-comments-overlay .wc-cc-card').forEach((c: any) => {
      blocked.push({ top: c.offsetTop, bottom: c.offsetTop + c.offsetHeight })
    })
    blocked.sort((a, b) => a.top - b.top)
    const fmts = ranges.filter((r) => r.type === 'format')
      .map((r) => ({ r, rect: rectWithFallback(Math.max(r.from, r.to - 1), r.from) }))
      .filter((x): x is { r: any; rect: { top: number; bottom: number; left: number } } => x.rect != null)
      .sort((a, b) => a.rect.top - b.rect.top)
    let cursor = 0
    for (const { r, rect } of fmts) {
      // Connector first (paints under the balloon): from the range to the column.
      const conn = elx('div', 'wc-track-connector')
      conn.style.top = Math.max(0, rect.bottom - 1) + 'px'
      conn.style.left = Math.max(0, rect.left) + 'px'
      conn.style.width = Math.max(0, pagesW + 12 - rect.left) + 'px'
      ov.appendChild(conn)
      const card = elx('div', 'wc-track-balloon')
      card.appendChild(elx('div', 'wc-tb-author', r.author || 'Author'))
      const body = elx('div', 'wc-tb-text')
      body.appendChild(elx('b', '', 'Formatted: '))
      body.appendChild(document.createTextNode(r.description || 'Formatted'))
      card.appendChild(body)
      ov.appendChild(card)
      let top = Math.max(rect.top, cursor)
      const h = card.offsetHeight || 48
      for (let guard = 0; guard < 24; guard++) {
        const hit = blocked.find((b) => top < b.bottom && top + h > b.top)
        if (!hit) break
        top = hit.bottom + 8
      }
      card.style.top = Math.max(0, top) + 'px'
      cursor = top + h + 8
      // Word selects the change when its balloon is clicked.
      card.addEventListener('click', () => {
        try {
          editor.commands.setTextSelection({ from: r.from, to: r.to })
          editor.view?.focus()
        } catch { /* stale range mid-edit */ }
      })
    }
  }

  renderPane()
}

// ---- Revisions pane (T11/D8.4, capture 14) ----
const VERB: Record<string, string> = { insert: 'Added', delete: 'Deleted', format: 'Formatted', comment: 'Commented' }

function buildPane(): HTMLElement {
  const WCg = w().WC
  const pane = elx('div', 'taskpane')
  pane.id = 'wc-review-pane'
  const head = elx('div', 'tp-head')
  head.appendChild(elx('div', 'tp-title', 'Revisions'))
  const btns = elx('div', 'wc-rvp-headbtns')
  btns.appendChild(iconBtn('wc-rvp-close', 'Close',
    WCg?.icon ? WCg.icon('win_close', 12) : 'x', () => hidePane()))
  head.appendChild(btns)
  // 'N revisions' row: collapse chevron + live count + refresh (capture 14).
  const bar = elx('div', 'wc-rvp-bar')
  bar.appendChild(iconBtn('wc-rvp-collapse', 'Collapse',
    WCg?.icon ? WCg.icon('chevron_down', 12) : 'v', () => {
      paneCollapsed = !paneCollapsed
      pane.classList.toggle('collapsed', paneCollapsed)
    }))
  bar.appendChild(elx('span', 'wc-rvp-count', '0 revisions'))
  bar.appendChild(iconBtn('wc-rvp-refresh', 'Refresh', svg(IC.refresh, 13), () => render()))
  const body = elx('div', 'tp-body')
  pane.append(head, bar, body)
  return pane
}

function renderPane() {
  let pane = document.getElementById('wc-review-pane')
  if (!paneOpen) { if (pane) pane.remove(); return }
  const workarea = document.getElementById('workarea')
  if (!pane) {
    if (!workarea) return
    pane = buildPane()
    workarea.appendChild(pane)
  }
  pane.classList.toggle('horizontal', paneOrientation === 'horizontal')
  pane.classList.toggle('collapsed', paneCollapsed)
  const pm = PM()
  const rows: any[] = (pm && typeof pm.getRevisions === 'function' && pm.getRevisions()) || []
  const count = pane.querySelector('.wc-rvp-count')
  if (count) count.textContent = rows.length + ' revision' + (rows.length === 1 ? '' : 's')
  const body = pane.querySelector('.tp-body') as HTMLElement
  body.innerHTML = ''
  if (!rows.length) body.appendChild(elx('div', 'wc-rvp-empty', 'No revisions.'))
  for (const r of rows) {
    const entry = elx('div', 'wc-rvp-entry')
    const head = elx('div', 'wc-rvp-head')
    head.appendChild(elx('span', 'wc-rvp-author', r.author || 'Author'))
    head.appendChild(document.createTextNode(' '))
    head.appendChild(elx('span', 'wc-rvp-verb', VERB[r.type] || 'Changed'))
    entry.appendChild(head)
    entry.appendChild(elx('div', 'wc-rvp-text', r.text || ''))
    entry.addEventListener('click', () => goTo(r))
    body.appendChild(entry)
  }
}

// Entry click -> selection moves to the revision (T11). Comment rows also
// activate their thread; NO view refocus on that leg -- the focus-driven
// selection sync could overwrite the just-activated thread (review.ts note).
function goTo(row: { pos?: number; type?: string; id?: string }) {
  const pm = PM()
  if (!pm || !editor?.view) return
  const max = editor.state.doc.content.size
  const pos = Math.max(1, Math.min(typeof row.pos === 'number' ? row.pos : 1, max - 1))
  try { editor.commands.setTextSelection({ from: pos, to: pos }) } catch { return }
  if (row.type === 'comment' && row.id != null) pm.cmd('setActiveComment', row.id)
  else editor.view?.focus()
}

function showPane(orientation?: PaneOrientation) {
  if (orientation) paneOrientation = orientation
  paneOpen = true
  render()
}

function hidePane() {
  paneOpen = false
  render()
}

// Main ribbon button: plain toggle in the last-used orientation (T11).
function togglePane(orientation?: PaneOrientation) {
  if (paneOpen && (!orientation || orientation === paneOrientation)) { hidePane(); return }
  showPane(orientation)
}

// ---- install (re-entrant: replaceEditor re-runs installBridge on Open/New;
// the old editor's listeners die with editor.destroy(); pane/latch state is
// module-level and survives the swap deliberately) ----
export function installTrackChrome(ed: AnyEditor) {
  editor = ed
  const WCg = w().WC
  WCg.TrackChrome = {
    refresh: () => schedule(), // commands.js latch toggles + probes route here
    render, // synchronous variant (probe determinism)
    showPane,
    hidePane,
    togglePane,
  }
  ed.on?.('transaction', schedule)
  ed.on?.('commentsUpdate', schedule)
  ed.on?.('comment-positions', schedule)
  schedule()
}
