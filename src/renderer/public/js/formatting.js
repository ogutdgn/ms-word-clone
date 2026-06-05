/* formatting.js — block formatting + Word named styles (Normal, Heading 1…). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const E = () => WC.Editor;

  WC.formatBlock = function (tag) {
    E().node.focus(); E().restoreRange();
    try { document.execCommand('formatBlock', false, tag); } catch (e) {}
    E().selectedBlocks().forEach((b) => b.classList.remove('doc-title', 'doc-subtitle'));
    E().saveRange(); E().dirty = true; E().repaginate(); E().updateStatus(); E().emit();
  };

  // Apply a named Word style to the current paragraph(s) or selection.
  WC.applyNamedStyle = function (name) {
    const blocks = () => E().selectedBlocks();
    switch (name) {
      case 'Normal':
        WC.formatBlock('p'); blocks().forEach((b) => { b.removeAttribute('style'); b.removeAttribute('class'); }); break;
      case 'No Spacing':
        WC.formatBlock('p'); blocks().forEach((b) => { b.style.margin = '0'; b.style.lineHeight = '1'; }); break;
      case 'Heading 1': WC.formatBlock('h1'); break;
      case 'Heading 2': WC.formatBlock('h2'); break;
      case 'Heading 3': WC.formatBlock('h3'); break;
      case 'Heading 4': WC.formatBlock('h4'); break;
      case 'Title':
        WC.formatBlock('h1'); blocks().forEach((b) => { if (b.tagName === 'H1') b.classList.add('doc-title'); }); break;
      case 'Subtitle':
        WC.formatBlock('p'); blocks().forEach((b) => b.classList.add('doc-subtitle')); break;
      case 'Quote':
      case 'Intense Quote':
        WC.formatBlock('blockquote'); break;
      case 'List Paragraph':
        E().exec('indent'); break;
      case 'Strong': E().applyInlineStyle('fontWeight', 'bold'); break;
      case 'Emphasis': case 'Subtle Emphasis': E().applyInlineStyle('fontStyle', 'italic'); break;
      case 'Intense Emphasis': E().applyInlineStyle('fontStyle', 'italic'); E().applyInlineStyle('color', '#2e74b5'); break;
      default:
        WC.formatBlock('p');
    }
    // custom user styles (apply a class whose CSS we injected)
    const custom = WC.Styles && WC.Styles.find(name);
    if (custom && custom.className) {
      if (custom.type === 'character') {
        E().node.focus(); E().restoreRange();
        const sel = window.getSelection();
        if (sel.rangeCount && !sel.isCollapsed) {
          const span = document.createElement('span'); span.className = custom.className;
          const range = sel.getRangeAt(0);
          try { range.surroundContents(span); } catch (e) { span.appendChild(range.extractContents()); range.insertNode(span); }
        }
      } else {
        blocks().forEach((b) => { b.className = b.className.replace(/\bwcs-[\w-]+\b/g, '').trim(); b.classList.add(custom.className); });
      }
      E().dirty = true; E().repaginate(); E().updateStatus(); E().emit();
    }
    // reflect active style cell
    document.querySelectorAll('.style-cell').forEach((c) => c.classList.toggle('active', c.dataset.style === name));
  };

  // ---- Style registry (built-ins + user-created custom styles) ----
  const BUILTIN = ['Normal', 'No Spacing', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Title', 'Subtitle', 'Quote', 'Intense Quote', 'List Paragraph', 'Strong', 'Emphasis', 'Subtle Emphasis', 'Intense Emphasis'];
  let styleSeq = 0;
  WC.Styles = {
    custom: [],
    BUILTIN,
    all() { return BUILTIN.concat(this.custom.map((c) => c.name)); },
    find(name) { return this.custom.find((c) => c.name === name); },
    injectCSS() {
      let tag = document.getElementById('wc-custom-styles');
      if (!tag) { tag = document.createElement('style'); tag.id = 'wc-custom-styles'; document.head.appendChild(tag); }
      tag.textContent = this.custom.map((c) => {
        const decl = Object.entries(c.declarations).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
        return `#editor .${c.className}{${decl}}`;
      }).join('\n');
    },
    captureSelection() {
      const sel = window.getSelection();
      let n = sel && sel.anchorNode; n = n && n.nodeType === 3 ? n.parentNode : n;
      const decl = {};
      if (n) {
        const cs = getComputedStyle(n);
        const base = { fontFamily: /calibri|carlito/i, fontWeight: /^(400|normal)$/, fontStyle: /normal/, color: /rgb\(0, 0, 0\)/ };
        if (!base.fontFamily.test(cs.fontFamily)) decl.fontFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '');
        const pt = Math.round(parseFloat(cs.fontSize) / 1.3333 * 10) / 10; if (Math.abs(pt - 11) > 0.2) decl.fontSize = pt + 'pt';
        if (!base.fontWeight.test(cs.fontWeight)) decl.fontWeight = cs.fontWeight;
        if (!base.fontStyle.test(cs.fontStyle)) decl.fontStyle = cs.fontStyle;
        if (!base.color.test(cs.color)) decl.color = cs.color;
        if (cs.textDecorationLine && cs.textDecorationLine !== 'none') decl.textDecoration = cs.textDecorationLine;
      }
      return decl;
    },
    createFromSelection(name, type) {
      const className = 'wcs-' + (++styleSeq);
      const declarations = this.captureSelection();
      this.custom.push({ name, type: type || 'character', className, declarations });
      this.injectCSS();
      WC.applyNamedStyle(name);
      return name;
    },
  };
})();
