import { decodeRPrFromMarks } from '@converter/styles.js';

/**
 * Finds the paragraph node and its position for a given resolved position.
 * @param {import('prosemirror-model').ResolvedPos} $pos
 * @returns {{ node: import('prosemirror-model').Node, pos: number } | null}
 */
function findParagraph($pos) {
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'paragraph') {
      return { node, pos: $pos.before(depth) };
    }
  }
  return null;
}

/**
 * Adds a single mark's run-property representation to an empty paragraph's
 * `paragraphProperties.runProperties`.
 *
 * @param {import('prosemirror-state').Transaction} tr
 * @param {import('prosemirror-model').Mark | { type: import('prosemirror-model').MarkType | { name: string } | string, attrs?: Record<string, unknown> }} mark
 */
export function addParagraphRunProperty(tr, mark) {
  if (!mark) return;

  updateEmptyParagraphRunProperties(tr, (currentRunProperties) => {
    const nextRunProperties = { ...(currentRunProperties || {}) };
    const decodedRunProperties = decodeRPrFromMarks([mark]);
    if (decodedRunProperties && typeof decodedRunProperties === 'object') {
      Object.assign(nextRunProperties, decodedRunProperties);
    }
    // MS-WORD-CLONE FORK EDIT (Phase 3, Home/Font, NOTICE'd): an attr explicitly
    // set to null is a CLEAR (e.g. toggling subscript/superscript OFF on an EMPTY
    // paragraph, where sub/super lives in the paragraph run properties, not
    // storedMarks). decodeRPrFromMarks omits null attrs, so the prior value would
    // otherwise persist — the "activates but won't deactivate on an empty doc"
    // bug. Remove the run-property keys for the nulled attrs (reuses the sibling
    // remove helper, scoped to just the null attributes).
    const nulledAttrs = {};
    for (const [attr, val] of Object.entries(mark.attrs || {})) {
      if (val == null) nulledAttrs[attr] = val;
    }
    if (Object.keys(nulledAttrs).length > 0) {
      removeRunPropertiesForMark(nextRunProperties, { type: mark.type, attrs: nulledAttrs });
    }
    return Object.keys(nextRunProperties).length > 0 ? nextRunProperties : null;
  });
}

/**
 * Removes a single mark's run-property representation from an empty paragraph's
 * `paragraphProperties.runProperties`.
 *
 * @param {import('prosemirror-state').Transaction} tr
 * @param {import('prosemirror-model').Mark | { type: import('prosemirror-model').MarkType | { name: string } | string, attrs?: Record<string, unknown> }} mark
 */
export function removeParagraphRunProperty(tr, mark) {
  if (!mark) return;

  updateEmptyParagraphRunProperties(tr, (currentRunProperties) => {
    const nextRunProperties = { ...(currentRunProperties || {}) };
    removeRunPropertiesForMark(nextRunProperties, mark);
    return Object.keys(nextRunProperties).length > 0 ? nextRunProperties : null;
  });
}

function updateEmptyParagraphRunProperties(tr, updater) {
  const { selection } = tr;
  if (!selection.empty) return;

  const result = findParagraph(selection.$head);
  if (!result) return;

  const { node: paragraph, pos: paragraphPos } = result;
  if (paragraph.content.size > 0) return;

  const currentParagraphProperties = paragraph.attrs.paragraphProperties;
  const currentRunProperties = currentParagraphProperties?.runProperties || null;
  const newRunProperties = updater(currentRunProperties);

  tr.setNodeMarkup(paragraphPos, undefined, {
    ...paragraph.attrs,
    paragraphProperties: {
      ...(currentParagraphProperties || {}),
      runProperties: newRunProperties,
    },
  });
}

function removeRunPropertiesForMark(runProperties, mark) {
  const type = mark?.type?.name ?? mark?.type;
  if (!type) return;

  if (type === 'textStyle') {
    Object.keys(mark.attrs || {}).forEach((attr) => {
      delete runProperties[attr];
    });
    return;
  }

  switch (type) {
    case 'bold':
    case 'italic':
    case 'strike':
    case 'underline':
    case 'highlight':
      delete runProperties[type];
      break;
    case 'link':
      delete runProperties.styleId;
      break;
  }
}
