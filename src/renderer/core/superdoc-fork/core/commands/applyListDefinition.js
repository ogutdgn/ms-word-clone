// @ts-check
import { ListHelpers } from '@helpers/list-numbering-helpers.js';
import { mutateNumbering } from '@core/parts/adapters/numbering-mutation';
import { updateNumberingProperties } from './changeListLevel.js';
import {
  getResolvedParagraphProperties,
  calculateResolvedParagraphProperties,
} from '@extensions/paragraph/resolvedPropertiesCache.js';

/**
 * Apply a freshly-minted list definition with explicit per-level numFmt/lvlText to every
 * paragraph in the selection (preserving each paragraph's existing ilvl).
 *
 * Used by the multilevel-list gallery (full 9-level patterns) and the bullet library's
 * non-canonical glyphs (single-level override). Levels beyond `levels.length` keep the
 * minted base template's definition.
 *
 * Mirrors toggleList's 'create' mode: numbering-XML mutation happens via mutateNumbering
 * (outside PM history — same recorded caveat as every toggleList create), while paragraph
 * attrs move through the shared `tr` so undo restores the paragraphs.
 *
 * @param {Object} options
 * @param {'orderedList'|'bulletList'} options.listType
 * @param {Array<{fmt: string, text: string}>} options.levels  OOXML w:numFmt + w:lvlText per ilvl
 *   (base templates define 9 levels — entries beyond ilvl 8 are silently skipped)
 * @example
 * editor.commands.applyListDefinition({ listType: 'orderedList', levels: [
 *   { fmt: 'decimal', text: '%1.' }, { fmt: 'decimal', text: '%1.%2.' },
 * ]})
 */
export const applyListDefinition =
  ({ listType, levels }) =>
  ({ editor, state, tr, dispatch }) => {
    if (listType !== 'orderedList' && listType !== 'bulletList') return false;
    if (!Array.isArray(levels) || !levels.length) return false;

    const paragraphs = [];
    const { from, to } = state.selection;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph') {
        paragraphs.push({ node, pos });
        return false;
      }
      return true;
    });
    if (!paragraphs.length) return false;

    // Dry-run (`can()`) stops here — same guard as toggleList's create mode, so a
    // capability check never mints definitions into the numbering XML.
    if (!dispatch) return true;

    const numId = Number(ListHelpers.getNewListId(editor));
    ListHelpers.generateNewListDefinition({ numId, listType, editor });

    // Override the minted abstract's levels with the requested per-level fmt/lvlText.
    mutateNumbering(editor, 'applyListDefinition', (numbering) => {
      const abstractId = numbering.definitions[numId]?.elements?.find(
        (el) => el.name === 'w:abstractNumId',
      )?.attributes?.['w:val'];
      const abstract = numbering.abstracts[abstractId];
      if (!abstract?.elements) return;
      levels.forEach((lvl, i) => {
        const lvlEl = abstract.elements.find(
          (el) => el.name === 'w:lvl' && el.attributes?.['w:ilvl'] === String(i),
        );
        if (!lvlEl?.elements) return;
        const setChild = (name, value) => {
          const existing = lvlEl.elements.find((el) => el.name === name);
          if (existing) existing.attributes = { ...(existing.attributes || {}), 'w:val': value };
          else lvlEl.elements.push({ type: 'element', name, attributes: { 'w:val': value } });
        };
        setChild('w:numFmt', lvl.fmt);
        setChild('w:lvlText', lvl.text);
        // Strip the template's marker font (Symbol/Wingdings on bullet levels) so the
        // override's character renders literally — same move as setLvlStyleOnAbstract
        // (core/parts/adapters/numbering-transforms.ts stripMarkerFont).
        const rPr = lvlEl.elements.find((el) => el.name === 'w:rPr');
        if (rPr?.elements) rPr.elements = rPr.elements.filter((el) => el.name !== 'w:rFonts');
      });
    });

    for (const { node, pos } of paragraphs) {
      // getResolvedParagraphProperties is a cache-only WeakMap read — misses on nodes
      // the rendering pass hasn't visited; mirror textIndent.js's fallback or a fresh
      // paragraph silently resets to ilvl 0.
      const resolved =
        getResolvedParagraphProperties(node) ||
        calculateResolvedParagraphProperties(editor ?? {}, node, state.doc.resolve(pos));
      const existingIlvl = resolved?.numberingProperties?.ilvl ?? 0;
      updateNumberingProperties({ numId, ilvl: existingIlvl }, node, pos, editor, tr);
    }
    dispatch(tr);
    return true;
  };
