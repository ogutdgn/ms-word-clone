// NOTICE: net-new fork translator (ms-word-clone, 020 — Font Color Gradient).
// w14:textFill ↔ the textStyle.textGradient mark { type:'linear', angle:<deg>, stops:[{pos:0..1, color:'#RRGGBB'}] }.
// Scope v1: a LINEAR gradient with srgbClr stops (Word's Format Text Effects → Text Fill → Gradient). Radial paths
// and theme-color stops are out of scope (deferred). Units: w14:gs/@w14:pos is per-mille×100 (0..100000);
// w14:lin/@w14:ang is 60000ths of a degree (0..21600000).
import { NodeTranslator } from '@translator';

const XML_NAME = 'w14:textFill';
const SD_KEY = 'textGradient';
const DEG = 60000;

const nameIs = (el, suffix) => new RegExp(suffix + '$').test(el?.name || '');

export const translator = NodeTranslator.from({
  xmlName: XML_NAME,
  sdNodeOrKeyName: SD_KEY,
  // import: w14:textFill XML → the model object
  encode: ({ nodes }) => {
    const node = nodes?.[0];
    if (!node) return undefined;
    const grad = (node.elements || []).find((e) => nameIs(e, 'gradFill'));
    if (!grad) return undefined;
    const gsLst = (grad.elements || []).find((e) => nameIs(e, 'gsLst'));
    let themed = false;
    const stops = ((gsLst && gsLst.elements) || [])
      .filter((e) => nameIs(e, 'gs'))
      .map((gs) => {
        const posRaw = Number(gs.attributes?.['w14:pos'] ?? gs.attributes?.['pos']);
        const srgb = (gs.elements || []).find((e) => nameIs(e, 'srgbClr'));
        const hex = srgb?.attributes?.['w14:val'] ?? srgb?.attributes?.['val'];
        if (hex == null) themed = true; // a theme-color (w14:schemeClr) stop — out of v1 scope
        return {
          pos: Number.isFinite(posRaw) ? Math.round(posRaw) / 100000 : 0,
          color: hex ? '#' + String(hex).toUpperCase() : '#000000',
        };
      });
    // v1: skip degenerate (<2-stop) or theme-color gradients rather than corrupting them to all-black — the run
    // keeps its normal fill (the original w14:textFill is preserved verbatim, not re-imported as a wrong gradient).
    if (stops.length < 2 || themed) return undefined;
    const lin = (grad.elements || []).find((e) => nameIs(e, 'lin'));
    const angRaw = Number(lin?.attributes?.['w14:ang'] ?? lin?.attributes?.['ang']);
    const angle = Number.isFinite(angRaw) ? Math.round(angRaw / DEG) : 90;
    return { type: 'linear', angle, stops };
  },
  // export: the model object → w14:textFill XML
  decode: ({ node }) => {
    const o = node?.attrs?.[SD_KEY];
    // Require ≥2 stops — a 1-stop w14:gradFill is malformed OOXML (Word would flag the file for repair).
    if (!o || typeof o !== 'object' || !Array.isArray(o.stops) || o.stops.length < 2) return undefined;
    const gsEls = o.stops.map((s) => ({
      name: 'w14:gs',
      type: 'element',
      attributes: { 'w14:pos': String(Math.max(0, Math.min(100000, Math.round((Number(s.pos) || 0) * 100000)))) },
      elements: [{ name: 'w14:srgbClr', type: 'element', attributes: { 'w14:val': String(s.color || '#000000').replace(/^#/, '').toUpperCase() } }],
    }));
    // Normalize the angle into [0,360) (modulo, not clamp) so 400°/-45° wrap to the correct direction.
    const deg = (((Math.round(Number(o.angle) || 90)) % 360) + 360) % 360;
    const ang = deg * DEG;
    return {
      elements: [
        {
          name: 'w14:gradFill',
          type: 'element',
          elements: [
            { name: 'w14:gsLst', type: 'element', elements: gsEls },
            { name: 'w14:lin', type: 'element', attributes: { 'w14:ang': String(ang), 'w14:scaled': '1' } },
          ],
        },
      ],
    };
  },
});
