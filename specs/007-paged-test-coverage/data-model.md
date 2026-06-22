# Data model: Paged test-coverage port

Test-infra only — no document-model entities. The "entities" are the in-suite structures.

## `MODE` / `PAGED` (suite-scope)

```js
const MODE  = window.__WC_LAYOUT_MODE === 'paged' ? 'paged' : 'overlay'; // the actual booted engine
const PAGED = MODE === 'paged';
```
Recorded once via the GATE MODE info row (a PASS). Threaded into `t()`/`ta()` and the Category-B branches.

## `PAGED_SKIP` (Map<exactTestName, { reason, probe }>)

The auditable registry of Category-A overlay-only tests (FR-004). One entry per paged-skipped test.

```js
const PAGED_SKIP = new Map([
  ['pagination exposes page geometry from the document model',
    { reason: 'overlay Pagination engine (PM.__pagination); paged PE is the sole paginator', probe: 'probe:coords + probe:statusbar' }],
  // … one per Category-A test (62), grouped by zone with a comment header per zone …
]);
```

- **Key**: the EXACT `name` string passed to `t()`/`ta()` (static in the suite — verified against the empirical
  fail list).
- **reason**: the overlay-only construct (what doesn't exist / renders differently in paged).
- **probe**: the dedicated paged test that DOES cover this in paged (the honesty anchor).

## Skip record (emitted in paged when a key matches)

```js
{ name, pass: true, detail: '⊘ paged-skip (overlay-only): ' + reason + ' — paged covered by ' + probe }
```

Counts as a PASS (so paged total = pass, no hard fail) but is visibly a skip in the results — auditable, never
silent.

## Category-B port (per test, inline)

No registry — each functional test gets a `PAGED`-aware branch asserting the paged equivalent, e.g.:
```js
t('open .html imports headings/bold/list …', () => {
  // … import …
  const hasBold = /* assert the doc-model bold mark (mode-agnostic), not rendered DOM */;
  return hasBold ? true : 'bold mark lost';
});
```
