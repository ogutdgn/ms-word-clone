import b64 from '@/core/generated/basic-list.docx.b64'
import { BLANK_DOCX_B64 } from '@/core/generated/blank.docx.b64'

// Decode WITHOUT Node Buffer/fs (renderer has nodeIntegration:false). Works under file://.
function b64ToArrayBuffer(s: string): ArrayBuffer {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export function fixtureArrayBuffer(): ArrayBuffer { return b64ToArrayBuffer(b64) }

// Blank document template — used by "New Document" on the PM core.
// Decodes identically to fixtureArrayBuffer(); kept as a separate export for clarity.
export function blankArrayBuffer(): ArrayBuffer { return b64ToArrayBuffer(BLANK_DOCX_B64) }
