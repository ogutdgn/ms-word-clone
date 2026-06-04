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
    resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
    plugins: [devCspPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } },
  },
})
