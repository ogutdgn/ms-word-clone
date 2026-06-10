import { twipsToPixels, convertSizeToCSS } from '@core/super-converter/helpers.js';
import { Attribute } from '@core/Attribute.js';

/**
 * Source example.
 * https://github.com/ProseMirror/prosemirror-tables/blob/master/src/tableview.ts
 */
export const createTableView = ({ editor }) => {
  return class TableView {
    editor;

    node;

    dom;

    table;

    colgroup;

    contentDOM;

    cellMinWidth;

    constructor(node, cellMinWidth) {
      this.editor = editor;
      this.node = node;
      this.cellMinWidth = cellMinWidth;
      this.dom = document.createElement('div');
      this.dom.className = 'tableWrapper';
      this.table = this.dom.appendChild(document.createElement('table'));
      this.colgroup = this.table.appendChild(document.createElement('colgroup'));
      updateTable(this.editor, this.node, this.table);
      updateColumns(node, this.colgroup, this.table, cellMinWidth);
      this.contentDOM = this.table.appendChild(document.createElement('tbody'));

      // use `setTimeout` to get cells.
      setTimeout(() => {
        updateTableWrapper(this.dom, this.table);
      }, 0);
    }

    update(node) {
      if (node.type !== this.node.type) {
        return false;
      }

      this.node = node;
      updateTable(this.editor, node, this.table);
      updateColumns(node, this.colgroup, this.table, this.cellMinWidth);
      updateTableWrapper(this.dom, this.table);

      return true;
    }

    ignoreMutation(mutation) {
      const tableWrapper = this.dom;
      if (mutation.target === tableWrapper && mutation.type === 'attributes' && mutation.attributeName === 'style') {
        return true;
      }

      return (
        mutation.type === 'attributes' && (mutation.target === this.table || this.colgroup.contains(mutation.target))
      );
    }
  };
};

/**
 * @param {import('./table.js').TableNode} node
 * @param {HTMLTableColElement} colgroup
 * @param {HTMLTableElement} table
 * @param {number} _cellMinWidth - Reserved for future use (cell minimum width)
 */
export function updateColumns(node, colgroup, table, _cellMinWidth) {
  const gridColumns =
    Array.isArray(node.attrs?.grid) && node.attrs.grid.length
      ? node.attrs.grid.map((col) => twipsToPixels(col.col))
      : null;
  const totalColumns = gridColumns?.length ?? null;

  const resolveColumnWidth = (colIndex, colwidthValue) => {
    if (colwidthValue != null) return colwidthValue;
    if (gridColumns && gridColumns[colIndex] != null) return gridColumns[colIndex];
    return null;
  };

  const widths = [];
  const firstRow = node.firstChild;
  let colIndex = 0;

  if (firstRow !== null) {
    for (let i = 0; i < firstRow.childCount; i++) {
      const child = firstRow.child(i);
      const { colspan, colwidth } = child.attrs;
      for (let span = 0; span < colspan; span += 1, colIndex += 1) {
        widths.push(resolveColumnWidth(colIndex, colwidth && colwidth[span]));
      }
    }
  }

  if (totalColumns != null && colIndex < totalColumns) {
    for (let col = colIndex; col < totalColumns; col += 1) {
      widths.push(resolveColumnWidth(col));
    }
  }

  const normalizedWidths = widths.map((widthPx) => {
    const numericWidth = Number(widthPx);
    if (!Number.isFinite(numericWidth)) return null;
    if (numericWidth < 0) return null;
    if (numericWidth === 0) return 0;
    if (numericWidth < 1) return 0;
    return numericWidth;
  });

  const tableWidthCSS = convertSizeToCSS(
    // TODO: why is tableWidth undefined in src/tests/import-export/font-default-styles.test.js?
    node.attrs.tableProperties.tableWidth?.value ?? null,
    node.attrs.tableProperties.tableWidth?.type ?? 'auto',
  );

  // TODO: there's no guarantee that all children of colgroup are <col> elements. (Note type errors below)
  // Consider the simpler approach of deleting all children and repopulating; if that proves inefficient, then skip/delete any non-HTMLColElement children
  let colElement = colgroup.firstChild;
  normalizedWidths.forEach((width) => {
    if (!colElement) {
      colElement = document.createElement('col');
      colgroup.appendChild(colElement);
    }

    // TODO: is there a reason to have a cellMinWidth?
    // colElement.style.minWidth = `${cellMinWidth}px`;
    colElement.style.width = width !== null && width !== undefined ? `${width}px` : null;
    colElement = colElement.nextSibling;
  });

  while (colElement) {
    const next = colElement.nextSibling;
    colElement.parentNode?.removeChild(colElement);
    colElement = next;
  }

  // 1. The table is offset to the left by the margin (internal padding) of the first cell
  // 1b. This seems to be overridden when tableIndent is specified. TODO: identify the exact rules within the spec dictating the interaction between tableIndent and leading margin.
  // 2. If the table width is relative, it's increased by the left margin of the first cell plus the right margin of the last cell in the first row
  const firstRowFirstCellPaddingLeftPx = firstRow?.firstChild?.attrs?.cellMargins?.left ?? 0;
  const firstRowLastCellPaddingRightPx = firstRow?.lastChild?.attrs?.cellMargins?.right ?? 0;

  // margin-left ownership (slice 6 fix): only write margin-left here when the doc
  // carries an EXPLICIT non-zero indent. The old code converted
  // `tableIndent?.value ?? 0` unconditionally — for dxa that is always a string
  // ('0px' with no indent, never null), so EVERY construct/update stomped the
  // justification margins (`margin: 0 auto` center / `margin-left: auto` right)
  // that updateTable() had just applied from the renderDOM attrs, leaving
  // center/right alignment visually inert. The importer + setTableIndent
  // dual-write two shapes: nested tableProperties.tableIndent {value: twips}
  // (canonical) and top-level tableIndent {width: px} — honor both.
  const rawIndentTwips = node.attrs.tableProperties?.tableIndent?.value;
  const rawIndentPx = node.attrs.tableIndent?.width;
  const justification = node.attrs.justification ?? node.attrs.tableProperties?.justification;
  const isJustified = justification === 'center' || justification === 'right';

  if (rawIndentTwips != null && rawIndentTwips !== 0) {
    const tableIndent = convertSizeToCSS(rawIndentTwips, node.attrs.tableProperties?.tableIndent?.type ?? 'dxa');
    if (tableIndent !== null) table.style.marginLeft = tableIndent;
  } else if (rawIndentPx != null && rawIndentPx !== 0) {
    table.style.marginLeft = `${rawIndentPx}px`;
  } else if (!isJustified) {
    // No explicit indent, no center/right justification: keep the legacy default
    // (cell-padding offset, then the zero indent exactly as convertSizeToCSS
    // renders it — preserves the pre-fix pixels for plain left tables).
    table.style.marginLeft = `${-firstRowFirstCellPaddingLeftPx}px`;
    const zeroIndent = convertSizeToCSS(0, node.attrs.tableProperties?.tableIndent?.type ?? 'dxa');
    if (zeroIndent !== null) table.style.marginLeft = zeroIndent;
  }
  // When justified with no explicit indent we deliberately do NOT touch
  // margin-left: updateTable() rewrites table.style.cssText from the renderDOM
  // attrs on every construct/update, so the justification margins are already in
  // effect and any stale view-written margin-left was wiped by that rewrite.
  // (Clearing via `table.style.marginLeft = ''` here would REMOVE the `auto`
  // longhand the cssText just set and re-break centering.)

  // TODO: why is tableWidth undefined in src/tests/import-export/font-default-styles.test.js?
  if (node.attrs.tableProperties.tableWidth?.type === 'pct') {
    const padding = firstRowFirstCellPaddingLeftPx + firstRowLastCellPaddingRightPx;
    table.style.maxWidth = table.style.width = `calc(${tableWidthCSS} + ${padding}px)`;
  } else {
    table.style.maxWidth = table.style.width = tableWidthCSS;
  }
}

function updateTable(editor, node, table) {
  const allExtensionsAttrs = editor.extensionService.attributes;
  const tableExtensionAttrs = allExtensionsAttrs.filter((e) => e.type === 'table');
  const htmlAttributes = Attribute.getAttributesToRender(node, tableExtensionAttrs);
  Object.entries(htmlAttributes).forEach(([key, value]) => {
    if (key === 'style') {
      table.style.cssText = value;
    } else {
      table.setAttribute(key, value);
    }
  });
}

function updateTableWrapper(tableWrapper, table) {
  let defaultBorderWidth = 1;
  let borderWidth;

  if (!table) {
    return;
  }

  let borderLeftMax = parseFloat(table.style.borderLeftWidth || 0);
  let borderRightMax = parseFloat(table.style.borderRightWidth) || 0;

  let firstColumnCells = [...table.querySelectorAll(':scope > tbody > tr > td:first-child')];
  let lastColumnCells = [...table.querySelectorAll(':scope > tbody > tr > td:last-child')];

  for (let cell of firstColumnCells) {
    let borderLeft = parseFloat(cell.style.borderLeftWidth) || 0;
    borderLeftMax = Math.max(borderLeftMax, borderLeft);
  }
  for (let cell of lastColumnCells) {
    let borderRight = parseFloat(cell.style.borderRightWidth) || 0;
    borderRightMax = Math.max(borderRightMax, borderRight);
  }

  // for simplicity, we take the maximum value of the borders.
  borderWidth = Math.ceil(Math.max(borderLeftMax, borderRightMax));
  tableWrapper.style.setProperty('--table-border-width', `${borderWidth || defaultBorderWidth}px`);
}
