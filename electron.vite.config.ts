import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'

// A strict CSP <meta> + a relaxed header intersect (most-restrictive wins), so we
// swap the meta IN DEV only. The prod build keeps the strict meta verbatim — unsafe
// directives never ship.
const DEV_CSP =
  "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self'; " +
  "connect-src 'self' ws://localhost:* http://localhost:*"

function devCspPlugin() {
  return {
    name: 'dev-csp',
    apply: 'serve' as const, // dev server only; never runs during `build`
    transformIndexHtml(html: string) {
      return html.replace(
        /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/,
        `$1${DEV_CSP}$2`,
      )
    },
  }
}

// The flattened fork contains ZERO .vue SFCs (the UI layer was excluded), yet some
// extensions still `import X from '...Vue'` for optional popover/overlay UI. We build
// the HEADLESS editing engine (main.ts imports @core/Editor.js, not the Vue barrel),
// so resolve every .vue specifier to an inert empty Vue component instead of pulling
// in @vitejs/plugin-vue and the whole UI surface. The engine never renders these.
function stubVueComponentsPlugin() {
  const STUB_ID = '\0fork-vue-stub'
  return {
    name: 'fork-vue-stub',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (source.endsWith('.vue')) return STUB_ID
      return null
    },
    load(id: string) {
      if (id === STUB_ID) {
        // Minimal valid Vue component (render returns null) — safe for createApp(stub).
        return 'export default { name: "ForkVueStub", render() { return null } }'
      }
      return null
    },
  }
}

// The vendored, FLATTENED SuperDoc fork (top-level dirs are core/, extensions/, …;
// there is NO editors/v1 segment). The 5 sibling packages live under _vendor/superdoc.
const FORK = resolve(__dirname, 'src/renderer/core/superdoc-fork')
const VENDOR = resolve(FORK, '_vendor/superdoc')

// Vite matches a string `find` when the importee equals it OR is followed by '/', so
// '@' never shadows '@core'/'@superdoc' (next char is a letter, not '/'). We still use
// the explicit { find, replacement } array form and order the most-specific first:
//   - '@superdoc/style-engine/ooxml' BEFORE '@superdoc/style-engine'
//   - '@translator' maps to a FILE (exact bare specifier, never a prefix)
const aliases = [
  // Category B — @superdoc/* → vendored editable copies (override the npm package).
  // @superdoc/common is imported BOTH bare (→ index.ts) AND with subpaths
  // (@superdoc/common/icons/*.svg, /data/blank.docx, /list-numbering, /list-rendering).
  // Regex-exact maps the bare specifier; the prefix string maps subpaths to the dir.
  { find: /^@superdoc\/common$/, replacement: resolve(VENDOR, 'common/index.ts') },
  { find: '@superdoc/common', replacement: resolve(VENDOR, 'common') },
  { find: '@superdoc/contracts', replacement: resolve(VENDOR, 'contracts/src/index.ts') },
  { find: '@superdoc/style-engine/ooxml', replacement: resolve(VENDOR, 'style-engine/src/ooxml/index.ts') },
  { find: '@superdoc/style-engine', replacement: resolve(VENDOR, 'style-engine/src/index.ts') },
  { find: '@superdoc/url-validation', replacement: resolve(VENDOR, 'url-validation/index.js') },
  { find: '@superdoc/document-api', replacement: resolve(VENDOR, 'document-api/src/index.ts') },
  { find: '@superdoc/super-editor', replacement: resolve(FORK, 'index.js') }, // SELF — fork entry

  // Category A — @-aliases → fork dirs (the flattened tree).
  { find: '@translator', replacement: resolve(FORK, 'core/super-converter/v3/node-translator/index.js') }, // FILE
  { find: '@converter', replacement: resolve(FORK, 'core/super-converter') },
  { find: '@core', replacement: resolve(FORK, 'core') },
  { find: '@extensions', replacement: resolve(FORK, 'extensions') },
  { find: '@helpers', replacement: resolve(FORK, 'core/helpers') },
  { find: '@utils', replacement: resolve(FORK, 'utils') },
  { find: '@components', replacement: resolve(FORK, 'components') },
  { find: '@tests', replacement: resolve(FORK, 'tests') },

  // App's own '@' alias (kept last; '@' only matches '@/…').
  { find: '@', replacement: resolve(__dirname, 'src/renderer') },
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()], // keep node deps (html-to-docx, mammoth, …) external
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/main.js') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/preload.js') } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: aliases,
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
      // Force a single copy of each so the vendored Editor shares the renderer's PM/Yjs/Vue.
      dedupe: [
        'prosemirror-model',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-transform',
        'prosemirror-commands',
        'prosemirror-keymap',
        'prosemirror-history',
        'prosemirror-tables',
        'prosemirror-schema-basic',
        'prosemirror-gapcursor',
        'prosemirror-dropcursor',
        'yjs',
        'y-prosemirror',
        'vue',
      ],
    },
    // Fixes the one unguarded process.env read at ProseMirrorRenderer.ts:966.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [stubVueComponentsPlugin(), devCspPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } },
  },
})
