// One construction path for the vendored Editor (boot + Open + New).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'

export async function createPmEditor(mountEl: HTMLElement, source: ArrayBuffer) {
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(source)
  return new (Editor as any)({
    element: mountEl,
    mode: 'docx',
    content: docx,
    mediaFiles,
    fonts,
    extensions: getStarterExtensions(),
    user: { name: 'local', email: '' },
    isDebug: false,
    telemetry: { enabled: false },
  })
}
