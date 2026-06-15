// NOTICE: net-new fork translator (Text Effects stage 2) — ms-word-clone.
// w14:glow ↔ the textStyle.textGlow mark {radiusPt, color}.
// Unit: w14:rad is the glow radius in EMU (1 pt = 12700 EMU). The glow color is a direct
// w14:srgbClr child (opaque — the model carries no alpha).
import { NodeTranslator } from '@translator';

const XML_NAME = 'w14:glow';
const SD_KEY = 'textGlow';
const EMU_PER_PT = 12700;

function findSrgbVal(node) {
  if (!node) return undefined;
  if (/srgbClr$/.test(node.name || '')) return node.attributes?.['w14:val'] ?? node.attributes?.['val'];
  for (const c of node.elements || []) {
    const v = findSrgbVal(c);
    if (v != null) return v;
  }
  return undefined;
}

export const translator = NodeTranslator.from({
  xmlName: XML_NAME,
  sdNodeOrKeyName: SD_KEY,
  encode: ({ nodes }) => {
    const node = nodes?.[0];
    if (!node) return undefined;
    const rad = Number(node.attributes?.['w14:rad']);
    const radiusPt = Number.isFinite(rad) && rad > 0 ? Math.round((rad / EMU_PER_PT) * 100) / 100 : 4;
    const hex = findSrgbVal(node);
    return { radiusPt, color: hex ? '#' + String(hex).toUpperCase() : '#000000' };
  },
  decode: ({ node }) => {
    const o = node?.attrs?.[SD_KEY];
    if (!o || typeof o !== 'object') return undefined;
    const emu = Math.max(0, Math.round((Number(o.radiusPt) || 4) * EMU_PER_PT));
    const hex = String(o.color || '#000000').replace(/^#/, '').toUpperCase();
    return {
      attributes: { 'w14:rad': String(emu) },
      elements: [{ name: 'w14:srgbClr', type: 'element', attributes: { 'w14:val': hex } }],
    };
  },
});
