// Offline proofing engine for the Editor pane.
//   spelling   — nspell + a vendored SCOWL en_US Hunspell dictionary (dict/, MIT AND BSD)
//   grammar    — mechanical rules (repeated words, a/an, spacing, common confusions, capitalization)
//   refinement — write-good (passive voice / wordiness / weasel words → Clarity & Conciseness)
// Exposed on window.WC.Proofing for the classic Editor pane. Word's CLOUD Editor pieces
// (the ML Editor Score, Similarity, Insights, and the Formality/Punctuation/Resume
// refinements) require Microsoft 365 and stay flagged — see docs/SCOPE.md.
import nspell from 'nspell'
import affData from './dict/en_US.aff?raw'
import dicData from './dict/en_US.dic?raw'

export interface SpellHit { word: string; index: number; suggestions: string[] }
export interface GrammarHit { index: number; length: number; text: string; message: string; suggestion: string | null; kind: string }
export interface RefineHit { index: number; length: number; text: string; message: string; suggestion: string | null; category: string }

let spell: any = null
let buildP: Promise<void> | null = null
const userWords = new Set<string>()

// Lazily build nspell (a ~150ms synchronous parse of the 50k-word dictionary) — deferred
// a tick so the pane can paint a "Checking…" state first, and only on first use.
function ensureReady(): Promise<void> {
  if (spell) return Promise.resolve()
  if (!buildP) {
    buildP = new Promise<void>((resolve) => {
      setTimeout(() => {
        try { spell = nspell(affData as unknown as string, dicData as unknown as string) }
        catch (e) { console.error('[proofing] dictionary build failed:', e); spell = { correct: () => true, suggest: () => [], add: () => {} } }
        userWords.forEach((w) => spell.add(w))
        resolve()
      }, 0)
    })
  }
  return buildP
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g

function isCheckable(word: string): boolean {
  if (word.length < 2) return false
  if (/^[A-Z0-9]+$/.test(word)) return false // ALL-CAPS acronyms — Word ignores these by default
  if (/\d/.test(word)) return false
  return true
}

function spellCheck(text: string): SpellHit[] {
  if (!spell) return []
  const out: SpellHit[] = []
  WORD_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_RE.exec(text))) {
    const word = m[0]
    if (!isCheckable(word) || userWords.has(word.toLowerCase())) continue
    if (!spell.correct(word)) out.push({ word, index: m.index, suggestions: (spell.suggest(word) || []).slice(0, 5) })
  }
  return out
}

// 'a' before these vowel-letter words is actually correct (consonant sound): a unicorn, a one-time…
const A_VOWEL_OK = /^(uni|use|user|usu|usa|ubiq|euro|eul|ewe|one|once|u[bcdfghjklmnpqrstvwxz])/i
// 'an' before these consonant-letter words is correct (vowel sound): an hour, an X-ray, an MBA…
const AN_CONS_OK = /^(hour|honest|heir|honou?r|x|m|f|n|l|s|h|r)$|^(hour|honest|heir|honou?r)/i

function grammarCheck(text: string): GrammarHit[] {
  const out: GrammarHit[] = []
  const push = (index: number, length: number, message: string, suggestion: string | null, kind: string) =>
    out.push({ index, length, text: text.slice(index, index + length), message, suggestion, kind })
  let re: RegExp, m: RegExpExecArray | null

  // [^\S\n] = horizontal whitespace only — these spans get REPLACED, so they must not
  // cross a paragraph boundary (the \n separators scanModel inserts between blocks).
  re = /\b([A-Za-z]+)[^\S\n]+\1\b/gi
  while ((m = re.exec(text))) push(m.index, m[0].length, 'Repeated word', m[1], 'repeat')

  re = / {2,}/g
  while ((m = re.exec(text))) push(m.index, m[0].length, 'Multiple spaces in a row', ' ', 'spacing')

  re = /[^\S\n]+([,.;:!?])/g
  while ((m = re.exec(text))) push(m.index, m[0].length, 'Space before punctuation', m[1], 'spacing')

  re = /\b(could|should|would|must|might)[^\S\n]+of\b/gi
  while ((m = re.exec(text))) push(m.index, m[0].length, 'Did you mean “' + m[1].toLowerCase() + ' have”?', m[1] + ' have', 'confusion')

  re = /\balot\b/gi
  while ((m = re.exec(text))) push(m.index, m[0].length, 'Did you mean “a lot”?', 'a lot', 'confusion')

  re = /\b(a)[^\S\n]+([A-Za-z]+)/g
  while ((m = re.exec(text))) { const n = m[2]; if (/^[aeiou]/i.test(n) && !A_VOWEL_OK.test(n)) push(m.index, m[0].length, 'Use “an” before a vowel sound', 'an ' + n, 'article') }

  re = /\b(an)[^\S\n]+([A-Za-z]+)/gi
  while ((m = re.exec(text))) { const n = m[2]; if (!/^[aeiou]/i.test(n) && !AN_CONS_OK.test(n)) push(m.index, m[0].length, 'Use “a” before a consonant sound', 'a ' + n, 'article') }

  re = /(^|[.!?]\s+)([a-z])/g
  while ((m = re.exec(text))) {
    const at = m.index + m[1].length
    if (/\b[A-Za-z]\.\s$/.test(text.slice(Math.max(0, at - 4), at))) continue // skip abbreviations (e.g., i.e.)
    push(at, 1, 'Begin the sentence with a capital letter', m[2].toUpperCase(), 'capitalize')
  }

  out.sort((a, b) => a.index - b.index)
  return out
}

// Offline style refinements (Word's cloud Editor does these with ML; this is a
// deterministic heuristic subset → Conciseness + Clarity). The rest (Formality,
// Punctuation Conventions, Resume, Vocabulary, the ML score) stay cloud-flagged.
const WEASEL = ['very', 'really', 'quite', 'basically', 'actually', 'simply', 'just', 'rather', 'somewhat', 'fairly', 'totally', 'literally', 'virtually', 'definitely', 'probably', 'clearly', 'obviously', 'essentially']
const WORDY: Array<[RegExp, string]> = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bin the event that\b/gi, 'if'],
  [/\ba large number of\b/gi, 'many'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bin the near future\b/gi, 'soon'],
  [/\beach and every\b/gi, 'every'],
]
function refineCheck(text: string): RefineHit[] {
  const out: RefineHit[] = []
  const push = (index: number, length: number, message: string, suggestion: string | null, category: string) =>
    out.push({ index, length, text: text.slice(index, index + length), message, suggestion, category })
  let m: RegExpExecArray | null

  const weaselRe = new RegExp('\\b(' + WEASEL.join('|') + ')\\b', 'gi')
  while ((m = weaselRe.exec(text))) push(m.index, m[0].length, '“' + m[0] + '” can weaken your meaning', null, 'Conciseness')

  for (const [re, repl] of WORDY) { re.lastIndex = 0; while ((m = re.exec(text))) push(m.index, m[0].length, 'Wordy — consider “' + repl + '”', repl, 'Conciseness') }

  const passiveRe = /\b(is|are|was|were|be|been|being)\s+(\w+ed|written|made|done|taken|given|known|seen|shown|held|built|sent|kept)\b/gi
  while ((m = passiveRe.exec(text))) push(m.index, m[0].length, 'Passive voice — consider an active construction', null, 'Clarity')

  out.sort((a, b) => a.index - b.index)
  return out
}

function correct(word: string): boolean { return spell ? spell.correct(word) : true }
function suggest(word: string): string[] { return spell ? (spell.suggest(word) || []).slice(0, 5) : [] }
function add(word: string): void { userWords.add(word.toLowerCase()); if (spell) spell.add(word) }

export function installProofing(w: any): void {
  w.WC = w.WC || {}
  w.WC.Proofing = { ensureReady, isReady: () => !!spell, spellCheck, grammarCheck, refineCheck, correct, suggest, add }
}
