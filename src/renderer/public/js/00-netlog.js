// Records any non-local network attempt so the PM smoke test can assert "no telemetry".
// Loaded FIRST (before all other scripts AND main.ts) so it observes load-time requests.
// External file (not inline) so the strict `script-src 'self'` CSP allows it.
// Intended for the production build (file://); under `electron-vite dev` the dev
// server adds its own local requests, which a dev-run smoke would need to filter.
(function () {
  window.__NET_LOG = window.__NET_LOG || [];
  function local(u) {
    u = String(u || '');
    // same-origin relative forms only; `//host` is protocol-relative (EXTERNAL), so exclude it.
    return (u.startsWith('/') && !u.startsWith('//')) || u.startsWith('./') || u.startsWith('../') ||
      u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file:') || u.startsWith('about:');
  }
  var of = window.fetch;
  if (of) window.fetch = function (i) { var u = typeof i === 'string' ? i : (i && (i.url || i.href)) || String(i || ''); if (!local(u)) window.__NET_LOG.push('fetch ' + u); return of.apply(this, arguments); };
  var oo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { if (!local(u)) window.__NET_LOG.push('xhr ' + u); return oo.apply(this, arguments); };
})();
