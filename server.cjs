const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10);
const HOST = '0.0.0.0';

const possibleDistDirs = [
  path.resolve(__dirname, 'dist'),
  path.resolve(__dirname, 'artifacts/linkcloud/dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(process.cwd(), 'artifacts/linkcloud/dist'),
  '/dist',
  __dirname,
];

let DIST_DIR = possibleDistDirs[0];
for (const dir of possibleDistDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    DIST_DIR = dir;
    break;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function serveStaticFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  if (!fs.existsSync(filePath)) {
    const cwdDist = path.join(process.cwd(), 'dist', safePath);
    const cwdRoot = path.join(process.cwd(), safePath);
    if (fs.existsSync(cwdDist)) filePath = cwdDist;
    else if (fs.existsSync(cwdRoot)) filePath = cwdRoot;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = safePath.startsWith('/assets/') || safePath.startsWith('assets/');

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    if (isImmutable) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (ext === '.html' || ext === '.htm') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (
    pathname === '/health' ||
    pathname === '/__health' ||
    pathname === '/_health' ||
    pathname === '/__aistudio_health'
  ) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    return;
  }

  // Static files handling
  const served = serveStaticFile(pathname, res);
  if (served) {
    return;
  }

  if (path.extname(pathname)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
    return;
  }

  const possibleIndexPaths = [
    path.join(DIST_DIR, 'index.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];

  let foundIndexPath = null;
  for (const p of possibleIndexPaths) {
    if (fs.existsSync(p)) {
      foundIndexPath = p;
      break;
    }
  }

  if (foundIndexPath) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(foundIndexPath).pipe(res);
  } else {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><html><head><title>LinkCloud</title></head><body><div id="root"></div></body></html>');
  }
});

server.on('error', (err) => {
  console.error('[LinkCloud Server Error]', err);
});

server.listen(PORT, HOST, () => {
  console.log(`[LinkCloud Server] Running on http://${HOST}:${PORT}`);
  console.log(`[LinkCloud Server] Serving static files from: ${DIST_DIR}`);
});

if (PORT !== 3000) {
  try {
    const secondaryServer = http.createServer((req, res) => {
      server.emit('request', req, res);
    });
    secondaryServer.on('error', (err) => {
      console.log(`[LinkCloud Server] Port 3000 secondary listener notice: ${err.message}`);
    });
    secondaryServer.listen(3000, HOST, () => {
      console.log(`[LinkCloud Server] Also listening on secondary port http://${HOST}:3000`);
    });
  } catch (secErr) {
    console.log('[LinkCloud Server] Secondary port setup note:', secErr);
  }
}

process.on('SIGTERM', () => {
  console.log('[LinkCloud Server] Received SIGTERM, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[LinkCloud Server] Received SIGINT, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
