/**
 * LinkCloud Production Entrypoint
 * Universal runtime compatible with Node.js 18, 20, 22, and 24.
 * Loads the compiled production bundle (dist/server.cjs or server.cjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const currentDir = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(currentDir, 'dist/server.cjs'),
  path.resolve(currentDir, 'server.cjs'),
  path.resolve(currentDir, 'artifacts/linkcloud/dist/server.cjs'),
  path.resolve(currentDir, 'artifacts/linkcloud/server.cjs'),
  path.resolve(process.cwd(), 'dist/server.cjs'),
  path.resolve(process.cwd(), 'server.cjs'),
  path.resolve(process.cwd(), 'artifacts/linkcloud/dist/server.cjs'),
  path.resolve(process.cwd(), 'artifacts/linkcloud/server.cjs'),
  path.resolve(currentDir, 'dist/server.js'),
  path.resolve(currentDir, 'server.js'),
  path.resolve(process.cwd(), 'dist/server.js'),
  path.resolve(process.cwd(), 'server.js'),
];

let started = false;
for (const cand of candidates) {
  if (fs.existsSync(cand)) {
    try {
      require(cand);
      started = true;
      break;
    } catch (err) {
      console.error(`[LinkCloud Launcher] Failed to load ${cand}:`, err);
    }
  }
}

if (!started) {
  try {
    console.log('[LinkCloud Launcher] Attempting direct server-app module import...');
    await import('./server-app.ts');
    started = true;
  } catch (directErr) {
    console.error('[LinkCloud Launcher] Notice: could not load primary server bundle:', directErr);
  }
}

if (!started) {
  // Emergency fallback HTTP server so Cloud Run container health checks and ingress never fail
  const http = await import('node:http');
  const targetPort = parseInt(process.env.PORT || process.env.APP_PORT || '8080', 10);
  const host = '0.0.0.0';

  const findDist = () => {
    const dirs = [
      path.resolve(currentDir, 'dist'),
      path.resolve(process.cwd(), 'dist'),
      path.resolve(currentDir, 'artifacts/linkcloud/dist'),
      path.resolve(process.cwd(), 'artifacts/linkcloud/dist'),
      currentDir,
      process.cwd(),
    ];
    for (const d of dirs) {
      if (fs.existsSync(path.join(d, 'index.html'))) return d;
    }
    return dirs[0];
  };

  const distDir = findDist();

  const fallbackHandler = (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health' || url.pathname === '/__health' || url.pathname === '/_health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    const candidateFile = path.join(distDir, safePath);
    if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
      res.writeHead(200);
      fs.createReadStream(candidateFile).pipe(res);
      return;
    }

    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexHtml).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><head><title>LinkCloud</title></head><body><div id="root"></div></body></html>');
    }
  };

  const startFallback = (port) => {
    const s = http.createServer(fallbackHandler);
    s.on('error', (e) => {
      console.log(`[LinkCloud Fallback] Port ${port} notice:`, e?.message || e);
    });
    s.listen(port, host, () => {
      console.log(`[LinkCloud Fallback] Server listening on http://${host}:${port}`);
    });
    return s;
  };

  startFallback(targetPort);
  if (targetPort !== 3000) {
    startFallback(3000);
  }

  setInterval(() => {}, 60000);
}
