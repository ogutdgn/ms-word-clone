'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, desktopCapturer, screen, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { is } = require('@electron-toolkit/utils');

const isDev = process.argv.includes('--dev') || process.argv.includes('--enable-logging');

// Headless probe runs (test:pm / test:smoke / test:roundtrip) drive the
// renderer via executeJavaScript and immediately quit — they never need a
// visible window. Launching Electron normally activates the app and steals
// the macOS foreground, interrupting whatever the user is doing. In headless
// mode we keep the window hidden AND (on macOS) switch to the dock-less
// "accessory" activation policy so the test run is invisible and never grabs
// focus. Gated on a probe with no PNG capture (--shot needs a painted window).
const isHeadless =
  (process.argv.some((a) => a.startsWith('--probe-out=')) &&
    !process.argv.some((a) => a.startsWith('--shot='))) ||
  process.argv.includes('--headless');
if (isHeadless && process.platform === 'darwin' && app.setActivationPolicy) {
  app.setActivationPolicy('accessory');
}

let mainWindow = null;

// Frameless Electron 31 on Linux/Wayland (incl. WSLg) has no client-side
// decoration support, so a native maximize() leaves the content bounds offset
// from where the OS paints the window — clicks then miss the buttons. We avoid
// native maximize entirely and "maximize" by resizing to the display work area,
// which keeps the real frameless bounds and eliminates the click offset.
let fauxMax = false;
let preMaxBounds = null;
function toggleFauxMaximize() {
  if (!mainWindow) return false;
  if (!fauxMax) {
    preMaxBounds = mainWindow.getBounds();
    const disp = screen.getDisplayMatching(mainWindow.getBounds());
    mainWindow.setBounds(disp.workArea);
    fauxMax = true;
  } else {
    if (preMaxBounds) mainWindow.setBounds(preMaxBounds);
    fauxMax = false;
  }
  mainWindow.webContents.send('window:state', { maximized: fauxMax });
  return fauxMax;
}

// WSLg's virtual GPU often fails Chromium's GPU init (harmless software-render
// fallback, but it logs errors and can flicker). Disable hardware acceleration
// automatically under WSL so `npm start` is smooth without extra flags.
function isWSL() {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try { return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch { return false; }
}
if (isWSL() && !process.argv.includes('--enable-gpu')) {
  app.disableHardwareAcceleration();
}

// ---------------------------------------------------------------------------
// Recent files persistence
// ---------------------------------------------------------------------------
function recentFilesPath() {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

async function loadRecentFiles() {
  try {
    const raw = await fsp.readFile(recentFilesPath(), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function pushRecentFile(filePath) {
  if (!filePath) return;
  let list = await loadRecentFiles();
  list = list.filter((p) => p && p.path !== filePath);
  list.unshift({ path: filePath, name: path.basename(filePath), at: Date.now() });
  list = list.slice(0, 15);
  try {
    await fsp.writeFile(recentFilesPath(), JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    if (isDev) console.error('recent write failed', e);
  }
  if (app.addRecentDocument) app.addRecentDocument(filePath);
  return list;
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 820,
    minHeight: 560,
    show: false,
    frame: false,
    backgroundColor: '#f3f2f1',
    title: 'Word',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
      // A never-shown window (headless probe runs: test:pm/smoke/roundtrip on
      // Windows) is treated as occluded by Chromium, which SUSPENDS
      // requestAnimationFrame + throttles timers. The ribbon state-sync tick
      // (bridge/state-sync.ts) coalesces into rAF, so without this the chrome
      // (toggles/combos/latches) never updates in headless tests and the
      // pagination measurer (also rAF-driven) would never run. Disabling
      // background throttling keeps rAF/timers live in the hidden window. Safe
      // for the real app (a desktop editor that stays responsive when
      // backgrounded, like Word).
      backgroundThrottling: false,
    },
  });

  // No native menu bar — Word uses the ribbon, and the renderer owns all
  // keyboard shortcuts. A null menu avoids a stray menu bar on the frameless
  // Linux window. (buildHiddenMenu remains available if OS accelerators are
  // ever wanted, but is intentionally not installed.)
  Menu.setApplicationMenu(null);

  // Allow microphone for Dictate (Web Speech). Local trusted app only.
  mainWindow.webContents.session.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media' || perm === 'audioCapture' || perm === 'microphone'));
  mainWindow.webContents.session.setPermissionCheckHandler(() => true);

  // PM is the only boot mode (slice 11: --legacy retired).
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    const winArg = process.argv.find((a) => a.startsWith('--win='));
    if (winArg) { const [w, h] = winArg.split('=')[1].split('x').map(Number); if (w && h) mainWindow.setSize(w, h); }
    if (process.argv.includes('--start-maximized')) toggleFauxMaximize();
    if (!isHeadless) {
      mainWindow.show();
    } else if (process.platform === 'win32') {
      // Headless probe runs (test:pm/smoke/roundtrip) must still PAINT so that
      // requestAnimationFrame runs at full speed. On Windows a never-shown
      // window is treated as occluded and Chromium throttles rAF to ~2fps,
      // starving the rAF-coalesced ribbon state-sync (bridge/state-sync.ts) and
      // the pagination measurer — so chrome assertions miss their ~150ms wait
      // windows (probe-confirmed: bold toggle lights at 1150ms, not 150ms).
      // Show it fully transparent + inactive: rAF runs at 60fps, the window
      // never steals focus, and nothing is visible to the user.
      // WIN32 ONLY: setOpacity is a documented no-op on Linux (Electron docs), so
      // showInactive there would pop an OPAQUE window during headless/CI runs.
      // macOS uses the dock-less accessory policy above; Linux keeps the never-shown
      // path (xvfb/CI hide it anyway).
      mainWindow.setOpacity(0);
      mainWindow.showInactive();
    }
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
    maybeScreenshot();
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

// Debug/verification: `electron . --shot=/path/img.png [--shot-delay=ms] [--shot-eval="js"]`
// captures the rendered window to a PNG and quits. Used for visual QA.
function maybeScreenshot() {
  const shotArg = process.argv.find((a) => a.startsWith('--shot='));
  const probeOutArg = process.argv.find((a) => a.startsWith('--probe-out='));
  if (!shotArg && !probeOutArg) return;
  const out = shotArg ? shotArg.split('=')[1] : null;
  const probeOut = probeOutArg ? probeOutArg.slice('--probe-out='.length) : null;
  const delayArg = process.argv.find((a) => a.startsWith('--shot-delay='));
  const delay = delayArg ? parseInt(delayArg.split('=')[1], 10) : 1200;
  const evalArg = process.argv.find((a) => a.startsWith('--shot-eval='));
  const evalFileArg = process.argv.find((a) => a.startsWith('--shot-evalfile='));
  setTimeout(async () => {
    try {
      let js = evalArg ? evalArg.slice('--shot-eval='.length) : null;
      if (evalFileArg) js = require('fs').readFileSync(evalFileArg.slice('--shot-evalfile='.length), 'utf8');
      let result;
      if (js) { result = await mainWindow.webContents.executeJavaScript(js); await new Promise((r) => setTimeout(r, 600)); }
      // Cross-platform: ensure the output directory exists. On Windows the gate paths
      // resolve to e.g. C:\tmp\wc-pm.json, which may not exist yet — create it.
      if (probeOut) { await fsp.mkdir(require('path').dirname(probeOut), { recursive: true }).catch(() => {}); await fsp.writeFile(probeOut, typeof result === 'string' ? result : JSON.stringify(result, null, 2)); console.log('PROBE_SAVED ' + probeOut); }
      if (out) { await fsp.mkdir(require('path').dirname(out), { recursive: true }).catch(() => {}); const img = await mainWindow.webContents.capturePage(); await fsp.writeFile(out, img.toPNG()); console.log('SHOT_SAVED ' + out); }
    } catch (e) { console.error('PROBE_FAIL', e); }
    app.quit();
  }, delay);
}

// Hidden menu: provides accelerators that the renderer listens for, plus the
// editing roles so native clipboard shortcuts behave normally.
function buildHiddenMenu() {
  const acc = (label, accelerator, action) => ({
    label,
    accelerator,
    click: () => send('menu:action', action),
    visible: false,
  });
  const template = [
    {
      label: 'File',
      submenu: [
        acc('New', 'CmdOrCtrl+N', 'file.new'),
        acc('Open', 'CmdOrCtrl+O', 'file.open'),
        acc('Save', 'CmdOrCtrl+S', 'file.save'),
        acc('Save As', 'CmdOrCtrl+Shift+S', 'file.saveAs'),
        acc('Print', 'CmdOrCtrl+P', 'file.print'),
        { role: 'quit', visible: false },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
        acc('Find', 'CmdOrCtrl+F', 'edit.find'),
        acc('Replace', 'CmdOrCtrl+H', 'edit.replace'),
      ],
    },
    {
      label: 'View',
      submenu: [
        acc('Zoom In', 'CmdOrCtrl+=', 'view.zoomIn'),
        acc('Zoom Out', 'CmdOrCtrl+-', 'view.zoomOut'),
        acc('Reset Zoom', 'CmdOrCtrl+0', 'view.zoomReset'),
        { role: 'toggleDevTools' },
        { role: 'reload' },
      ],
    },
  ];
  // Make whole submenus invisible but keep accelerators active.
  return Menu.buildFromTemplate(template);
}

// ---------------------------------------------------------------------------
// IPC: window controls
// ---------------------------------------------------------------------------
ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:toggleMaximize', () => toggleFauxMaximize());
ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:isMaximized', () => fauxMax);

// ---------------------------------------------------------------------------
// IPC: recent files
// ---------------------------------------------------------------------------
ipcMain.handle('recent:list', () => loadRecentFiles());
ipcMain.handle('recent:clear', async () => {
  try { await fsp.writeFile(recentFilesPath(), '[]', 'utf8'); } catch {}
  return [];
});

// Home › Font name — enumerate the OS-installed font families so the dropdown reflects the real system
// (replaces the hardcoded 17-font renderer list). Windows: System.Drawing.FontFamily via PowerShell (always
// present, clean family names). mac/Linux: scan the standard font dirs (best-effort). Renderer caches the result
// and falls back to its built-in list if this returns nothing.
let _fontCache = null; // the font list is static for a session — enumerate once, cache the success
ipcMain.handle('fonts:list', async () => {
  if (_fontCache) return _fontCache;
  try {
    let names = [];
    if (process.platform === 'win32') {
      // ASYNC execFile (not execSync) so the main process is never blocked while PowerShell runs.
      const { execFile } = require('child_process');
      const out = await new Promise((resolve, reject) => {
        execFile('powershell',
          ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.Drawing; [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }'],
          { timeout: 6000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
          (err, stdout) => (err ? reject(err) : resolve(stdout)));
      });
      names = String(out).split(/\r?\n/);
    } else {
      const os = require('os');
      const dirs = process.platform === 'darwin'
        ? ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts')]
        : ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts')];
      for (const d of dirs) {
        try { for (const f of fs.readdirSync(d)) { if (/\.(ttf|otf|ttc)$/i.test(f)) names.push(f.replace(/\.[^.]+$/, '')); } } catch {}
      }
    }
    const fonts = Array.from(new Set(names.map((s) => String(s).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const res = { ok: fonts.length > 0, fonts };
    if (res.ok) _fontCache = res; // cache only a successful enumeration (a transient failure can be retried)
    return res;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), fonts: [] };
  }
});

// ---------------------------------------------------------------------------
// IPC: open document
// ---------------------------------------------------------------------------
async function openPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') {
    // The legacy mammoth importer is gone (slice 11). Real .docx opens go through the
    // PM engine's byte channel (doc:openBytes → fork super-converter). This text path
    // only serves the csv/txt/html data-source readers below.
    return { ok: false, error: 'Open .docx via the PM document path (doc:openBytes), not this text reader.' };
  }
  if (ext === '.html' || ext === '.htm') {
    const html = await fsp.readFile(filePath, 'utf8');
    await pushRecentFile(filePath);
    return { ok: true, html, path: filePath, name: path.basename(filePath), format: 'html' };
  }
  if (ext === '.csv' || ext === '.tsv') {
    // Data source (mail merge): return the RAW text so the renderer can parse it
    // RFC-4180-aware. Do NOT round-trip through HTML — that corrupts & < > etc.
    const csv = await fsp.readFile(filePath, 'utf8');
    await pushRecentFile(filePath);
    return { ok: true, csv, path: filePath, name: path.basename(filePath), format: 'csv' };
  }
  if (ext === '.txt' || ext === '.md' || ext === '.rtf') {
    let text = await fsp.readFile(filePath, 'utf8');
    if (ext === '.rtf') {
      // Minimal RTF strip — full RTF parsing is documented as not implemented.
      text = text.replace(/\\par[d]?/g, '\n').replace(/\{\\[^}]*\}/g, '').replace(/\\[a-z]+-?\d* ?/g, '').replace(/[{}]/g, '');
    }
    const html = text
      .split(/\r?\n/)
      .map((l) => `<p>${escapeHtml(l) || '<br>'}</p>`)
      .join('');
    await pushRecentFile(filePath);
    return { ok: true, html, path: filePath, name: path.basename(filePath), format: 'text' };
  }
  return { ok: false, error: `Unsupported file type: ${ext}` };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

ipcMain.handle('doc:open', async (_evt, presetPath) => {
  try {
    let filePath = presetPath;
    if (!filePath) {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open',
        properties: ['openFile'],
        filters: [
          { name: 'Word Documents', extensions: ['docx'] },
          { name: 'Web Page', extensions: ['html', 'htm'] },
          { name: 'Text/Rich Text', extensions: ['txt', 'rtf', 'md'] },
          { name: 'Data Source (CSV/TSV)', extensions: ['csv', 'tsv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
      filePath = res.filePaths[0];
    }
    return await openPath(filePath);
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// ---------------------------------------------------------------------------
// IPC: Phase 2 PM file-io channels — bytes + text writers and the Save As
// dialog half; serialization stays renderer-side (renderer-side .docx
// converter + html/txt serializers).
// ---------------------------------------------------------------------------
ipcMain.handle('doc:saveBytes', async (_evt, { filePath, bytes }) => {
  try {
    if (!filePath) return { ok: false, error: 'No path' };
    const buf = Buffer.from(bytes);
    if (!buf.length) return { ok: false, error: 'Empty document data (export failed?)' }; // never truncate a real file
    await fsp.writeFile(filePath, buf);
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

ipcMain.handle('doc:openBytes', async (_evt, presetPath) => {
  try {
    let filePath = presetPath;
    if (!filePath) {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Open',
        properties: ['openFile'],
        filters: [
          { name: 'All Supported', extensions: ['docx', 'html', 'htm', 'txt', 'csv', 'tsv'] },
          { name: 'Word Documents', extensions: ['docx'] },
          { name: 'Web Page', extensions: ['html', 'htm'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'Data Source (CSV/TSV)', extensions: ['csv', 'tsv'] },
        ], // slice 7: the PM engine imports html/txt/csv renderer-side (bytes stay raw here)
      });
      if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
      filePath = res.filePaths[0];
    }
    const buf = await fsp.readFile(filePath);
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath), bytes: buf };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

// slice 7: dumb utf8 writer for PM html/txt saves — serialization lives renderer-side (§5.3).
ipcMain.handle('doc:saveTextFile', async (_evt, { filePath, content }) => {
  try {
    if (!filePath) return { ok: false, error: 'No path' };
    if (typeof content !== 'string') return { ok: false, error: 'No content' };
    await fsp.writeFile(filePath, content, 'utf8');
    await pushRecentFile(filePath);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

// slice 7: dialog-only half of the two-phase PM Save As (renderer exports per chosen ext).
ipcMain.handle('doc:askSavePath', async (_evt, { suggestedName }) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save As',
      defaultPath: suggestedName || 'Document1.docx',
      filters: [
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'Web Page', extensions: ['html'] },
        { name: 'Plain Text', extensions: ['txt'] },
      ],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    let filePath = res.filePath;
    let ext = path.extname(filePath).replace('.', '').toLowerCase();
    if (ext === 'htm') ext = 'html'; // canonical contract: the renderer's format switch keys on 'html'
    // Word always appends the chosen type's extension — an extensionless typed name gets .docx
    // (otherwise Files.open would later refuse the very file we created).
    if (!ext) {
      ext = 'docx'; filePath += '.docx';
      // GTK-only edge: the dialog's overwrite prompt covered the extensionless name, not the
      // appended one (macOS/Windows append before their own prompt — this can't fire there).
      if (fs.existsSync(filePath)) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning', buttons: ['Replace', 'Cancel'], defaultId: 1,
          message: `"${path.basename(filePath)}" already exists. Do you want to replace it?`,
        });
        if (response !== 0) return { ok: false, canceled: true };
      }
    }
    return { ok: true, filePath, ext };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

// ---------------------------------------------------------------------------
// IPC: export PDF + print
// ---------------------------------------------------------------------------
ipcMain.handle('doc:exportPdf', async (_evt, { suggestedName }) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export to PDF',
      defaultPath: (suggestedName || 'Document1').replace(/\.[^.]+$/, '') + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: { marginType: 'none' },
    });
    await fsp.writeFile(res.filePath, data);
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle('doc:print', async () => {
  return new Promise((resolve) => {
    try {
      mainWindow.webContents.print({ printBackground: true }, (success, failureReason) => {
        resolve({ ok: success, error: success ? undefined : failureReason });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
});

// Generic helper: read a file the renderer points at (e.g. image insert)
ipcMain.handle('fs:readImage', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Insert Picture',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  const p = res.filePaths[0];
  const buf = await fsp.readFile(p);
  const ext = path.extname(p).replace('.', '').toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}`, name: path.basename(p) };
});

ipcMain.handle('shell:openExternal', (_evt, url) => {
  if (/^https?:/i.test(url)) shell.openExternal(url);
});

// Screen clipping: minimise our window, grab the primary screen, restore.
ipcMain.handle('insert:screenshot', async () => {
  try {
    const wasVisible = mainWindow.isVisible();
    mainWindow.minimize();
    await new Promise((r) => setTimeout(r, 450));
    const { width, height } = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    if (wasVisible) mainWindow.restore();
    const src = sources[0];
    if (!src) return { ok: false, error: 'No screen source' };
    return { ok: true, dataUrl: src.thumbnail.toDataURL() };
  } catch (e) {
    if (mainWindow) mainWindow.restore();
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// ---------------------------------------------------------------------------
// IPC: Slice 4 clipboard — reads/writes via the clipboard module; cut/copy/paste
// triggers via webContents edit methods → native DOM events in the renderer.
// NOTE: webContents.paste() is FIRE-AND-FORGET — the renderer paste lands async;
// callers poll the document, never assume completion on invoke-resolve.
// ---------------------------------------------------------------------------
ipcMain.handle('clipboard:flavors', () => {
  const formats = clipboard.availableFormats();
  return {
    formats,
    hasText: formats.includes('text/plain'),
    hasHtml: formats.includes('text/html'),
    hasImage: formats.some((f) => f.startsWith('image/')) || !clipboard.readImage().isEmpty(),
  };
});
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:readHTML', () => clipboard.readHTML());
ipcMain.handle('clipboard:readImage', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  const { width, height } = img.getSize();
  return { dataUrl: img.toDataURL(), width, height };
});
ipcMain.handle('clipboard:writeText', (_evt, text) => clipboard.writeText(String(text ?? '')));
ipcMain.handle('clipboard:writeHTML', (_evt, html) => {
  const s = String(html ?? '');
  const text = s.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  clipboard.write({ html: s, text });
});
ipcMain.handle('clipboard:writeImage', (_evt, dataUrl) => {
  const s = String(dataUrl ?? '');
  if (!s.startsWith('data:')) return; // invalid: no-op, don't touch the clipboard
  clipboard.writeImage(nativeImage.createFromDataURL(s));
});
ipcMain.handle('clipboard:cut', () => mainWindow && mainWindow.webContents.cut());
ipcMain.handle('clipboard:copy', () => mainWindow && mainWindow.webContents.copy());
ipcMain.handle('clipboard:paste', () => mainWindow && mainWindow.webContents.paste());

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
