/* icons.js — monoline (Fluent-style) SVG icons keyed by command name.
   All icons are 24x24, stroke=currentColor. A generic fallback is used for the
   long tail of ribbon commands so every control still renders an icon. */
(function () {
  window.WC = window.WC || {};

  // raw inner markup for each icon (viewBox 0 0 24 24)
  const P = {
    // Clipboard
    paste: '<path d="M8 4h8v3H8z" fill="none" stroke="currentColor"/><rect x="5" y="6" width="14" height="15" rx="1" fill="none" stroke="currentColor"/><path d="M9 11h6M9 14h6M9 17h4" stroke="currentColor"/>',
    cut: '<circle cx="7" cy="17" r="2.4" fill="none" stroke="currentColor"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor"/><path d="M8.7 15.4 18 4M15.3 15.4 6 4" stroke="currentColor"/>',
    copy: '<rect x="8" y="3" width="11" height="14" rx="1" fill="none" stroke="currentColor"/><path d="M5 7v13a1 1 0 0 0 1 1h9" fill="none" stroke="currentColor"/>',
    formatPainter: '<path d="M4 8V5h11v3" fill="none" stroke="currentColor"/><rect x="3" y="8" width="13" height="4" rx="1" fill="none" stroke="currentColor"/><path d="M11 12v3h3v3l-2 3h-2l-2-3v-3" fill="none" stroke="currentColor"/>',
    // Font
    bold: '<path d="M7 4h6a3.5 3.5 0 0 1 0 7H7zM7 11h7a3.5 3.5 0 0 1 0 8H7z" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    italic: '<path d="M10 4h7M6 20h7M14 4 9 20" stroke="currentColor" stroke-width="1.7"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" stroke="currentColor" stroke-width="1.6"/>',
    strikethrough: '<path d="M5 12h14M8 8a4 3 0 0 1 8 0M8 16a4 3 0 0 0 8 0" stroke="currentColor"/>',
    subscript: '<path d="M5 5l8 10M13 5 5 15" stroke="currentColor"/><path d="M18 20h3.5M19 20c0-1 2.5-1.2 2.5-2.6S20 16 19 17" stroke="currentColor" stroke-width="1.2"/>',
    superscript: '<path d="M5 9l8 10M13 9 5 19" stroke="currentColor"/><path d="M18 8h3.5M19 8c0-1 2.5-1.2 2.5-2.6S20 4 19 5" stroke="currentColor" stroke-width="1.2"/>',
    textHighlightColor: '<path d="M4 20h6" stroke="#caa600" stroke-width="3"/><path d="M9 16 6 19l-2-.5L13 9l3 3-7 4z" fill="none" stroke="currentColor"/><path d="M13 9l3-3 3 3-3 3" fill="none" stroke="currentColor"/>',
    fontColor: '<path d="M6 16 10 6h2l4 10M7.5 13h7" stroke="currentColor"/>',
    clearAllFormatting: '<path d="M7 5h11M9 5l-2 14M13 5l-1 7M16 16l4 4M20 16l-4 4" stroke="currentColor"/>',
    increaseFontSize: '<path d="M3 18 7 7l4 11M4.5 14h5" stroke="currentColor"/><path d="M16 12h6M19 9v6" stroke="currentColor"/>',
    decreaseFontSize: '<path d="M3 18 7 7l4 11M4.5 14h5" stroke="currentColor"/><path d="M16 12h6" stroke="currentColor"/>',
    changeCase: '<path d="M3 17 6 8l3 9M3.8 14.5h4.4" stroke="currentColor"/><path d="M14 17l3-9 3 9M14.8 14.5h4.4" stroke="currentColor"/>',
    textEffectsAndTypography: '<path d="M5 18 9 6h2l4 12M6.5 14h7" stroke="currentColor"/><path d="M17 7l1.2 2.3L20.5 10l-2.3.7L17 13l-1.2-2.3L13.5 10l2.3-.7z" fill="none" stroke="currentColor" stroke-width="1"/>',
    // Paragraph
    bullets: '<circle cx="5" cy="7" r="1.4" fill="currentColor"/><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="5" cy="17" r="1.4" fill="currentColor"/><path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor"/>',
    numbering: '<path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor"/><text x="3" y="9" font-size="6" fill="currentColor" font-family="sans-serif">1</text><text x="3" y="14" font-size="6" fill="currentColor" font-family="sans-serif">2</text><text x="3" y="19" font-size="6" fill="currentColor" font-family="sans-serif">3</text>',
    multilevelList: '<path d="M5 7h3M10 7h10M8 12h3M13 12h7M11 17h3M16 17h4" stroke="currentColor"/>',
    decreaseIndent: '<path d="M4 6h16M9 10h11M9 14h11M4 18h16M7 12 3 9v6z" fill="currentColor" stroke="currentColor"/>',
    increaseIndent: '<path d="M4 6h16M11 10h9M11 14h9M4 18h16M3 9l4 3-4 3z" fill="currentColor" stroke="currentColor"/>',
    sort: '<path d="M6 5v14M6 19l-3-3M6 19l3-3" stroke="currentColor"/><path d="M12 6h8M12 10h6M12 14h4M12 18h2" stroke="currentColor"/>',
    showhide: '<path d="M18 4H14M14 4a4 4 0 0 0 0 8M14 4v16M18 4v16" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    alignLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10" stroke="currentColor"/>',
    center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10" stroke="currentColor"/>',
    alignRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10" stroke="currentColor"/>',
    justify: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor"/>',
    lineAndParagraphSpacing: '<path d="M10 6h10M10 12h10M10 18h10" stroke="currentColor"/><path d="M5 5v14M5 5 3 7M5 5l2 2M5 19l-2-2M5 19l2-2" stroke="currentColor"/>',
    shading: '<path d="M5 5h14v9H5z" fill="none" stroke="currentColor"/><path d="M5 14h14v5H5z" fill="currentColor" opacity=".3"/>',
    borders: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-dasharray="2 2"/>',
    // Borders-dropdown glyphs — match Word's menu icons: a faint dotted box with the
    // active edge(s)/feature drawn solid. (Fluent has no matching set.)
    borderBottom: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.9"/>',
    borderTop: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M4 4h16" stroke="currentColor" stroke-width="1.9"/>',
    borderLeft: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M4 4v16" stroke="currentColor" stroke-width="1.9"/>',
    borderRight: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M20 4v16" stroke="currentColor" stroke-width="1.9"/>',
    borderNoneIc: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/>',
    borderAllIc: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="1.4"/>',
    borderOutsideIc: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/>',
    borderInsideIc: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="1.7"/>',
    borderInsideH: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M4 12h16" stroke="currentColor" stroke-width="1.9"/>',
    borderInsideV: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M12 4v16" stroke="currentColor" stroke-width="1.9"/>',
    borderDiagDown: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M5 5 19 19" stroke="currentColor" stroke-width="1.8"/>',
    borderDiagUp: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".5"/><path d="M5 19 19 5" stroke="currentColor" stroke-width="1.8"/>',
    borderHorizLine: '<path d="M3 9h5M3 13h5M3 17h3" stroke="currentColor" opacity=".55"/><path d="M11 13h10" stroke="currentColor" stroke-width="1.8"/><path d="M3 5h12" stroke="currentColor" opacity=".55"/>',
    drawTable: '<rect x="4" y="6" width="16" height="13" fill="none" stroke="currentColor" stroke-dasharray="2 2" opacity=".6"/><path d="M14 4 19 9 11 17l-5 1 1-5z" fill="none" stroke="currentColor"/>',
    viewGridlines: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M4 10h16M4 15h16M9 4v16M14 4v16" stroke="currentColor" stroke-dasharray="2 2" opacity=".7"/>',
    // Styles / Editing
    find: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor"/><path d="M16 16l4 4" stroke="currentColor"/>',
    replace: '<path d="M4 7h9M10 4 13 7l-3 3" fill="none" stroke="currentColor"/><path d="M20 17h-9M14 14l-3 3 3 3" fill="none" stroke="currentColor"/>',
    select: '<path d="M5 5l5 14 2-5 5-2z" fill="none" stroke="currentColor"/>',
    // Insert
    coverPage: '<rect x="5" y="3" width="14" height="18" rx="1" fill="none" stroke="currentColor"/><path d="M8 7h8M8 10h8M8 17h5" stroke="currentColor"/>',
    blankPage: '<path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor"/><path d="M14 3v4h4" fill="none" stroke="currentColor"/>',
    pageBreak: '<path d="M6 4h8l4 4v4H6z" fill="none" stroke="currentColor"/><path d="M3 16h18" stroke="currentColor" stroke-dasharray="2 2"/><path d="M6 20h12" fill="none" stroke="currentColor" opacity=".5"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="1" fill="none" stroke="currentColor"/><path d="M4 9.5h16M4 14h16M9.3 5v14M14.6 5v14" stroke="currentColor"/>',
    pictures: '<rect x="4" y="5" width="16" height="14" rx="1" fill="none" stroke="currentColor"/><circle cx="9" cy="10" r="1.6" fill="none" stroke="currentColor"/><path d="M5 18l4.5-5 3 3 3-4 3.5 4" fill="none" stroke="currentColor"/>',
    shapes: '<rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor"/><circle cx="17" cy="7" r="4" fill="none" stroke="currentColor"/>',
    icons: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor"/><path d="M12 8v8M8 12h8" stroke="currentColor"/>',
    smartArt: '<rect x="9" y="3" width="6" height="5" fill="none" stroke="currentColor"/><rect x="3" y="15" width="6" height="5" fill="none" stroke="currentColor"/><rect x="15" y="15" width="6" height="5" fill="none" stroke="currentColor"/><path d="M12 8v3M12 11H6v4M12 11h6v4" stroke="currentColor"/>',
    chart: '<path d="M4 4v16h16" stroke="currentColor"/><rect x="7" y="11" width="3" height="6" fill="none" stroke="currentColor"/><rect x="12" y="8" width="3" height="9" fill="none" stroke="currentColor"/><rect x="17" y="13" width="3" height="4" fill="none" stroke="currentColor"/>',
    screenshot: '<rect x="3" y="6" width="18" height="13" rx="1" fill="none" stroke="currentColor"/><path d="M8 6 9.5 3h5L16 6" fill="none" stroke="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor"/>',
    onlinePictures: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="currentColor"/>',
    header: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M4 8h16" stroke="currentColor"/><path d="M7 6h6" stroke="currentColor"/>',
    footer: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M4 16h16" stroke="currentColor"/><path d="M7 18h6" stroke="currentColor"/>',
    pageNumber: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><text x="8" y="16" font-size="8" fill="currentColor" font-family="sans-serif">#</text>',
    textBox: '<rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor"/><path d="M7 6V4M7 18v2M17 6V4M17 18v2" stroke="currentColor"/>',
    quickParts: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor"/>',
    wordArt: '<path d="M4 18 9 6l5 12M5.5 14h7" stroke="currentColor"/><path d="M16 7c2-2 4 0 2 2s0 4 2 2" fill="none" stroke="currentColor"/>',
    dropCap: '<path d="M4 4h7v14H4z" fill="none" stroke="currentColor"/><path d="M13 6h7M13 10h7M13 14h5M13 18h5" stroke="currentColor"/>',
    signatureLine: '<path d="M4 16c3-6 5 2 8-1s4-4 8 1" fill="none" stroke="currentColor"/><path d="M4 19h16" stroke="currentColor"/>',
    dateAndTime: '<rect x="4" y="5" width="16" height="15" rx="1" fill="none" stroke="currentColor"/><path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor"/>',
    object: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M4 4l16 16M20 4 4 20" stroke="currentColor" opacity=".3"/>',
    equation: '<path d="M5 6h8l-5 12M7 12h4" stroke="currentColor"/><path d="M15 9l5 6M20 9l-5 6" stroke="currentColor"/>',
    symbol: '<path d="M9 18a4 4 0 1 1 4-4M9 18h6" stroke="currentColor"/><text x="6" y="9" font-size="8" fill="currentColor" font-family="sans-serif">Ω</text>',
    link: '<path d="M9 12a3 3 0 0 1 3-3h2a3 3 0 0 1 0 6M15 12a3 3 0 0 1-3 3h-2a3 3 0 0 1 0-6" fill="none" stroke="currentColor"/>',
    bookmark: '<path d="M7 4h10v16l-5-4-5 4z" fill="none" stroke="currentColor"/>',
    crossReference: '<path d="M5 7h14M5 12h9M5 17h6" stroke="currentColor"/><path d="M16 14l4 3-4 3" fill="none" stroke="currentColor"/>',
    comment: '<path d="M4 5h16v11H9l-4 4z" fill="none" stroke="currentColor"/><path d="M8 9h8M8 12h5" stroke="currentColor"/>',
    insertFootnote: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><text x="7" y="14" font-size="7" fill="currentColor" font-family="sans-serif">A¹</text>',
    // References
    tableOfContents: '<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor"/><path d="M7 8h6M7 11h8M7 14h5" stroke="currentColor"/><path d="M16 8h1M17 11h-1M16 14h1" stroke="currentColor"/>',
    insertCitation: '<path d="M6 6h7l3 3v9H6z" fill="none" stroke="currentColor"/><path d="M9 11h5M9 14h5" stroke="currentColor"/>',
    insertCaption: '<rect x="4" y="5" width="16" height="10" fill="none" stroke="currentColor"/><path d="M7 18h10" stroke="currentColor"/>',
    // Review
    spellingGrammar: '<path d="M4 16 8 6l4 10M5.5 13h5" stroke="currentColor"/><path d="M14 13l2 2 4-5" fill="none" stroke="currentColor"/>',
    thesaurus: '<path d="M5 4h14v16H5z" fill="none" stroke="currentColor"/><path d="M8 8h8M8 11h8M8 14h5" stroke="currentColor"/>',
    wordCount: '<path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor"/><text x="14" y="20" font-size="6" fill="currentColor" font-family="sans-serif">123</text>',
    readAloud: '<path d="M4 9v6h4l5 4V5L8 9z" fill="none" stroke="currentColor"/><path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor"/>',
    translate: '<path d="M3 6h8M7 4v2M5 6c0 4-2 6-2 6M5 6c0 4 3 5 3 5" fill="none" stroke="currentColor"/><path d="M11 20l4-9 4 9M12.5 17h5" stroke="currentColor"/>',
    newComment: '<path d="M4 5h16v11H9l-4 4z" fill="none" stroke="currentColor"/><path d="M12 8v5M9.5 10.5h5" stroke="currentColor"/>',
    trackChanges: '<path d="M5 17 15 7l3 3L8 20H5z" fill="none" stroke="currentColor"/><path d="M13 9l3 3" stroke="currentColor"/>',
    // View
    readMode: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1z" fill="none" stroke="currentColor"/><path d="M12 7v13" stroke="currentColor"/>',
    printLayout: '<rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="currentColor"/><path d="M9 7h6M9 10h6M9 13h4" stroke="currentColor"/>',
    webLayout: '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor"/><path d="M3 9h18" stroke="currentColor"/><circle cx="6" cy="7" r=".6" fill="currentColor"/>',
    zoom: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor"/><path d="M16 16l4 4M9 11h4M11 9v4" stroke="currentColor"/>',
    onePage: '<rect x="7" y="4" width="10" height="16" fill="none" stroke="currentColor"/>',
    ruler: '<rect x="3" y="8" width="18" height="8" fill="none" stroke="currentColor"/><path d="M6 8v3M9 8v4M12 8v3M15 8v4M18 8v3" stroke="currentColor"/>',
    gridlines: '<rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" opacity=".5"/>',
    navigationPane: '<rect x="3" y="4" width="18" height="16" fill="none" stroke="currentColor"/><path d="M9 4v16" stroke="currentColor"/><path d="M5 8h2M5 11h2" stroke="currentColor"/>',
    // QAT / window
    save: '<path d="M5 4h12l3 3v13H5z" fill="none" stroke="currentColor"/><path d="M8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor"/>',
    undo: '<path d="M8 7 4 11l4 4M4 11h9a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor"/>',
    redo: '<path d="M16 7l4 4-4 4M20 11h-9a5 5 0 0 0 0 10h2" fill="none" stroke="currentColor"/>',
    autosave: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v4h-4" fill="none" stroke="currentColor"/>',
    search: '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor"/><path d="M16 16l4 4" stroke="currentColor"/>',
    win_min: '<path d="M2 6h8" stroke="currentColor"/>',
    win_max: '<rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor"/>',
    win_restore: '<rect x="1.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor"/><path d="M4 3.5V1.5h7v7H9" fill="none" stroke="currentColor"/>',
    win_close: '<path d="M1 1 11 11M11 1 1 11" stroke="currentColor"/>',
    back: '<path d="M15 5 8 12l7 7" fill="none" stroke="currentColor"/>',
    chevron_down: '<path d="M5 8l5 5 5-5" fill="none" stroke="currentColor"/>',
    share: '<circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor"/><path d="M8.2 11 15.8 7M8.2 13l7.6 4" stroke="currentColor"/>',
    // generic fallback
    _generic: '<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor"/><path d="M8 12h8" stroke="currentColor" opacity=".55"/>',
  };

  function svg(name, size) {
    const inner = P[name] || P._generic;
    const s = size || 24;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }

  // map a control to an icon name by cmd, with a few aliases
  const ALIAS = {
    showHide: 'showhide',
    'showHide¶': 'showhide',
    textHighlightColor: 'textHighlightColor',
    icons3DModels: 'icons',
    '3dModels': 'icons',
    onlinePictures: 'onlinePictures',
    chart: 'chart',
    object: 'object',
    insertEndnote: 'insertFootnote',
    nextFootnote: 'insertFootnote',
    manageSources: 'insertCitation',
    bibliography: 'insertCitation',
    style: 'insertCitation',
    insertTableOfFigures: 'tableOfContents',
    updateTable: 'tableOfContents',
    markEntry: 'tableOfContents',
    insertIndex: 'tableOfContents',
    showComments: 'comment',
    deleteComment: 'comment',
    previousComment: 'comment',
    nextComment: 'comment',
    acceptAndMoveToNext: 'trackChanges',
    accept: 'trackChanges',
    reject: 'trackChanges',
    next: 'trackChanges',
    previous: 'trackChanges',
    multiplePages: 'webLayout',
    pageWidth: 'zoom',
    'zoom100': 'onePage',
    'a100': 'onePage',
  };

  window.WC.icon = function (cmd, size) {
    // Authentic Fluent UI System Icon (Microsoft's own) for ribbon commands.
    if (cmd && window.WC.FLUENT && window.WC.FLUENT[cmd]) {
      const s = size || 24;
      return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true">${window.WC.FLUENT[cmd]}</svg>`;
    }
    if (!cmd) return svg('_generic', size);
    const name = ALIAS[cmd] || (P[cmd] ? cmd : '_generic');
    return svg(name, size);
  };
  window.WC.rawIcon = svg;
})();
