/* design-tools.js — Design tab DATA TABLES (themes, colors, fonts, paragraph
   spacing, style sets) + WC.setThemeColors. The legacy apply/snapshot/watermark
   engine was retired in slice 11 (PM uses WC.PM.deApplyTheme/deApplyColors/…);
   only the value tables + setThemeColors remain, read by commands.js + the
   bridge (bridge/design.ts). */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  const root = () => document.documentElement;

  // Themes — accent palettes/fonts/Text2 colors web-verified from Office theme
  // XML; fonts carry Linux-safe fallback chains. (Office/Aptos validated vs real Word.)
  const TREB = "'Trebuchet MS','Segoe UI',sans-serif";
  const TWCEN = "'Tw Cen MT','Century Gothic','Questrial',sans-serif";
  const GOTHIC = "'Century Gothic','Questrial','URW Gothic',sans-serif";
  const GARA = "'Garamond','EB Garamond',Georgia,serif";
  const CALL = "'Calibri Light',Calibri,Carlito,sans-serif"; // Calibri Light heading
  const CALB = 'Calibri,Carlito,sans-serif';
  // Themes — Word's built-in gallery: Office first, then alphabetical (matches the
  // Mac Word Design ▸ Themes list). Accent palettes/fonts approximate the Office
  // theme XML; fonts carry Linux-safe fallback chains. (Office/Aptos validated.)
  const THEMES = [
    { name: 'Office', heading: "'Aptos Display',Aptos,Calibri,sans-serif", body: "Aptos,Calibri,Carlito,sans-serif", color: '#0E2841', accents: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'] },
    { name: 'Office 2013-2022', heading: CALL, body: CALB, color: '#44546A', accents: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] },
    { name: 'Atlas', heading: TREB, body: TREB, color: '#3E3E3E', accents: ['#F36F31', '#80B0A6', '#8FB03C', '#B0CA53', '#D8AF54', '#E0863A'] },
    { name: 'Badge', heading: GOTHIC, body: GOTHIC, color: '#2C2C2C', accents: ['#F8B229', '#704B30', '#A26D3F', '#C09A5F', '#A1A23F', '#5A7D3C'] },
    { name: 'Banded', heading: GOTHIC, body: GOTHIC, color: '#3B3B3B', accents: ['#FFC000', '#A5D028', '#08CC78', '#0BD0D9', '#10C4F5', '#FF974D'] },
    { name: 'Berlin', heading: TREB, body: TREB, color: '#1A1A1A', accents: ['#1A1A1A', '#B9CA60', '#6E9DAC', '#F09415', '#C2615F', '#C2A874'] },
    { name: 'Celestial', heading: GARA, body: GARA, color: '#283138', accents: ['#AC3EC1', '#477BD1', '#46B298', '#90BA4C', '#DD9D31', '#E25247'] },
    { name: 'Crop', heading: TWCEN, body: TWCEN, color: '#2B2B2B', accents: ['#8C8D86', '#E6C069', '#897B61', '#8DAB8E', '#77A4BB', '#D3882F'] },
    { name: 'Depth', heading: GOTHIC, body: GOTHIC, color: '#293C36', accents: ['#41AEBD', '#97D7A3', '#FFCD33', '#FFA32F', '#EB6D43', '#A653A1'] },
    { name: 'Dividend', heading: TREB, body: TREB, color: '#3C3C3C', accents: ['#4F6E72', '#80582F', '#A5774B', '#5E8F4F', '#8C7E70', '#9C5B3E'] },
    { name: 'Droplet', heading: TWCEN, body: TWCEN, color: '#212934', accents: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] },
    { name: 'Facet', heading: TREB, body: TREB, color: '#2C3C43', accents: ['#90C226', '#54A021', '#E6B91E', '#E76618', '#C42F1A', '#918655'] },
    { name: 'Feathered', heading: GARA, body: GARA, color: '#4A4A4A', accents: ['#9C6A6A', '#C18C72', '#A4977D', '#73937B', '#6E8B96', '#9D8AA5'] },
    { name: 'Frame', heading: CALL, body: CALB, color: '#40434C', accents: ['#40557C', '#3F8A8B', '#6FA34F', '#B7912E', '#A35A48', '#8460A6'] },
    { name: 'Gallery', heading: GOTHIC, body: GOTHIC, color: '#1E1E1E', accents: ['#B71E42', '#26408B', '#955F2C', '#637C42', '#7D6A55', '#3F5664'] },
    { name: 'Headlines', heading: TREB, body: TREB, color: '#212121', accents: ['#439EB7', '#E36F1E', '#7DAA3F', '#F2C300', '#B4609F', '#D24D57'] },
    { name: 'Integral', heading: TWCEN, body: TWCEN, color: '#1B2A4E', accents: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] },
    { name: 'Ion', heading: GOTHIC, body: GOTHIC, color: '#21262A', accents: ['#B01513', '#EA6312', '#E6B729', '#6AAC90', '#54849C', '#9E5E9B'] },
    { name: 'Ion Boardroom', heading: GOTHIC, body: GOTHIC, color: '#1F1F1F', accents: ['#B31166', '#E33D6F', '#E45F3C', '#E29836', '#1DC9A4', '#6BBA56'] },
    { name: 'Madison', heading: GARA, body: GARA, color: '#3A3A38', accents: ['#A0AD5A', '#62A39F', '#7C7F42', '#C2BC80', '#9B8357', '#94A088'] },
    { name: 'Mesh', heading: TWCEN, body: TWCEN, color: '#393F47', accents: ['#6F6D63', '#F1AE4B', '#D87E2D', '#A38B6C', '#76A08A', '#5E7E9B'] },
    { name: 'Organic', heading: GARA, body: GARA, color: '#2A2A28', accents: ['#83992A', '#3E8853', '#2E6F3A', '#719500', '#7C7F42', '#6B9BC7'] },
    { name: 'Parallax', heading: GOTHIC, body: GOTHIC, color: '#212121', accents: ['#30ACEC', '#80C34F', '#E29F38', '#DF5327', '#A0539A', '#676A6E'] },
    { name: 'Quotable', heading: TREB, body: TREB, color: '#1F1F1F', accents: ['#00C9A7', '#56C1E0', '#6F8BC9', '#9B7BC4', '#C76FA0', '#E08A5B'] },
    { name: 'Retrospect', heading: CALL, body: CALB, color: '#505046', accents: ['#E48312', '#BD582C', '#865640', '#9B8357', '#C2BC80', '#94A088'] },
    { name: 'Savon', heading: GOTHIC, body: GOTHIC, color: '#2A2A2A', accents: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] },
    { name: 'Slice', heading: TREB, body: TREB, color: '#1F1F1F', accents: ['#052F61', '#A50E0E', '#077B1F', '#B59B00', '#9013FE', '#0E8AB5'] },
    { name: 'View', heading: GARA, body: GARA, color: '#3C3C3C', accents: ['#6F6F6F', '#9CA383', '#A88C5A', '#7C9885', '#6A8CAA', '#A57F8C'] },
    { name: 'Wisp', heading: GOTHIC, body: GOTHIC, color: '#766F60', accents: ['#74A507', '#5BB0AE', '#C1B62E', '#D58717', '#F94D4D', '#A26EC4'] },
    { name: 'Wood Type', heading: GARA, body: GARA, color: '#3C2C20', accents: ['#A35E2A', '#686256', '#A19574', '#7F6F4F', '#9C6B3F', '#5E5040'] },
  ];
  // Color schemes — Office "Colors" gallery (Office first, then the standard family).
  const COLOR_SCHEMES = [
    { name: 'Office', accents: ['#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'] },
    { name: 'Office 2007-2010', accents: ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'] },
    { name: 'Grayscale', accents: ['#7F7F7F', '#B2B2B2', '#595959', '#A6A6A6', '#404040', '#D9D9D9'] },
    { name: 'Blue Warm', accents: ['#4472C4', '#5B9BD5', '#ED7D31', '#FFC000', '#70AD47', '#264478'] },
    { name: 'Blue', accents: ['#5B9BD5', '#ED7D31', '#A5A5A5', '#FFC000', '#4472C4', '#70AD47'] },
    { name: 'Blue II', accents: ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'] },
    { name: 'Blue Green', accents: ['#0F6FC6', '#009DD9', '#0BD0D9', '#10CF9B', '#7CCA62', '#A5C249'] },
    { name: 'Green', accents: ['#77933C', '#4F6228', '#9BBB59', '#4BACC6', '#8064A2', '#C0504D'] },
    { name: 'Green Yellow', accents: ['#99CB38', '#63A537', '#37A76F', '#44C1A3', '#4EB3CF', '#51C3F9'] },
    { name: 'Yellow', accents: ['#FFCA08', '#F8931D', '#CE8D3E', '#EC7016', '#E64823', '#9C6A6A'] },
    { name: 'Yellow Orange', accents: ['#E8A33D', '#C25E18', '#94A088', '#9B8357', '#C2BC80', '#7F8A6B'] },
    { name: 'Orange', accents: ['#E48312', '#BD582C', '#865640', '#9B8357', '#C2BC80', '#94A088'] },
    { name: 'Orange Red', accents: ['#E84C22', '#FF8021', '#FCB711', '#C0504D', '#A23B32', '#7D2B1F'] },
    { name: 'Red Orange', accents: ['#D34817', '#9B2D1F', '#A28E6A', '#956251', '#918A8A', '#855D5D'] },
    { name: 'Red', accents: ['#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#1F497D'] },
    { name: 'Red Violet', accents: ['#E32D91', '#C830CC', '#4EA6DC', '#4775E7', '#8971E1', '#D54773'] },
    { name: 'Violet', accents: ['#71588F', '#4484C2', '#5B9BD5', '#6FAC46', '#E1A93C', '#C46A36'] },
    { name: 'Violet II', accents: ['#A55FAA', '#C24FB5', '#8C5DA7', '#6D5CAE', '#5C6FB1', '#5081B7'] },
  ];
  // Font pairings — Word "Fonts" gallery (Office first), heading/body with fallbacks.
  const FONT_PAIRS = [
    { name: 'Office', heading: CALL, body: CALB },
    { name: 'Office 2007-2010', heading: 'Cambria,Georgia,serif', body: CALB },
    { name: 'Aptos', heading: "'Aptos Display',Aptos,Calibri,sans-serif", body: 'Aptos,Calibri,Carlito,sans-serif' },
    { name: 'Calibri', heading: CALB, body: CALB },
    { name: 'Calibri Light', heading: CALL, body: CALB },
    { name: 'Arial', heading: 'Arial,Helvetica,sans-serif', body: 'Arial,Helvetica,sans-serif' },
    { name: 'Corbel', heading: "Corbel,'Segoe UI',sans-serif", body: "Corbel,'Segoe UI',sans-serif" },
    { name: 'Candara', heading: "Candara,'Segoe UI',sans-serif", body: "Candara,'Segoe UI',sans-serif" },
    { name: 'Cambria', heading: 'Cambria,Georgia,serif', body: 'Cambria,Georgia,serif' },
    { name: 'Georgia', heading: 'Georgia,serif', body: 'Georgia,serif' },
    { name: 'Garamond', heading: GARA, body: GARA },
    { name: 'Times New Roman', heading: "'Times New Roman',Times,serif", body: "'Times New Roman',Times,serif" },
    { name: 'Trebuchet MS', heading: TREB, body: TREB },
    { name: 'Century Gothic', heading: GOTHIC, body: GOTHIC },
    { name: 'Verdana', heading: 'Verdana,Geneva,sans-serif', body: 'Verdana,Geneva,sans-serif' },
  ];
  // Paragraph spacing presets (pt before/after + line multiple) — Word built-ins.
  const SPACING = [
    { name: 'No Paragraph Space', before: 0, after: 0, line: 1 },
    { name: 'Compact', before: 0, after: 4, line: 1 },
    { name: 'Tight', before: 0, after: 6, line: 1.15 },
    { name: 'Open', before: 0, after: 10, line: 1.15 },
    { name: 'Relaxed', before: 0, after: 6, line: 1.5 },
    { name: 'Double', before: 0, after: 8, line: 2 },
  ];
  const STYLE_SETS = ['Default', 'Basic (Simple)', 'Basic (Elegant)', 'Lines (Distinctive)', 'Shaded', 'Casual', 'Centered', 'Word 2010', 'Word 2013'];

  // Value tables only — read by commands.js (Design gallery menus) and the bridge.
  const Design = { THEMES, COLOR_SCHEMES, FONT_PAIRS, SPACING, STYLE_SETS };

  // Re-map the color picker's theme row to a new accent set.
  WC.setThemeColors = function (accents) {
    WC._themeAccents = accents;
    root().style.setProperty('--word-blue', accents[0]);
  };

  WC.Design = Design;
})();
