// Headless .docx import → { schema, doc }. Runs IN the Electron renderer (real DOM
// present), so NO jsdom/mockWindow (those would clobber global document/window and
// break the legacy tests). Stage C swaps the 'superdoc/super-editor' import to the
// vendored '@/core/superdoc-fork/...' path.
import { Editor, getStarterExtensions } from 'superdoc/super-editor'
import type { Schema } from '@/pm'

export interface ImportResult { schema: Schema; doc: unknown }

export async function importDocx(buf: ArrayBuffer): Promise<ImportResult> {
  // Published 5-tuple: [docx, media, mediaFiles, fonts, decrypted] — take index 2 + 3.
  const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(buf)
  // renderer has a real DOM; Editor falls back to global document — do NOT pass jsdom.
  // telemetry:{enabled:false} is load-bearing (ctor default is enabled:true; the
  // test-env guard does not apply in Electron → would POST on document-open).
  const editor = new (Editor as any)({
    isHeadless: true,
    extensions: getStarterExtensions(),
    content: docx,
    mediaFiles,
    fonts,
    telemetry: { enabled: false },
  })
  const schema = editor.schema as Schema     // PM Schema survives destroy()
  const doc = editor.getJSON()
  editor.destroy()
  return { schema, doc }
}
