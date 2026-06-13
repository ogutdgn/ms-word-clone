/**
 * Processes a mail-merge field instruction (MERGEFIELD / ADDRESSBLOCK /
 * GREETINGLINE / NEXT and the merge-rule codes) and creates an `sd:mergeField`
 * node. Covers BOTH the `w:fldSimple` and the combined `w:fldChar` forms — the
 * caller (`preProcessNodesForFldChar`) dispatches both through
 * `getInstructionPreProcessor` by keyword.
 *
 * @param {import('../../v2/types/index.js').OpenXmlNode[]} nodesToCombine The nodes to combine.
 * @param {string} instrText The instruction text.
 * @param {import('../../v2/docxHelper').ParsedDocx} [_docx] The docx object (unused).
 * @param {Array<{type: string, text?: string}>} [instructionTokens] Raw instruction tokens.
 * @returns {import('../../v2/types/index.js').OpenXmlNode[]}
 */
export function preProcessMergefieldInstruction(nodesToCombine, instrText, _docx, instructionTokens = null) {
  return [
    {
      name: 'sd:mergeField',
      type: 'element',
      attributes: {
        instruction: (instrText || '').trim(),
        ...(instructionTokens ? { instructionTokens } : {}),
      },
      elements: nodesToCombine,
    },
  ];
}
