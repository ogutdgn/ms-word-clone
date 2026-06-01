/* Hit-tests every ribbon control's centre with elementFromPoint across all
   tabs to detect occlusion (a control whose centre is covered by a different
   control == clicks land on the wrong place). Returns JSON. */
(async () => {
  const WC = window.WC;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SEL = '.rbtn, .rsplit .main, .rsplit .arrow, .rcombo, .style-cell, .ribbon-group-label .launcher';
  const byTab = [];
  for (const tab of WC.RIBBON) {
    WC.Ribbon.activate(tab.id);
    await sleep(60);
    const panel = document.querySelector(`.ribbon-panel[data-tab="${tab.id}"]`);
    const ctrls = Array.from(panel.querySelectorAll(SEL));
    const occluded = [];
    let offscreen = 0;
    for (const c of ctrls) {
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) { offscreen++; continue; }
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) { occluded.push({ label: lbl(c), reason: 'no-hit' }); continue; }
      const ownCtrl = c.closest('.rbtn, .rsplit, .rcombo, .style-cell, .ribbon-group');
      const hitCtrl = hit.closest('.rbtn, .rsplit, .rcombo, .style-cell, .ribbon-group');
      if (hitCtrl && ownCtrl && hitCtrl !== ownCtrl && !ownCtrl.contains(hit) && !hit.contains(ownCtrl)) {
        occluded.push({ label: lbl(c), coveredBy: lbl(hitCtrl) });
      }
    }
    byTab.push({ tab: tab.name, controls: ctrls.length, offscreen, occludedCount: occluded.length, occluded });
  }
  WC.Ribbon.activate('home');
  function lbl(el) {
    if (!el) return '?';
    const t = el.querySelector && el.querySelector('.lbl');
    return (t && t.textContent) || (el.dataset && el.dataset.cmd) || (el.textContent || '').trim().slice(0, 18) || el.className;
  }
  const totalOccluded = byTab.reduce((a, b) => a + b.occludedCount, 0);
  return JSON.stringify({ width: window.innerWidth, totalOccluded, byTab }, null, 2);
})();
