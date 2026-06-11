// One construction path for the vendored Editor (boot + Open + New).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'

// Real shapes: docx → DocxFileEntry[] | Record<string,unknown> (EditorOptions.content),
// mediaFiles → Record<string,unknown> (EditorOptions.mediaFiles),
// fonts → Record<string,unknown> (EditorOptions.fonts).
// Kept as unknown: @core/types/EditorConfig.js is a vendored .ts file; importing
// EditorOptions type-only from there requires an extra path alias round-trip that
// adds no runtime value. See src/renderer/core/superdoc-fork/core/types/EditorConfig.ts.
export type ParsedDocx = { docx: unknown; mediaFiles: unknown; fonts: unknown }

// Parse only — throws on corrupt input. Callers parse BEFORE tearing anything down.
export async function parseDocx(source: ArrayBuffer): Promise<ParsedDocx> {
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(source)
  return { docx, mediaFiles, fonts }
}

// slice 7: non-docx imports thread initial html through the docx constructor leg.
// onContentError matters because Editor#generatePmData catches a constructor-internal
// parse failure and emits 'contentError' (Editor.ts:2847-2851) — and the fork's
// DEFAULT handler RETHROWS it (Editor.ts:750-752: `({ error }) => { throw error; }`).
// Our override replaces that rethrow with a silent blank doc + flag, so
// replaceEditor can detect the degradation and recover in-PM instead of unwinding.
export type ExtraContent = { html?: string; onContentError?: () => void }

export function constructPmEditor(mountEl: HTMLElement, parsed: ParsedDocx, extra?: ExtraContent) {
  return new (Editor as any)({
    element: mountEl,
    mode: 'docx',
    content: parsed.docx,
    mediaFiles: parsed.mediaFiles,
    fonts: parsed.fonts,
    // slice 7: when set, the doc initializes from HTML via createDocFromHTML while the
    // converter keeps the (blank-template) docx context — the doc stays docx-exportable.
    ...(extra?.html ? { html: extra.html } : {}),
    ...(extra?.onContentError ? { onContentError: extra.onContentError } : {}),
    extensions: getStarterExtensions(),
    // slice 8 (A2): a REAL display identity — stamped as w:author/w:initials on tracked
    // changes and as creatorName on comment cards (legacy parity: review-tools/comments
    // used "Word User"). The oracle compares the author FLOW (stamp → card → docx →
    // reimport) against real Word, where the name comes from the signed-in account.
    user: { name: 'Word User', email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
}

export async function createPmEditor(mountEl: HTMLElement, source: ArrayBuffer) {
  return constructPmEditor(mountEl, await parseDocx(source))
}
