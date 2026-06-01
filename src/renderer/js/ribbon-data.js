/* AUTO-GENERATED from docs/research/raw-research.json by scripts/gen.js.
   Faithful Microsoft Word (Microsoft 365) ribbon map. Do not hand-edit; re-run the generator. */
window.WC = window.WC || {};
window.WC.RIBBON = [
  {
    "name": "Home",
    "id": "home",
    "groups": [
      {
        "name": "Clipboard",
        "id": "clipboard",
        "controls": [
          {
            "id": "home.clipboard.paste",
            "cmd": "paste",
            "label": "Paste",
            "type": "split",
            "tooltip": "Paste content from the Clipboard. Dropdown offers Paste Options: Keep Source Formatting, Merge Formatting, Picture, Keep Text Only, and Paste Special / Set Default Paste.",
            "shortcut": "Ctrl+V",
            "feasible": "partial",
            "items": [
              "Keep Source Formatting",
              "Merge Formatting",
              "Picture",
              "Keep Text Only",
              "Paste Special...",
              "Set Default Paste..."
            ]
          },
          {
            "id": "home.clipboard.cut",
            "cmd": "cut",
            "label": "Cut",
            "type": "button",
            "tooltip": "Remove the selection and put it on the Clipboard so you can paste it elsewhere.",
            "shortcut": "Ctrl+X",
            "feasible": "yes"
          },
          {
            "id": "home.clipboard.copy",
            "cmd": "copy",
            "label": "Copy",
            "type": "button",
            "tooltip": "Put a copy of the selection on the Clipboard so you can paste it somewhere else.",
            "shortcut": "Ctrl+C",
            "feasible": "yes"
          },
          {
            "id": "home.clipboard.format-painter",
            "cmd": "formatPainter",
            "label": "Format Painter",
            "type": "button",
            "tooltip": "Copy formatting from one place and apply it to another. Double-click to apply to multiple selections.",
            "shortcut": "Ctrl+Shift+C / Ctrl+Shift+V",
            "feasible": "partial"
          }
        ],
        "launcher": {
          "id": "home.clipboard.clipboard",
          "cmd": "clipboard",
          "label": "Clipboard",
          "type": "button",
          "tooltip": "Dialog Box Launcher: opens the Clipboard task pane showing collected cut/copied items.",
          "feasible": "partial"
        }
      },
      {
        "name": "Font",
        "id": "font",
        "controls": [
          {
            "id": "home.font.font",
            "cmd": "font",
            "label": "Font",
            "type": "combo",
            "tooltip": "Change the font face. Editable combo box with live preview of installed fonts.",
            "shortcut": "Ctrl+Shift+F",
            "feasible": "partial"
          },
          {
            "id": "home.font.font-size",
            "cmd": "fontSize",
            "label": "Font Size",
            "type": "combo",
            "tooltip": "Change the size of your text. Editable combo box.",
            "shortcut": "Ctrl+Shift+P",
            "feasible": "yes"
          },
          {
            "id": "home.font.increase-font-size",
            "cmd": "increaseFontSize",
            "label": "Increase Font Size",
            "type": "button",
            "tooltip": "Make the text a bit bigger.",
            "shortcut": "Ctrl+>",
            "feasible": "yes"
          },
          {
            "id": "home.font.decrease-font-size",
            "cmd": "decreaseFontSize",
            "label": "Decrease Font Size",
            "type": "button",
            "tooltip": "Make the text a bit smaller.",
            "shortcut": "Ctrl+<",
            "feasible": "yes"
          },
          {
            "id": "home.font.change-case",
            "cmd": "changeCase",
            "label": "Change Case",
            "type": "dropdown",
            "tooltip": "Change all the selected text to UPPERCASE, lowercase, Capitalize Each Word, or other capitalization.",
            "feasible": "yes",
            "items": [
              "Sentence case.",
              "lowercase",
              "UPPERCASE",
              "Capitalize Each Word",
              "tOGGLE cASE"
            ]
          },
          {
            "id": "home.font.clear-all-formatting",
            "cmd": "clearAllFormatting",
            "label": "Clear All Formatting",
            "type": "button",
            "tooltip": "Remove all formatting from the selection, leaving only plain text.",
            "feasible": "yes"
          },
          {
            "id": "home.font.bold",
            "cmd": "bold",
            "label": "Bold",
            "type": "toggle",
            "tooltip": "Make your text bold.",
            "shortcut": "Ctrl+B",
            "feasible": "yes"
          },
          {
            "id": "home.font.italic",
            "cmd": "italic",
            "label": "Italic",
            "type": "toggle",
            "tooltip": "Italicize your text.",
            "shortcut": "Ctrl+I",
            "feasible": "yes"
          },
          {
            "id": "home.font.underline",
            "cmd": "underline",
            "label": "Underline",
            "type": "split",
            "tooltip": "Underline your text. Dropdown chooses underline style and color (single, double, dotted, etc.).",
            "shortcut": "Ctrl+U",
            "feasible": "partial",
            "items": [
              "Underline styles",
              "More Underlines...",
              "Underline Color"
            ]
          },
          {
            "id": "home.font.strikethrough",
            "cmd": "strikethrough",
            "label": "Strikethrough",
            "type": "toggle",
            "tooltip": "Draw a line through the middle of the selected text.",
            "feasible": "yes"
          },
          {
            "id": "home.font.subscript",
            "cmd": "subscript",
            "label": "Subscript",
            "type": "toggle",
            "tooltip": "Type very small letters just below the line of text.",
            "shortcut": "Ctrl+=",
            "feasible": "yes"
          },
          {
            "id": "home.font.superscript",
            "cmd": "superscript",
            "label": "Superscript",
            "type": "toggle",
            "tooltip": "Type very small letters just above the line of text.",
            "shortcut": "Ctrl+Shift+=",
            "feasible": "yes"
          },
          {
            "id": "home.font.text-effects-and-typography",
            "cmd": "textEffectsAndTypography",
            "label": "Text Effects and Typography",
            "type": "dropdown",
            "tooltip": "Add visual effects such as shadow, glow, reflection, and outline. Also Number Styles, Ligatures, Stylistic Sets.",
            "feasible": "partial",
            "items": [
              "Outline",
              "Shadow",
              "Reflection",
              "Glow",
              "Number Styles",
              "Ligatures",
              "Stylistic Sets"
            ]
          },
          {
            "id": "home.font.text-highlight-color",
            "cmd": "textHighlightColor",
            "label": "Text Highlight Color",
            "type": "split",
            "tooltip": "Make text look like it was marked with a highlighter pen. Dropdown picks the highlight color or No Color / Stop Highlighting.",
            "feasible": "yes",
            "items": [
              "Color swatches",
              "No Color",
              "Stop Highlighting"
            ]
          },
          {
            "id": "home.font.font-color",
            "cmd": "fontColor",
            "label": "Font Color",
            "type": "split",
            "tooltip": "Change the color of your text. Dropdown opens the color palette: Automatic, Theme Colors, Standard Colors, More Colors, Gradient.",
            "feasible": "yes",
            "items": [
              "Automatic",
              "Theme Colors",
              "Standard Colors",
              "More Colors...",
              "Gradient"
            ]
          }
        ],
        "launcher": {
          "id": "home.font.font-2",
          "cmd": "font",
          "label": "Font",
          "type": "button",
          "tooltip": "Dialog Box Launcher: opens the Font dialog for detailed character formatting (effects, advanced spacing, OpenType).",
          "shortcut": "Ctrl+D",
          "feasible": "partial"
        }
      },
      {
        "name": "Paragraph",
        "id": "paragraph",
        "controls": [
          {
            "id": "home.paragraph.bullets",
            "cmd": "bullets",
            "label": "Bullets",
            "type": "split",
            "tooltip": "Create a bulleted list. Dropdown shows the Bullet Library and Define New Bullet.",
            "feasible": "partial",
            "items": [
              "Bullet Library",
              "Document Bullets",
              "Change List Level",
              "Define New Bullet..."
            ]
          },
          {
            "id": "home.paragraph.numbering",
            "cmd": "numbering",
            "label": "Numbering",
            "type": "split",
            "tooltip": "Create a numbered list. Dropdown shows the Numbering Library, Set Numbering Value, and Define New Number Format.",
            "feasible": "partial",
            "items": [
              "Numbering Library",
              "Change List Level",
              "Define New Number Format...",
              "Set Numbering Value..."
            ]
          },
          {
            "id": "home.paragraph.multilevel-list",
            "cmd": "multilevelList",
            "label": "Multilevel List",
            "type": "dropdown",
            "tooltip": "Create a multilevel list to organize items or create an outline. Includes Define New Multilevel List and Define New List Style.",
            "feasible": "partial",
            "items": [
              "Current List",
              "List Library",
              "Change List Level",
              "Define New Multilevel List...",
              "Define New List Style..."
            ]
          },
          {
            "id": "home.paragraph.decrease-indent",
            "cmd": "decreaseIndent",
            "label": "Decrease Indent",
            "type": "button",
            "tooltip": "Move your paragraph closer to the margin.",
            "feasible": "yes"
          },
          {
            "id": "home.paragraph.increase-indent",
            "cmd": "increaseIndent",
            "label": "Increase Indent",
            "type": "button",
            "tooltip": "Move your paragraph farther away from the margin.",
            "feasible": "yes"
          },
          {
            "id": "home.paragraph.sort",
            "cmd": "sort",
            "label": "Sort",
            "type": "button",
            "tooltip": "Arrange the current selection in alphabetical or numerical order.",
            "feasible": "partial"
          },
          {
            "id": "home.paragraph.show-hide",
            "cmd": "showHide",
            "label": "Show/Hide ¶",
            "type": "toggle",
            "tooltip": "Show paragraph marks and other hidden formatting symbols.",
            "shortcut": "Ctrl+*",
            "feasible": "partial"
          },
          {
            "id": "home.paragraph.align-left",
            "cmd": "alignLeft",
            "label": "Align Left",
            "type": "toggle",
            "tooltip": "Align your content to the left margin.",
            "shortcut": "Ctrl+L",
            "feasible": "yes"
          },
          {
            "id": "home.paragraph.center",
            "cmd": "center",
            "label": "Center",
            "type": "toggle",
            "tooltip": "Center your content on the page.",
            "shortcut": "Ctrl+E",
            "feasible": "yes"
          },
          {
            "id": "home.paragraph.align-right",
            "cmd": "alignRight",
            "label": "Align Right",
            "type": "toggle",
            "tooltip": "Align your content to the right margin.",
            "shortcut": "Ctrl+R",
            "feasible": "yes"
          },
          {
            "id": "home.paragraph.justify",
            "cmd": "justify",
            "label": "Justify",
            "type": "toggle",
            "tooltip": "Distribute your text evenly between the margins.",
            "shortcut": "Ctrl+J",
            "feasible": "partial"
          },
          {
            "id": "home.paragraph.line-and-paragraph-spacing",
            "cmd": "lineAndParagraphSpacing",
            "label": "Line and Paragraph Spacing",
            "type": "dropdown",
            "tooltip": "Choose how much space appears between lines of text or between paragraphs. Add/Remove Space Before/After Paragraph.",
            "feasible": "partial",
            "items": [
              "1.0",
              "1.15",
              "1.5",
              "2.0",
              "2.5",
              "3.0",
              "Line Spacing Options...",
              "Add Space Before Paragraph",
              "Remove Space After Paragraph"
            ]
          },
          {
            "id": "home.paragraph.shading",
            "cmd": "shading",
            "label": "Shading",
            "type": "split",
            "tooltip": "Color the background behind the selected text or paragraph. Dropdown opens the color palette.",
            "feasible": "yes",
            "items": [
              "Theme Colors",
              "Standard Colors",
              "No Color",
              "More Colors..."
            ]
          },
          {
            "id": "home.paragraph.borders",
            "cmd": "borders",
            "label": "Borders",
            "type": "split",
            "tooltip": "Add or remove borders from your selection. Dropdown lists border edge options, Draw Table, View Gridlines, Borders and Shading.",
            "feasible": "partial",
            "items": [
              "Bottom Border",
              "Top Border",
              "Left Border",
              "Right Border",
              "No Border",
              "All Borders",
              "Outside Borders",
              "Inside Borders",
              "Draw Table",
              "View Gridlines",
              "Borders and Shading..."
            ]
          }
        ],
        "launcher": {
          "id": "home.paragraph.paragraph",
          "cmd": "paragraph",
          "label": "Paragraph",
          "type": "button",
          "tooltip": "Dialog Box Launcher: opens the Paragraph dialog for indents, spacing, and line/page breaks.",
          "feasible": "partial"
        }
      },
      {
        "name": "Styles",
        "id": "styles",
        "controls": [
          {
            "id": "home.styles.styles-gallery",
            "cmd": "stylesGallery",
            "label": "Styles Gallery",
            "type": "gallery",
            "tooltip": "Apply a style (Normal, No Spacing, Heading 1, Heading 2, Title, etc.) for consistent formatting. Includes a scroll/More button to expand the gallery.",
            "feasible": "partial",
            "items": [
              "Normal",
              "No Spacing",
              "Heading 1",
              "Heading 2",
              "Heading 3",
              "Title",
              "Subtitle",
              "Subtle Emphasis",
              "Emphasis",
              "Intense Emphasis",
              "Strong",
              "Quote",
              "Intense Quote",
              "List Paragraph",
              "Create a Style",
              "Clear Formatting",
              "Apply Styles..."
            ]
          }
        ],
        "launcher": {
          "id": "home.styles.styles",
          "cmd": "styles",
          "label": "Styles",
          "type": "button",
          "tooltip": "Dialog Box Launcher: opens the Styles task pane listing all available styles with management options.",
          "shortcut": "Ctrl+Alt+Shift+S",
          "feasible": "partial"
        }
      },
      {
        "name": "Editing",
        "id": "editing",
        "controls": [
          {
            "id": "home.editing.find",
            "cmd": "find",
            "label": "Find",
            "type": "split",
            "tooltip": "Find text or other content in the document. Dropdown: Find, Advanced Find, Go To.",
            "shortcut": "Ctrl+F",
            "feasible": "yes",
            "items": [
              "Find",
              "Advanced Find...",
              "Go To..."
            ]
          },
          {
            "id": "home.editing.replace",
            "cmd": "replace",
            "label": "Replace",
            "type": "button",
            "tooltip": "Search for text you'd like to change and replace it with something else.",
            "shortcut": "Ctrl+H",
            "feasible": "yes"
          },
          {
            "id": "home.editing.select",
            "cmd": "select",
            "label": "Select",
            "type": "dropdown",
            "tooltip": "Select text or objects in the document: Select All, Select Objects, Select All Text With Similar Formatting, Selection Pane.",
            "feasible": "partial",
            "items": [
              "Select All",
              "Select Objects",
              "Select All Text With Similar Formatting",
              "Selection Pane..."
            ]
          }
        ]
      },
      {
        "name": "Voice",
        "id": "voice",
        "controls": [
          {
            "id": "home.voice.dictate",
            "cmd": "dictate",
            "label": "Dictate",
            "type": "split",
            "tooltip": "Use your voice to type anywhere on your computer. Dropdown selects spoken language and dictation settings.",
            "feasible": "no",
            "items": [
              "Spoken Language",
              "Settings"
            ]
          }
        ]
      },
      {
        "name": "Sensitivity",
        "id": "sensitivity",
        "controls": [
          {
            "id": "home.sensitivity.sensitivity",
            "cmd": "sensitivity",
            "label": "Sensitivity",
            "type": "dropdown",
            "tooltip": "Apply a sensitivity label to classify and protect this document (requires Microsoft Purview / organizational policy).",
            "feasible": "no",
            "items": [
              "Public",
              "General",
              "Confidential",
              "Highly Confidential"
            ]
          }
        ]
      },
      {
        "name": "Editor",
        "id": "editor",
        "controls": [
          {
            "id": "home.editor.editor",
            "cmd": "editor",
            "label": "Editor",
            "type": "button",
            "tooltip": "Check spelling, grammar, and refinements (clarity, conciseness) with the Editor pane.",
            "shortcut": "F7",
            "feasible": "no"
          }
        ]
      },
      {
        "name": "Add-ins",
        "id": "add-ins",
        "controls": [
          {
            "id": "home.add-ins.add-ins",
            "cmd": "addIns",
            "label": "Add-ins",
            "type": "dropdown",
            "tooltip": "Quick access to installed Office Add-ins; opens the Get Add-ins store and My Add-ins list.",
            "feasible": "no",
            "items": [
              "Get Add-ins",
              "My Add-ins"
            ]
          }
        ]
      },
      {
        "name": "Reuse Files",
        "id": "reuse-files",
        "controls": [
          {
            "id": "home.reuse-files.reuse-files",
            "cmd": "reuseFiles",
            "label": "Reuse Files",
            "type": "button",
            "tooltip": "Find and reuse content from your existing files (Microsoft 365 cloud feature). May not appear on all builds.",
            "feasible": "no"
          }
        ]
      }
    ]
  },
  {
    "name": "Insert",
    "id": "insert",
    "groups": [
      {
        "name": "Pages",
        "id": "pages",
        "controls": [
          {
            "id": "insert.pages.cover-page",
            "cmd": "coverPage",
            "label": "Cover Page",
            "type": "dropdown",
            "tooltip": "Add a stylish, fully formatted cover page from a gallery of designs (Built-in templates, Remove Current Cover Page).",
            "feasible": "partial",
            "items": [
              "Built-in cover page gallery",
              "More Cover Pages from Office.com",
              "Remove Current Cover Page",
              "Save Selection to Cover Page Gallery..."
            ]
          },
          {
            "id": "insert.pages.blank-page",
            "cmd": "blankPage",
            "label": "Blank Page",
            "type": "button",
            "tooltip": "Add a blank page anywhere in your document.",
            "feasible": "partial"
          },
          {
            "id": "insert.pages.page-break",
            "cmd": "pageBreak",
            "label": "Page Break",
            "type": "button",
            "tooltip": "End the current page and move to the next one.",
            "shortcut": "Ctrl+Enter",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Tables",
        "id": "tables",
        "controls": [
          {
            "id": "insert.tables.table",
            "cmd": "table",
            "label": "Table",
            "type": "dropdown",
            "tooltip": "Insert a table. Use the grid to pick rows/columns, or Insert Table, Draw Table, Convert Text to Table, Excel Spreadsheet, Quick Tables.",
            "feasible": "partial",
            "items": [
              "Insert Table grid",
              "Insert Table...",
              "Draw Table",
              "Convert Text to Table...",
              "Excel Spreadsheet",
              "Quick Tables"
            ]
          }
        ]
      },
      {
        "name": "Illustrations",
        "id": "illustrations",
        "controls": [
          {
            "id": "insert.illustrations.pictures",
            "cmd": "pictures",
            "label": "Pictures",
            "type": "dropdown",
            "tooltip": "Insert a picture from This Device, Stock Images, or Online Pictures.",
            "feasible": "partial",
            "items": [
              "This Device...",
              "Stock Images...",
              "Online Pictures..."
            ]
          },
          {
            "id": "insert.illustrations.shapes",
            "cmd": "shapes",
            "label": "Shapes",
            "type": "dropdown",
            "tooltip": "Insert ready-made shapes such as rectangles, circles, arrows, lines, flowchart symbols, and callouts. Includes New Drawing Canvas.",
            "feasible": "partial",
            "items": [
              "Recently Used Shapes",
              "Lines",
              "Rectangles",
              "Basic Shapes",
              "Block Arrows",
              "Equation Shapes",
              "Flowchart",
              "Stars and Banners",
              "Callouts",
              "New Drawing Canvas"
            ]
          },
          {
            "id": "insert.illustrations.icons",
            "cmd": "icons",
            "label": "Icons",
            "type": "button",
            "tooltip": "Insert an icon to visually communicate using symbols (opens the icon/stock content picker).",
            "feasible": "partial"
          },
          {
            "id": "insert.illustrations.3d-models",
            "cmd": "3dModels",
            "label": "3D Models",
            "type": "split",
            "tooltip": "Insert a 3D model to rotate and view from any angle. Dropdown: This Device, Stock 3D Models.",
            "feasible": "no",
            "items": [
              "This Device...",
              "Stock 3D Models..."
            ]
          },
          {
            "id": "insert.illustrations.smartart",
            "cmd": "smartart",
            "label": "SmartArt",
            "type": "button",
            "tooltip": "Insert a SmartArt graphic to visually communicate information (lists, processes, cycles, hierarchies).",
            "feasible": "partial"
          },
          {
            "id": "insert.illustrations.chart",
            "cmd": "chart",
            "label": "Chart",
            "type": "button",
            "tooltip": "Insert a chart to illustrate and compare data (Column, Line, Pie, Bar, etc.).",
            "feasible": "partial"
          },
          {
            "id": "insert.illustrations.screenshot",
            "cmd": "screenshot",
            "label": "Screenshot",
            "type": "dropdown",
            "tooltip": "Insert a picture of any open window or a clipping of a screen area (Available Windows, Screen Clipping).",
            "feasible": "no",
            "items": [
              "Available Windows",
              "Screen Clipping"
            ]
          }
        ]
      },
      {
        "name": "Add-ins",
        "id": "add-ins",
        "controls": [
          {
            "id": "insert.add-ins.get-add-ins",
            "cmd": "getAddIns",
            "label": "Get Add-ins",
            "type": "button",
            "tooltip": "Browse and add Office Add-ins from the Office Store to extend Word's functionality.",
            "feasible": "no"
          },
          {
            "id": "insert.add-ins.my-add-ins",
            "cmd": "myAddIns",
            "label": "My Add-ins",
            "type": "split",
            "tooltip": "Insert an add-in you already have. Dropdown lists your installed add-ins and See All.",
            "feasible": "no",
            "items": [
              "Recently Used Add-ins",
              "See All..."
            ]
          }
        ]
      },
      {
        "name": "Media",
        "id": "media",
        "controls": [
          {
            "id": "insert.media.online-video",
            "cmd": "onlineVideo",
            "label": "Online Video",
            "type": "button",
            "tooltip": "Insert a video from an online source by pasting its address; play it directly in the document.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Links",
        "id": "links",
        "controls": [
          {
            "id": "insert.links.link",
            "cmd": "link",
            "label": "Link",
            "type": "split",
            "tooltip": "Create a link in your document for quick access to webpages and files. Dropdown: Insert Link, recent items.",
            "shortcut": "Ctrl+K",
            "feasible": "yes",
            "items": [
              "Insert Link...",
              "Recent Items"
            ]
          },
          {
            "id": "insert.links.bookmark",
            "cmd": "bookmark",
            "label": "Bookmark",
            "type": "button",
            "tooltip": "Create a bookmark to assign a name to a specific point in a document so you can link to it.",
            "feasible": "partial"
          },
          {
            "id": "insert.links.cross-reference",
            "cmd": "crossReference",
            "label": "Cross-reference",
            "type": "button",
            "tooltip": "Refer to specific places in your document, such as headings, figures, and tables; updates automatically if content moves.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Comments",
        "id": "comments",
        "controls": [
          {
            "id": "insert.comments.comment",
            "cmd": "comment",
            "label": "Comment",
            "type": "button",
            "tooltip": "Add a note or annotation about this part of the document.",
            "shortcut": "Ctrl+Alt+M",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Header & Footer",
        "id": "header-footer",
        "controls": [
          {
            "id": "insert.header-footer.header",
            "cmd": "header",
            "label": "Header",
            "type": "dropdown",
            "tooltip": "Content in the top margin of each page. Built-in gallery, Edit Header, Remove Header, Save Selection to Header Gallery.",
            "feasible": "partial",
            "items": [
              "Built-in header gallery",
              "More Headers from Office.com",
              "Edit Header",
              "Remove Header",
              "Save Selection to Header Gallery..."
            ]
          },
          {
            "id": "insert.header-footer.footer",
            "cmd": "footer",
            "label": "Footer",
            "type": "dropdown",
            "tooltip": "Content in the bottom margin of each page. Built-in gallery, Edit Footer, Remove Footer, Save Selection to Footer Gallery.",
            "feasible": "partial",
            "items": [
              "Built-in footer gallery",
              "More Footers from Office.com",
              "Edit Footer",
              "Remove Footer",
              "Save Selection to Footer Gallery..."
            ]
          },
          {
            "id": "insert.header-footer.page-number",
            "cmd": "pageNumber",
            "label": "Page Number",
            "type": "dropdown",
            "tooltip": "Insert page numbers. Top of Page, Bottom of Page, Page Margins, Current Position, Format Page Numbers, Remove Page Numbers.",
            "feasible": "partial",
            "items": [
              "Top of Page",
              "Bottom of Page",
              "Page Margins",
              "Current Position",
              "Format Page Numbers...",
              "Remove Page Numbers"
            ]
          }
        ]
      },
      {
        "name": "Text",
        "id": "text",
        "controls": [
          {
            "id": "insert.text.text-box",
            "cmd": "textBox",
            "label": "Text Box",
            "type": "dropdown",
            "tooltip": "Add a text box that can be positioned anywhere on the page. Built-in gallery, Draw Text Box, Save Selection to Text Box Gallery.",
            "feasible": "partial",
            "items": [
              "Built-in text box gallery",
              "More Text Boxes from Office.com",
              "Draw Text Box",
              "Save Selection to Text Box Gallery..."
            ]
          },
          {
            "id": "insert.text.quick-parts",
            "cmd": "quickParts",
            "label": "Quick Parts",
            "type": "dropdown",
            "tooltip": "Insert reusable pieces of content: AutoText, Document Property, Field, Building Blocks Organizer, Save Selection to Quick Part Gallery.",
            "feasible": "partial",
            "items": [
              "AutoText",
              "Document Property",
              "Field...",
              "Building Blocks Organizer...",
              "Save Selection to Quick Part Gallery..."
            ]
          },
          {
            "id": "insert.text.wordart",
            "cmd": "wordart",
            "label": "WordArt",
            "type": "dropdown",
            "tooltip": "Insert decorative text. Pick a WordArt style from the gallery.",
            "feasible": "partial",
            "items": [
              "WordArt style gallery"
            ]
          },
          {
            "id": "insert.text.drop-cap",
            "cmd": "dropCap",
            "label": "Drop Cap",
            "type": "dropdown",
            "tooltip": "Create a large capital letter at the beginning of a paragraph. None, Dropped, In Margin, Drop Cap Options.",
            "feasible": "partial",
            "items": [
              "None",
              "Dropped",
              "In margin",
              "Drop Cap Options..."
            ]
          },
          {
            "id": "insert.text.signature-line",
            "cmd": "signatureLine",
            "label": "Signature Line",
            "type": "split",
            "tooltip": "Insert a signature line that specifies who must sign. Dropdown: Microsoft Office Signature Line, Add Signature Services.",
            "feasible": "no",
            "items": [
              "Microsoft Office Signature Line...",
              "Add Signature Services..."
            ]
          },
          {
            "id": "insert.text.date-time",
            "cmd": "dateTime",
            "label": "Date & Time",
            "type": "button",
            "tooltip": "Quickly add the current date or time, optionally as a field that updates automatically.",
            "feasible": "yes"
          },
          {
            "id": "insert.text.object",
            "cmd": "object",
            "label": "Object",
            "type": "split",
            "tooltip": "Insert an embedded object (e.g., another document or spreadsheet). Dropdown: Object, Text from File.",
            "feasible": "no",
            "items": [
              "Object...",
              "Text from File..."
            ]
          }
        ]
      },
      {
        "name": "Symbols",
        "id": "symbols",
        "controls": [
          {
            "id": "insert.symbols.equation",
            "cmd": "equation",
            "label": "Equation",
            "type": "split",
            "tooltip": "Add common mathematical equations or build your own with the equation tools. Dropdown: built-in equation gallery, Insert New Equation, Ink Equation.",
            "shortcut": "Alt+=",
            "feasible": "partial",
            "items": [
              "Built-in equation gallery",
              "Insert New Equation",
              "Ink Equation...",
              "Save Selection to Equation Gallery..."
            ]
          },
          {
            "id": "insert.symbols.symbol",
            "cmd": "symbol",
            "label": "Symbol",
            "type": "dropdown",
            "tooltip": "Insert symbols and special characters not on your keyboard. Recently used symbols, More Symbols.",
            "feasible": "yes",
            "items": [
              "Recently used symbols",
              "More Symbols..."
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Draw",
    "id": "draw",
    "groups": [
      {
        "name": "Tools",
        "id": "tools",
        "controls": [
          {
            "id": "draw.tools.select-objects",
            "cmd": "selectObjects",
            "label": "Select Objects",
            "type": "button",
            "tooltip": "Select ink, shapes, and text areas so you can move or resize them.",
            "feasible": "partial"
          },
          {
            "id": "draw.tools.lasso-select",
            "cmd": "lassoSelect",
            "label": "Lasso Select",
            "type": "button",
            "tooltip": "Select ink by drawing a circle around it, instead of selecting word by word.",
            "feasible": "partial"
          },
          {
            "id": "draw.tools.eraser",
            "cmd": "eraser",
            "label": "Eraser",
            "type": "split",
            "tooltip": "Erase ink strokes. Click the arrow to choose Stroke Eraser, Small/Medium/Large Eraser, or Segment Eraser.",
            "feasible": "partial",
            "items": [
              "Stroke Eraser",
              "Small Eraser",
              "Medium Eraser",
              "Large Eraser",
              "Segment Eraser"
            ]
          }
        ]
      },
      {
        "name": "Pens",
        "id": "pens",
        "controls": [
          {
            "id": "draw.pens.pens-gallery",
            "cmd": "pensGallery",
            "label": "Pens Gallery",
            "type": "gallery",
            "tooltip": "Gallery of ink pens, pencils, and highlighters. Click a pen once to select it; click again to set its Thickness, Color, and Effects (Rainbow, Galaxy, Gold, etc.).",
            "feasible": "partial",
            "items": [
              "Pen",
              "Pencil",
              "Highlighter"
            ]
          },
          {
            "id": "draw.pens.add-pen",
            "cmd": "addPen",
            "label": "Add Pen",
            "type": "dropdown",
            "tooltip": "Add a new Pen, Pencil, Highlighter, or Action pen to the gallery.",
            "feasible": "partial",
            "items": [
              "Pen",
              "Pencil",
              "Highlighter",
              "Action Pen"
            ]
          },
          {
            "id": "draw.pens.draw-with-trackpad",
            "cmd": "drawWithTrackpad",
            "label": "Draw with Trackpad",
            "type": "toggle",
            "tooltip": "Use the trackpad to draw ink when you do not have a touchscreen or pen.",
            "feasible": "partial"
          },
          {
            "id": "draw.pens.drawing",
            "cmd": "drawing",
            "label": "Drawing",
            "type": "toggle",
            "tooltip": "Toggle ink drawing mode on or off (Draw with Touch / Draw Ink).",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Convert",
        "id": "convert",
        "controls": [
          {
            "id": "draw.convert.ink-to-shape",
            "cmd": "inkToShape",
            "label": "Ink to Shape",
            "type": "toggle",
            "tooltip": "Automatically convert ink drawings into clean geometric shapes as you draw.",
            "feasible": "no"
          },
          {
            "id": "draw.convert.ink-to-math",
            "cmd": "inkToMath",
            "label": "Ink to Math",
            "type": "button",
            "tooltip": "Convert a handwritten mathematical expression into a typeset equation.",
            "feasible": "no"
          }
        ]
      },
      {
        "name": "Insert",
        "id": "insert",
        "controls": [
          {
            "id": "draw.insert.drawing-canvas",
            "cmd": "drawingCanvas",
            "label": "Drawing Canvas",
            "type": "button",
            "tooltip": "Insert a drawing canvas to help arrange and keep parts of a drawing together.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Replay",
        "id": "replay",
        "controls": [
          {
            "id": "draw.replay.ink-replay",
            "cmd": "inkReplay",
            "label": "Ink Replay",
            "type": "button",
            "tooltip": "Replay your ink strokes in the order they were drawn; pause and play to review.",
            "feasible": "no"
          }
        ]
      }
    ]
  },
  {
    "name": "Design",
    "id": "design",
    "groups": [
      {
        "name": "Document Formatting",
        "id": "document-formatting",
        "controls": [
          {
            "id": "design.document-formatting.themes",
            "cmd": "themes",
            "label": "Themes",
            "type": "dropdown",
            "tooltip": "Change the overall design of the entire document, including colors, fonts, and effects.",
            "feasible": "partial",
            "items": [
              "Built-In themes gallery",
              "Reset to Theme from Template",
              "Browse for Themes...",
              "Save Current Theme..."
            ]
          },
          {
            "id": "design.document-formatting.style-set",
            "cmd": "styleSet",
            "label": "Style Set",
            "type": "gallery",
            "tooltip": "Gallery of built-in style sets (heading and body styling). Includes Reset to the Default Style Set and Save as a New Style Set.",
            "feasible": "partial",
            "items": [
              "Built-in style sets",
              "Reset to the Default Style Set",
              "Save as a New Style Set..."
            ]
          },
          {
            "id": "design.document-formatting.colors",
            "cmd": "colors",
            "label": "Colors",
            "type": "dropdown",
            "tooltip": "Change the colors for the current theme.",
            "feasible": "yes",
            "items": [
              "Color scheme gallery",
              "Customize Colors..."
            ]
          },
          {
            "id": "design.document-formatting.fonts",
            "cmd": "fonts",
            "label": "Fonts",
            "type": "dropdown",
            "tooltip": "Change the fonts for the current theme (heading and body font pairs).",
            "feasible": "yes",
            "items": [
              "Font pair gallery",
              "Customize Fonts..."
            ]
          },
          {
            "id": "design.document-formatting.paragraph-spacing",
            "cmd": "paragraphSpacing",
            "label": "Paragraph Spacing",
            "type": "dropdown",
            "tooltip": "Quickly change the line and paragraph spacing for the whole document.",
            "feasible": "yes",
            "items": [
              "No Paragraph Space",
              "Compact",
              "Tight",
              "Open",
              "Relaxed",
              "Double",
              "Custom Paragraph Spacing..."
            ]
          },
          {
            "id": "design.document-formatting.effects",
            "cmd": "effects",
            "label": "Effects",
            "type": "dropdown",
            "tooltip": "Change the effects for the current theme (shadows, reflections, etc. for shapes).",
            "feasible": "partial",
            "items": [
              "Effect style gallery"
            ]
          },
          {
            "id": "design.document-formatting.set-as-default",
            "cmd": "setAsDefault",
            "label": "Set as Default",
            "type": "button",
            "tooltip": "Use this document's formatting as the default for all new documents.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Page Background",
        "id": "page-background",
        "controls": [
          {
            "id": "design.page-background.watermark",
            "cmd": "watermark",
            "label": "Watermark",
            "type": "dropdown",
            "tooltip": "Insert ghosted text behind the content, such as Confidential or Draft.",
            "feasible": "partial",
            "items": [
              "Confidential gallery",
              "Disclaimers gallery",
              "Urgent gallery",
              "Custom Watermark...",
              "Remove Watermark",
              "Save Selection to Watermark Gallery..."
            ]
          },
          {
            "id": "design.page-background.page-color",
            "cmd": "pageColor",
            "label": "Page Color",
            "type": "dropdown",
            "tooltip": "Choose a color for the background of the page.",
            "feasible": "yes",
            "items": [
              "Theme Colors",
              "Standard Colors",
              "No Color",
              "More Colors...",
              "Fill Effects..."
            ]
          },
          {
            "id": "design.page-background.page-borders",
            "cmd": "pageBorders",
            "label": "Page Borders",
            "type": "button",
            "tooltip": "Add or change the border around the page (opens the Borders and Shading dialog).",
            "feasible": "partial"
          }
        ]
      }
    ]
  },
  {
    "name": "Layout",
    "id": "layout",
    "groups": [
      {
        "name": "Page Setup",
        "id": "page-setup",
        "controls": [
          {
            "id": "layout.page-setup.margins",
            "cmd": "margins",
            "label": "Margins",
            "type": "dropdown",
            "tooltip": "Set the margin sizes for the entire document or current section.",
            "feasible": "yes",
            "items": [
              "Normal",
              "Narrow",
              "Moderate",
              "Wide",
              "Mirrored",
              "Office 2003 Default",
              "Custom Margins..."
            ]
          },
          {
            "id": "layout.page-setup.orientation",
            "cmd": "orientation",
            "label": "Orientation",
            "type": "dropdown",
            "tooltip": "Switch the pages between portrait and landscape layouts.",
            "feasible": "yes",
            "items": [
              "Portrait",
              "Landscape"
            ]
          },
          {
            "id": "layout.page-setup.size",
            "cmd": "size",
            "label": "Size",
            "type": "dropdown",
            "tooltip": "Choose a paper size for the document.",
            "feasible": "yes",
            "items": [
              "Letter",
              "Legal",
              "A4",
              "A3",
              "Tabloid",
              "Executive",
              "More Paper Sizes..."
            ]
          },
          {
            "id": "layout.page-setup.columns",
            "cmd": "columns",
            "label": "Columns",
            "type": "dropdown",
            "tooltip": "Split text into two or more columns.",
            "feasible": "yes",
            "items": [
              "One",
              "Two",
              "Three",
              "Left",
              "Right",
              "More Columns..."
            ]
          },
          {
            "id": "layout.page-setup.breaks",
            "cmd": "breaks",
            "label": "Breaks",
            "type": "dropdown",
            "tooltip": "Add page, column, text-wrapping, or section breaks to the document.",
            "feasible": "partial",
            "items": [
              "Page",
              "Column",
              "Text Wrapping",
              "Next Page",
              "Continuous",
              "Even Page",
              "Odd Page"
            ]
          },
          {
            "id": "layout.page-setup.line-numbers",
            "cmd": "lineNumbers",
            "label": "Line Numbers",
            "type": "dropdown",
            "tooltip": "Add line numbers in the margin alongside each line of the document.",
            "feasible": "partial",
            "items": [
              "None",
              "Continuous",
              "Restart Each Page",
              "Restart Each Section",
              "Suppress for Current Paragraph",
              "Line Numbering Options..."
            ]
          },
          {
            "id": "layout.page-setup.hyphenation",
            "cmd": "hyphenation",
            "label": "Hyphenation",
            "type": "dropdown",
            "tooltip": "Turn on hyphenation to break words between lines at the end of a line.",
            "feasible": "partial",
            "items": [
              "None",
              "Automatic",
              "Manual",
              "Hyphenation Options..."
            ]
          }
        ]
      },
      {
        "name": "Paragraph",
        "id": "paragraph",
        "controls": [
          {
            "id": "layout.paragraph.indent-left",
            "cmd": "indentLeft",
            "label": "Indent Left",
            "type": "spinner",
            "tooltip": "Set the amount of space the paragraph is indented from the left margin.",
            "feasible": "yes"
          },
          {
            "id": "layout.paragraph.indent-right",
            "cmd": "indentRight",
            "label": "Indent Right",
            "type": "spinner",
            "tooltip": "Set the amount of space the paragraph is indented from the right margin.",
            "feasible": "yes"
          },
          {
            "id": "layout.paragraph.spacing-before",
            "cmd": "spacingBefore",
            "label": "Spacing Before",
            "type": "spinner",
            "tooltip": "Change the amount of space above the selected paragraphs.",
            "feasible": "yes"
          },
          {
            "id": "layout.paragraph.spacing-after",
            "cmd": "spacingAfter",
            "label": "Spacing After",
            "type": "spinner",
            "tooltip": "Change the amount of space below the selected paragraphs.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Arrange",
        "id": "arrange",
        "controls": [
          {
            "id": "layout.arrange.position",
            "cmd": "position",
            "label": "Position",
            "type": "dropdown",
            "tooltip": "Position the selected object on the page; text wraps around it automatically.",
            "feasible": "partial",
            "items": [
              "In Line with Text",
              "Position presets (Top/Middle/Bottom x Left/Center/Right)",
              "More Layout Options..."
            ]
          },
          {
            "id": "layout.arrange.wrap-text",
            "cmd": "wrapText",
            "label": "Wrap Text",
            "type": "dropdown",
            "tooltip": "Choose how text wraps around the selected object.",
            "feasible": "partial",
            "items": [
              "In Line with Text",
              "Square",
              "Tight",
              "Through",
              "Top and Bottom",
              "Behind Text",
              "In Front of Text",
              "Edit Wrap Points",
              "Move with Text",
              "Fix Position on Page",
              "More Layout Options..."
            ]
          },
          {
            "id": "layout.arrange.bring-forward",
            "cmd": "bringForward",
            "label": "Bring Forward",
            "type": "split",
            "tooltip": "Bring the selected object forward one level or in front of all other objects.",
            "feasible": "partial",
            "items": [
              "Bring Forward",
              "Bring to Front",
              "Bring in Front of Text"
            ]
          },
          {
            "id": "layout.arrange.send-backward",
            "cmd": "sendBackward",
            "label": "Send Backward",
            "type": "split",
            "tooltip": "Send the selected object back one level or behind all other objects.",
            "feasible": "partial",
            "items": [
              "Send Backward",
              "Send to Back",
              "Send Behind Text"
            ]
          },
          {
            "id": "layout.arrange.selection-pane",
            "cmd": "selectionPane",
            "label": "Selection Pane",
            "type": "button",
            "tooltip": "Show the Selection pane to list, select, show, and hide objects on the page.",
            "feasible": "partial"
          },
          {
            "id": "layout.arrange.align",
            "cmd": "align",
            "label": "Align",
            "type": "dropdown",
            "tooltip": "Align the edges of multiple selected objects, or distribute them evenly.",
            "feasible": "partial",
            "items": [
              "Align Left",
              "Align Center",
              "Align Right",
              "Align Top",
              "Align Middle",
              "Align Bottom",
              "Distribute Horizontally",
              "Distribute Vertically",
              "Align to Page",
              "Align to Margin",
              "Align Selected Objects",
              "View Gridlines",
              "Grid Settings..."
            ]
          },
          {
            "id": "layout.arrange.group",
            "cmd": "group",
            "label": "Group",
            "type": "dropdown",
            "tooltip": "Group objects together so they are treated as a single object.",
            "feasible": "partial",
            "items": [
              "Group",
              "Regroup",
              "Ungroup"
            ]
          },
          {
            "id": "layout.arrange.rotate",
            "cmd": "rotate",
            "label": "Rotate",
            "type": "dropdown",
            "tooltip": "Rotate or flip the selected object.",
            "feasible": "partial",
            "items": [
              "Rotate Right 90",
              "Rotate Left 90",
              "Flip Vertical",
              "Flip Horizontal",
              "More Rotation Options..."
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "References",
    "id": "references",
    "groups": [
      {
        "name": "Table of Contents",
        "id": "table-of-contents",
        "controls": [
          {
            "id": "references.table-of-contents.table-of-contents",
            "cmd": "tableOfContents",
            "label": "Table of Contents",
            "type": "dropdown",
            "tooltip": "Add a table of contents generated from the document's heading styles.",
            "feasible": "partial",
            "items": [
              "Automatic Table 1",
              "Automatic Table 2",
              "Manual Table",
              "More Tables from Office.com",
              "Custom Table of Contents...",
              "Remove Table of Contents",
              "Save Selection to Table of Contents Gallery..."
            ]
          },
          {
            "id": "references.table-of-contents.add-text",
            "cmd": "addText",
            "label": "Add Text",
            "type": "dropdown",
            "tooltip": "Add the current paragraph as an entry in the table of contents at a chosen level.",
            "feasible": "partial",
            "items": [
              "Do Not Show in Table of Contents",
              "Level 1",
              "Level 2",
              "Level 3"
            ]
          },
          {
            "id": "references.table-of-contents.update-table",
            "cmd": "updateTable",
            "label": "Update Table",
            "type": "button",
            "tooltip": "Update the table of contents so all entries refer to the correct page numbers.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Footnotes",
        "id": "footnotes",
        "controls": [
          {
            "id": "references.footnotes.insert-footnote",
            "cmd": "insertFootnote",
            "label": "Insert Footnote",
            "type": "button",
            "tooltip": "Add a footnote, automatically numbered, at the bottom of the page.",
            "shortcut": "Alt+Ctrl+F",
            "feasible": "partial"
          },
          {
            "id": "references.footnotes.insert-endnote",
            "cmd": "insertEndnote",
            "label": "Insert Endnote",
            "type": "button",
            "tooltip": "Add an endnote, automatically numbered, at the end of the document.",
            "shortcut": "Alt+Ctrl+D",
            "feasible": "partial"
          },
          {
            "id": "references.footnotes.next-footnote",
            "cmd": "nextFootnote",
            "label": "Next Footnote",
            "type": "split",
            "tooltip": "Navigate to the next footnote. Click the arrow for Previous Footnote, Next/Previous Endnote.",
            "feasible": "partial",
            "items": [
              "Next Footnote",
              "Previous Footnote",
              "Next Endnote",
              "Previous Endnote"
            ]
          },
          {
            "id": "references.footnotes.show-notes",
            "cmd": "showNotes",
            "label": "Show Notes",
            "type": "button",
            "tooltip": "Scroll the document to show where the footnotes or endnotes are located.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Research",
        "id": "research",
        "controls": [
          {
            "id": "references.research.search",
            "cmd": "search",
            "label": "Search",
            "type": "button",
            "tooltip": "Open the Search pane (Smart Lookup) to find related material from online sources.",
            "feasible": "no"
          },
          {
            "id": "references.research.researcher",
            "cmd": "researcher",
            "label": "Researcher",
            "type": "button",
            "tooltip": "Explore material related to your topic and add it and its sources to your document.",
            "feasible": "no"
          }
        ]
      },
      {
        "name": "Citations & Bibliography",
        "id": "citations-bibliography",
        "controls": [
          {
            "id": "references.citations-bibliography.insert-citation",
            "cmd": "insertCitation",
            "label": "Insert Citation",
            "type": "dropdown",
            "tooltip": "Cite a source by adding a citation; choose an existing source or add a new one.",
            "feasible": "partial",
            "items": [
              "Existing source list",
              "Add New Source...",
              "Add New Placeholder..."
            ]
          },
          {
            "id": "references.citations-bibliography.manage-sources",
            "cmd": "manageSources",
            "label": "Manage Sources",
            "type": "button",
            "tooltip": "Organize the list of sources cited in the document (Source Manager).",
            "feasible": "partial"
          },
          {
            "id": "references.citations-bibliography.style",
            "cmd": "style",
            "label": "Style",
            "type": "dropdown",
            "tooltip": "Choose the citation style to use, such as APA, MLA, or Chicago.",
            "feasible": "partial",
            "items": [
              "APA",
              "Chicago",
              "IEEE",
              "ISO 690",
              "MLA",
              "Turabian",
              "and more"
            ]
          },
          {
            "id": "references.citations-bibliography.bibliography",
            "cmd": "bibliography",
            "label": "Bibliography",
            "type": "dropdown",
            "tooltip": "Add a bibliography listing all sources cited in the document.",
            "feasible": "partial",
            "items": [
              "Bibliography",
              "References",
              "Works Cited",
              "Insert Bibliography",
              "Save Selection to Bibliography Gallery..."
            ]
          }
        ]
      },
      {
        "name": "Captions",
        "id": "captions",
        "controls": [
          {
            "id": "references.captions.insert-caption",
            "cmd": "insertCaption",
            "label": "Insert Caption",
            "type": "button",
            "tooltip": "Add a caption (a numbered label such as Figure 1) to a picture or other object.",
            "feasible": "partial"
          },
          {
            "id": "references.captions.insert-table-of-figures",
            "cmd": "insertTableOfFigures",
            "label": "Insert Table of Figures",
            "type": "button",
            "tooltip": "Insert a table of figures listing captioned objects and their page numbers.",
            "feasible": "partial"
          },
          {
            "id": "references.captions.update-table",
            "cmd": "updateTable",
            "label": "Update Table",
            "type": "button",
            "tooltip": "Update the table of figures to include all captioned entries in the document.",
            "feasible": "partial"
          },
          {
            "id": "references.captions.cross-reference",
            "cmd": "crossReference",
            "label": "Cross-reference",
            "type": "button",
            "tooltip": "Refer to a numbered item, heading, figure, or table elsewhere in the document.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Index",
        "id": "index",
        "controls": [
          {
            "id": "references.index.mark-entry",
            "cmd": "markEntry",
            "label": "Mark Entry",
            "type": "button",
            "tooltip": "Include the selected text in the document's index.",
            "shortcut": "Alt+Shift+X",
            "feasible": "partial"
          },
          {
            "id": "references.index.insert-index",
            "cmd": "insertIndex",
            "label": "Insert Index",
            "type": "button",
            "tooltip": "Add an index listing keywords and the page numbers where they appear.",
            "feasible": "partial"
          },
          {
            "id": "references.index.update-index",
            "cmd": "updateIndex",
            "label": "Update Index",
            "type": "button",
            "tooltip": "Update the index so all entries point to the correct page numbers.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Table of Authorities",
        "id": "table-of-authorities",
        "controls": [
          {
            "id": "references.table-of-authorities.mark-citation",
            "cmd": "markCitation",
            "label": "Mark Citation",
            "type": "button",
            "tooltip": "Add the selected text (such as a legal case) to the table of authorities.",
            "shortcut": "Alt+Shift+I",
            "feasible": "partial"
          },
          {
            "id": "references.table-of-authorities.insert-table-of-authorities",
            "cmd": "insertTableOfAuthorities",
            "label": "Insert Table of Authorities",
            "type": "button",
            "tooltip": "Add a table of authorities listing cases, statutes, and other cited authorities.",
            "feasible": "partial"
          },
          {
            "id": "references.table-of-authorities.update-table",
            "cmd": "updateTable",
            "label": "Update Table",
            "type": "button",
            "tooltip": "Update the table of authorities to include all marked citations.",
            "feasible": "partial"
          }
        ]
      }
    ]
  },
  {
    "name": "Mailings",
    "id": "mailings",
    "groups": [
      {
        "name": "Create",
        "id": "create",
        "controls": [
          {
            "id": "mailings.create.envelopes",
            "cmd": "envelopes",
            "label": "Envelopes",
            "type": "button",
            "tooltip": "Create and print envelopes. You can choose the envelope size, formatting, and printing options.",
            "feasible": "partial"
          },
          {
            "id": "mailings.create.labels",
            "cmd": "labels",
            "label": "Labels",
            "type": "button",
            "tooltip": "Create and print labels. Choose from a number of popular label styles and shapes.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Start Mail Merge",
        "id": "start-mail-merge",
        "controls": [
          {
            "id": "mailings.start-mail-merge.start-mail-merge",
            "cmd": "startMailMerge",
            "label": "Start Mail Merge",
            "type": "dropdown",
            "tooltip": "Create one document and send it to multiple people. Choose Letters, E-mail Messages, Envelopes, Labels, Directory, Normal Word Document, or the Step-by-Step Mail Merge Wizard.",
            "feasible": "partial",
            "items": [
              "Letters",
              "E-mail Messages",
              "Envelopes...",
              "Labels...",
              "Directory",
              "Normal Word Document",
              "Step-by-Step Mail Merge Wizard..."
            ]
          },
          {
            "id": "mailings.start-mail-merge.select-recipients",
            "cmd": "selectRecipients",
            "label": "Select Recipients",
            "type": "dropdown",
            "tooltip": "Choose the list of people you want to send the document to. Type a new list, use an existing one, or choose Outlook contacts.",
            "feasible": "partial",
            "items": [
              "Type a New List...",
              "Use an Existing List...",
              "Choose from Outlook Contacts..."
            ]
          },
          {
            "id": "mailings.start-mail-merge.edit-recipient-list",
            "cmd": "editRecipientList",
            "label": "Edit Recipient List",
            "type": "button",
            "tooltip": "Make changes to the list of recipients and decide which of them receive your letter. You can sort, filter, find, and remove duplicates.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Write & Insert Fields",
        "id": "write-insert-fields",
        "controls": [
          {
            "id": "mailings.write-insert-fields.highlight-merge-fields",
            "cmd": "highlightMergeFields",
            "label": "Highlight Merge Fields",
            "type": "button",
            "tooltip": "Highlight the fields you've inserted in the document so you can easily spot the parts of your letter that will be replaced with information from your recipient list.",
            "feasible": "partial"
          },
          {
            "id": "mailings.write-insert-fields.address-block",
            "cmd": "addressBlock",
            "label": "Address Block",
            "type": "button",
            "tooltip": "Add an address to your letter. You specify the formatting and location, and Word replaces it with actual addresses from your recipient list when you finish the mail merge.",
            "feasible": "partial"
          },
          {
            "id": "mailings.write-insert-fields.greeting-line",
            "cmd": "greetingLine",
            "label": "Greeting Line",
            "type": "button",
            "tooltip": "Add a greeting line such as 'Dear Mr. Smith' to your document.",
            "feasible": "partial"
          },
          {
            "id": "mailings.write-insert-fields.insert-merge-field",
            "cmd": "insertMergeField",
            "label": "Insert Merge Field",
            "type": "split",
            "tooltip": "Add any field from your recipient list to the document, such as Last Name, Home Phone, Company Name, or any other field.",
            "feasible": "partial"
          },
          {
            "id": "mailings.write-insert-fields.rules",
            "cmd": "rules",
            "label": "Rules",
            "type": "dropdown",
            "tooltip": "Specify rules to add decision-making ability to the mail merge (e.g., If...Then...Else, Fill-in, Ask, Skip Record If, Next Record).",
            "feasible": "partial",
            "items": [
              "Ask...",
              "Fill-in...",
              "If...Then...Else...",
              "Merge Record #",
              "Merge Sequence #",
              "Next Record",
              "Next Record If...",
              "Set Bookmark...",
              "Skip Record If..."
            ]
          },
          {
            "id": "mailings.write-insert-fields.match-fields",
            "cmd": "matchFields",
            "label": "Match Fields",
            "type": "button",
            "tooltip": "Tell Word the meaning of different fields in your recipient list. Match the fields with standard names that Word recognizes (e.g., First Name, Last Name, Address).",
            "feasible": "partial"
          },
          {
            "id": "mailings.write-insert-fields.update-labels",
            "cmd": "updateLabels",
            "label": "Update Labels",
            "type": "button",
            "tooltip": "If you're creating labels, update all the labels in the document to use the information from the recipient list. (Available only for label merges.)",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Preview Results",
        "id": "preview-results",
        "controls": [
          {
            "id": "mailings.preview-results.preview-results",
            "cmd": "previewResults",
            "label": "Preview Results",
            "type": "toggle",
            "tooltip": "See your document with the merge fields replaced by actual data from your recipient list, so you can check the way it looks.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.first-record",
            "cmd": "firstRecord",
            "label": "First Record",
            "type": "button",
            "tooltip": "Preview the first record in your recipient list.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.previous-record",
            "cmd": "previousRecord",
            "label": "Previous Record",
            "type": "button",
            "tooltip": "Preview the previous record in your recipient list.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.go-to-record",
            "cmd": "goToRecord",
            "label": "Go to Record",
            "type": "spinner",
            "tooltip": "Type the number of the record you'd like to preview, or use the arrows to move to the next or previous record.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.next-record",
            "cmd": "nextRecord",
            "label": "Next Record",
            "type": "button",
            "tooltip": "Preview the next record in your recipient list.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.last-record",
            "cmd": "lastRecord",
            "label": "Last Record",
            "type": "button",
            "tooltip": "Preview the last record in your recipient list.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.find-recipient",
            "cmd": "findRecipient",
            "label": "Find Recipient",
            "type": "button",
            "tooltip": "Find and preview a specific record in your recipient list by searching for text.",
            "feasible": "partial"
          },
          {
            "id": "mailings.preview-results.check-for-errors",
            "cmd": "checkForErrors",
            "label": "Check for Errors",
            "type": "button",
            "tooltip": "Specify how to handle errors that occur when completing the mail merge. You can also simulate the merge to see what errors might happen.",
            "shortcut": "Alt+Shift+K",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Finish",
        "id": "finish",
        "controls": [
          {
            "id": "mailings.finish.finish-merge",
            "cmd": "finishMerge",
            "label": "Finish & Merge",
            "type": "dropdown",
            "tooltip": "Complete the mail merge. You can edit individual copies of the document, print them, or send them as e-mail messages.",
            "feasible": "partial",
            "items": [
              "Edit Individual Documents...",
              "Print Documents...",
              "Send E-mail Messages..."
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Review",
    "id": "review",
    "groups": [
      {
        "name": "Proofing",
        "id": "proofing",
        "controls": [
          {
            "id": "review.proofing.editor",
            "cmd": "editor",
            "label": "Editor",
            "type": "button",
            "tooltip": "Check your document for spelling, grammar, and writing style suggestions. (In Microsoft 365 this is the Editor pane; classic Spelling & Grammar in Word 2021.)",
            "shortcut": "F7",
            "feasible": "partial"
          },
          {
            "id": "review.proofing.thesaurus",
            "cmd": "thesaurus",
            "label": "Thesaurus",
            "type": "button",
            "tooltip": "Find other words with the same meaning (synonyms) for the word you've selected.",
            "shortcut": "Shift+F7",
            "feasible": "partial"
          },
          {
            "id": "review.proofing.word-count",
            "cmd": "wordCount",
            "label": "Word Count",
            "type": "button",
            "tooltip": "Find out the number of words, characters, paragraphs, and lines in the document. You can also find the number of pages.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Speech",
        "id": "speech",
        "controls": [
          {
            "id": "review.speech.read-aloud",
            "cmd": "readAloud",
            "label": "Read Aloud",
            "type": "toggle",
            "tooltip": "Have your text read aloud while it highlights each word so you can check the text or just listen to your document.",
            "shortcut": "Ctrl+Alt+Space",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Accessibility",
        "id": "accessibility",
        "controls": [
          {
            "id": "review.accessibility.check-accessibility",
            "cmd": "checkAccessibility",
            "label": "Check Accessibility",
            "type": "split",
            "tooltip": "Find and fix accessibility issues to make your content easier for people with disabilities to access.",
            "feasible": "partial",
            "items": [
              "Check Accessibility",
              "Alt Text",
              "Accessibility Reminder",
              "Options for Always Checking..."
            ]
          }
        ]
      },
      {
        "name": "Language",
        "id": "language",
        "controls": [
          {
            "id": "review.language.translate",
            "cmd": "translate",
            "label": "Translate",
            "type": "dropdown",
            "tooltip": "Easily translate selected text or your whole document into a different language using Microsoft Translator.",
            "feasible": "partial",
            "items": [
              "Translate Selection",
              "Translate Document"
            ]
          },
          {
            "id": "review.language.language",
            "cmd": "language",
            "label": "Language",
            "type": "dropdown",
            "tooltip": "Choose the language settings for proofing tools and editing.",
            "feasible": "partial",
            "items": [
              "Set Proofing Language...",
              "Language Preferences..."
            ]
          }
        ]
      },
      {
        "name": "Comments",
        "id": "comments",
        "controls": [
          {
            "id": "review.comments.new-comment",
            "cmd": "newComment",
            "label": "New Comment",
            "type": "button",
            "tooltip": "Add a note about this part of the document. Select the content you want to comment on, then click here.",
            "feasible": "yes"
          },
          {
            "id": "review.comments.delete",
            "cmd": "delete",
            "label": "Delete",
            "type": "split",
            "tooltip": "Delete the selected comment, or delete all comments in the document.",
            "feasible": "yes",
            "items": [
              "Delete",
              "Delete All Comments Shown",
              "Delete All Comments in Document"
            ]
          },
          {
            "id": "review.comments.previous",
            "cmd": "previous",
            "label": "Previous",
            "type": "button",
            "tooltip": "Jump to the previous comment in the document.",
            "feasible": "yes"
          },
          {
            "id": "review.comments.next",
            "cmd": "next",
            "label": "Next",
            "type": "button",
            "tooltip": "Jump to the next comment in the document.",
            "feasible": "yes"
          },
          {
            "id": "review.comments.show-comments",
            "cmd": "showComments",
            "label": "Show Comments",
            "type": "toggle",
            "tooltip": "Choose to see all comments inline alongside the text, or show them in a contextual pane.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Tracking",
        "id": "tracking",
        "controls": [
          {
            "id": "review.tracking.track-changes",
            "cmd": "trackChanges",
            "label": "Track Changes",
            "type": "split",
            "tooltip": "Keep track of all the changes made to the document, including insertions, deletions, and formatting changes.",
            "shortcut": "Ctrl+Shift+E",
            "feasible": "partial",
            "items": [
              "Track Changes",
              "Lock Tracking..."
            ]
          },
          {
            "id": "review.tracking.display-for-review",
            "cmd": "displayForReview",
            "label": "Display for Review",
            "type": "combo",
            "tooltip": "Choose how you want to view changes to the document: Simple Markup, All Markup, No Markup, or Original.",
            "feasible": "partial",
            "items": [
              "Simple Markup",
              "All Markup",
              "No Markup",
              "Original"
            ]
          },
          {
            "id": "review.tracking.show-markup",
            "cmd": "showMarkup",
            "label": "Show Markup",
            "type": "dropdown",
            "tooltip": "Choose what kind of markup to show in your document, such as comments, insertions and deletions, formatting, and which reviewers to display.",
            "feasible": "partial",
            "items": [
              "Comments",
              "Insertions and Deletions",
              "Formatting",
              "Balloons",
              "Specific People",
              "Highlight Updates",
              "Other Authors",
              "Reviewing Pane"
            ]
          },
          {
            "id": "review.tracking.reviewing-pane",
            "cmd": "reviewingPane",
            "label": "Reviewing Pane",
            "type": "split",
            "tooltip": "Show revisions in a separate window, vertically or horizontally. This is a handy way to make sure that all tracked changes have been removed from your document.",
            "feasible": "partial",
            "items": [
              "Reviewing Pane Vertical",
              "Reviewing Pane Horizontal"
            ]
          }
        ]
      },
      {
        "name": "Changes",
        "id": "changes",
        "controls": [
          {
            "id": "review.changes.accept",
            "cmd": "accept",
            "label": "Accept",
            "type": "split",
            "tooltip": "Keep this change and move to the next one. Use the dropdown to accept and move to next, accept all changes, accept all and stop tracking, or accept all changes shown.",
            "feasible": "partial",
            "items": [
              "Accept and Move to Next",
              "Accept This Change",
              "Accept All Changes Shown",
              "Accept All Changes",
              "Accept All Changes and Stop Tracking"
            ]
          },
          {
            "id": "review.changes.reject",
            "cmd": "reject",
            "label": "Reject",
            "type": "split",
            "tooltip": "Reject this change and move to the next one. Use the dropdown to reject all changes or reject all and stop tracking.",
            "feasible": "partial",
            "items": [
              "Reject and Move to Next",
              "Reject This Change",
              "Reject All Changes Shown",
              "Reject All Changes",
              "Reject All Changes and Stop Tracking"
            ]
          },
          {
            "id": "review.changes.previous",
            "cmd": "previous",
            "label": "Previous",
            "type": "button",
            "tooltip": "Jump to the previous tracked change in the document so you can accept or reject it.",
            "feasible": "partial"
          },
          {
            "id": "review.changes.next",
            "cmd": "next",
            "label": "Next",
            "type": "button",
            "tooltip": "Jump to the next tracked change in the document so you can accept or reject it.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Compare",
        "id": "compare",
        "controls": [
          {
            "id": "review.compare.compare",
            "cmd": "compare",
            "label": "Compare",
            "type": "dropdown",
            "tooltip": "Compare or combine multiple versions of a document.",
            "feasible": "no",
            "items": [
              "Compare... (Compare two versions of a document — legal blackline)",
              "Combine... (Combine revisions from multiple authors into a single document)"
            ]
          }
        ]
      },
      {
        "name": "Protect",
        "id": "protect",
        "controls": [
          {
            "id": "review.protect.block-authors",
            "cmd": "blockAuthors",
            "label": "Block Authors",
            "type": "button",
            "tooltip": "Block other authors from making changes to the text you've selected. (Available for documents stored on SharePoint / OneDrive for shared editing.)",
            "feasible": "no"
          },
          {
            "id": "review.protect.restrict-editing",
            "cmd": "restrictEditing",
            "label": "Restrict Editing",
            "type": "button",
            "tooltip": "Limit how much others can edit or format the document. Restrict formatting to a selection of styles, and control the kinds of editing changes that can be made.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Ink",
        "id": "ink",
        "controls": [
          {
            "id": "review.ink.hide-ink",
            "cmd": "hideInk",
            "label": "Hide Ink",
            "type": "toggle",
            "tooltip": "Hide or show ink annotations in the document. (Appears when the document contains ink or on touch/pen-enabled devices.)",
            "feasible": "no"
          }
        ]
      },
      {
        "name": "OneNote",
        "id": "onenote",
        "controls": [
          {
            "id": "review.onenote.linked-notes",
            "cmd": "linkedNotes",
            "label": "Linked Notes",
            "type": "button",
            "tooltip": "Take notes in OneNote and link them to the part of the document you're working on. (Appears when OneNote integration is available.)",
            "feasible": "no"
          }
        ]
      }
    ]
  },
  {
    "name": "View",
    "id": "view",
    "groups": [
      {
        "name": "Views",
        "id": "views",
        "controls": [
          {
            "id": "view.views.read-mode",
            "cmd": "readMode",
            "label": "Read Mode",
            "type": "button",
            "tooltip": "Read documents comfortably in a view designed to fit your screen. Hides most toolbars and lets you swipe between pages.",
            "feasible": "partial"
          },
          {
            "id": "view.views.print-layout",
            "cmd": "printLayout",
            "label": "Print Layout",
            "type": "button",
            "tooltip": "See the document the way it will look on the printed page. This is the default view.",
            "feasible": "partial"
          },
          {
            "id": "view.views.web-layout",
            "cmd": "webLayout",
            "label": "Web Layout",
            "type": "button",
            "tooltip": "See how your document would look as a webpage. Text wraps to fit the window and graphics are positioned as in a browser.",
            "feasible": "partial"
          },
          {
            "id": "view.views.outline",
            "cmd": "outline",
            "label": "Outline",
            "type": "button",
            "tooltip": "See your document in outline form, where content is shown as bulleted points. This view is useful for creating headings and moving whole paragraphs within the document.",
            "feasible": "partial"
          },
          {
            "id": "view.views.draft",
            "cmd": "draft",
            "label": "Draft",
            "type": "button",
            "tooltip": "See your document as a simple draft, for quickly editing text. Certain elements such as headers and footers won't be visible.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Immersive",
        "id": "immersive",
        "controls": [
          {
            "id": "view.immersive.focus",
            "cmd": "focus",
            "label": "Focus",
            "type": "toggle",
            "tooltip": "Focus on your document by hiding the ribbon and other on-screen elements, leaving just your content on a dark background.",
            "feasible": "partial"
          },
          {
            "id": "view.immersive.immersive-reader",
            "cmd": "immersiveReader",
            "label": "Immersive Reader",
            "type": "button",
            "tooltip": "Open a focused reading experience that lets you adjust text spacing, column width, page color, line focus, syllables, and read aloud.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Page Movement",
        "id": "page-movement",
        "controls": [
          {
            "id": "view.page-movement.vertical",
            "cmd": "vertical",
            "label": "Vertical",
            "type": "toggle",
            "tooltip": "Flip pages vertically by scrolling up and down. This is the default page movement.",
            "feasible": "partial"
          },
          {
            "id": "view.page-movement.side-to-side",
            "cmd": "sideToSide",
            "label": "Side to Side",
            "type": "toggle",
            "tooltip": "Flip pages horizontally from one side to the other, like turning pages in a book.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Show",
        "id": "show",
        "controls": [
          {
            "id": "view.show.ruler",
            "cmd": "ruler",
            "label": "Ruler",
            "type": "checkbox",
            "tooltip": "Show the rulers next to your document so you can measure and line things up.",
            "feasible": "yes"
          },
          {
            "id": "view.show.gridlines",
            "cmd": "gridlines",
            "label": "Gridlines",
            "type": "checkbox",
            "tooltip": "Turn on gridlines to line up objects in your document. The gridlines won't be printed.",
            "feasible": "yes"
          },
          {
            "id": "view.show.navigation-pane",
            "cmd": "navigationPane",
            "label": "Navigation Pane",
            "type": "checkbox",
            "tooltip": "Open the Navigation Pane to move around the document by heading, page, or by searching for text or objects.",
            "feasible": "yes"
          }
        ]
      },
      {
        "name": "Zoom",
        "id": "zoom",
        "controls": [
          {
            "id": "view.zoom.zoom",
            "cmd": "zoom",
            "label": "Zoom",
            "type": "button",
            "tooltip": "Choose a zoom level for the document. In most cases, you can use the zoom controls in the status bar to do the same thing.",
            "feasible": "yes"
          },
          {
            "id": "view.zoom.100",
            "cmd": "100",
            "label": "100%",
            "type": "button",
            "tooltip": "Zoom the document to 100% of the normal size.",
            "feasible": "yes"
          },
          {
            "id": "view.zoom.one-page",
            "cmd": "onePage",
            "label": "One Page",
            "type": "button",
            "tooltip": "Zoom the document so that an entire page fits in the window.",
            "feasible": "partial"
          },
          {
            "id": "view.zoom.multiple-pages",
            "cmd": "multiplePages",
            "label": "Multiple Pages",
            "type": "button",
            "tooltip": "Zoom the document so that two or more pages fit in the window at once.",
            "feasible": "partial"
          },
          {
            "id": "view.zoom.page-width",
            "cmd": "pageWidth",
            "label": "Page Width",
            "type": "button",
            "tooltip": "Zoom the document so that the width of the page matches the width of the window.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Window",
        "id": "window",
        "controls": [
          {
            "id": "view.window.new-window",
            "cmd": "newWindow",
            "label": "New Window",
            "type": "button",
            "tooltip": "Open a second window for the document so you can work in different places at the same time.",
            "feasible": "partial"
          },
          {
            "id": "view.window.arrange-all",
            "cmd": "arrangeAll",
            "label": "Arrange All",
            "type": "button",
            "tooltip": "Stack your open windows so you can see all of them at once.",
            "feasible": "partial"
          },
          {
            "id": "view.window.split",
            "cmd": "split",
            "label": "Split",
            "type": "button",
            "tooltip": "View two sections of your document at the same time. This is helpful for seeing one part while editing another.",
            "feasible": "partial"
          },
          {
            "id": "view.window.view-side-by-side",
            "cmd": "viewSideBySide",
            "label": "View Side by Side",
            "type": "toggle",
            "tooltip": "View two documents side by side so you can compare their contents.",
            "feasible": "partial"
          },
          {
            "id": "view.window.synchronous-scrolling",
            "cmd": "synchronousScrolling",
            "label": "Synchronous Scrolling",
            "type": "toggle",
            "tooltip": "Scroll two documents at the same time. This is a great way to compare documents line by line. (Enabled with View Side by Side.)",
            "feasible": "partial"
          },
          {
            "id": "view.window.reset-window-position",
            "cmd": "resetWindowPosition",
            "label": "Reset Window Position",
            "type": "button",
            "tooltip": "Place the documents you're comparing side by side so they share the screen equally. (Enabled with View Side by Side.)",
            "feasible": "partial"
          },
          {
            "id": "view.window.switch-windows",
            "cmd": "switchWindows",
            "label": "Switch Windows",
            "type": "dropdown",
            "tooltip": "Switch quickly to another open window. The dropdown lists all currently open documents.",
            "feasible": "partial"
          }
        ]
      },
      {
        "name": "Macros",
        "id": "macros",
        "controls": [
          {
            "id": "view.macros.macros",
            "cmd": "macros",
            "label": "Macros",
            "type": "split",
            "tooltip": "View the list of macros, from which you can run, create, or delete a macro. The dropdown offers View Macros, Record Macro, and Pause Recording.",
            "shortcut": "Alt+F8",
            "feasible": "no",
            "items": [
              "View Macros",
              "Record Macro...",
              "Pause Recording"
            ]
          }
        ]
      },
      {
        "name": "SharePoint",
        "id": "sharepoint",
        "controls": [
          {
            "id": "view.sharepoint.properties",
            "cmd": "properties",
            "label": "Properties",
            "type": "button",
            "tooltip": "View and edit the SharePoint document properties for this file. (This group appears only when the document is stored in a SharePoint library.)",
            "feasible": "no"
          }
        ]
      }
    ]
  },
  {
    "name": "Help",
    "id": "help",
    "groups": [
      {
        "name": "Help",
        "id": "help",
        "controls": [
          {
            "id": "help.help.help",
            "cmd": "help",
            "label": "Help",
            "type": "button",
            "tooltip": "Get help using Word. Browse help articles and search for answers to your questions.",
            "shortcut": "F1",
            "feasible": "partial"
          },
          {
            "id": "help.help.contact-support",
            "cmd": "contactSupport",
            "label": "Contact Support",
            "type": "button",
            "tooltip": "Contact Microsoft Support to get help with a problem.",
            "feasible": "no"
          },
          {
            "id": "help.help.feedback",
            "cmd": "feedback",
            "label": "Feedback",
            "type": "button",
            "tooltip": "Tell Microsoft what you like and don't like, and suggest new features. Opens the Feedback page in the File menu (Backstage).",
            "feasible": "partial"
          },
          {
            "id": "help.help.show-training",
            "cmd": "showTraining",
            "label": "Show Training",
            "type": "button",
            "tooltip": "Watch training videos and learn how to get the most out of Word.",
            "feasible": "partial"
          },
          {
            "id": "help.help.what-s-new",
            "cmd": "whatSNew",
            "label": "What's New",
            "type": "button",
            "tooltip": "See what's new and improved in recent updates to Word.",
            "feasible": "partial"
          }
        ]
      }
    ]
  }
];
window.WC.BACKSTAGE = {
  "name": "File",
  "sections": [
    {
      "name": "Home",
      "id": "home",
      "actions": [
        {
          "id": "home.new-blank-document-card",
          "cmd": "newBlankDocumentCard",
          "label": "New blank document card",
          "type": "button",
          "tooltip": "Creates a new empty document",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "home.template-thumbnails-take-a-tour-etc",
          "cmd": "templateThumbnailsTakeATourEtc",
          "label": "Template thumbnails (Take a tour, etc.)",
          "type": "gallery",
          "tooltip": "Featured template cards shown on Home",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "home.search-for-online-templates",
          "cmd": "searchForOnlineTemplates",
          "label": "Search for online templates",
          "type": "combo",
          "tooltip": "Requires a hosted template service / online catalog",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "home.recent-documents-list",
          "cmd": "recentDocumentsList",
          "label": "Recent documents list",
          "type": "gallery",
          "tooltip": "Recently opened files with path and timestamp",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "home.pinned-documents",
          "cmd": "pinnedDocuments",
          "label": "Pinned documents",
          "type": "gallery",
          "tooltip": "Documents pinned to the top of Recent",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "home.shared-with-me",
          "cmd": "sharedWithMe",
          "label": "Shared with Me",
          "type": "gallery",
          "tooltip": "Requires cloud/sharing backend",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "home.more-documents-more-templates-links",
          "cmd": "moreDocumentsMoreTemplatesLinks",
          "label": "More documents / More templates links",
          "type": "button",
          "tooltip": "Jumps to Open or New",
          "items": [],
          "feasible": "yes"
        }
      ]
    },
    {
      "name": "New",
      "id": "new",
      "actions": [
        {
          "id": "new.blank-document",
          "cmd": "blankDocument",
          "label": "Blank document",
          "type": "button",
          "tooltip": "Create a new empty document",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "new.featured-template-gallery",
          "cmd": "featuredTemplateGallery",
          "label": "Featured template gallery",
          "type": "gallery",
          "tooltip": "Local bundled templates feasible; full online catalog needs a service",
          "items": [
            "Resume",
            "Cover letter",
            "Flyer",
            "Newsletter",
            "Calendar"
          ],
          "feasible": "partial"
        },
        {
          "id": "new.search-online-templates-box",
          "cmd": "searchOnlineTemplatesBox",
          "label": "Search online templates box",
          "type": "combo",
          "tooltip": "Needs Office template web service",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "new.suggested-searches-chips",
          "cmd": "suggestedSearchesChips",
          "label": "Suggested searches chips",
          "type": "button",
          "tooltip": "Quick filters: Business, Cards, Flyers, Letters, Education, Resumes",
          "items": [
            "Business",
            "Cards",
            "Flyers",
            "Letters",
            "Education",
            "Resumes and Cover Letters",
            "Holiday"
          ],
          "feasible": "partial"
        },
        {
          "id": "new.template-preview-dialog-create",
          "cmd": "templatePreviewDialogCreate",
          "label": "Template preview dialog (Create)",
          "type": "button",
          "tooltip": "Preview then create from a template",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "new.take-a-tour-built-in-tutorials",
          "cmd": "takeATourBuiltInTutorials",
          "label": "Take a tour / built-in tutorials",
          "type": "gallery",
          "tooltip": "Interactive welcome/tour content",
          "items": [],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Open",
      "id": "open",
      "actions": [
        {
          "id": "open.recent",
          "cmd": "recent",
          "label": "Recent",
          "type": "gallery",
          "tooltip": "Recent files and folders",
          "items": [
            "Documents",
            "Folders"
          ],
          "feasible": "yes"
        },
        {
          "id": "open.pinned-items",
          "cmd": "pinnedItems",
          "label": "Pinned items",
          "type": "gallery",
          "tooltip": "Pinned recent files/folders",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "open.shared-with-me",
          "cmd": "sharedWithMe",
          "label": "Shared with Me",
          "type": "gallery",
          "tooltip": "Requires cloud account/sharing",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "open.onedrive-cloud-locations",
          "cmd": "onedriveCloudLocations",
          "label": "OneDrive / Cloud locations",
          "type": "button",
          "tooltip": "Needs cloud storage integration",
          "items": [
            "OneDrive - Personal",
            "OneDrive - Business",
            "SharePoint sites"
          ],
          "feasible": "partial"
        },
        {
          "id": "open.this-pc",
          "cmd": "thisPc",
          "label": "This PC",
          "type": "button",
          "tooltip": "Browse local folders",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "open.add-a-place",
          "cmd": "addAPlace",
          "label": "Add a Place",
          "type": "button",
          "tooltip": "Connect additional storage services",
          "items": [
            "OneDrive",
            "SharePoint"
          ],
          "feasible": "partial"
        },
        {
          "id": "open.browse",
          "cmd": "browse",
          "label": "Browse",
          "type": "button",
          "tooltip": "Open native file picker dialog",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "open.recover-unsaved-documents",
          "cmd": "recoverUnsavedDocuments",
          "label": "Recover Unsaved Documents",
          "type": "button",
          "tooltip": "Open autosave/temp recovery location",
          "items": [],
          "feasible": "yes"
        }
      ]
    },
    {
      "name": "Info",
      "id": "info",
      "actions": [
        {
          "id": "info.document-thumbnail-title",
          "cmd": "documentThumbnailTitle",
          "label": "Document thumbnail / title",
          "type": "label",
          "tooltip": "Current file name and path",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "info.protect-document",
          "cmd": "protectDocument",
          "label": "Protect Document",
          "type": "dropdown",
          "tooltip": "Mark as Final feasible; encryption/IRM/signatures need crypto backend",
          "items": [
            "Always Open Read-Only",
            "Encrypt with Password",
            "Restrict Editing",
            "Restrict Access (IRM)",
            "Add a Digital Signature",
            "Mark as Final"
          ],
          "feasible": "partial"
        },
        {
          "id": "info.check-for-issues",
          "cmd": "checkForIssues",
          "label": "Check for Issues",
          "type": "dropdown",
          "tooltip": "Inspector feasible; accessibility/compatibility checks are large work",
          "items": [
            "Inspect Document",
            "Check Accessibility",
            "Check Compatibility"
          ],
          "feasible": "partial"
        },
        {
          "id": "info.manage-document-versions",
          "cmd": "manageDocumentVersions",
          "label": "Manage Document / Versions",
          "type": "dropdown",
          "tooltip": "Autosave version history needs versioning store",
          "items": [
            "Recover Unsaved Documents",
            "Delete All Unsaved Documents"
          ],
          "feasible": "partial"
        },
        {
          "id": "info.properties-panel",
          "cmd": "propertiesPanel",
          "label": "Properties panel",
          "type": "label",
          "tooltip": "Size, pages, words, editing time, title, tags, comments",
          "items": [
            "Size",
            "Pages",
            "Words",
            "Total Editing Time",
            "Title",
            "Tags",
            "Comments"
          ],
          "feasible": "yes"
        },
        {
          "id": "info.advanced-properties-show-all-properties",
          "cmd": "advancedPropertiesShowAllProperties",
          "label": "Advanced Properties / Show All Properties",
          "type": "button",
          "tooltip": "Expand full metadata fields",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "info.related-dates",
          "cmd": "relatedDates",
          "label": "Related Dates",
          "type": "label",
          "tooltip": "Last modified, created, last printed",
          "items": [
            "Last Modified",
            "Created",
            "Last Printed"
          ],
          "feasible": "yes"
        },
        {
          "id": "info.related-people",
          "cmd": "relatedPeople",
          "label": "Related People",
          "type": "label",
          "tooltip": "Author add/edit; presence info needs identity service",
          "items": [
            "Author",
            "Last Modified By"
          ],
          "feasible": "partial"
        },
        {
          "id": "info.version-history",
          "cmd": "versionHistory",
          "label": "Version History",
          "type": "button",
          "tooltip": "Cloud version history requires sync backend",
          "items": [],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Save",
      "id": "save",
      "actions": [
        {
          "id": "save.save-to-current-location",
          "cmd": "saveToCurrentLocation",
          "label": "Save (to current location)",
          "type": "button",
          "tooltip": "Save changes to the existing file",
          "items": [],
          "feasible": "yes"
        }
      ]
    },
    {
      "name": "Save As",
      "id": "save-as",
      "actions": [
        {
          "id": "save-as.recent-folders",
          "cmd": "recentFolders",
          "label": "Recent folders",
          "type": "gallery",
          "tooltip": "Recently used save locations",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "save-as.onedrive-cloud-locations",
          "cmd": "onedriveCloudLocations",
          "label": "OneDrive / Cloud locations",
          "type": "button",
          "tooltip": "Requires cloud storage integration",
          "items": [
            "OneDrive",
            "SharePoint"
          ],
          "feasible": "partial"
        },
        {
          "id": "save-as.this-pc",
          "cmd": "thisPc",
          "label": "This PC",
          "type": "button",
          "tooltip": "Save to a local folder",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "save-as.add-a-place",
          "cmd": "addAPlace",
          "label": "Add a Place",
          "type": "button",
          "tooltip": "Connect storage services",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "save-as.browse",
          "cmd": "browse",
          "label": "Browse",
          "type": "button",
          "tooltip": "Open native Save As dialog",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "save-as.file-name",
          "cmd": "fileName",
          "label": "File name",
          "type": "combo",
          "tooltip": "Enter the file name",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "save-as.save-as-type",
          "cmd": "saveAsType",
          "label": "Save as type",
          "type": "dropdown",
          "tooltip": ".docx feasible; full fidelity .doc/.pdf/.rtf/.odt export varies",
          "items": [
            ".docx",
            ".doc",
            ".pdf",
            ".rtf",
            ".odt",
            ".txt",
            "Web Page (.htm)",
            "Template (.dotx)"
          ],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Print",
      "id": "print",
      "actions": [
        {
          "id": "print.print-button",
          "cmd": "printButton",
          "label": "Print button",
          "type": "button",
          "tooltip": "Triggers print; relies on OS print pipeline",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "print.copies",
          "cmd": "copies",
          "label": "Copies",
          "type": "spinner",
          "tooltip": "Number of copies to print",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "print.printer",
          "cmd": "printer",
          "label": "Printer",
          "type": "dropdown",
          "tooltip": "Printer enumeration via OS; selection in Electron is limited",
          "items": [
            "Available printers",
            "Microsoft Print to PDF",
            "Printer Properties"
          ],
          "feasible": "partial"
        },
        {
          "id": "print.print-range-settings",
          "cmd": "printRangeSettings",
          "label": "Print range / Settings",
          "type": "dropdown",
          "tooltip": "Which pages to print",
          "items": [
            "Print All Pages",
            "Print Selection",
            "Print Current Page",
            "Custom Print Range"
          ],
          "feasible": "partial"
        },
        {
          "id": "print.pages-custom-range-box",
          "cmd": "pagesCustomRangeBox",
          "label": "Pages (custom range box)",
          "type": "combo",
          "tooltip": "Enter page numbers/ranges",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "print.print-one-sided-duplex",
          "cmd": "printOneSidedDuplex",
          "label": "Print One Sided / Duplex",
          "type": "dropdown",
          "tooltip": "Duplex depends on printer/driver",
          "items": [
            "Print One Sided",
            "Print on Both Sides (long edge)",
            "Print on Both Sides (short edge)"
          ],
          "feasible": "partial"
        },
        {
          "id": "print.collation",
          "cmd": "collation",
          "label": "Collation",
          "type": "dropdown",
          "tooltip": "Collated vs uncollated",
          "items": [
            "Collated",
            "Uncollated"
          ],
          "feasible": "partial"
        },
        {
          "id": "print.orientation",
          "cmd": "orientation",
          "label": "Orientation",
          "type": "dropdown",
          "tooltip": "Portrait or landscape",
          "items": [
            "Portrait Orientation",
            "Landscape Orientation"
          ],
          "feasible": "yes"
        },
        {
          "id": "print.paper-size",
          "cmd": "paperSize",
          "label": "Paper size",
          "type": "dropdown",
          "tooltip": "Letter, A4, etc.",
          "items": [
            "Letter",
            "A4",
            "Legal",
            "A3",
            "Custom"
          ],
          "feasible": "yes"
        },
        {
          "id": "print.margins",
          "cmd": "margins",
          "label": "Margins",
          "type": "dropdown",
          "tooltip": "Preset margin sets",
          "items": [
            "Normal",
            "Narrow",
            "Moderate",
            "Wide",
            "Custom Margins"
          ],
          "feasible": "yes"
        },
        {
          "id": "print.pages-per-sheet",
          "cmd": "pagesPerSheet",
          "label": "Pages per sheet",
          "type": "dropdown",
          "tooltip": "Scale multiple pages onto one sheet",
          "items": [
            "1 Page Per Sheet",
            "2",
            "4",
            "6",
            "Scale to Paper Size"
          ],
          "feasible": "yes"
        },
        {
          "id": "print.print-preview-pane",
          "cmd": "printPreviewPane",
          "label": "Print preview pane",
          "type": "gallery",
          "tooltip": "Rendering an accurate paginated preview is significant work",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "print.page-navigation-zoom-slider",
          "cmd": "pageNavigationZoomSlider",
          "label": "Page navigation + zoom slider",
          "type": "spinner",
          "tooltip": "Navigate preview pages and zoom",
          "items": [],
          "feasible": "yes"
        }
      ]
    },
    {
      "name": "Share",
      "id": "share",
      "actions": [
        {
          "id": "share.share-with-people-cloud",
          "cmd": "shareWithPeopleCloud",
          "label": "Share with People (cloud)",
          "type": "button",
          "tooltip": "Requires cloud co-authoring backend (OneDrive/SharePoint)",
          "items": [],
          "feasible": "no"
        },
        {
          "id": "share.invite-people-enter-emails",
          "cmd": "invitePeopleEnterEmails",
          "label": "Invite people / enter emails",
          "type": "combo",
          "tooltip": "Needs sharing/permissions service",
          "items": [],
          "feasible": "no"
        },
        {
          "id": "share.copy-link",
          "cmd": "copyLink",
          "label": "Copy Link",
          "type": "button",
          "tooltip": "Only meaningful with a cloud link service",
          "items": [
            "Anyone with the link",
            "People in your organization"
          ],
          "feasible": "partial"
        },
        {
          "id": "share.email",
          "cmd": "email",
          "label": "Email",
          "type": "dropdown",
          "tooltip": "Mailto/local mail attach feasible; rich options need integration",
          "items": [
            "Send as Attachment",
            "Send a Link",
            "Send as PDF",
            "Send as XPS",
            "Send as Internet Fax"
          ],
          "feasible": "partial"
        },
        {
          "id": "share.present-online",
          "cmd": "presentOnline",
          "label": "Present Online",
          "type": "button",
          "tooltip": "Requires presentation service",
          "items": [],
          "feasible": "no"
        }
      ]
    },
    {
      "name": "Export",
      "id": "export",
      "actions": [
        {
          "id": "export.create-pdf-xps-document",
          "cmd": "createPdfXpsDocument",
          "label": "Create PDF/XPS Document",
          "type": "button",
          "tooltip": "PDF export feasible via print-to-PDF/renderer; XPS less so",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "export.change-file-type",
          "cmd": "changeFileType",
          "label": "Change File Type",
          "type": "gallery",
          "tooltip": "docx feasible; full-fidelity legacy/ODT/RTF conversion varies",
          "items": [
            "Document (.docx)",
            "Word 97-2003 (.doc)",
            "OpenDocument Text (.odt)",
            "Template (.dotx)",
            "Plain Text (.txt)",
            "Rich Text Format (.rtf)",
            "Single File Web Page (.mht)"
          ],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Transform",
      "id": "transform",
      "actions": [
        {
          "id": "transform.transform-to-web-page-sway",
          "cmd": "transformToWebPageSway",
          "label": "Transform to Web Page (Sway)",
          "type": "button",
          "tooltip": "Requires Microsoft Sway cloud service",
          "items": [],
          "feasible": "no"
        }
      ]
    },
    {
      "name": "Close",
      "id": "close",
      "actions": [
        {
          "id": "close.close-document",
          "cmd": "closeDocument",
          "label": "Close document",
          "type": "button",
          "tooltip": "Closes the current document with save prompt",
          "items": [],
          "feasible": "yes"
        }
      ]
    },
    {
      "name": "Account",
      "id": "account",
      "actions": [
        {
          "id": "account.user-information-name-photo-email",
          "cmd": "userInformationNamePhotoEmail",
          "label": "User information (name, photo, email)",
          "type": "label",
          "tooltip": "Needs sign-in/identity service to populate",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "account.account-photo-change-photo",
          "cmd": "accountPhotoChangePhoto",
          "label": "Account photo / Change photo",
          "type": "button",
          "tooltip": "Requires account service",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "account.sign-out-switch-account",
          "cmd": "signOutSwitchAccount",
          "label": "Sign out / Switch account",
          "type": "button",
          "tooltip": "Requires auth backend",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "account.office-background",
          "cmd": "officeBackground",
          "label": "Office Background",
          "type": "dropdown",
          "tooltip": "Decorative title-bar pattern",
          "items": [
            "No Background",
            "Calligraphy",
            "Circles and Stripes",
            "Clouds",
            "Geometry",
            "Spring"
          ],
          "feasible": "yes"
        },
        {
          "id": "account.office-theme",
          "cmd": "officeTheme",
          "label": "Office Theme",
          "type": "dropdown",
          "tooltip": "App color theme",
          "items": [
            "Colorful",
            "Dark Gray",
            "Black",
            "White",
            "Use system setting"
          ],
          "feasible": "yes"
        },
        {
          "id": "account.connected-services",
          "cmd": "connectedServices",
          "label": "Connected Services",
          "type": "button",
          "tooltip": "Add storage/services; needs integrations",
          "items": [
            "OneDrive",
            "SharePoint",
            "Add a service"
          ],
          "feasible": "partial"
        },
        {
          "id": "account.product-information-about-license",
          "cmd": "productInformationAboutLicense",
          "label": "Product Information / About / License",
          "type": "label",
          "tooltip": "Version/about feasible; license/activation needs backend",
          "items": [
            "About Word",
            "What's New",
            "Update Options",
            "Manage Account"
          ],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Feedback",
      "id": "feedback",
      "actions": [
        {
          "id": "feedback.i-like-something-i-don-t-like-something-i-have-a-suggestion",
          "cmd": "iLikeSomethingIDonTLikeSomethingIHaveASuggestion",
          "label": "I like something / I don't like something / I have a suggestion",
          "type": "button",
          "tooltip": "UI feasible; submission needs a feedback endpoint",
          "items": [],
          "feasible": "partial"
        }
      ]
    },
    {
      "name": "Options",
      "id": "options",
      "actions": [
        {
          "id": "options.general",
          "cmd": "general",
          "label": "General",
          "type": "button",
          "tooltip": "UI options, personalization, startup",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "options.display",
          "cmd": "display",
          "label": "Display",
          "type": "button",
          "tooltip": "Page display and printing options",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "options.proofing",
          "cmd": "proofing",
          "label": "Proofing",
          "type": "button",
          "tooltip": "AutoCorrect feasible; full spelling/grammar engine is large",
          "items": [
            "AutoCorrect Options",
            "Spelling",
            "Grammar"
          ],
          "feasible": "partial"
        },
        {
          "id": "options.save",
          "cmd": "save",
          "label": "Save",
          "type": "button",
          "tooltip": "AutoRecover, default format, default locations",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "options.language",
          "cmd": "language",
          "label": "Language",
          "type": "button",
          "tooltip": "Editing/display language packs need resources",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "options.accessibility",
          "cmd": "accessibility",
          "label": "Accessibility",
          "type": "button",
          "tooltip": "Accessibility preferences",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "options.advanced",
          "cmd": "advanced",
          "label": "Advanced",
          "type": "button",
          "tooltip": "Large set of editing/display/print toggles",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "options.customize-ribbon",
          "cmd": "customizeRibbon",
          "label": "Customize Ribbon",
          "type": "button",
          "tooltip": "Ribbon customization UI is substantial",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "options.quick-access-toolbar",
          "cmd": "quickAccessToolbar",
          "label": "Quick Access Toolbar",
          "type": "button",
          "tooltip": "Customize QAT commands",
          "items": [],
          "feasible": "yes"
        },
        {
          "id": "options.add-ins",
          "cmd": "addIns",
          "label": "Add-ins",
          "type": "button",
          "tooltip": "Add-in framework needed for full support",
          "items": [],
          "feasible": "partial"
        },
        {
          "id": "options.trust-center",
          "cmd": "trustCenter",
          "label": "Trust Center",
          "type": "button",
          "tooltip": "Macro/privacy/protected-view settings; security model heavy",
          "items": [],
          "feasible": "partial"
        }
      ]
    }
  ]
};
