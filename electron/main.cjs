const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');

// Write a log file to the user's temp directory for debugging
const logPath = path.join(os.tmpdir(), 'pdf-drawing-viewer.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logPath, line); } catch (_) {}
  console.log(msg);
}

log('App starting...');
log(`Electron version: ${process.versions.electron}`);
log(`App path: ${app ? app.getAppPath() : 'N/A'}`);
log(`Platform: ${process.platform} ${process.arch}`);
log(`Temp dir: ${os.tmpdir()}`);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

function startServer(staticDir, callback) {
  log(`Starting HTTP server, serving from: ${staticDir}`);

  if (!fs.existsSync(staticDir)) {
    log(`ERROR: staticDir does not exist: ${staticDir}`);
    // List what IS there
    const parent = path.dirname(staticDir);
    if (fs.existsSync(parent)) {
      log(`Contents of ${parent}: ${fs.readdirSync(parent).join(', ')}`);
    }
  }

  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = path.join(staticDir, urlPath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(staticDir, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexData);
          }
        });
      } else {
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
      }
    });
  });

  server.on('error', (err) => {
    log(`Server error: ${err.message}`);
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    log(`HTTP server listening on port ${port}`);
    callback(port);
  });

  return server;
}

let mainServer;

function createWindow(port) {
  log(`Creating window, loading http://127.0.0.1:${port}`);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'PDF Drawing Viewer',
    show: false,
  });

  win.loadURL(`http://127.0.0.1:${port}`);

  win.once('ready-to-show', () => {
    log('Window ready, showing now');
    win.show();
  });

  win.webContents.on('did-fail-load', (event, code, desc, url) => {
    log(`Page failed to load: ${code} ${desc} ${url}`);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('ready', () => {
  log('App ready event fired');
  const staticDir = path.join(app.getAppPath(), 'dist', 'public');
  mainServer = startServer(staticDir, (port) => {
    createWindow(port);
  });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const staticDir = path.join(app.getAppPath(), 'dist', 'public');
    startServer(staticDir, (port) => createWindow(port));
  }
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (mainServer) mainServer.close();
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.stack}`);
});
