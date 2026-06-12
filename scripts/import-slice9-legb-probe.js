/* slice-9 references LEG-B import probe (Word -> clone). NO Word/COM here — a
   headless electron import only. Runs in the renderer via electron --shot-evalfile;
   driven by the Node host scripts/import-slice9-legb.js. Mirrors the structure of
   scripts/author-slice9-clone-probe.js (sentinel-gated readiness, same JSON
   contract) and the [0b]/[9] round-trip pattern in scripts/test-suite-pm.js
   (openBytes -> WC.PM.openDocx(bytes) -> inspect doc.toJSON()).

   Fixture: C:/tmp/wc-slice9-resaved.docx — Word for Windows 16.0 opened a clone
   references doc and RESAVED it, so this file is WORD'S OWN OOXML for: 1 footnote +
   body, a TOC field (TOC \o "1-3" \u \h \z), a SEQ Figure caption, a CITATION
   field, and a <b:Source> in customXml. The goal is to confirm those references
   constructs survive the fork converter's import of REAL-Word XML.

   Reports booleans:
     footnoteRefNode  — a footnoteReference node exists in the imported PM doc
     tocNodeOrField   — a tableOfContents node exists OR the TOC survived as a
                        field/instruction (TOC instruction text or w:fldChar in the
                        re-exported document.xml) — accept either
     captionSeq       — a sequenceField node OR a SEQ Figure field survived
     citationNode     — a citation node OR a CITATION field survived
     contentError     — did the import blank the doc / emit a contentError /
                        return non-true (MUST be false on a healthy import) */
(async () => {
  const results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Convention (matches test-suite-pm.js / author probe): a string return is a
  // FAILURE carrying detail; true/non-string/non-false is a PASS.
  const t = async (name, fn) => {
    try { const r = await fn(); results.push({ name, pass: r !== false && typeof r !== 'string', detail: typeof r === 'string' ? r : '' }); }
    catch (e) { results.push({ name, pass: false, detail: 'ERR: ' + ((e && e.message) || e) }); }
  };

  const FIXTURE = 'C:/tmp/wc-slice9-resaved.docx';

  // Assertions object — filled as the probe runs; printed in summary so the host
  // can judge it directly.
  const assertions = {
    footnoteRefNode: false,
    tocNodeOrField: false,
    captionSeq: false,
    citationNode: false,
    contentError: false, // healthy import => stays false
  };
  let importResult = 'not-run';

  for (let i = 0; i < 200 && !(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready); i++) await sleep(50);
  if (!(window.__WC_READY && window.WC && window.WC.PM && window.WC.PM.ready)) {
    return JSON.stringify({
      summary: { total: 1, pass: 0, fail: 1, fixture: FIXTURE, importResult: 'harness-not-ready', assertions },
      results: [{ name: 'harness ready', pass: false, detail: 'sentinel timeout after 10s' }],
    }, null, 2);
  }

  const PM = () => window.WC.PM;
  const v = () => window.WC.view;
  const doc = () => v().state.doc;
  // Recursive node-name scan over the imported PM doc (covers nested footnote /
  // TOC / table content, which descendants() also walks).
  const hasNode = (name) => { let f = false; doc().descendants((n) => { if (n.type.name === name) f = true; }); return f; };
  // Collect every node-type name present (diagnostic — surfaces how Word's fields
  // were mapped: fieldAnnotation, citation, sequenceField, tableOfContents, etc.).
  const nodeTypeNames = () => { const s = new Set(); doc().descendants((n) => s.add(n.type.name)); return [...s].sort(); };
  // Raw word/document.xml string the imported doc would re-export to — lets us
  // detect constructs that survived as Word FIELDS (instruction text / fldChar)
  // rather than as dedicated PM nodes.
  const exportDocumentXml = async () => {
    const xml = await window.WC.editor.exportDocx({ exportXmlOnly: true });
    return typeof xml === 'string' ? xml : '';
  };

  // --- THE IMPORT: read the real-Word resaved bytes off disk, then openDocx ----
  let bytes = null;
  await t('read fixture bytes via wordAPI.openBytes(' + FIXTURE + ')', async () => {
    const r = await window.wordAPI.openBytes(FIXTURE);
    if (!r || !r.ok) return 'openBytes failed: ' + ((r && r.error) || JSON.stringify(r));
    bytes = r.bytes;
    if (!bytes || bytes.length < 500) return 'fixture too small: ' + (bytes ? bytes.length : 'null') + ' bytes';
    // PK zip header — Word .docx is a zip.
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'no PK zip header: bytes[0..1]=' + bytes[0] + ',' + bytes[1];
    return true;
  });

  await t('WC.PM.openDocx(bytes): import the real-Word references docx (no contentError, not blanked)', async () => {
    if (!bytes) return 'skipped: no fixture bytes';
    let ok;
    try {
      ok = await PM().openDocx(bytes); // THE IMPORT PATH (slice-9 Leg B)
    } catch (e) {
      importResult = 'THREW: ' + ((e && e.message) || e);
      assertions.contentError = true; // a throw on the docx path == failBridge / degraded import
      return 'openDocx THREW: ' + ((e && e.message) || e);
    }
    await sleep(200); // let the editor rebuild / decorations settle
    if (ok !== true) {
      // openDocx returns false on parse failure OR a phase-2 contentError that
      // rethrew into failBridge OR a blanked import — all are a real Leg-B finding.
      importResult = 'openDocx returned ' + JSON.stringify(ok) + ' (import refused / failBridge / blanked)';
      assertions.contentError = true;
      return importResult;
    }
    // lastImportBlanked() is the bridge's own "the doc is gone, recovered to blank"
    // flag — a true here means the import degraded to a blank doc.
    const blanked = !!(PM().lastImportBlanked && PM().lastImportBlanked());
    if (blanked) {
      importResult = 'openDocx returned true BUT lastImportBlanked()=true (import degraded to blank)';
      assertions.contentError = true;
      return importResult;
    }
    // Sanity: the imported body must have real content (Word's doc has a TOC +
    // body + a footnote — a near-empty doc means the converter dropped everything).
    const size = doc().content.size;
    if (size < 8) {
      importResult = 'openDocx returned true but doc is effectively empty (content.size=' + size + ')';
      assertions.contentError = true;
      return importResult;
    }
    importResult = 'openDocx returned true; doc.content.size=' + size + '; nodeTypes=' + JSON.stringify(nodeTypeNames());
    return true;
  });

  // If the import itself failed, the construct checks are meaningless — record them
  // as failures with the import detail rather than probing a stale/old doc.
  const importedOk = assertions.contentError === false && importResult.startsWith('openDocx returned true');

  // --- CONSTRUCT SURVIVAL CHECKS (only meaningful on a healthy import) ---------
  let reXml = '';
  await t('re-export imported doc to document.xml (for field-survival checks)', async () => {
    if (!importedOk) return 'skipped: import did not succeed (' + importResult + ')';
    reXml = await exportDocumentXml();
    return reXml.length > 0 || 'exportDocx(exportXmlOnly) returned empty';
  });

  await t('footnoteRefNode: a footnoteReference node survived the import', async () => {
    if (!importedOk) return 'skipped: import did not succeed';
    assertions.footnoteRefNode = hasNode('footnoteReference');
    return assertions.footnoteRefNode || 'no footnoteReference node in imported doc; nodeTypes=' + JSON.stringify(nodeTypeNames());
  });

  await t('tocNodeOrField: a tableOfContents node OR a TOC field/instruction survived', async () => {
    if (!importedOk) return 'skipped: import did not succeed';
    const node = hasNode('tableOfContents');
    // Word serializes a TOC as a field: instruction text "TOC \o ..." inside
    // w:instrText, wrapped in w:fldChar begin/end. Accept either signal in the
    // re-exported XML (the converter may map it to a node OR keep it as a field).
    const tocInstr = /\bTOC\b/.test(reXml); // matches the TOC \o "1-3" instruction
    const fldChar = /<w:fldChar\b/.test(reXml);
    assertions.tocNodeOrField = !!(node || tocInstr || fldChar);
    if (assertions.tocNodeOrField) return true;
    return 'TOC survived as NEITHER a tableOfContents node NOR a TOC field marker (TOC instr / w:fldChar). nodeTypes='
      + JSON.stringify(nodeTypeNames());
  });

  await t('captionSeq: a sequenceField node OR a SEQ Figure field survived', async () => {
    if (!importedOk) return 'skipped: import did not succeed';
    const node = hasNode('sequenceField');
    // Word serializes a caption number as a SEQ field: instrText "SEQ Figure ...".
    const seqInstr = /\bSEQ\b/.test(reXml);
    // The visible caption label text ("Figure") surviving in the body is a weaker
    // but real signal the caption paragraph imported at all.
    const figureText = /Figure/.test(doc().textContent);
    assertions.captionSeq = !!(node || seqInstr);
    if (assertions.captionSeq) return true;
    // Report the weaker signal in detail so a partial survival is visible.
    return 'SEQ caption survived as NEITHER a sequenceField node NOR a SEQ field marker'
      + (figureText ? ' (caption TEXT "Figure" is present, but the SEQ field/number was dropped)' : ' (no "Figure" text either)')
      + '. nodeTypes=' + JSON.stringify(nodeTypeNames());
  });

  await t('citationNode: a citation node OR a CITATION field survived', async () => {
    if (!importedOk) return 'skipped: import did not succeed';
    const node = hasNode('citation');
    // Word serializes a managed citation as a CITATION field: instrText
    // "CITATION <tag> ...". The converter may also map it to a fieldAnnotation.
    const citInstr = /\bCITATION\b/.test(reXml);
    const fieldAnno = hasNode('fieldAnnotation');
    assertions.citationNode = !!(node || citInstr);
    if (assertions.citationNode) return true;
    return 'citation survived as NEITHER a citation node NOR a CITATION field marker'
      + (fieldAnno ? ' (a fieldAnnotation node IS present — citation may have mapped to a generic field)' : '')
      + '. nodeTypes=' + JSON.stringify(nodeTypeNames());
  });

  await t('contentError stays FALSE (the import did not blank/throw)', async () => {
    return assertions.contentError === false || ('contentError TRUE — ' + importResult);
  });

  const pass = results.filter((r) => r.pass).length;
  return JSON.stringify({
    summary: { total: results.length, pass, fail: results.length - pass, fixture: FIXTURE, importResult, assertions },
    results,
  }, null, 2);
})()
