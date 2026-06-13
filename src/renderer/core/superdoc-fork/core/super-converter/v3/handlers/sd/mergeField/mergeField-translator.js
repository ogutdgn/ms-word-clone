// @ts-check
import { NodeTranslator } from '@translator';

/** @type {import('@translator').XmlNodeName} */
const XML_NODE_NAME = 'sd:mergeField';

/**
 * The SuperDoc key. A UNIQUE name (`'fieldAnnotation-mergeField'`) — NOT the bare
 * `'fieldAnnotation'` the `w:sdt` translator uses — so this translator does not
 * collide on the decode-routing map. Export of a merge field goes through
 * `translate-field-annotation.js` (the PM node IS a `fieldAnnotation`), so this
 * translator's `decode` is never the merge-field export path.
 * @type {import('@translator').SuperDocNodeOrKeyName}
 */
const SD_NODE_NAME = 'fieldAnnotation-mergeField';

/**
 * Parse a mail-merge field instruction (e.g. ` MERGEFIELD FirstName `) into the
 * field code, the display label («…»), and the field name. Mirrors the bridge's
 * insert-side conventions (D10.2) so import↔insert produce identical attrs.
 * @param {string} instr
 * @returns {{ code: string, label: string, name: string }}
 */
function parseInstruction(instr) {
  const trimmed = (instr || '').trim();
  const code = trimmed.split(/\s+/)[0] || 'MERGEFIELD';
  if (code === 'MERGEFIELD') {
    const name = trimmed.slice('MERGEFIELD'.length).trim().replace(/^"|"$/g, '') || 'Field';
    return { code, label: `«${name}»`, name };
  }
  if (code === 'ADDRESSBLOCK') return { code, label: '«AddressBlock»', name: 'AddressBlock' };
  if (code === 'GREETINGLINE') return { code, label: '«GreetingLine»', name: 'GreetingLine' };
  if (code === 'NEXT') return { code, label: '«Next Record»', name: 'Next' };
  return { code, label: `{ ${trimmed} }`, name: code };
}

/**
 * Encode a <sd:mergeField> node as a SuperDoc `fieldAnnotation` node. Flag-INDEPENDENT:
 * unlike `handleAnnotationNode` (gated on `editor.options.annotations`, which the clone
 * never sets), this dedicated translator always emits the node (K-2).
 * @param {import('@translator').SCEncoderConfig} [params]
 * @returns {import('@translator').SCEncoderResult}
 */
const encode = (params) => {
  const node = (params?.nodes || [])[0];
  const { code, label, name } = parseInstruction(node?.attributes?.instruction);
  return {
    type: 'fieldAnnotation',
    attrs: {
      type: 'text',
      fieldType: code,
      fieldId: `mm-${name}-${(node?.attributes?.instruction || '').length}`,
      displayLabel: label,
      defaultDisplayLabel: label,
    },
  };
};

/**
 * Export of a merge field goes via `translate-field-annotation.js` (the PM node is a
 * `fieldAnnotation`), so this translator's decode is never the merge-field export path.
 * Present only so `NodeTranslator.from` accepts the config (decode must be a function).
 * @returns {null}
 */
const decode = () => null;

/** @type {import('@translator').NodeTranslatorConfig} */
export const config = {
  xmlName: XML_NODE_NAME,
  sdNodeOrKeyName: SD_NODE_NAME,
  type: NodeTranslator.translatorTypes.NODE,
  encode,
  decode,
};

/**
 * The NodeTranslator instance for the sd:mergeField element.
 * @type {import('@translator').NodeTranslator}
 */
export const translator = NodeTranslator.from(config);
