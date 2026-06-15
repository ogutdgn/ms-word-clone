import { Plugin } from 'prosemirror-state';

/**
 * Paragraph borders are a paragraph property (w:pBdr) and, in Word, CONTINUE onto
 * the next paragraph when you press Enter — e.g. a bottom border under a line keeps
 * running under each new line you add. The fork's splitBlock drops the whole
 * `paragraphProperties` object on split (so styleId / numbering follow Word's
 * next-style and list rules instead of blindly carrying), which also drops borders.
 *
 * This plugin re-applies ONLY the `borders` of the paragraph that was just split
 * onto the newly created paragraph. It fires on a fresh split (caret at the very
 * start of a paragraph whose previous sibling is bordered and which itself has no
 * borders yet), covering both "Enter at end → new empty bordered line" and
 * "Enter mid-paragraph → both halves stay bordered". It never overrides borders
 * that already exist, so it can't loop.
 */
export function createBorderCarryPlugin() {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;

      const sel = newState.selection;
      if (!sel.empty) return null;

      const $from = sel.$from;
      const para = $from.parent;
      if (para.type.name !== 'paragraph') return null;

      // Only just after a split: the caret sits at the START of the paragraph.
      // (A paste typically leaves the caret at the END of the inserted content.)
      if ($from.parentOffset !== 0) return null;

      const curProps = para.attrs?.paragraphProperties || null;
      if (curProps && curProps.borders) return null; // already bordered — nothing to do

      const depth = $from.depth;
      const index = $from.index(depth - 1);
      if (index <= 0) return null; // no previous sibling

      const container = $from.node(depth - 1);
      const prev = container.child(index - 1);
      if (!prev || prev.type.name !== 'paragraph') return null;

      const prevBorders = prev.attrs?.paragraphProperties?.borders || null;
      if (!prevBorders) return null;

      const pos = $from.before(depth);
      const tr = newState.tr.setNodeMarkup(pos, undefined, {
        ...para.attrs,
        paragraphProperties: { ...(curProps || {}), borders: prevBorders },
      });
      tr.setMeta('addToHistory', false); // fold into the user's Enter for a single undo
      return tr;
    },
  });
}
