/* references-tools.js — References tab: TOC, footnotes/endnotes, captions,
   table of figures, index, and citations/bibliography. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const el = WC.el;
  const E = () => WC.Editor;
  let uid = 0;
  const nid = (p) => p + '_' + (++uid);

  const Ref = {
    citationStyle: 'APA',
    sources: [],

    // ---- Table of Contents ----
    headings() { return Array.from(E().node.querySelectorAll('h1, h2, h3')).filter((h) => !h.closest('.wc-toc')); },
    insertTOC(manual, opts) {
      opts = opts || {};
      const showPages = opts.showPageNumbers !== false;
      const maxLvl = opts.levels || 3;
      const heads = this.headings().filter((h) => +h.tagName[1] <= maxLvl);
      const wrap = el('div', { class: 'wc-toc' + (showPages ? '' : ' wc-toc-nopg'), contenteditable: 'false' });
      wrap.appendChild(el('div', { class: 'wc-toc-title', text: opts.title || 'Contents' }));
      if (!heads.length) wrap.appendChild(el('div', { style: { color: '#888' }, text: 'No headings — apply Heading 1–3 styles, then Update Table.' }));
      heads.forEach((h) => {
        if (!h.id) h.id = nid('h');
        const lvl = +h.tagName[1];
        const row = el('div', { class: 'wc-toc-row lvl' + lvl });
        const link = el('a', { href: '#' + h.id, class: 'wc-toc-link', text: h.textContent });
        link.addEventListener('click', (e) => { e.preventDefault(); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
        row.appendChild(link);
        if (showPages) { row.appendChild(el('span', { class: 'wc-toc-leader' })); row.appendChild(el('span', { class: 'wc-toc-pg', text: String(E().pageOfElement(h)) })); }
        wrap.appendChild(row);
      });
      E().focus(); E().restoreRange();
      const sel = window.getSelection();
      if (sel.rangeCount) { sel.getRangeAt(0).insertNode(wrap); wrap.after(el('p', { html: '<br>' })); }
      else E().node.insertBefore(wrap, E().node.firstChild);
      E().dirty = true; E().repaginate(); WC.toast('Table of Contents inserted.');
    },
    updateTOC() {
      const toc = E().node.querySelector('.wc-toc'); if (!toc) { WC.toast('No table of contents to update.'); return; }
      const heads = this.headings();
      toc.querySelectorAll('.wc-toc-row').forEach((r) => r.remove());
      heads.forEach((h) => { if (!h.id) h.id = nid('h'); const lvl = +h.tagName[1]; const row = el('div', { class: 'wc-toc-row lvl' + lvl }); const link = el('a', { href: '#' + h.id, class: 'wc-toc-link', text: h.textContent }); link.addEventListener('click', (e) => { e.preventDefault(); h.scrollIntoView({ block: 'start' }); }); row.appendChild(link); row.appendChild(el('span', { class: 'wc-toc-leader' })); row.appendChild(el('span', { class: 'wc-toc-pg', text: String(E().pageOfElement(h)) })); toc.appendChild(row); });
      E().dirty = true; WC.toast('Table of contents updated.');
    },
    addText(level) {
      const b = E().selectedBlocks()[0]; if (!b) return;
      if (level === 0) WC.applyNamedStyle('Normal');
      else WC.applyNamedStyle('Heading ' + level);
      WC.toast('Added to TOC as Level ' + (level || '—'));
    },

    // ---- Footnotes / Endnotes ----
    insertNote(kind) {
      const container = kind === 'endnote' ? this.ensureNotes('wc-endnotes', 'Endnotes') : this.ensureNotes('wc-footnotes', 'Footnotes');
      E().focus(); E().restoreRange();
      const marker = el('sup', { class: 'wc-noteref', dataset: { kind } });
      const a = el('a', { href: '#', text: '1' }); marker.appendChild(a);
      const sel = window.getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(marker);
      const note = el('div', { class: 'wc-note' }, [el('span', { class: 'wc-note-num', text: '1. ' }), el('span', { contenteditable: 'true', text: 'Type the ' + kind + ' here.' })]);
      // Insert the note at the marker's DOCUMENT-ORDER position among same-kind
      // markers — not always at the end — so marker N maps to note N even when a
      // note is inserted ahead of existing ones.
      const refs = Array.from(E().node.querySelectorAll('.wc-noteref[data-kind="' + kind + '"]'));
      const idx = refs.indexOf(marker);
      const notes = Array.from(container.querySelectorAll('.wc-note'));
      if (idx >= 0 && idx < notes.length) container.insertBefore(note, notes[idx]); else container.appendChild(note);
      this.renumberNotes();
      note.querySelector('[contenteditable]').focus();
      E().dirty = true; E().repaginate();
    },
    ensureNotes(cls, title) {
      let c = E().node.querySelector('.' + cls);
      if (!c) { c = el('div', { class: cls + ' wc-notes', contenteditable: 'false' }); c.appendChild(el('div', { class: 'wc-notes-title', text: title })); E().node.appendChild(c); }
      return c;
    },
    renumberNotes() {
      ['footnote', 'endnote'].forEach((kind) => {
        const refs = Array.from(E().node.querySelectorAll('.wc-noteref[data-kind="' + kind + '"]'));
        const cont = E().node.querySelector(kind === 'endnote' ? '.wc-endnotes' : '.wc-footnotes');
        const notes = cont ? Array.from(cont.querySelectorAll('.wc-note')) : [];
        refs.forEach((r, i) => { const n = kind === 'endnote' ? toRoman(i + 1).toLowerCase() : String(i + 1); r.querySelector('a').textContent = n; });
        notes.forEach((n, i) => { n.querySelector('.wc-note-num').textContent = (kind === 'endnote' ? toRoman(i + 1).toLowerCase() : (i + 1)) + '. '; });
      });
    },
    showNotes() { const c = E().node.querySelector('.wc-footnotes') || E().node.querySelector('.wc-endnotes'); if (c) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); else WC.toast('No notes in this document.'); },
    nextNote(kind, dir) {
      dir = dir || 1;
      const sel = kind ? '.wc-noteref[data-kind="' + kind + '"]' : '.wc-noteref';
      const refs = Array.from(E().node.querySelectorAll(sel));
      if (!refs.length) { WC.toast('No ' + (kind || 'note') + 's in this document.'); return; }
      // find the ref relative to the current caret position, then step by dir
      const s = window.getSelection();
      let curIdx = -1;
      if (s && s.rangeCount) {
        const caret = s.getRangeAt(0).startContainer;
        refs.forEach((r, i) => { if (r.compareDocumentPosition(caret) & Node.DOCUMENT_POSITION_FOLLOWING || r === caret || r.contains(caret)) curIdx = i; });
      }
      let next = curIdx + dir;
      if (next < 0) next = refs.length - 1;
      if (next >= refs.length) next = 0;
      const target = refs[next];
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const r = document.createRange(); r.selectNode(target); r.collapse(false);
      s.removeAllRanges(); s.addRange(r);
    },

    // ---- Captions + Table of Figures ----
    insertCaption(label) {
      label = label || 'Figure';
      const n = E().node.querySelectorAll('.wc-caption[data-label="' + label + '"]').length + 1;
      const cap = el('p', { class: 'wc-caption', dataset: { label } }, [el('b', { text: label + ' ' + n }), document.createTextNode(': caption text')]);
      const b = E().selectedBlocks()[0];
      if (b) b.after(cap); else E().insertHTML(cap.outerHTML);
      E().dirty = true; E().repaginate(); WC.toast(label + ' ' + n + ' caption inserted.');
    },
    insertTableOfFigures(label) {
      label = label || 'Figure';
      const caps = Array.from(E().node.querySelectorAll('.wc-caption[data-label="' + label + '"]'));
      const wrap = el('div', { class: 'wc-tof wc-toc', contenteditable: 'false' });
      wrap.appendChild(el('div', { class: 'wc-toc-title', text: 'Table of ' + label + 's' }));
      caps.forEach((c) => { if (!c.id) c.id = nid('cap'); const row = el('div', { class: 'wc-toc-row' }); const link = el('a', { href: '#' + c.id, class: 'wc-toc-link', text: c.textContent }); link.addEventListener('click', (e) => { e.preventDefault(); c.scrollIntoView({ block: 'start' }); }); row.appendChild(link); row.appendChild(el('span', { class: 'wc-toc-leader' })); row.appendChild(el('span', { class: 'wc-toc-pg', text: String(E().pageOfElement(c)) })); wrap.appendChild(row); });
      if (!caps.length) wrap.appendChild(el('div', { style: { color: '#888' }, text: 'No captions yet.' }));
      E().focus(); E().restoreRange(); const sel = window.getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(wrap); else E().node.appendChild(wrap);
      E().dirty = true; E().repaginate(); WC.toast('Table of ' + label + 's inserted.');
    },

    // ---- Index ----
    markEntry() {
      const sel = window.getSelection(); if (!sel || sel.isCollapsed) { WC.toast('Select a term to mark for the index.'); return; }
      const term = sel.toString(); const span = el('span', { class: 'wc-index', dataset: { term } });
      const r = sel.getRangeAt(0); try { r.surroundContents(span); } catch (e) { span.appendChild(r.extractContents()); r.insertNode(span); }
      E().dirty = true; WC.toast('Index entry marked: ' + term);
    },
    insertIndex() {
      // Replace any existing index in place (don't append a duplicate on update).
      const existing = E().node.querySelector('.wc-index-list'); if (existing) existing.remove();
      const entries = Array.from(E().node.querySelectorAll('.wc-index'));
      const map = {};
      entries.forEach((e2) => { const t = e2.dataset.term; if (!e2.id) e2.id = nid('ix'); (map[t] = map[t] || []).push(E().pageOfElement(e2)); });
      const wrap = el('div', { class: 'wc-index-list wc-toc', contenteditable: 'false' });
      wrap.appendChild(el('div', { class: 'wc-toc-title', text: 'Index' }));
      Object.keys(map).sort((a, b) => a.localeCompare(b)).forEach((term) => { const pages = Array.from(new Set(map[term])).sort((a, b) => a - b); wrap.appendChild(el('div', { class: 'wc-index-row', text: term + ', ' + pages.join(', ') })); });
      if (!entries.length) wrap.appendChild(el('div', { style: { color: '#888' }, text: 'No marked entries. Use Mark Entry first.' }));
      E().focus(); E().restoreRange(); const sel = window.getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(wrap); else E().node.appendChild(wrap);
      E().dirty = true; E().repaginate(); WC.toast('Index inserted.');
    },

    // ---- Citations & Bibliography ----
    addSource(s) { this.sources.push(s); WC.toast('Source added: ' + s.author); },
    inText(s) {
      const a = (s.author || '').split(/\s|,/)[0] || s.author;
      if (this.citationStyle === 'MLA') return '(' + a + ' ' + (s.pages || '') + ')';
      if (this.citationStyle === 'IEEE') return '[' + (this.sources.indexOf(s) + 1) + ']';
      return '(' + a + ', ' + (s.year || 'n.d.') + ')'; // APA / Chicago / Harvard
    },
    insertCitation(s) { const idx = this.sources.indexOf(s); E().focus(); E().restoreRange(); E().insertHTML('<span class="wc-citation" data-src="' + WC.escapeHtml(s.author) + '" data-src-idx="' + idx + '">' + WC.escapeHtml(this.inText(s)) + '</span> '); },
    // Re-render every in-text citation and bibliography entry after a style change.
    restyle() {
      E().node.querySelectorAll('.wc-citation').forEach((c) => {
        let s = null;
        const idx = parseInt(c.dataset.srcIdx, 10);
        if (!isNaN(idx) && this.sources[idx]) s = this.sources[idx];
        else s = this.sources.find((x) => x.author === c.dataset.src);
        if (s) c.textContent = this.inText(s);
      });
      const bib = E().node.querySelector('.wc-bibliography');
      if (bib) { const title = (bib.querySelector('h1') && bib.querySelector('h1').textContent) || 'Bibliography'; this._rebuildBib(bib, title); }
      E().dirty = true; E().repaginate();
    },
    _rebuildBib(wrap, title) {
      wrap.innerHTML = '';
      wrap.appendChild(el('h1', { text: title }));
      this.sources.slice().sort((a, b) => (a.author || '').localeCompare(b.author || '')).forEach((s) => { const p = el('p', { class: 'wc-bib-entry', style: { textIndent: '-24px', paddingLeft: '24px' } }); p.innerHTML = this.bibEntry(s); wrap.appendChild(p); });
    },
    bibEntry(s) {
      const A = WC.escapeHtml(s.author || 'Unknown'); const Y = WC.escapeHtml(s.year || 'n.d.'); const T = WC.escapeHtml(s.title || 'Untitled'); const P = WC.escapeHtml(s.publisher || '');
      if (this.citationStyle === 'MLA') return `${A}. <i>${T}</i>. ${P}, ${Y}.`;
      if (this.citationStyle === 'IEEE') return `${A}, "${T}," ${P}, ${Y}.`;
      if (this.citationStyle === 'Chicago') return `${A}. <i>${T}</i>. ${P}, ${Y}.`;
      return `${A}. (${Y}). <i>${T}</i>. ${P}.`; // APA
    },
    insertBibliography(title) {
      const wrap = el('div', { class: 'wc-bibliography', contenteditable: 'false' });
      wrap.appendChild(el('h1', { text: title || 'Bibliography' }));
      if (!this.sources.length) wrap.appendChild(el('p', { style: { color: '#888' }, text: 'No sources. Add sources via Insert Citation → Add New Source.' }));
      this.sources.slice().sort((a, b) => (a.author || '').localeCompare(b.author || '')).forEach((s) => { const p = el('p', { class: 'wc-bib-entry', style: { textIndent: '-24px', paddingLeft: '24px' } }); p.innerHTML = this.bibEntry(s); wrap.appendChild(p); });
      E().focus(); E().restoreRange(); const sel = window.getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(wrap); else E().node.appendChild(wrap);
      E().dirty = true; E().repaginate(); WC.toast(title + ' inserted (' + this.citationStyle + ').');
    },

    // ---- Table of Authorities (legal citations) ----
    markCitation() {
      const sel = window.getSelection();
      const selText = sel && !sel.isCollapsed ? sel.toString() : '';
      const full = el('input', { type: 'text', class: 'grow', value: selText, placeholder: 'Selected text' });
      const cat = el('select', {}, ['Cases', 'Statutes', 'Other Authorities', 'Rules', 'Treatises', 'Regulations', 'Constitutional Provisions'].map((c) => el('option', { text: c })));
      const short = el('input', { type: 'text', class: 'grow', value: selText, placeholder: 'Short citation' });
      const body = el('div', {}, [
        el('div', { class: 'row' }, [el('label', { text: 'Selected text:', style: { width: '100px' } }), full]),
        el('div', { class: 'row' }, [el('label', { text: 'Category:', style: { width: '100px' } }), cat]),
        el('div', { class: 'row' }, [el('label', { text: 'Short citation:', style: { width: '100px' } }), short]),
      ]);
      WC.dialog({ title: 'Mark Citation', width: '460px', body, footer: [
        { label: 'Mark', primary: true, onClick: () => {
          const span = el('span', { class: 'wc-toa-mark', dataset: { category: cat.value, short: short.value || full.value } });
          if (sel && !sel.isCollapsed) { const r = sel.getRangeAt(0); try { r.surroundContents(span); } catch (e) { span.appendChild(r.extractContents()); r.insertNode(span); } }
          else { span.textContent = full.value; E().focus(); E().restoreRange(); E().insertNode ? E().insertNode(span) : E().insertHTML(span.outerHTML); }
          E().dirty = true; WC.toast('Citation marked (' + cat.value + ').');
        } },
        { label: 'Cancel' },
      ] });
    },
    insertTableOfAuthorities() {
      const existing = E().node.querySelector('.wc-toa'); if (existing) existing.remove();
      const marks = Array.from(E().node.querySelectorAll('.wc-toa-mark'));
      const wrap = el('div', { class: 'wc-toa wc-toc', contenteditable: 'false' });
      wrap.appendChild(el('div', { class: 'wc-toc-title', text: 'Table of Authorities' }));
      if (!marks.length) { wrap.appendChild(el('div', { style: { color: '#888' }, text: 'No marked citations. Use Mark Citation first.' })); }
      else {
        const byCat = {};
        marks.forEach((m) => { if (!m.id) m.id = nid('toa'); const c = m.dataset.category || 'Other Authorities'; (byCat[c] = byCat[c] || []).push(m); });
        Object.keys(byCat).sort().forEach((c) => {
          wrap.appendChild(el('div', { class: 'wc-toa-cat', style: { fontWeight: '700', margin: '6px 0 2px' }, text: c }));
          const seen = {};
          byCat[c].forEach((m) => { const key = m.dataset.short || m.textContent; if (seen[key]) { seen[key].push(E().pageOfElement(m)); return; } seen[key] = [E().pageOfElement(m)]; });
          Object.keys(seen).sort((a, b) => a.localeCompare(b)).forEach((key) => { const row = el('div', { class: 'wc-toc-row' }); row.appendChild(el('span', { class: 'wc-toc-link', text: key })); row.appendChild(el('span', { class: 'wc-toc-leader' })); row.appendChild(el('span', { class: 'wc-toc-pg', text: Array.from(new Set(seen[key])).sort((a, b) => a - b).join(', ') })); wrap.appendChild(row); });
        });
      }
      E().focus(); E().restoreRange(); const sel = window.getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(wrap); else E().node.appendChild(wrap);
      E().dirty = true; E().repaginate(); WC.toast('Table of Authorities inserted (' + marks.length + ' citation(s)).');
    },

    // ---- Update Table (context: TOC / ToF / Index) ----
    updateAny() { if (E().node.querySelector('.wc-toc:not(.wc-tof):not(.wc-toa)')) this.updateTOC(); if (E().node.querySelector('.wc-tof')) WC.toast('Tables updated.'); if (E().node.querySelector('.wc-index-list')) this.insertIndex(); if (E().node.querySelector('.wc-toa')) this.insertTableOfAuthorities(); },
  };
  function toRoman(n) { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, sym] of m) while (n >= v) { s += sym; n -= v; } return s || 'i'; }
  WC.Ref = Ref;
})();
