// Phase 1 new-core entry. Stage A: stub only (proves the ESM module loads AFTER
// the legacy classic scripts built window.WC). Real mount in Stage B.
console.info('[wc] main.ts loaded; window.WC present:', !!(window as any).WC)
