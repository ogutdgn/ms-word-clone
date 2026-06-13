// NET-NEW (slice 10 themes, NOTICE'd). Word only RENDERS a document page color
// (<w:background>) when word/settings.xml contains <w:displayBackgroundShape/>.
// This helper add/removes that flag on the converter's settings part so a clone
// page color shows on Word open. The exporter passes word/settings.xml through from
// convertedXml, so mutating it here is sufficient. (No imports — builds plain object literals.)

const SETTINGS_PART = 'word/settings.xml';

function settingsRoot(converter) {
  const part = converter && converter.convertedXml && converter.convertedXml[SETTINGS_PART];
  if (part && part.elements) {
    const root = part.elements.find((el) => el.name === 'w:settings');
    if (root) {
      if (!root.elements) root.elements = [];
      return root;
    }
  }
  return null;
}

// Create a minimal settings part when none exists (rare — most docx ship one).
function ensureSettingsPart(converter) {
  let root = settingsRoot(converter);
  if (root) return root;
  if (!converter.convertedXml) return null;
  converter.convertedXml[SETTINGS_PART] = {
    declaration: { attributes: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } },
    elements: [
      {
        type: 'element',
        name: 'w:settings',
        attributes: { 'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main' },
        elements: [],
      },
    ],
  };
  return settingsRoot(converter);
}

export function ensureDisplayBackgroundShape(converter, on) {
  const root = on ? ensureSettingsPart(converter) : settingsRoot(converter);
  if (!root) return false;
  const idx = root.elements.findIndex((el) => el.name === 'w:displayBackgroundShape');
  let changed = false;
  if (on) {
    if (idx < 0) { root.elements.unshift({ type: 'element', name: 'w:displayBackgroundShape' }); changed = true; }
  } else if (idx >= 0) {
    root.elements.splice(idx, 1); changed = true;
  }
  // Only flag the converter modified when the tree actually changed (avoid a spurious
  // metadata/GUID write when clearing a background that was never set).
  if (changed && converter) converter.documentModified = true;
  return true;
}
