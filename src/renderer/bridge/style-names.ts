// Display-name ↔ OOXML styleId for the styles UI vocabulary (slice 3).
// The UI (ribbon-data gallery items, .style-cell dataset.style, the legacy BUILTIN
// list) speaks display names; the engine (setStyleById, paragraphProperties.styleId,
// w:styleId) speaks ids. NEVER derive this from styles.xml w:name — the blank
// fixture's heading names are lowercase ('heading 1').
export const STYLE_NAME_TO_ID: Record<string, string> = {
  'Normal': 'Normal',
  'No Spacing': 'NoSpacing',
  'Heading 1': 'Heading1',
  'Heading 2': 'Heading2',
  'Heading 3': 'Heading3',
  'Heading 4': 'Heading4',
  'Title': 'Title',
  'Subtitle': 'Subtitle',
  'Quote': 'Quote',
  'Intense Quote': 'IntenseQuote',
  'List Paragraph': 'ListParagraph',
  'Strong': 'Strong',
  'Emphasis': 'Emphasis',
  'Subtle Emphasis': 'SubtleEmphasis',
  'Intense Emphasis': 'IntenseEmphasis',
  // Intense Reference is defined in the base fixture's styles.xml (probe-verified);
  // Subtle Reference / Book Title are NOT (would need a fixture regen — deferred).
  'Intense Reference': 'IntenseReference',
}
export const STYLE_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE_NAME_TO_ID).map(([name, id]) => [id, name]),
)
