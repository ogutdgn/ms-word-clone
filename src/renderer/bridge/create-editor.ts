// One construction path for the vendored Editor (boot + Open + New).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'

export type ParsedDocx = { docx: unknown; mediaFiles: unknown; fonts: unknown }

// Parse only — throws on corrupt input. Callers parse BEFORE tearing anything down.
export async function parseDocx(source: ArrayBuffer): Promise<ParsedDocx> {
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(source)
  return { docx, mediaFiles, fonts }
}

export function constructPmEditor(mountEl: HTMLElement, parsed: ParsedDocx) {
  return new (Editor as any)({
    element: mountEl,
    mode: 'docx',
    content: parsed.docx,
    mediaFiles: parsed.mediaFiles,
    fonts: parsed.fonts,
    extensions: getStarterExtensions(),
    user: { name: 'local', email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
}

export async function createPmEditor(mountEl: HTMLElement, source: ArrayBuffer) {
  return constructPmEditor(mountEl, await parseDocx(source))
}
