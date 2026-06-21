/* header-footer-tools-pm.js — PM "Header & Footer" contextual ribbon tab (002).

   Mirrors picture-tools-pm.js / table-tools-pm.js: a runtime-injected contextual tab
   (WC.Ribbon.showContextualTab(def)) shown while a header/footer editing session is active in the
   paged engine, hidden when editing ends (Close / click back into the body).

   ACTIVATION is event-driven: the WC.PM bridge (bridge/header-footer.ts) listens to the paged
   PresentationEditor's 'headerFooterModeChanged' and re-emits a window 'wc:hf-mode' CustomEvent
   ({ mode: 'header' | 'footer' | 'body' }). This module shows the tab when mode !== 'body' and
   hides it on 'body'. No fork edit; no polling.

   The ribbon dispatches { cmd, label, type } -> WC.Commands.run/dropdown({cmd}) -> H[cmd]
   (commands.js); inline handlers are ignored (same contract as the picture/table tabs).

   P1 controls: Header/Footer (the existing Edit-Header/Footer modal) + Go to Header/Footer +
   Close. P2 adds an "Options" group (Different First Page / Odd & Even); P3 adds Page Number. */
(function () {
  window.WC = window.WC || {};
  const WC = window.WC;
  let shown = false;

  function headerFooterToolsTab() {
    return {
      id: 'header-footer-tools',
      name: 'Header & Footer',
      contextual: true,
      groups: [
        {
          id: 'hf-insert',
          name: 'Header & Footer',
          controls: [
            { cmd: 'header', label: 'Header', type: 'dropdown' },
            { cmd: 'footer', label: 'Footer', type: 'dropdown' },
          ],
        },
        {
          id: 'hf-nav',
          name: 'Navigation',
          controls: [
            { cmd: 'goToHeader', label: 'Go to Header', type: 'button' },
            { cmd: 'goToFooter', label: 'Go to Footer', type: 'button' },
          ],
        },
        {
          id: 'hf-close',
          name: 'Close',
          controls: [
            { cmd: 'closeHeaderFooter', label: 'Close Header and Footer', type: 'button' },
          ],
        },
      ],
    };
  }

  // Show when a header/footer editing session is active; hide on return to body. Word ACTIVATES
  // this tab on entry (unlike the passive picture/table tabs), so activate:true. Idempotent.
  function syncContextualTab(active) {
    if (!WC.Ribbon || !WC.Ribbon.showContextualTab) return;
    if (active && !shown) {
      WC.Ribbon.showContextualTab(headerFooterToolsTab(), { activate: true });
      shown = true;
    } else if (!active && shown) {
      if (WC.Ribbon.hideContextualTab) WC.Ribbon.hideContextualTab('header-footer-tools');
      shown = false;
    }
  }

  // Event-driven: the bridge emits 'wc:hf-mode' off the PE's headerFooterModeChanged.
  window.addEventListener('wc:hf-mode', function (e) {
    try {
      const mode = e && e.detail && e.detail.mode;
      syncContextualTab(!!(mode && mode !== 'body'));
    } catch (err) {
      /* a UI signal must never throw */
    }
  });

  WC.HeaderFooterToolsPM = { syncContextualTab, headerFooterToolsTab };
})();
