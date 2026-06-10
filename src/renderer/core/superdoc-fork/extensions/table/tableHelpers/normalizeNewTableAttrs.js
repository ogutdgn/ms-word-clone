// @ts-check
import {
  DEFAULT_TBL_LOOK,
  resolvePreferredNewTableStyleId,
  TABLE_FALLBACK_BORDERS,
  TABLE_FALLBACK_CELL_PADDING,
  TABLE_STYLE_ID_TABLE_GRID,
} from '@superdoc/style-engine/ooxml';
import { readDefaultTableStyle, readSettingsRoot } from '../../../document-api-adapters/document-settings.js';
import { readTranslatedLinkedStyles } from '../../../core/parts/adapters/styles-read.js';
import { eighthPointsToPixels } from '../../../core/super-converter/helpers.js';
import { cloneBorders, mapBorderSizes } from './border-utils.js';
import { resolveTableStyleVisuals } from './resolveTableStyleVisuals.js';

/**
 * @typedef {Object} NormalizedTableAttrs
 * @property {string | null} tableStyleId - Resolved style ID (null if source is 'none')
 * @property {Object} [borders] - Fallback borders when no style exists
 * @property {Object} [tableProperties] - Table properties including fallback cellMargins
 */

/**
 * Resolves the preferred table style ID from the editor's converter context.
 * Encapsulates settings access and style catalog lookup.
 *
 * @param {Object} editor - The super-editor instance
 * @returns {{ styleId: string | null, source: string }}
 */
export function resolvePreferredNewTableStyleIdFromEditor(editor) {
  const translatedLinkedStyles = readTranslatedLinkedStyles(editor);

  let settingsDefaultStyleId = null;
  const converter = editor?.converter;
  if (converter) {
    const settingsRoot = readSettingsRoot(converter);
    if (settingsRoot) {
      settingsDefaultStyleId = readDefaultTableStyle(settingsRoot);
    }
  }

  return resolvePreferredNewTableStyleId(settingsDefaultStyleId, translatedLinkedStyles);
}

/**
 * Computes the attributes for a newly created table.
 *
 * When a style is resolved, returns only `tableStyleId` — borders come from
 * the style at render time via `resolveTableProperties`.
 * When no style exists (`source: 'none'`), returns inline fallback borders
 * and cell padding so the table renders with sensible defaults.
 *
 * @param {Object} editor - The super-editor instance
 * @returns {NormalizedTableAttrs}
 */
export function normalizeNewTableAttrs(editor) {
  const resolved = resolvePreferredNewTableStyleIdFromEditor(editor);

  if (resolved.source === 'none') {
    const fallbackPixelBorders = cloneBorders(TABLE_FALLBACK_BORDERS, TABLE_BORDER_SIDES);
    mapBorderSizes(fallbackPixelBorders, eighthPointsToPixels);

    return {
      tableStyleId: null,
      borders: fallbackPixelBorders,
      tableProperties: {
        borders: { ...TABLE_FALLBACK_BORDERS },
        cellMargins: {
          marginTop: { value: TABLE_FALLBACK_CELL_PADDING.top, type: 'dxa' },
          marginBottom: { value: TABLE_FALLBACK_CELL_PADDING.bottom, type: 'dxa' },
          marginLeft: { value: TABLE_FALLBACK_CELL_PADDING.left, type: 'dxa' },
          marginRight: { value: TABLE_FALLBACK_CELL_PADDING.right, type: 'dxa' },
        },
      },
    };
  }

  // Bake the resolved style's renderable visuals into the new table's attrs
  // (fork change, slice 6 T4, 2026-06-10): there is NO live render-time style
  // cascade in this fork (the `resolveTableProperties` render path the upstream
  // comment above refers to only exists in the layout-adapter, which the live PM
  // view does not use). Once table styles are minted into the catalog
  // (DEFAULT_LINKED_STYLES), resolution flips from 'none' to 'builtin-fallback'
  // (TableGrid) — without this bake newly inserted tables would render
  // borderless. Mirrors the importer's px `borders` projection.
  const visuals = resolveTableStyleVisuals(editor, resolved.styleId);

  return {
    tableStyleId: resolved.styleId,
    ...(visuals && Object.keys(visuals.borders).length ? { borders: visuals.borders } : {}),
    // Also include tableStyleId inside tableProperties so the exporter's
    // decodeProperties loop (which iterates Object.keys(tableProperties))
    // finds it and writes <w:tblStyle> into <w:tblPr>.
    tableProperties: { tableStyleId: resolved.styleId, tblLook: { ...DEFAULT_TBL_LOOK } },
  };
}

/**
 * Fallback style ID for standalone contexts (markdown import without editor).
 * Matches Word behavior where `TableGrid` is always the default.
 */
export const STANDALONE_TABLE_STYLE_ID = TABLE_STYLE_ID_TABLE_GRID;

const TABLE_BORDER_SIDES = ['top', 'bottom', 'left', 'right', 'insideH', 'insideV'];
