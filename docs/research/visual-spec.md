# Microsoft Word — Visual Design Reference (M365 light theme)

_Auto-generated from research. Drives the CSS variables in `src/renderer/styles/base.css`._

## Palette

| Hex | Name | Usage |
|---|---|---|
| `#2B579A` | Word brand blue (accent) | Primary Word accent. App theme color used for active-tab underline/indicator, File-tab and ribbon-launcher accents, focus rings, hyperlink-style highlights, and the Word app icon. RGB(43,87,154), CSS name 'Endeavour'. |
| `#2B579A` | File tab (Backstage) blue | The 'File' tab fill in the tab strip (a solid Word-blue chip), and the Backstage left rail uses this same brand blue. |
| `#F3F2F1` | Ribbon / window background | Default neutral ribbon body and overall chrome background in the modern (post-2019/M365) light theme. Very light warm gray. |
| `#F3F2F1` | Tab strip background | Background behind the ribbon tab labels (Home, Insert, ...). In the flat modern theme it matches the ribbon background; the active tab is distinguished by its underline, not a different fill. |
| `#FFFFFF` | Active tab background | Selected ribbon tab body. In modern M365 the selected tab text is brand blue with a ~2px #2B579A underline; the ribbon body below reads as white/near-white. |
| `#2B579A` | Active tab indicator (underline) | ~2px solid brand-blue underline beneath the currently selected tab label. |
| `#444444` | Inactive tab text | Unselected tab labels and most ribbon/group label text. Near-black neutral (#444 to #333). |
| `#E1DFDD` | Button hover background | Hover state fill for ribbon buttons, gallery items, and tabs. Light neutral gray (Fluent neutralLight). |
| `#D2D0CE` | Button pressed / selected background | Pressed/active and toggled-on (e.g. Bold engaged) ribbon button fill. Slightly darker gray (Fluent neutralQuaternaryAlt). Toggled-on buttons also tint subtly toward brand blue. |
| `#C8C6C4` | Button hover/pressed border | 1px subtle border that appears around a button on hover/press (Fluent neutralTertiaryAlt). |
| `#E1DFDD` | Group divider / separator | 1px vertical hairline separating ribbon groups, and the thin rule above group labels. Also used for QAT and status-bar separators. |
| `#E6E6E6` | Document canvas (work area) gray | The gray area surrounding the page in the editing view (classic ~#ECECEC to #E6E6E6). The page 'floats' on this neutral gray. |
| `#FFFFFF` | Page (paper) white | The document page itself - pure white sheet with a soft drop shadow against the canvas gray. |
| `rgba(0,0,0,0.20)` | Page drop shadow | Soft shadow under/around the page giving the floating-paper effect (e.g. 0 1px 4px rgba(0,0,0,0.2)). |
| `#CCE8FF` | Selection highlight blue | Text selection highlight in the document when the window is focused (light Windows selection blue, approx #ADD6FF to #CCE8FF). Inactive/out-of-focus selection falls back to a light gray. |
| `#F3F2F1` | Status bar background | Bottom status bar fill in the modern light theme (neutral). Earlier 'Colorful' builds painted the status bar in Word-blue #2B579A with white text; the current M365 default is the neutral light bar with dark text. |
| `#444444` | Status bar text | Status-bar text and icons (page count, word count, language, zoom). Near-black neutral on the light bar. |
| `#FFFFFF` | Title bar background | Modern M365 title bar / QAT region is near-white. (Legacy 'Colorful' theme used Word-blue #2B579A title bar with white caption text and white QAT icons.) |
| `#444444` | Ribbon icon color (monoline) | Fluent monoline ribbon glyphs render in a dark neutral (#424242/#444), with selective brand-blue or category accents on a few icons. |

## Typography

- **UI font family**: Segoe UI (Windows). Fallback stack: 'Segoe UI', 'Segoe UI Web', system-ui, Tahoma, Arial, sans-serif. Antialiased/ClearType. Weights used: Regular 400, Semibold 600, Bold 700.
- **Title bar / document name**: Segoe UI Regular, ~12px (9pt). Centered in modern M365; near-black on white (or white on blue in legacy Colorful).
- **Ribbon tab labels (Home, Insert, ...)**: Segoe UI Regular, ~14px (12px-14px range). Selected tab is brand blue #2B579A; unselected #444. Comfortable letter spacing, sentence case.
- **File tab label**: Segoe UI Semibold, ~14px, white text on the #2B579A blue chip.
- **Ribbon button labels**: Segoe UI Regular, ~12px (9pt). Two-line wrap allowed under large buttons (e.g. 'Format\nPainter'). Color #444.
- **Ribbon group labels (bottom captions)**: Segoe UI Regular, ~11px (9pt). Centered under each group (Clipboard, Font, Paragraph, Styles, Editing). Color #444/#605E5C neutral.
- **Gallery / dropdown item text**: Segoe UI Regular, ~12px. Style names in the Styles gallery render in their own formatting (e.g. Calibri 11) but the chrome chrome around them is Segoe UI.
- **Status bar text**: Segoe UI Regular, ~12px (9pt). 'Page 1 of 1', 'X words', language, zoom %. Color #444.
- **QAT tooltips / screen tips**: Segoe UI Regular ~12px body with Segoe UI Semibold ~12-13px title.
- **Default DOCUMENT body font**: Calibri 11pt (the Office default body font). Line spacing 1.08, 8pt space-after paragraph (Office default). Calibri is a humanist sans-serif; web fallback: Calibri, 'Carlito', 'Segoe UI', sans-serif.
- **Default DOCUMENT heading font**: Calibri Light (Headings) for Heading 1/Title in the default Office theme; body style uses Calibri. (Newer 'Aptos' theme ships in latest M365, but Calibri remains the classic default referenced here.)

## Metrics

- **Title bar height**: ~32px (standard Windows caption / M365 title+QAT band).
- **Quick Access Toolbar (QAT) height**: ~28-32px. Shares the title-bar band in M365; icons ~16px in a ~24px hit target.
- **Ribbon tab strip height**: ~28-30px (tab label row), with ~2px active-tab underline at its base.
- **Ribbon body height**: ~92px (range 90-95px). Total ribbon block (tabs + body) is roughly 120-125px tall when expanded.
- **Collapsed/simplified ribbon body**: ~40px single-row (Simplified Ribbon option), vs ~92px Classic.
- **Ribbon group min width**: ~52-60px for a small group (e.g. Editing) up to ~120-200px for large groups (Font, Paragraph). Groups scale/collapse responsively; collapsed group = single ~52px button with dropdown.
- **Ribbon large button**: ~48px tall x ~36-44px wide (icon ~32px + two-line label). Small buttons ~22px square hit targets in a 3-row stack.
- **Group divider**: 1px vertical hairline (#E1DFDD) with ~4-6px padding either side between groups.
- **Ruler height (horizontal)**: ~18-20px strip below the ribbon when View > Ruler is on; matching ~18px vertical ruler at left.
- **Status bar height**: ~22px (range 22-24px).
- **Scrollbar width**: ~16-17px (Windows standard); thin overlay ~8px in newer builds.
- **Page size - US Letter (default, US locale)**: 8.5 x 11 in = 215.9 x 279.4 mm. At 96 CSS px/in => 816 x 1056 px.
- **Page size - A4 (default, EU/intl locale)**: 210 x 297 mm = 8.27 x 11.69 in. At 96 px/in => ~794 x 1123 px.
- **Default margins**: 1 in (2.54 cm) on all four sides (Normal margins). At 96 px/in => 96px each side. Text column on Letter = 816 - 192 = 624px wide.
- **Default page gap (between pages in view)**: ~10-14px gray gutter between consecutive page sheets in Print Layout.
- **Page shadow**: Soft drop shadow approx 0 1px 4px rgba(0,0,0,0.20) around each white sheet on the gray canvas.

## Notes

- Word brand blue confirmed as #2B579A (RGB 43,87,154, CSS name 'Endeavour'). It is the accent used for the File tab chip, active-tab underline, focus rings, and the legacy Colorful-theme title/status bars. Source: brandcolorcode.com, usbrandcolors.com, colorhexa.
- Default UI font is Segoe UI across all chrome (tabs, group labels, button captions, status bar). Default DOCUMENT font is Calibri 11pt with 1.08 line spacing and 8pt space-after (Office defaults). Newest M365 builds ship 'Aptos' as the document default, but Calibri 11 is the classic/long-standing default this spec targets.
- Theme distinction: The MODERN M365 default ('Colorful' in current builds) uses a flat near-white/neutral chrome (#F3F2F1 ribbon, near-white title bar) with brand-blue accents only on the File tab and active-tab underline. The OLDER 'Colorful' theme (2013-2019) painted the entire title bar AND status bar solid Word-blue #2B579A with white text/icons. State both so the implementer can pick.
- Active tab styling in modern Word: NOT a raised/colored tab. The selected tab shows brand-blue label text plus a ~2px #2B579A underline; the ribbon body below it reads as white. Inactive tabs are #444 text on the neutral strip.
- Button states (Fluent neutrals): rest = transparent on ribbon bg; hover = #E1DFDD fill with 1px #C8C6C4 border and ~2-3px rounded corners; pressed/selected/toggled-on = #D2D0CE fill (toggled-on like engaged Bold also gets a subtle blue tint). Corner radius on ribbon controls is small (~2-3px); the chrome is largely flat/squared per Fluent.
- Group structure: each ribbon group is a cluster of controls with a centered ~11px Segoe UI caption at the bottom (Clipboard | Font | Paragraph | Styles | Editing on the Home tab). Groups are separated by a 1px vertical hairline (#E1DFDD). Many groups have a small dialog-launcher arrow at the bottom-right that opens the full dialog.
- Icons are Fluent monoline glyphs (single-weight outlines) rendered in dark neutral #424242/#444, a few with category accents (e.g. text-highlight yellow, font-color red bar). They are crisp at 16px and 32px. Avoid filled/skeuomorphic icons - that's the pre-2013 look.
- Document canvas: white page (#FFF) with soft drop shadow floating on a light gray work area (~#E6E6E6). Default view is Print Layout showing the full sheet with 1in margins; text selection highlights light blue (~#CCE8FF) when focused.
- Rounded corners overall: the chrome is predominantly flat/squared (Fluent). Only minor 2-3px rounding on hover/pressed button backgrounds, tooltips, and dropdown popovers; the window itself follows the OS (Windows 11 adds ~8px rounded window corners).
- Separators & dividers summary: vertical group dividers (1px #E1DFDD), QAT-to-title separators, and status-bar item separators are all thin 1px neutral hairlines; nothing uses heavy/dark borders.
