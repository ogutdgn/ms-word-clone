import b64 from '@/core/generated/basic-list.docx.b64'

// Decode WITHOUT Node Buffer/fs (renderer has nodeIntegration:false). Works under file://.
export function fixtureArrayBuffer(): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}
