// src/renderer/bridge/mail.ts — slice 10 mail-merge doc-mutation surface (engine/data stay clone-owned).
type AnyEditor = any
const slug = (s: string) => String(s || '').replace(/[^A-Za-z0-9]+/g, '').slice(0, 24) || 'Field'

export function installMailMerge(editor: AnyEditor) {
  const refocus = () => editor.view?.focus()
  const countMergeFields = (): number => { let n = 0; editor.state.doc.descendants((x: any) => { if (x.type.name === 'fieldAnnotation' && x.attrs.fieldType) n++ }); return n }

  function insertFieldCode(code: string, name: string, label: string): boolean {
    const before = countMergeFields()
    editor.commands.addFieldAnnotationAtSelection({
      type: 'text', fieldType: code,
      fieldId: `mm-${slug(name)}-${Math.floor(editor.state.doc.content.size)}-${slug(label)}`,
      displayLabel: label, defaultDisplayLabel: label,
    }, false)
    refocus()
    return countMergeFields() === before + 1
  }
  const mmInsertField = (field: string) => insertFieldCode('MERGEFIELD', field, `«${field}»`)
  const mmAddressBlock = () => insertFieldCode('ADDRESSBLOCK', 'AddressBlock', '«AddressBlock»')
  const mmGreetingLine = () => insertFieldCode('GREETINGLINE', 'GreetingLine', '«GreetingLine»')
  const mmInsertRule = (code: string, label: string) => insertFieldCode(code.split(/\s+/)[0], code.split(/\s+/)[0], `{ ${label || code} }`)

  function mmHighlight(on: boolean): boolean {
    editor.commands.setFieldAnnotationsHighlighted((n: any) => n.attrs && n.attrs.fieldType != null, on !== false)
    refocus(); return true
  }
  function mmPreview(values: Record<string, string> | null): boolean {
    const updates: Array<{ id: string; label: string }> = []
    editor.state.doc.descendants((n: any) => {
      if (n.type.name !== 'fieldAnnotation' || n.attrs.fieldType !== 'MERGEFIELD') return
      const name = String(n.attrs.defaultDisplayLabel || n.attrs.displayLabel || '').replace(/^«|»$/g, '')
      const label = values == null ? `«${name}»` : (values[name] != null ? String(values[name]) : `«${name}»`)
      updates.push({ id: n.attrs.fieldId, label })
    })
    updates.forEach((u) => editor.commands.updateFieldAnnotations(u.id, { displayLabel: u.label }))
    refocus(); return true
  }
  function mmBuildMerge(recipients: any[], resolve: (field: string, rec: any) => string): string {
    const w = window as any
    const template: string = w.WC?.PM?.getHTML?.() || ''
    const BREAK = '<div class="manual-break" contenteditable="false" style="break-after:page;page-break-after:always"></div>'
    const fillOne = (rec: any): string => {
      const div = document.createElement('div'); div.innerHTML = template
      div.querySelectorAll('span.annotation[data-field-type]').forEach((m: any) => {
        const code = m.getAttribute('data-field-type')
        // Read the IMMUTABLE name (data-default-display-label); data-display-label is
        // overwritten by mmPreview to the record value while preview is on.
        const label = m.getAttribute('data-default-display-label') || m.getAttribute('data-display-label') || ''
        const name = code === 'MERGEFIELD' ? label.replace(/^«|»$/g, '')
          : code === 'ADDRESSBLOCK' ? '__AddressBlock__' : code === 'GREETINGLINE' ? '__GreetingLine__' : code === 'NEXT' ? '__NextRecord__' : ''
        m.outerHTML = name ? (resolve(name, rec) || '') : m.outerHTML
      })
      return div.innerHTML
    }
    return (recipients && recipients.length ? recipients : [{}]).map(fillOne).join(BREAK)
  }
  async function mmFinishToNewDoc(mergedHtml: string): Promise<boolean> {
    const w = window as any
    return !!(await w.WC?.PM?.openHtml?.(mergedHtml))
  }

  return { mmInsertField, mmAddressBlock, mmGreetingLine, mmInsertRule, mmHighlight, mmPreview, mmBuildMerge, mmFinishToNewDoc }
}
