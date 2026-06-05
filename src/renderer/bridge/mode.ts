// Phase 2 boot mode (spec §4.2): PM-active by default; `electron . --legacy`
// (or ?legacy=1 under `electron-vite dev`) boots the classic app. Read
// synchronously at import time — main.ts flips the page before first paint.
export const legacyBoot = new URLSearchParams(window.location.search).get('legacy') === '1'
