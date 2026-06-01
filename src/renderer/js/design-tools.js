/* design-tools.js — Design tab: themes, colors, fonts, paragraph spacing,
   style sets, watermark, page color, page borders. Theme = CSS variables. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;
  const root = () => document.documentElement;

  // Themes — accent palettes/fonts/Text2 colors web-verified from Office theme
  // XML; fonts carry Linux-safe fallback chains. (Office/Aptos validated vs real Word.)
  const TREB = "'Trebuchet MS','Segoe UI',sans-serif";
  const TWCEN = "'Tw Cen MT','Century Gothic','Questrial',sans-serif";
  const GOTHIC = "'Century Gothic','Questrial','URW Gothic',sans-serif";
  const GARA = "'Garamond','EB Garamond',Georgia,serif";
  const THEMES = [
    { name: 'Office (Aptos)', heading: "'Aptos Display',Aptos,Calibri,sans-serif", body: "Aptos,Calibri,Carlito,sans-serif", color: '#0E2841', accents: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'] },
    { name: 'Office 2013-2022', heading: "'Calibri Light',Calibri,Carlito,sans-serif", body: 'Calibri,Carlito,sans-serif', color: '#44546A', accents: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] },
    { name: 'Facet', heading: TREB, body: TREB, color: '#2C3C43', accents: ['#90C226', '#54A021', '#E6B91E', '#E76618', '#C42F1A', '#918655'] },
    { name: 'Integral', heading: TWCEN, body: TWCEN, color: '#1B2A4E', accents: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] },
    { name: 'Ion', heading: GOTHIC, body: GOTHIC, color: '#21262A', accents: ['#B01513', '#EA6312', '#E6B729', '#6AAC90', '#54849C', '#9E5E9B'] },
    { name: 'Berlin', heading: TREB, body: TREB, color: '#1A1A1A', accents: ['#1A1A1A', '#B9CA60', '#6E9DAC', '#F09415', '#C2615F', '#C2A874'] },
    { name: 'Retrospect', heading: "'Calibri Light',Calibri,sans-serif", body: 'Calibri,Carlito,sans-serif', color: '#505046', accents: ['#E48312', '#BD582C', '#865640', '#9B8357', '#C2BC80', '#94A088'] },
    { name: 'Organic', heading: GARA, body: GARA, color: '#2A2A28', accents: ['#83992A', '#3E8853', '#2E6F3A', '#719500', '#7C7F42', '#6B9BC7'] },
    { name: 'Wisp', heading: GOTHIC, body: GOTHIC, color: '#766F60', accents: ['#74A507', '#5BB0AE', '#C1B62E', '#D58717', '#F94D4D', '#A26EC4'] },
  ];
  // Color schemes — accent sets from Office theme color schemes (web-verified).
  const COLOR_SCHEMES = [
    { name: 'Office', accents: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'] },
    { name: 'Office 2013-2022', accents: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] },
    { name: 'Grayscale', accents: ['#7F7F7F', '#B2B2B2', '#595959', '#A6A6A6', '#404040', '#D9D9D9'] },
    { name: 'Blue Warm', accents: ['#4472C4', '#5B9BD5', '#ED7D31', '#FFC000', '#70AD47', '#264478'] },
    { name: 'Blue', accents: ['#5B9BD5', '#ED7D31', '#A5A5A5', '#FFC000', '#4472C4', '#70AD47'] },
    { name: 'Red', accents: ['#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#1F497D'] },
    { name: 'Green', accents: ['#77933C', '#4F6228', '#9BBB59', '#4BACC6', '#8064A2', '#C0504D'] },
    { name: 'Orange', accents: ['#E48312', '#BD582C', '#865640', '#9B8357', '#C2BC80', '#94A088'] },
  ];
  // Font pairings — heading/body with Linux fallback chains.
  const FONT_PAIRS = [
    { name: 'Aptos', heading: "'Aptos Display',Aptos,Calibri,sans-serif", body: 'Aptos,Calibri,Carlito,sans-serif' },
    { name: 'Office (Calibri)', heading: "'Calibri Light',Calibri,sans-serif", body: 'Calibri,Carlito,sans-serif' },
    { name: 'Arial', heading: 'Arial,Helvetica,sans-serif', body: 'Arial,Helvetica,sans-serif' },
    { name: 'Georgia', heading: 'Georgia,serif', body: 'Georgia,serif' },
    { name: 'Times New Roman', heading: "'Times New Roman',Times,serif", body: "'Times New Roman',Times,serif" },
    { name: 'Garamond', heading: GARA, body: GARA },
    { name: 'Cambria', heading: 'Cambria,Georgia,serif', body: 'Cambria,Georgia,serif' },
    { name: 'Trebuchet MS', heading: TREB, body: TREB },
    { name: 'Century Gothic', heading: GOTHIC, body: GOTHIC },
    { name: 'Verdana', heading: 'Verdana,Geneva,sans-serif', body: 'Verdana,Geneva,sans-serif' },
  ];
  // Paragraph spacing presets (pt before/after + line multiple) — Word built-ins.
  const SPACING = [
    { name: 'No Paragraph Space', before: 0, after: 0, line: 1 },
    { name: 'Compact', before: 0, after: 4, line: 1 },
    { name: 'Tight', before: 0, after: 6, line: 1.15 },
    { name: 'Open', before: 0, after: 10, line: 1.15 },
    { name: 'Relaxed', before: 0, after: 6, line: 1.5 },
    { name: 'Double', before: 0, after: 8, line: 2 },
  ];
  const STYLE_SETS = ['Default', 'Basic (Simple)', 'Basic (Elegant)', 'Lines (Distinctive)', 'Shaded', 'Casual', 'Centered', 'Word 2010', 'Word 2013'];

  const Design = {
    THEMES, COLOR_SCHEMES, FONT_PAIRS, SPACING, STYLE_SETS,
    // Capture/restore the document's look so the ribbon galleries can live-preview
    // a choice on hover (like Word) and revert when the pointer leaves.
    snapshot() {
      const r = root().style; const ed = E().node;
      return {
        headingFont: r.getPropertyValue('--doc-heading-font'),
        bodyFont: r.getPropertyValue('--doc-font'),
        headingColor: r.getPropertyValue('--heading-color'),
        wordBlue: r.getPropertyValue('--word-blue'),
        accents: WC._themeAccents ? WC._themeAccents.slice() : null,
        edClass: ed.className,
        paraStyles: Array.from(ed.querySelectorAll('p, li')).map((p) => p.getAttribute('style') || ''),
      };
    },
    restore(s) {
      if (!s) return;
      const r = root().style;
      const set = (k, v) => { if (v) r.setProperty(k, v); else r.removeProperty(k); };
      set('--doc-heading-font', s.headingFont); set('--doc-font', s.bodyFont);
      set('--heading-color', s.headingColor);
      // Always restore the accent state, INCLUDING the "no accents captured" case.
      // If we skip it when s.accents is null, a previewed accent leaves --word-blue
      // and WC._themeAccents stuck, which then poisons the next snapshot.
      if (WC.setThemeColors) {
        if (s.accents) WC.setThemeColors(s.accents);
        else { WC._themeAccents = null; set('--word-blue', s.wordBlue); }
      } else { set('--word-blue', s.wordBlue); }
      E().node.className = s.edClass;
      if (s.paraStyles) { const ps = E().node.querySelectorAll('p, li'); ps.forEach((p, i) => { const v = s.paraStyles[i]; if (v == null) return; if (v) p.setAttribute('style', v); else p.removeAttribute('style'); }); }
    },
    applyTheme(t, silent) {
      root().style.setProperty('--doc-heading-font', t.heading);
      root().style.setProperty('--doc-font', t.body);
      root().style.setProperty('--heading-color', t.color);
      if (WC.setThemeColors) WC.setThemeColors(t.accents);
      if (silent) return;
      WC.Ribbon.setComboValue && WC.Ribbon.setComboValue('font', first(t.body));
      E().dirty = true; WC.toast('Theme “' + t.name + '” applied.');
    },
    applyColorScheme(s, silent) { if (WC.setThemeColors) WC.setThemeColors(s.accents); if (silent) return; E().dirty = true; WC.toast('Colors: ' + s.name); },
    applyFontPairing(p, silent) {
      root().style.setProperty('--doc-heading-font', p.heading);
      root().style.setProperty('--doc-font', p.body);
      if (silent) return;
      WC.Ribbon.setComboValue && WC.Ribbon.setComboValue('font', first(p.body));
      E().dirty = true; WC.toast('Fonts: ' + p.name);
    },
    applyParagraphSpacing(s, silent) {
      const paras = E().node.querySelectorAll('p, li');
      paras.forEach((p) => { p.style.marginTop = s.before + 'pt'; p.style.marginBottom = s.after + 'pt'; p.style.lineHeight = String(s.line); });
      if (silent) return;
      E().dirty = true; E().repaginate(); E().updateStatus(); WC.toast('Paragraph Spacing: ' + s.name);
    },
    applyStyleSet(name, silent) {
      E().node.className = E().node.className.replace(/\bstyleset-[\w-]+\b/g, '').trim();
      const cls = 'styleset-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (name !== 'Default') E().node.classList.add(cls);
      if (silent) return;
      E().dirty = true; WC.toast('Style Set: ' + name);
    },
    pageColor(color) { E().node.style.backgroundColor = color || ''; document.querySelectorAll('.page').forEach((p) => p.style.background = color || ''); E().dirty = true; },
    pageBorders(opts) {
      opts = opts || {};
      let box = E().node.querySelector('.wc-page-border');
      if (opts.remove) { if (box) box.remove(); E().dirty = true; return; }
      if (!box) { box = el('div', { class: 'wc-page-border', contenteditable: 'false' }); E().node.appendChild(box); }
      box.style.borderStyle = opts.style || 'solid';
      box.style.borderWidth = (opts.width || 1) + 'px';
      box.style.borderColor = opts.color || '#000000';
      E().dirty = true;
    },
    watermark(text, opts) {
      opts = opts || {};
      this.removeWatermark();
      if (!text) return;
      const color = (opts.color || '#C8C8C8').replace('#', '%23');
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='816' height='1056'><text x='408' y='560' font-family='Calibri,Arial' font-size='80' fill='${color}' fill-opacity='0.5' text-anchor='middle' transform='rotate(${opts.diagonal === false ? 0 : -45} 408 560)'>${escapeXml(text)}</text></svg>`;
      E().node.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      E().node.style.backgroundRepeat = 'repeat-y';
      E().node.style.backgroundPosition = 'center top';
      E().dirty = true; WC.toast('Watermark: ' + text);
    },
    removeWatermark() { E().node.style.backgroundImage = ''; },
    setAsDefault() { WC.toast('Current theme/spacing set as the default for new documents (session).'); },
  };
  function escapeXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function first(chain) { return String(chain).split(',')[0].replace(/['"]/g, '').trim(); }

  // Re-map the color picker's theme row to a new accent set.
  WC.setThemeColors = function (accents) {
    WC._themeAccents = accents;
    root().style.setProperty('--word-blue', accents[0]);
  };

  WC.Design = Design;
})();
