// Slice 9 task 4 (D9.1): the footnote/endnote NOTES REGION on the PM engine.
// Plan: docs/superpowers/plans/2026-06-12-phase2-slice-9-references.md (D9.1 — the
// designated trim point). Legacy precedent: references-tools.js .wc-footnotes /
// .wc-endnotes containers (public/js).
//
// WHY a clone-owned region (NOT a PM node): footnote/endnote REFERENCE markers (the
// superscript numbers) already render inside the PM doc (fork FootnoteReference /
// EndnoteReference nodeViews). But the note BODY lives in word/footnotes.xml — it is
// NOT an editable PM node in this build (page-foot placement is Phase 7). Without a
// notes UI a user inserts a footnote, sees the superscript, but has nowhere to read or
// type the note. This module ships a continuous-flow region BELOW the document body
// that lists the notes and edits each body as PLAIN TEXT (rich formatting is dropped —
// ledger), persisting through the bridge (WC.PM.refUpdateNote → editor.doc.footnotes.update).
//
// MOUNT: #pm-notes-area is a sibling of #pm-editor inside #pages (the same scroll +
// zoom-scale container the comments overlay / track chrome use). #pages is a column
// flexbox, so the region flows naturally below the page sheet (continuous flow). Hidden
// entirely (display:none) when there are zero notes — Word does not draw an empty
// separator.
//
// STATE-SYNC: re-renders on the editor 'transaction' (mirrors comments-ui / track-chrome),
// debounce-coalesced, but CHEAP — it diffs a signature of the note set/content and skips
// the rebuild when nothing changed, so per-keystroke typing in the body never thrashes
// the DOM. NEVER steals focus or disrupts the PM selection: the region's own inputs are
// exempt from focus.ts blur guards (contenteditable + .ProseMirror/input selectors).
// CLOBBER-SAFE: the rebuild recreates each body from the ENGINE content, so a rebuild
// fired while a body is focused-and-DIRTY (live text != its engine content — an edit not
// yet committed via refUpdateNote) would discard the typed text. renderInner() detects
// that case and SKIPS the rebuild this cycle, re-scheduling to retry after blur/commit
// (see the CLOBBER GUARD in renderInner). On a CLEAN rebuild it preserves the focused
// note id + caret offset for continuity.
//
// PM-ONLY by construction: installNotesArea is called from installBridge AFTER its
// legacyBoot early-return, so none of this DOM ever exists under --legacy (the legacy
// references-tools.js .wc-notes containers live inside the legacy #editor and are
// untouched).

type AnyEditor = any

// ---- module singletons (installNotesArea re-runs on Open/New — see install) ----
let editor: AnyEditor = null
let renderTimer: ReturnType<typeof setTimeout> | null = null
let lastSig = '' // signature of the rendered note set — re-render only on a real change
let editTimer: ReturnType<typeof setTimeout> | null = null

const w = () => window as any
// Live-bridge accessor (NOT a captured closure): probes/tests may swap PM impls.
const PM = () => { const pm = w().WC?.PM; return pm && pm.active && pm.ready ? pm : null }

// ---- tiny DOM helper (note bodies/numbers always land via textContent) ----
function elx(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

// ---- debounced re-render (transactions fire per keystroke — coalesce) ----
function schedule() {
  if (renderTimer != null) return
  renderTimer = setTimeout(() => { renderTimer = null; render() }, 90)
}

// Note set/content signature: cheap change-detection so a transaction that did NOT
// touch the notes (ordinary typing in the doc body) never rebuilds the region. Includes
// type/number/content/noteId so an edit, insert, or renumber all force a rebuild.
function signature(notes: any[]): string {
  return notes.map((n) => n.type + '|' + n.noteId + '|' + n.displayNumber + '|' + n.content).join('')
}

function render() {
  try { renderInner() } catch (e) { console.error('[WC.NotesArea] render failed', e) }
}

// Build one note row: [number] + an editable PLAIN-TEXT body. On commit (blur or a
// debounced input pause) persist via the bridge, then reconcile.
function buildNote(note: any): HTMLElement {
  const row = elx('div', 'pm-note')
  row.appendChild(elx('span', 'pm-note-num', (note.displayNumber || '') + '. '))
  const body = elx('div', 'pm-note-body')
  body.setAttribute('contenteditable', 'true')
  // Plain-text only (FIX 4): rich paste is flattened to its text AT PASTE TIME by the
  // paste handler below (preventDefault + insert the clipboard's text/plain), so the
  // body never accrues rich nodes. The commit() read (body.textContent) is the second
  // line of defence — note bodies are PLAIN TEXT (ledger C). spellcheck off keeps the
  // region quiet next to the doc.
  body.spellcheck = false
  body.dataset.noteId = String(note.noteId)
  body.textContent = note.content
  // commit(): persist the current plain text + reconcile. Guarded so a stale row
  // (re-rendered out from under the user) does not write garbage.
  const commit = () => {
    if (editTimer != null) { clearTimeout(editTimer); editTimer = null }
    const pm = PM()
    if (!pm || typeof pm.refUpdateNote !== 'function') return
    const text = body.textContent ?? ''
    if (text === note.content) return // no-op edit — skip the write + reconcile
    const target = note.target || note.noteId
    if (pm.refUpdateNote(target, text)) {
      note.content = text // keep the captured row in sync so the next diff is stable
      schedule() // reconcile numbering/order; the focused field is preserved by render()
    }
  }
  body.addEventListener('blur', commit)
  body.addEventListener('input', () => {
    // Debounced commit while typing (Word-ish live persistence); blur also commits.
    if (editTimer != null) clearTimeout(editTimer)
    editTimer = setTimeout(commit, 500)
  })
  body.addEventListener('paste', (e) => {
    // FIX 4: flatten rich paste to PLAIN TEXT at paste time (note bodies are plain
    // text — ledger C). Take the clipboard's text/plain, collapse newlines to spaces
    // (single-line bodies, mirroring the Enter-commits keydown rule), and insert it at
    // the caret — replacing any selection. execCommand('insertText') is the cheap path
    // that keeps the caret correct after a single-node insert; fall back to a manual
    // Range splice (still single text node) if it is unavailable.
    e.preventDefault()
    e.stopPropagation()
    const raw = e.clipboardData?.getData('text/plain') ?? ''
    const text = raw.replace(/[\r\n]+/g, ' ')
    if (!text) return
    let inserted = false
    try { inserted = document.execCommand('insertText', false, text) } catch { inserted = false }
    if (!inserted) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const tn = document.createTextNode(text)
        range.insertNode(tn)
        // Caret AFTER the inserted text (robust for multi-node content too).
        range.setStartAfter(tn)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        body.textContent = (body.textContent ?? '') + text
      }
    }
    // Arm the same debounced commit the input handler would (paste does not always
    // fire a synthetic 'input' across engines).
    if (editTimer != null) clearTimeout(editTimer)
    editTimer = setTimeout(commit, 500)
  })
  body.addEventListener('keydown', (e) => {
    // Keep edits inside the field: Enter commits (single-line note bodies — Word does
    // not allow paragraph breaks in a footnote body here); Escape reverts + blurs.
    // stopPropagation so app.js's document-level chords never see these presses (a
    // bubbled Ctrl+Enter is app.js's Insert Page Break — comments-ui precedent).
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); body.blur() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); body.textContent = note.content; body.blur() }
    else e.stopPropagation()
  })
  row.appendChild(body)
  return row
}

function buildSection(title: string, notes: any[]): HTMLElement {
  const sec = elx('div', 'pm-notes-section')
  sec.appendChild(elx('div', 'pm-notes-title', title))
  for (const n of notes) sec.appendChild(buildNote(n))
  return sec
}

function renderInner() {
  const pm = PM()
  const pages = document.getElementById('pages')
  let region = document.getElementById('pm-notes-area')
  if (!pm || !editor || !pages) { if (region) region.style.display = 'none'; return }

  const notes: any[] = (typeof pm.refListFootnotes === 'function' && pm.refListFootnotes()) || []
  const footnotes = notes.filter((n) => n.type !== 'endnote')
  const endnotes = notes.filter((n) => n.type === 'endnote')

  // Zero notes → hide the region entirely (Word draws no empty separator). Drop the
  // signature so a later insert always rebuilds.
  if (!notes.length) {
    if (region) { region.innerHTML = ''; region.style.display = 'none' }
    lastSig = ''
    return
  }

  // CHEAP: skip the rebuild when neither the note set nor any content changed. This is
  // what keeps per-keystroke transactions in the DOCUMENT body from thrashing the region.
  const sig = signature(notes)
  if (region && sig === lastSig && region.style.display !== 'none') return

  // CLOBBER GUARD (FIX 1): the rebuild below wipes innerHTML and recreates every note
  // body from the ENGINE content (notes[].content), restoring only the caret offset —
  // so rebuilding the focused body while the user is mid-edit, BEFORE that edit has
  // committed through refUpdateNote, DISCARDS the uncommitted typed text. Two real
  // triggers bump the signature while a body is focused-but-dirty: (a) CROSS-NOTE —
  // another note's 500ms-debounced commit fires refUpdateNote + schedule(), and (b)
  // SELF-NOTE — a transaction lands in the ~90ms window after the focused body's own
  // commit but before this render reflects it. In both cases the focused body's live
  // textContent !== its engine content. Detect that and SKIP the wipe this cycle,
  // re-scheduling so the rebuild retries after the body blurs/commits (when it is no
  // longer dirty). This MUST gate the innerHTML wipe AND lastSig — leaving lastSig
  // unadvanced is what makes the retry re-enter (sig still !== lastSig next cycle).
  if (region && region.style.display !== 'none') {
    const focused = document.activeElement as any
    if (
      focused
      && focused.classList?.contains?.('pm-note-body')
      && focused.closest?.('#pm-notes-area')
      && focused.dataset?.noteId
    ) {
      const fid = String(focused.dataset.noteId)
      const engineNote = notes.find((n) => String(n.noteId) === fid)
      // Dirty = the focused body's live text differs from the engine value for its id.
      // (A note that vanished from the engine — engineNote == null — is treated as
      // dirty too: never wipe an in-progress edit out from under the user.)
      if (!engineNote || (focused.textContent ?? '') !== String(engineNote.content)) {
        schedule() // retry after blur/commit; lastSig stays stale so the retry re-enters
        return
      }
    }
  }
  lastSig = sig

  // Focus continuity (CLEAN rebuild only — the CLOBBER GUARD above already bailed when
  // the focused body was dirty): rebuilding replaces the field the user is editing —
  // snapshot the focused note id + caret offset and restore after the rebuild
  // (comments-ui pattern, adapted for contenteditable).
  const ae = document.activeElement as any
  const focusId = ae && ae.dataset?.noteId && ae.closest?.('#pm-notes-area') ? String(ae.dataset.noteId) : null
  let caretOffset = 0
  if (focusId) {
    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) caretOffset = sel.getRangeAt(0).startOffset
    } catch { /* selection unreadable */ }
  }

  if (!region) {
    region = elx('div'); region.id = 'pm-notes-area'
    // Sibling of #pm-editor in the #pages column flex → flows BELOW the page sheet.
    pages.appendChild(region)
  }
  region.style.display = ''
  region.innerHTML = ''
  if (footnotes.length) region.appendChild(buildSection('Footnotes', footnotes))
  if (endnotes.length) region.appendChild(buildSection('Endnotes', endnotes))

  if (focusId) {
    const next = region.querySelector('.pm-note-body[data-note-id="' + (window as any).CSS?.escape?.(focusId) + '"]')
      || region.querySelector('.pm-note-body[data-note-id="' + focusId + '"]')
    if (next instanceof HTMLElement) {
      next.focus()
      try {
        const sel = window.getSelection()
        const tn = next.firstChild
        if (sel && tn) {
          const off = Math.min(caretOffset, (tn.textContent || '').length)
          const range = document.createRange()
          range.setStart(tn, off)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      } catch { /* restore is best-effort */ }
    }
  }
}

// refShowNotes target (references.ts wires this): reveal + scroll the region into view
// and focus the FIRST note body. Returns false when there is nothing to show.
function showNotes(): boolean {
  render() // make sure the region reflects the latest notes before we reveal it
  const region = document.getElementById('pm-notes-area')
  if (!region || region.style.display === 'none') return false
  region.scrollIntoView({ block: 'nearest' })
  const first = region.querySelector('.pm-note-body') as HTMLElement | null
  if (first) {
    first.focus()
    try {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(first)
      range.collapse(false) // caret at end of the body — ready to keep typing
      sel?.removeAllRanges()
      sel?.addRange(range)
    } catch { /* focus is enough */ }
  }
  return true
}

// ---- install (re-entrant: replaceEditor re-runs installBridge on Open/New; the old
// editor's listeners die with editor.destroy(); the region re-derives from the NEW
// editor.doc.footnotes on the first schedule() below) ----
export function installNotesArea(ed: AnyEditor) {
  editor = ed
  lastSig = ''
  if (editTimer != null) { clearTimeout(editTimer); editTimer = null }
  const WCg = w().WC
  WCg.NotesArea = {
    refresh: () => schedule(),
    render, // synchronous variant (probe/test determinism)
    showNotes, // refShowNotes (references.ts) routes here
  }
  ed.on?.('transaction', schedule)
  schedule()
}
