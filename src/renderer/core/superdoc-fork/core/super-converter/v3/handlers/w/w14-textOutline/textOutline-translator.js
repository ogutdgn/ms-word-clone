// NOTICE: net-new fork translator (Text Effects stage 2) — ms-word-clone.
// w14:textOutline ↔ the textStyle.textOutline mark {widthPt, color, fill}.
// Unit: w14:w is the stroke width in EMU (1 pt = 12700 EMU). The stroke color is a
// w14:solidFill > w14:srgbClr child. (The text FILL — o.fill — is a separate w14:textFill
// concern and is not emitted here.)
import { NodeTranslator } from '@translator';

const XML_NAME = 'w14:textOutline';
const SD_KEY = 'textOutline';
const EMU_PER_PT = 12700;

// Find the first w14:srgbClr/a:srgbClr val anywhere in the subtree.
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
    const w = Number(node.attributes?.['w14:w']);
    const widthPt = Number.isFinite(w) && w > 0 ? Math.round((w / EMU_PER_PT) * 100) / 100 : 1;
    const hex = findSrgbVal(node);
    return { widthPt, color: hex ? '#' + String(hex).toUpperCase() : '#000000', fill: 'transparent' };
  },
  decode: ({ node }) => {
    const o = node?.attrs?.[SD_KEY];
    if (!o || typeof o !== 'object') return undefined;
    const emu = Math.max(0, Math.round((Number(o.widthPt) || 1) * EMU_PER_PT));
    const hex = String(o.color || '#000000').replace(/^#/, '').toUpperCase();
    return {
      attributes: { 'w14:w': String(emu), 'w14:cap': 'flat', 'w14:cmpd': 'sng', 'w14:algn': 'ctr' },
      elements: [
        { name: 'w14:solidFill', type: 'element', elements: [{ name: 'w14:srgbClr', type: 'element', attributes: { 'w14:val': hex } }] },
        { name: 'w14:prstDash', type: 'element', attributes: { 'w14:val': 'solid' } },
        { name: 'w14:round', type: 'element' },
      ],
    };
  },
});
