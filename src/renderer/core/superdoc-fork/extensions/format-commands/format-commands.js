// @ts-nocheck
import { Extension } from '@core/Extension.js';
import { getMarksFromSelection, getFormattingStateAtPos } from '@core/helpers/getMarksFromSelection.js';
import { toggleMarkCascade } from '@core/commands/toggleMarkCascade.js';

const FORMAT_PAINTER_DOUBLE_CLICK_MS = 500;
// Chrome surfaces whose clicks must NOT consume the armed painter. Upstream
// SuperDoc selectors stay first; the rest are this app's REAL chrome roots
// (ids/classes verified against src/renderer/index.html + public/styles/*.css):
// titlebar/tabstrip/ribbon (incl. flyouts/dropdowns/galleries), statusbar,
// backstage, dialogs/modals/toasts, context menus, ruler. The editor surfaces
// (#editor / #pm-editor / .ProseMirror) are deliberately EXCLUDED so clicking
// into the document to pick a paint target still triggers the apply (slice 4).
const FORMAT_PAINTER_UI_SELECTOR =
  '[data-editor-ui-surface], .toolbar-dropdown-menu, .sd-toolbar-dropdown-menu, .sd-tooltip-content, ' +
  '#titlebar, #tabstrip, #ribbon, #statusbar, #backstage, #modal-root, #ruler, ' +
  '.flyout, .rdrop, .rsplit, .ribbon-panel, .styles-gallery, .pens-gallery, ' +
  '.context-menu, .cb-item-menu, .rm-menu, .dialog, .modal-backdrop, .taskpane, .toast, .toast-wrap';

/**
 * Stored format style
 * @typedef {Object} StoredStyle
 * @property {string} name - Mark name
 * @property {Object} attrs - Mark attributes
 */

/**
 * Configuration options for FormatCommands
 * @typedef {Object} FormatCommandsOptions
 * @category Options
 */

/**
 * @module FormatCommands
 * @sidebarTitle Format Commands
 * @snippetPath /snippets/extensions/format-commands.mdx
 * @shortcut Mod-Alt-c | clearFormat | Clear all formatting
 */
export const FormatCommands = Extension.create({
  name: 'formatCommands',

  addOptions() {
    return {};
  },

  addStorage() {
    return {
      /**
       * @private
       * @type {StoredStyle[]|null}
       */
      storedStyle: null,
      /**
       * @private
       * Paragraph-scope properties the Word painter carries (slice 4): styleId,
       * justification, spacing, numbering, etc. Captured alongside the marks.
       * @type {Object|null}
       */
      storedParaProps: null,
      sourceSelection: null,
      persistent: false,
      lastCopyFormatClickAt: 0,
      releaseCleanup: null,
      pointerSelecting: false,
      keyboardSelecting: false,
    };
  },

  addCommands() {
    return {
      toggleMarkCascade,
      /**
       * Clear all formatting (nodes and marks)
       * @category Command
       * @example
       * editor.commands.clearFormat()
       * @note Removes all marks and resets nodes to default paragraph
       */
      clearFormat:
        () =>
        ({ chain }) => {
          return chain().clearNodes().unsetAllMarks().run();
        },

      /**
       * Clear only mark formatting
       * @category Command
       * @example
       * editor.commands.clearMarksFormat()
       * @note Removes bold, italic, underline, colors, etc. but preserves block structure
       */
      clearMarksFormat:
        () =>
        ({ chain }) => {
          return chain().unsetAllMarks().run();
        },

      /**
       * Clear only node formatting
       * @category Command
       * @example
       * editor.commands.clearNodesFormat()
       * @note Converts headings, lists, etc. to paragraphs but preserves text marks
       */
      clearNodesFormat:
        () =>
        ({ chain }) => {
          return chain().clearNodes().run();
        },

      /**
       * Copy format from selection or apply copied format
       * @category Command
       * @example
       * editor.commands.copyFormat()
       * @note Works like format painter: click copies for one target selection; double-click keeps it active
       */
      copyFormat:
        (options = {}) =>
        ({ chain }) => {
          const currentSelection = getSelectionRange(this.editor.state);

          if (!this.storage.storedStyle && !this.storage.storedParaProps) {
            this.storage.storedStyle = captureMarks(this.editor.state, this.editor);
            this.storage.storedParaProps = captureParaProps(this.editor.state);
            this.storage.sourceSelection = currentSelection;
            this.storage.persistent = !!options.persistent;
            this.storage.lastCopyFormatClickAt = Date.now();
            armFormatPainterRelease({ storage: this.storage, editor: this.editor });
            return true;
          }

          // Explicit intent (app entry points): idempotent sticky promotion — the
          // ribbon dblclick arrives as click,click,dblclick and must end ARMED-STICKY.
          if (options.persistent) {
            this.storage.persistent = true;
            this.storage.lastCopyFormatClickAt = 0;
            return true;
          }

          if (this.storage.persistent) {
            clearFormatPainterStorage(this.storage);
            return true;
          }

          const clickedSourceAgain = isSameSelection(currentSelection, this.storage.sourceSelection);
          // 500ms promotion heuristic stays alive ONLY for no-arg callers (devtools/
          // upstream parity) — explicit callers are deterministic.
          const isDoubleClick =
            !('persistent' in options) &&
            clickedSourceAgain &&
            Date.now() - this.storage.lastCopyFormatClickAt <= FORMAT_PAINTER_DOUBLE_CLICK_MS;

          if (isDoubleClick && !this.storage.persistent) {
            this.storage.persistent = true;
            this.storage.lastCopyFormatClickAt = 0;
            return true;
          }

          if (clickedSourceAgain) {
            clearFormatPainterStorage(this.storage);
            return true;
          }

          return applyStoredFormat.call(this, { chain, storage: this.storage });
        },

      /**
       * Apply the stored format painter style to the current selection.
       * @category Command
       * @example
       * editor.commands.applyStoredFormat()
       */
      applyStoredFormat:
        () =>
        ({ chain }) => {
          return applyStoredFormat({ chain, storage: this.storage });
        },

      /**
       * Cancel/disarm the format painter (Word's Esc path).
       * @category Command
       * @example
       * editor.commands.cancelFormatPainter()
       * @note Returns false when nothing is armed so callers can fall through.
       */
      cancelFormatPainter:
        () =>
        () => {
          if (!this.storage.storedStyle && !this.storage.storedParaProps) return false;
          clearFormatPainterStorage(this.storage);
          return true;
        },
    };
  },

  onSelectionUpdate({ editor }) {
    const { storedStyle, sourceSelection } = this.storage;
    if (!storedStyle) return;

    const currentSelection = getSelectionRange(editor.state);
    if (editor.state.selection.empty || isSameSelection(currentSelection, sourceSelection)) return;
    if (this.storage.pointerSelecting || this.storage.keyboardSelecting) return;

    editor.commands.applyStoredFormat();
  },

  onDestroy() {
    clearFormatPainterStorage(this.storage);
  },

  addShortcuts() {
    return {
      'Mod-Alt-c': () => this.editor.commands.clearFormat(),
    };
  },
});

function getSelectionRange(state) {
  const { from, to } = state.selection;
  return { from, to };
}

function isSameSelection(selection, otherSelection) {
  if (!selection || !otherSelection) return false;
  return selection.from === otherSelection.from && selection.to === otherSelection.to;
}

/** Capture the marks the Word painter copies (slice 4). Word copies the FIRST run's
 *  formatting on a non-empty selection (oracle probe B9 — getMarksFromSelection
 *  INTERSECTS, returning [] on mixed runs, which is wrong); a collapsed caret keeps
 *  getMarksFromSelection (correct caret marks). The `link` mark is never carried
 *  (oracle B8 — painter must not spray hyperlinks). Returns mark INSTANCES (with
 *  `.type.name`/`.attrs`), matching the shape applyStoredFormat re-applies.
 *
 *  NOTE (fork deviation from the plan's `state.doc.nodeAt(sel.from)`): this fork
 *  wraps text in `run` nodes, so at a run boundary `nodeAt` returns the run node
 *  whose `.marks` is empty — bold/italic live on the inner text node and partly in
 *  run/paragraph runProperties. We therefore reuse the engine's own per-position
 *  resolver `getFormattingStateAtPos` (the exact primitive `getFormattingStateForRange`
 *  feeds per segment) at the FIRST text segment, giving the first run's resolved
 *  marks with no intersection. Verified live (devtools probe): bold source → stored
 *  bold; uniform/mixed both copy the first run. */
function captureMarks(state, editor) {
  const sel = state.selection;
  if (sel.empty) {
    return (getMarksFromSelection(state, editor) || []).filter((m) => m.type.name !== 'link');
  }
  let firstTextPos = null;
  state.doc.nodesBetween(sel.from, sel.to, (node, pos) => {
    if (firstTextPos !== null) return false;
    if (node.isText && node.text?.length) {
      firstTextPos = pos + 1; // a position INSIDE the first character's run
      return false;
    }
    return true;
  });
  const marks =
    firstTextPos !== null
      ? getFormattingStateAtPos(state, firstTextPos, editor).resolvedMarks
      : state.doc.resolve(sel.from).marks();
  return (marks || []).filter((m) => m.type.name !== 'link');
}

/** Head-paragraph paragraphProperties the Word painter carries (slice 4 — full set
 *  incl. styleId/justification/spacing per oracle B2/B3; numbering CARRIED per the
 *  plan default, B7 unobserved). Deep-cloned so the snapshot can't alias live attrs. */
function captureParaProps(state) {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const n = $from.node(d);
    if (n.type.name === 'paragraph') {
      const pp = n.attrs?.paragraphProperties || {};
      return Object.keys(pp).length ? JSON.parse(JSON.stringify(pp)) : null;
    }
  }
  return null;
}

function clearFormatPainterStorage(storage) {
  storage.releaseCleanup?.();
  storage.storedStyle = null;
  storage.storedParaProps = null;
  storage.sourceSelection = null;
  storage.persistent = false;
  storage.lastCopyFormatClickAt = 0;
  storage.releaseCleanup = null;
  storage.pointerSelecting = false;
  storage.keyboardSelecting = false;
}

function armFormatPainterRelease({ storage, editor }) {
  if (storage.releaseCleanup) return;
  if (typeof document === 'undefined' || !document?.addEventListener) return;

  const pointerDownEventName = typeof PointerEvent === 'undefined' ? 'mousedown' : 'pointerdown';
  const pointerUpEventName = typeof PointerEvent === 'undefined' ? 'mouseup' : 'pointerup';
  const isToolbarEvent = (event) => event?.target?.closest?.(FORMAT_PAINTER_UI_SELECTOR);

  const applyIfTargetSelected = () => {
    if (!storage.storedStyle) return;
    const selection = editor.state.selection;
    const currentSelection = getSelectionRange(editor.state);
    if (selection.empty || isSameSelection(currentSelection, storage.sourceSelection)) return;

    editor.commands.applyStoredFormat();
  };

  const handlePointerDown = (event) => {
    if (isToolbarEvent(event)) {
      storage.pointerSelecting = false;
      return;
    }
    storage.pointerSelecting = true;
  };

  const handleRelease = (event) => {
    if (isToolbarEvent(event)) {
      storage.pointerSelecting = false;
      return;
    }
    storage.pointerSelecting = false;
    applyIfTargetSelected();
  };

  const handleKeyDown = (event) => {
    if (isToolbarEvent(event)) return;
    if (isFormatPainterSelectionKey(event)) storage.keyboardSelecting = true;
  };

  const handleKeyUp = () => {
    if (!storage.keyboardSelecting) return;
    storage.keyboardSelecting = false;
    applyIfTargetSelected();
  };

  document.addEventListener(pointerDownEventName, handlePointerDown, true);
  document.addEventListener(pointerUpEventName, handleRelease, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  storage.releaseCleanup = () => {
    document.removeEventListener(pointerDownEventName, handlePointerDown, true);
    document.removeEventListener(pointerUpEventName, handleRelease, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
  };
}

function isFormatPainterSelectionKey(event) {
  if (!event?.shiftKey) return false;
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key);
}

/**
 * Apply the stored painter format to the current selection (slice 4 — Word scope).
 * Replace-not-merge (oracle B6): every schema mark EXCEPT `link` is cleared on the
 * target first (oracle B8 — hyperlinks survive paint-over), then the stored marks
 * and paragraphProperties are re-applied generically. Clear + marks + paraProps run
 * in ONE chain (single `tr`) so undo reverts the whole paint in one step.
 * `.command(fn)` is the fork's generic command runner (registered command, chainable).
 */
function applyStoredFormat({ chain, storage }) {
  if (!storage.storedStyle && !storage.storedParaProps) return false;
  const shouldStayActive = storage.persistent;
  try {
    let result = chain();
    // Replace-not-merge (oracle B6) — but link SURVIVES (oracle B8): clear every
    // schema mark except link across the selection on the shared transaction.
    result = result.command(({ state, tr, dispatch }) => {
      const { from, to } = state.selection;
      Object.values(state.schema.marks).forEach((markType) => {
        if (markType.name === 'link') return;
        tr.removeMark(from, to, markType);
      });
      if (dispatch) dispatch(tr);
      return true;
    });
    (storage.storedStyle || []).forEach((mark) => {
      result = result.setMark(mark.type.name, { ...mark.attrs });
    });
    if (storage.storedParaProps) {
      result = result.updateAttributes('paragraph', {
        paragraphProperties: JSON.parse(JSON.stringify(storage.storedParaProps)),
      });
    }
    return result.run();
  } finally {
    if (!shouldStayActive) clearFormatPainterStorage(storage);
  }
}
