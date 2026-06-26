'use strict';
// Generates ribbon-data.js + documentation from the research JSON.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const research = require(path.join(ROOT, 'docs', 'research', 'raw-research.json')).result;

function decode(s) {
  if (s == null) return s;
  return String(s)
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function slug(s) {
  return decode(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function camel(s) {
  const parts = decode(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  return parts.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
}

// Assemble ribbon tabs in true Word order.
const order = ['Home', 'Insert', 'Draw', 'Design', 'Layout', 'References', 'Mailings', 'Review', 'View', 'Help'];
const allTabs = [];
for (const bundleKey of Object.keys(research.ribbon)) {
  if (bundleKey === 'backstage') continue;
  for (const t of research.ribbon[bundleKey].tabs) allTabs.push(t);
}
const byName = {};
for (const t of allTabs) byName[t.name] = t;

// Controls intentionally OMITTED from the clone's ribbon — cloud/ML/Office.js features with no local equivalent
// (user decision 2026-06-26). raw-research.json stays accurate (Word DOES have these); gen.js drops them from OUR
// ribbon. A group left with no controls is dropped too. Keyed by the generated `${tab}.${group}.${label-slug}` id.
const EXCLUDED_CONTROL_IDS = new Set([
  'home.voice.dictate',           // Dictate — speech-to-text (cloud)
  'home.sensitivity.sensitivity', // Sensitivity — Microsoft Purview labels (enterprise cloud)
  'home.add-ins.add-ins',         // Add-ins — Office.js runtime
  'home.reuse-files.reuse-files', // Reuse Files — M365 cloud content
]);

const seenIds = new Set();
function uniqueId(base) {
  let id = base, n = 2;
  while (seenIds.has(id)) { id = base + '-' + n; n++; }
  seenIds.add(id);
  return id;
}

function buildTab(tab) {
  const tabSlug = slug(tab.name);
  return {
    name: decode(tab.name),
    id: tabSlug,
    groups: (tab.groups || []).map((g) => {
      const gSlug = slug(g.name);
      const controls = [];
      let launcher = null;
      for (const c of g.controls || []) {
        const baseId = `${tabSlug}.${gSlug}.${slug(c.label)}`;
        if (EXCLUDED_CONTROL_IDS.has(baseId)) continue; // intentionally omitted (user decision) — see EXCLUDED_CONTROL_IDS
        const tip = decode(c.tooltip || '');
        const isLauncher = /dialog box launcher/i.test(tip);
        const ctrl = {
          id: uniqueId(baseId),
          // A4 (slice 8): optional per-control "cmd" override — labels stay
          // Word-faithful while cmd ids stay unique (e.g. Comments "Previous" →
          // previousComment vs Tracking "Previous" → previousChange).
          cmd: c.cmd ? c.cmd : camel(c.label),
          label: decode(c.label),
          type: c.type || 'button',
          tooltip: tip || undefined,
          shortcut: decode(c.shortcut) || undefined,
          feasible: c.feasible || 'yes',
        };
        if (Array.isArray(c.items) && c.items.length) ctrl.items = c.items.map(decode);
        if (isLauncher) { launcher = ctrl; continue; }
        controls.push(ctrl);
      }
      const out = { name: decode(g.name), id: gSlug, controls };
      if (launcher) out.launcher = launcher;
      return out;
    }).filter((g) => g.controls.length > 0 || g.launcher), // drop groups emptied by EXCLUDED_CONTROL_IDS
  };
}

const ribbon = order.filter((n) => byName[n]).map((n) => buildTab(byName[n]));
// include any tab not in order list (safety)
for (const t of allTabs) if (!order.includes(t.name)) ribbon.push(buildTab(t));

// Backstage
const backstageRaw = research.ribbon.backstage.tabs[0];
const backstage = {
  name: 'File',
  sections: (backstageRaw.groups || []).map((g) => ({
    name: decode(g.name),
    id: slug(g.name),
    actions: (g.controls || []).map((c) => ({
      id: slug(g.name) + '.' + slug(c.label),
      cmd: camel(c.label),
      label: decode(c.label),
      type: c.type || 'button',
      tooltip: decode(c.tooltip) || undefined,
      items: Array.isArray(c.items) ? c.items.map(decode) : undefined,
      feasible: c.feasible || 'yes',
    })),
  })),
};

const header = `/* AUTO-GENERATED from docs/research/raw-research.json by scripts/gen.js.\n   Faithful Microsoft Word (Microsoft 365) ribbon map. Do not hand-edit; re-run the generator. */\n`;
const out = `${header}window.WC = window.WC || {};\nwindow.WC.RIBBON = ${JSON.stringify(ribbon, null, 2)};\nwindow.WC.BACKSTAGE = ${JSON.stringify(backstage, null, 2)};\n`;
// Phase-1 moved the legacy renderer under public/ (served as static assets);
// the old src/renderer/js/ path no longer exists and writing there ENOENTs.
fs.writeFileSync(path.join(ROOT, 'src', 'renderer', 'public', 'js', 'ribbon-data.js'), out);

// ---- NOT_IMPLEMENTED.md from feasibility + ribbon controls ----
let md = `# Word Clone — Feature Coverage & Known Limitations\n\n`;
md += `_Auto-generated from deep research (\`docs/research/raw-research.json\`). This catalogs which Microsoft Word features this clone implements, partially implements, or deliberately does not implement, and why._\n\n`;
md += `> The user asked me to build a faithful MS Word clone and to **document the things that are not realistic to fully replicate** rather than stopping. This is that document.\n\n`;
md += `## Legend\n\n- ✅ **Feasible / implemented** — works in this clone (possibly simplified).\n- 🟡 **Partial** — a usable approximation; full Word behavior not replicated.\n- ❌ **Infeasible in this build** — would require a full Office-grade engine, a server/cloud backend, a proprietary runtime, or months of work.\n\n`;
md += `> **Implementation reality vs. research notes.** The status icons below come from the feasibility research. The *Notes* column describes the approach the research **recommended** — which sometimes differs from what this build actually shipped. The biggest difference: the document core is a **ProseMirror model forked from SuperDoc** (\`src/renderer/core/superdoc-fork/\`), and \`.docx\` import/export both go through that fork's **\`super-converter\`** — a structural OOXML↔model round-trip (the legacy \`contenteditable\`/\`execCommand\` editor and the \`mammoth\`/\`html-to-docx\` pipeline were retired in slice 11). Items marked ✅ are implemented and working in the app; 🟡/❌ items are present in the UI but stubbed or approximated.\n\n`;

md += `## Feature areas (from architecture feasibility research)\n\n`;
for (const cat of research.feasibility.categories) {
  md += `### ${decode(cat.area)}\n\n`;
  md += `| Feature | Status | Notes |\n|---|---|---|\n`;
  for (const f of cat.features) {
    const icon = f.feasibility === 'feasible' ? '✅' : f.feasibility === 'partial' ? '🟡' : '❌';
    const note = decode(f.approach ? f.approach : f.rationale).replace(/\n/g, ' ').replace(/\|/g, '\\|');
    md += `| ${decode(f.name)} | ${icon} | ${note} |\n`;
  }
  md += `\n`;
}

// Ribbon controls explicitly marked not feasible / partial
const partials = [];
const nos = [];
for (const t of ribbon) for (const g of t.groups) for (const c of g.controls.concat(g.launcher ? [g.launcher] : [])) {
  if (c.feasible === 'no') nos.push(`${t.name} ▸ ${g.name} ▸ ${c.label}`);
  else if (c.feasible === 'partial') partials.push(`${t.name} ▸ ${g.name} ▸ ${c.label}`);
}
md += `## Ribbon controls present in the UI but not fully functional\n\n`;
md += `Every ribbon tab, group, and control from Microsoft Word is rendered in this clone for UI fidelity. The controls below are present and clickable but are **stubbed or approximated** (clicking shows an explanatory message). This is intentional: the UI is complete; the deep engine behind these specific controls is out of scope for a one-session build.\n\n`;
md += `### ❌ Not implemented (placeholder UI only)\n\n`;
md += nos.length ? nos.map((s) => `- ${s}`).join('\n') + '\n\n' : '_None — all rendered controls have at least partial behavior._\n\n';
md += `### 🟡 Partial / approximated\n\n`;
md += partials.length ? partials.map((s) => `- ${s}`).join('\n') + '\n\n' : '_None._\n\n';

fs.writeFileSync(path.join(ROOT, 'docs', 'NOT_IMPLEMENTED.md'), md);

// ---- visual-spec.md ----
let vs = `# Microsoft Word — Visual Design Reference (M365 light theme)\n\n_Auto-generated from research. Drives the CSS variables in \`src/renderer/styles/base.css\`._\n\n## Palette\n\n| Hex | Name | Usage |\n|---|---|---|\n`;
for (const p of research.visual.palette) vs += `| \`${p.hex}\` | ${decode(p.name)} | ${decode(p.usage || '')} |\n`;
vs += `\n## Typography\n\n`;
for (const t of research.visual.typography) vs += `- **${decode(t.element)}**: ${decode(t.spec)}\n`;
vs += `\n## Metrics\n\n`;
for (const m of research.visual.metrics) vs += `- **${decode(m.element)}**: ${decode(m.value)}\n`;
vs += `\n## Notes\n\n`;
for (const n of research.visual.notes) vs += `- ${decode(n)}\n`;
fs.writeFileSync(path.join(ROOT, 'docs', 'research', 'visual-spec.md'), vs);

// ---- tech-notes.md ----
let tn = `# Technical Strategy (from research)\n\n`;
for (const r of research.tech.recommendations) {
  tn += `## ${decode(r.topic)}\n\n**Recommendation:** ${decode(r.recommendation)}\n\n`;
  if (r.rationale) tn += `**Rationale:** ${decode(r.rationale)}\n\n`;
  if (r.libraries && r.libraries.length) tn += `**Libraries:** ${r.libraries.map(decode).join('; ')}\n\n`;
  if (r.pitfalls && r.pitfalls.length) { tn += `**Pitfalls:**\n\n`; for (const p of r.pitfalls) tn += `- ${decode(p)}\n`; tn += `\n`; }
}
fs.writeFileSync(path.join(ROOT, 'docs', 'research', 'tech-notes.md'), tn);

// Stats
let nCtrl = 0, nGroups = 0;
for (const t of ribbon) { nGroups += t.groups.length; for (const g of t.groups) nCtrl += g.controls.length + (g.launcher ? 1 : 0); }
console.log(`ribbon-data.js: ${ribbon.length} tabs, ${nGroups} groups, ${nCtrl} controls`);
console.log(`backstage: ${backstage.sections.length} sections`);
console.log(`NOT_IMPLEMENTED.md: ${nos.length} not-implemented, ${partials.length} partial ribbon controls`);
console.log('wrote: ribbon-data.js, NOT_IMPLEMENTED.md, visual-spec.md, tech-notes.md');
