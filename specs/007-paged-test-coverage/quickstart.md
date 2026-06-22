# Quickstart: verify the paged test-coverage port

## Overlay gate (must stay 475)
```bash
WC_LAYOUT=overlay npm run build
npm run test:pm        # → 475 pass / 0 fail (byte-unchanged overlay behaviour)
```

## Paged gate (genuine paged — fresh profile)
```bash
npm run build          # paged default
npm run test:pm:paged  # fresh --user-data-dir → boots paged; → 0 hard fails, mode=paged
# inspect the skips (auditable):
node -e "const j=require('C:/tmp/wc-pm-paged.json');const s=j.results.filter(r=>/paged-skip/.test(r.detail||''));console.log('skips:',s.length);s.slice(0,5).forEach(r=>console.log(' ',r.name,'|',r.detail))"
```
Expected: `summary.fail === 0`; the GATE MODE row reads `mode=paged`; ≈62 rows carry `⊘ paged-skip
(overlay-only): … — paged covered by <probe>`; every Category-B test (`[7]`/`[8]`/`[0a]`/`[11]`) genuinely
passes (not skipped).

## Unaffected gates
```bash
npm run build && npm run test:smoke     # 9
npm run build && npm run test:roundtrip # 27
npm run build && npm run test:bundle    # 4
```

## Manual fallback (genuine paged without the npm convenience)
```bash
rm -rf /c/tmp/wc-paged-test
npx electron --user-data-dir=C:/tmp/wc-paged-test --disable-http-cache . \
  --probe-out=C:/tmp/wc-pm-paged.json --shot-evalfile=scripts/test-suite-pm.js
```
