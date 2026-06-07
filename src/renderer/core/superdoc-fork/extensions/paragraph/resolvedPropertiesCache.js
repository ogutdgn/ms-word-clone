import { resolveParagraphProperties } from '@superdoc/style-engine/ooxml';
import { findParentNodeClosestToPos } from '@helpers/index.js';

const resolvedParagraphPropertiesCache = new WeakMap();

/**
 * Build the TableInfo object resolveParagraphProperties expects (style-engine
 * ooxml/index.ts) from the paragraph's ancestor chain. Real row/cell indices are
 * REQUIRED: determineCellStyleTypes keys firstRow/firstCol conditional formats on
 * them, and DEFAULT_TBL_LOOK enables both — hardcoded zeros would mark every
 * in-table paragraph as first-row+first-column.
 * @returns {Object|null} TableInfo, or null when not in a (styled) table
 */
function buildTableInfo($pos) {
  const tableNode = findParentNodeClosestToPos($pos, (node) => node.type.name === 'table');
  const tableStyleId = tableNode?.node.attrs.tableStyleId || null;
  if (!tableStyleId) return null;
  const rowNode = findParentNodeClosestToPos($pos, (node) => node.type.name === 'tableRow');
  const cellNode = findParentNodeClosestToPos(
    $pos,
    (node) => node.type.name === 'tableCell' || node.type.name === 'tableHeader',
  );
  let rowIndex = 0;
  let cellIndex = 0;
  let numCells = 0;
  const numRows = tableNode.node.childCount;
  if (rowNode) {
    tableNode.node.forEach((child, _offset, index) => {
      if (child === rowNode.node) rowIndex = index;
    });
    numCells = rowNode.node.childCount;
    if (cellNode) {
      rowNode.node.forEach((child, _offset, index) => {
        if (child === cellNode.node) cellIndex = index;
      });
    }
  }
  // Spread the table's full tableProperties (carries tblLook + band sizes — the
  // style-engine reads tableInfo.tableProperties?.tblLook ?? DEFAULT_TBL_LOOK);
  // top-level attrs.tableStyleId wins over any stale copy inside tableProperties.
  return {
    tableProperties: { ...(tableNode.node.attrs.tableProperties ?? {}), tableStyleId },
    rowIndex,
    cellIndex,
    numRows,
    numCells,
  };
}

export function getResolvedParagraphProperties(node) {
  return resolvedParagraphPropertiesCache.get(node);
}

export function calculateResolvedParagraphProperties(editor, node, $pos) {
  if (!editor.converter) {
    return node.attrs.paragraphProperties || {};
  }
  const cached = getResolvedParagraphProperties(node);
  if (cached) {
    return cached;
  }
  const tableInfo = buildTableInfo($pos);
  const paragraphProperties = resolveParagraphProperties(
    {
      translatedNumbering: editor.converter.translatedNumbering,
      translatedLinkedStyles: editor.converter.translatedLinkedStyles,
    },
    node.attrs.paragraphProperties || {},
    tableInfo,
  );
  resolvedParagraphPropertiesCache.set(node, paragraphProperties);
  return paragraphProperties;
}

/**
 * Resolve the OOXML cascade for a *hypothetical* inline props object —
 * used by commands that need to know what would resolve if the inline
 * override were modified or removed. Not cached (the input does not
 * correspond to a real node identity).
 * @returns The resolved paragraph properties, or the inline props
 *   unchanged when the converter is unavailable (e.g., headless tests).
 */
export function resolveHypotheticalParagraphProperties(editor, $pos, inlineProps) {
  if (!editor?.converter) return inlineProps;
  const tableInfo = buildTableInfo($pos);
  return resolveParagraphProperties(
    {
      translatedNumbering: editor.converter.translatedNumbering,
      translatedLinkedStyles: editor.converter.translatedLinkedStyles,
    },
    inlineProps,
    tableInfo,
  );
}
