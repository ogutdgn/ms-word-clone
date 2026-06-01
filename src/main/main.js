'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

// Lazy-required heavy libs (loaded on first use to keep startup fast)
let mammoth = null;
let htmlToDocx = null;

const isDev = process.argv.includes('--dev') || process.argv.includes('--enable-logging');

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
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

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    const winArg = process.argv.find((a) => a.startsWith('--win='));
    if (winArg) { const [w, h] = winArg.split('=')[1].split('x').map(Number); if (w && h) mainWindow.setSize(w, h); }
    if (process.argv.includes('--start-maximized')) toggleFauxMaximize();
    mainWindow.show();
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
      if (probeOut) { await fsp.writeFile(probeOut, typeof result === 'string' ? result : JSON.stringify(result, null, 2)); console.log('PROBE_SAVED ' + probeOut); }
      if (out) { const img = await mainWindow.webContents.capturePage(); await fsp.writeFile(out, img.toPNG()); console.log('SHOT_SAVED ' + out); }
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

// ---------------------------------------------------------------------------
// IPC: open document
// ---------------------------------------------------------------------------
async function openPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') {
    if (!mammoth) mammoth = require('mammoth');
    const styleMap = [
      "p[style-name='Title'] => h1.doc-title:fresh",
      "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "r[style-name='Strong'] => strong",
    ];
    const result = await mammoth.convertToHtml(
      { path: filePath },
      { styleMap, includeDefaultStyleMap: true, convertImage: mammoth.images.imgElement(async (image) => {
        const buf = await image.read('base64');
        return { src: `data:${image.contentType};base64,${buf}` };
      }) }
    );
    await pushRecentFile(filePath);
    return { ok: true, html: result.value, messages: result.messages, path: filePath, name: path.basename(filePath), format: 'docx' };
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
// IPC: save document
// ---------------------------------------------------------------------------
async function writeDocx(filePath, html, options, header, footer) {
  if (!htmlToDocx) htmlToDocx = require('html-to-docx');
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${flattenNestedTables(html)}</body></html>`;
  const hasHeader = !!(header && header.trim());
  const hasFooter = !!(footer && footer.trim());
  const docxOpts = Object.assign({
    table: { row: { cantSplit: true } },
    footer: hasFooter,
    header: hasHeader,
    pageNumber: false,
    font: 'Aptos',
    fontSize: 24, // half-points => 12pt (matches real Word default)
    // ALL margin keys must be integers — html-to-docx stringifies missing keys
    // as "undefined", which makes real Word reject the file (w:header="undefined").
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720, gutter: 0 },
  }, options || {});
  // header/footer go to real Word header/footer parts — never demoted to body text.
  const headerHtml = hasHeader ? `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${header}</body></html>` : null;
  const footerHtml = hasFooter ? `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${footer}</body></html>` : null;
  const buffer = await htmlToDocx(fullHtml, headerHtml, docxOpts, footerHtml);
  await fsp.writeFile(filePath, buffer);
}

// html-to-docx silently drops a <table> nested inside a <td> (deleting the cell's
// text too). Flatten any inner table to <br>-joined cell text so nothing is lost.
function flattenNestedTables(html) {
  if (!/<table/i.test(html) || !/<\/table>/i.test(html)) return html;
  let prev;
  do {
    prev = html;
    html = html.replace(/(<td\b[^>]*>)([\s\S]*?)<table\b[^>]*>([\s\S]*?)<\/table>([\s\S]*?)(<\/td>)/gi, (m, tdOpen, before, inner, after, tdClose) => {
      const text = inner.replace(/<\/(tr|td|th|p|div)>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return tdOpen + before + (text ? '<br>' + text : '') + after + tdClose;
    });
  } while (html !== prev);
  return html;
}

async function saveToPath(filePath, html, format, header, footer) {
  const ext = (format || path.extname(filePath).replace('.', '')).toLowerCase();
  if (ext === 'docx') {
    await writeDocx(filePath, html, null, header, footer);
  } else if (ext === 'html' || ext === 'htm') {
    const full = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${path.basename(filePath)}</title></head>\n<body>${html}</body></html>`;
    await fsp.writeFile(filePath, full, 'utf8');
  } else if (ext === 'txt' || ext === 'text' || ext === 'md' || ext === 'rtf') {
    // openPath() labels .txt/.md/.rtf as format 'text'; accept that (and the bare
    // extensions) so a file opened from plain text can be saved without throwing.
    const text = html.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<br\s*\/?>(?=)/gi, '\n').replace(/<[^>]+>/g, '');
    await fsp.writeFile(filePath, decodeEntities(text), 'utf8');
  } else {
    throw new Error('Unsupported save format: ' + ext);
  }
  await pushRecentFile(filePath);
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

ipcMain.handle('doc:save', async (_evt, { filePath, html, format, header, footer }) => {
  try {
    if (!filePath) return { ok: false, error: 'No path' };
    await saveToPath(filePath, html, format, header, footer);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

ipcMain.handle('doc:saveAs', async (_evt, { html, suggestedName, header, footer }) => {
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
    const ext = path.extname(res.filePath).replace('.', '').toLowerCase() || 'docx';
    await saveToPath(res.filePath, html, ext, header, footer);
    return { ok: true, path: res.filePath, name: path.basename(res.filePath), format: ext };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
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
