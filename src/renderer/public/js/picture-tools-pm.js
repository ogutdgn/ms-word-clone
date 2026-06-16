/* picture-tools-pm.js — PM Picture Format chrome.

   A runtime-injected contextual ribbon tab (mirrors table-tools-pm.js's contextualTab() +
   WC.Ribbon.showContextualTab(def)) shown when a single PICTURE (an image NodeSelection) is
   selected, hidden when the selection leaves it. Hosts:
     • Size — "Height"/"Width" (numeric inches → setImageSize, honors the aspect lock) + "Lock
       Aspect Ratio" (toggles node.attrs.lockAspectRatio; when UNLOCKED the resize overlay's edge
       handles free-stretch one axis — see bridge/insert.ts setImageLockAspect/setImageSize).
     • Arrange — Wrap Text / Bring Forward / Send Backward, re-pointing the existing image cmds.
     • Accessibility — "Alt Text" (description → wp:docPr/@descr + mark-as-decorative; setImageAltText).
   CRITICAL (same as table-tools-pm.js): the ribbon dispatches { cmd, label, type } →
   WC.Commands.run/dropdown({cmd}) → H[cmd] (commands.js); inline onClick is ignored.
   syncContextualTab(imageSelected) is driven from bridge/state-sync.ts. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  let shown = false;

  function pictureFormatTab() {
    return {
      id: 'picture-format',
      name: 'Picture Format',
      contextual: true,
      groups: [
        {
          id: 'pf-size',
          name: 'Size',
          controls: [
            { cmd: 'imgHeight', label: 'Height', type: 'dropdown' },
            { cmd: 'imgWidth', label: 'Width', type: 'dropdown' },
            { cmd: 'imgLockAspect', label: 'Lock Aspect Ratio', type: 'button' },
          ],
        },
        {
          id: 'pf-arrange',
          name: 'Arrange',
          controls: [
            { cmd: 'wrapText', label: 'Wrap Text', type: 'dropdown' },
            { cmd: 'bringForward', label: 'Bring Forward', type: 'split' },
            { cmd: 'sendBackward', label: 'Send Backward', type: 'split' },
          ],
        },
        {
          id: 'pf-accessibility',
          name: 'Accessibility',
          controls: [{ cmd: 'imgAltText', label: 'Alt Text', type: 'dropdown' }],
        },
      ],
    };
  }

  // Show/hide the Picture Format tab as a picture is selected/deselected. PASSIVE (like Word and
  // the table tabs): it appears but never steals the active tab. Idempotent via the `shown` guard.
  function syncContextualTab(imageSelected) {
    if (!WC.Ribbon || !WC.Ribbon.showContextualTab) return;
    if (imageSelected && !shown) {
      WC.Ribbon.showContextualTab(pictureFormatTab(), { activate: false });
      shown = true;
    } else if (!imageSelected && shown) {
      if (WC.Ribbon.hideContextualTab) WC.Ribbon.hideContextualTab('picture-format');
      shown = false;
    }
  }

  WC.PictureToolsPM = { syncContextualTab };
})();
