const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

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
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const filePath = path.join(staticDir, urlPath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fall back to index.html for SPA routing
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

  server.listen(0, '127.0.0.1', () => {
    callback(server.address().port);
  });

  return server;
}

let mainServer;

function createWindow(port) {
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
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  const staticDir = path.join(app.getAppPath(), 'dist', 'public');
  mainServer = startServer(staticDir, (port) => {
    createWindow(port);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startServer(path.join(app.getAppPath(), 'dist', 'public'), (port) => createWindow(port));
    }
  });
});

app.on('window-all-closed', () => {
  if (mainServer) mainServer.close();
  if (process.platform !== 'darwin') app.quit();
});
