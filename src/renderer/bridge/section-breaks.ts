// 006 (Section Breaks) — insert a mid-document section break on the PM/paged engine.
//
// A mid-doc section break = a paragraph-level pPr/w:sectPr (the LAST paragraph of a section carries it). The
// fork's PUBLIC command editor.commands.insertSectionBreakAtSelection() sets that sectPr on the caret's paragraph
// via setNodeMarkup (spike-proven 2026-06-22: export → 2 <w:sectPr>; real Word reads Sections.Count==2,
// SectionStart==NewPage). A bare sectPr = Next Page; Continuous/Even/Odd add an OWNED <w:type w:val="…"/> to the
// created paragraph sectPr (the 003 columns bodySectPr pattern, on the paragraph's sectPr). NO fork edit; the
// WC.PM bridge is the only doc-write path; the model stays page-free (the sectPr is a paragraph property). The
// paged PE does NOT repaginate at the break in-app (known limitation — export-faithful; Word paginates on open).
type AnyEditor = any
type XmlEl = { type?: string; name?: string; attributes?: Record<string, any>; elements?: XmlEl[] }

type SectionStartType = 'nextPage' | 'continuous' | 'evenPage' | 'oddPage'

// CT_SectPr (ECMA-376 §17.6.17) places w:type AFTER the header/footer refs + footnote/endnote pr, BEFORE pgSz/etc.
const BEFORE_TYPE = new Set<string>(['w:headerReference', 'w:footerReference', 'w:footnotePr', 'w:endnotePr'])

export function installSectionBreaks(editor: AnyEditor) {
  const w = window as any
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }

  // The body (trailing document) sectPr — the section AFTER the break. Word puts the break's `w:type` HERE, not on
  // the mid-doc paragraph sectPr (verified against Word: a Continuous break writes `<w:type w:val="continuous">` on
  // the BODY sectPr → Word reads Sections(2).SectionStart=Continuous; the mid-doc sectPr stays bare). The live
  // body sectPr is `state.doc.attrs.bodySectPr` (the exporter reads it; `converter.bodySectPr` is null until a
  // sections-adapter mutation populates it). Mutating it IN PLACE survives export (diagnosed 2026-06-22) — the 003
  // columns owned-write pattern. NO fork edit; KNOWN v1: outside the PM undo stack (best-effort), single break
  // (the section after it IS the body section); multi-break per-section typing is a future feature.
  function bodySectPr(): XmlEl | null {
    try { return (editor as any)?.state?.doc?.attrs?.bodySectPr || null } catch { return null }
  }

  // Add/replace <w:type w:val="…"/> on the BODY sectPr (the section after the break), in CT_SectPr order
  // (w:type goes after any header/footer refs + footnote/endnote pr, before pgSz/etc). IN-PLACE mutation — the
  // exporter reads this object by reference. Returns false if the body sectPr isn't reachable (never a silent ok).
  function setSectionType(typeVal: string): boolean {
    try {
      const sect = bodySectPr()
      if (!sect) return false
      if (!Array.isArray(sect.elements)) sect.elements = []
      for (let i = sect.elements.length - 1; i >= 0; i--) { if (sect.elements[i]?.name === 'w:type') sect.elements.splice(i, 1) }
      let idx = 0
      while (idx < sect.elements.length && BEFORE_TYPE.has(sect.elements[idx]?.name || '')) idx++
      sect.elements.splice(idx, 0, { type: 'element', name: 'w:type', attributes: { 'w:val': typeVal } })
      return true
    } catch { return false }
  }

  const norm = (t: unknown): SectionStartType => (t === 'continuous' || t === 'evenPage' || t === 'oddPage' || t === 'nextPage') ? t : 'nextPage'

  // Count paragraphs already carrying a mid-doc sectPr (= existing section breaks) in the live doc.
  function midDocSectPrCount(): number {
    let n = 0
    try { (editor as any)?.state?.doc?.descendants?.((node: any) => { if (node?.type?.name === 'paragraph' && node?.attrs?.paragraphProperties?.sectPr) n++ }) } catch { /* none */ }
    return n
  }

  // Insert a section break of `type` at the caret. nextPage = a bare sectPr (Word's default start); the others
  // add a w:type. Fails honestly when there's no insertion point (e.g. the very first paragraph — the fork
  // command guards paraPos>0).
  //
  // v1 GUARD (review): a TYPED break writes w:type to the BODY sectPr, which only types the LAST section — correct
  // for a SINGLE break (oracle-validated: section 2 == the body section). A 2nd+ TYPED break would OVERWRITE the
  // prior type AND leave both mid-doc sectPrs bare → Word reads the wrong section starts (silent wrong output). So
  // refuse a 2nd+ typed break LOUDLY (the flyout toasts "Could not insert…"). Multiple nextPage breaks ARE allowed
  // (no w:type written; every bare mid-doc sectPr correctly defaults to NewPage). Per-section typing across
  // multiple breaks (write w:type onto each break's NEXT-section sectPr) is a future feature.
  function insertSectionBreak(type: SectionStartType): boolean {
    try {
      const cmd = editor?.commands
      if (typeof cmd?.insertSectionBreakAtSelection !== 'function') return false
      const t = norm(type)
      if (t !== 'nextPage' && midDocSectPrCount() >= 1) return false // v1: only ONE typed break per document
      if (cmd.insertSectionBreakAtSelection() !== true) return false
      if (t !== 'nextPage') { if (!setSectionType(t)) return false }
      markDirty()
      return true
    } catch { return false }
  }

  return { insertSectionBreak }
}
