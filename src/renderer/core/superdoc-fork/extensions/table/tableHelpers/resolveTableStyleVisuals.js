// @ts-check
// Fork addition (ms-word-clone slice 6 T4, 2026-06-10 — NOTICE.md).
//
// Runtime resolver: table styleId → the RENDERABLE visuals the live PM view can
// show through EXISTING attr paths (the table node's px-shaped `borders` attr and
// the cell `background` attr). This is the apply-time counterpart of what the
// import path bakes via `_getReferencedTableStyles` (tbl-translator) — without it
// `setTableStyle` was model/attr-only and the Table Styles gallery looked dead.
//
// It deliberately resolves through the style-engine cascade primitives
// (`resolveTableProperties` for w:tblPr borders down the basedOn chain;
// `resolveTableCellProperties` for the w:tblStylePr conditional cascade) instead
// of duplicating styles.xml walking. Only the STABLE subset is baked:
//   - whole-table borders (style base w:tblPr w:tblBorders → px `borders` attr)
//   - the firstRow fill (w:tblStylePr[firstRow] w:tcPr w:shd → cell `background`)
// Banded rows/columns and the remaining conditional formats (lastRow, firstCol
// run props, …) are NOT baked — they would go stale on row/column edits; Word
// recomputes them dynamically. That rendering remains a Phase-7 deferral; the
// EXPORTED file carries the full definition, so real Word renders the complete
// style (banding included).

import {
  DEFAULT_TBL_LOOK,
  resolveTableProperties,
  resolveTableCellProperties,
} from '@superdoc/style-engine/ooxml';
import { readTranslatedLinkedStyles } from '../../../core/parts/adapters/styles-read.js';
import { eighthPointsToPixels } from '../../../core/super-converter/helpers.js';

/**
 * @typedef {Object} TableStyleVisuals
 * @property {Object} borders - px-shaped borders for the table node's `borders` attr
 *   (`{ top|left|bottom|right|insideH|insideV: { size:<px>, color?:'#RRGGBB', val } }`).
 *   Same projection the importer produces via `_processTableBorders`.
 * @property {string|null} firstRowFill - hex fill (NO leading '#', matching the cell
 *   `background.color` convention) from the style's firstRow conditional, or null.
 */

/**
 * Resolve the bakeable visuals for a table style from the runtime styles catalog.
 *
 * @param {Object} editor - super-editor instance (reads `editor.converter.translatedLinkedStyles`)
 * @param {string|null|undefined} styleId - w:styleId to resolve
 * @param {Object|null} [tblLook] - the table's tblLook flags; defaults to OOXML 0x04A0
 * @returns {TableStyleVisuals|null} null when the style is unknown to the catalog
 */
export function resolveTableStyleVisuals(editor, styleId, tblLook = null) {
  const translatedLinkedStyles = readTranslatedLinkedStyles(editor);
  if (!styleId || !translatedLinkedStyles?.styles?.[styleId]) return null;

  // --- table-level borders (basedOn chain) → importer px projection ---
  const tableProps = resolveTableProperties(styleId, translatedLinkedStyles) || {};
  /** @type {Record<string, {size?: number, color?: string, val?: string}>} */
  const borders = {};
  Object.entries(tableProps.borders || {}).forEach(([side, spec]) => {
    if (!spec || typeof spec !== 'object') return;
    const { val, size, color } = /** @type {{val?:string, size?:number, color?:string}} */ (spec);
    if (val === 'none' || val === 'nil') return;
    /** @type {{size?: number, color?: string, val?: string}} */
    const out = {};
    const px = eighthPointsToPixels(size);
    if (px != null && Number.isFinite(px)) out.size = px;
    // The border attr handler already '#'-prefixes colors; 'auto' renders as black downstream.
    if (color && color !== 'auto') out.color = color;
    if (val) out.val = val;
    borders[side] = out;
  });

  // --- firstRow fill (conditional cascade, honoring tblLook) ---
  let firstRowFill = null;
  try {
    const cellProps = resolveTableCellProperties(
      null,
      {
        tableProperties: { tableStyleId: styleId, tblLook: tblLook || { ...DEFAULT_TBL_LOOK } },
        // A generic interior first-row cell: rowIndex 0 triggers firstRow; a middle
        // cellIndex avoids mixing firstCol/lastCol shading into the probe.
        rowIndex: 0,
        cellIndex: 1,
        numRows: 3,
        numCells: 3,
        rowCnfStyle: null,
        cellCnfStyle: null,
      },
      translatedLinkedStyles,
    );
    const fill = cellProps?.shading?.fill;
    if (fill && fill !== 'auto') firstRowFill = String(fill).replace(/^#/, '');
  } catch {
    firstRowFill = null; // cascade probe must never break the apply
  }

  return { borders, firstRowFill };
}
