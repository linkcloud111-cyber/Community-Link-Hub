import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  handleAdminUserStatusRequest,
  handleAdminUserDeleteRequest,
  handleAdminStatsRequest,
  handleAdminMigrationDryRunRequest,
  handleAdminCleanupUnverifiedRequest,
  handleAdminSettingsGetRequest,
  handleAdminSettingsUpdateRequest,
  handleAnnouncementsGetRequest,
  handleAdminAnnouncementsListRequest,
  handleAdminAnnouncementCreateRequest,
  handleAdminAnnouncementUpdateRequest,
  handleAdminAnnouncementDeleteRequest,
} from './artifacts/linkcloud/src/server/admin-api.ts';

import {
  handleDevEmailChangeRequest,
  handleDevEmailChangeResend,
  handleDevEmailChangeVerify,
  handleDevEmailChangeSessionRefresh,
  handleDevEmailChangeCancel,
} from './artifacts/linkcloud/src/server/dev-email-change.ts';

import {
  handleAuthProvisionUser,
  handleAuthProvisionGoogleUser,
  handleAuthProvisionPhoneUser,
  handleAuthCheckRegistration,
} from './artifacts/linkcloud/src/server/auth-api.ts';

function getDirname(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
}
const serverDir = getDirname();

const nginxPort = parseInt(process.env.NGINX_PORT || '0', 10);
const defaultAppPort = parseInt(process.env.DEFAULT_APP_PORT || '3000', 10);
const envPort = parseInt(process.env.PORT || process.env.APP_PORT || '0', 10);

// In AI Studio / Cloud Run container architecture:
// Nginx is the edge proxy listening on NGINX_PORT (8080) and proxying all traffic to DEFAULT_APP_PORT (3000).
// Therefore, whenever NGINX is present or DEFAULT_APP_PORT is defined, Node MUST bind to DEFAULT_APP_PORT (3000).
// If running in a standalone environment without Nginx proxy, Node binds to PORT (e.g. 8080).
const isBehindNginx = nginxPort > 0 || Boolean(process.env.DEFAULT_APP_PORT);
const PRIMARY_PORT = isBehindNginx ? defaultAppPort : (envPort > 0 ? envPort : defaultAppPort);
const HOST = '0.0.0.0';

// Determine dist directory location
const possibleDistDirs = [
  path.resolve(serverDir, 'dist'),
  path.resolve(process.cwd(), 'dist'),
  path.resolve(serverDir, 'artifacts/linkcloud/dist'),
  path.resolve(process.cwd(), 'artifacts/linkcloud/dist'),
  serverDir,
  process.cwd(),
  '/dist',
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
  // Normalize and prevent directory traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // If not found in primary DIST_DIR, check alternative locations
  if (!fs.existsSync(filePath)) {
    const cwdDist = path.join(process.cwd(), 'dist', safePath);
    const cwdRoot = path.join(process.cwd(), safePath);
    if (fs.existsSync(cwdDist)) filePath = cwdDist;
    else if (fs.existsSync(cwdRoot)) filePath = cwdRoot;
  }

  // If path is a directory, try index.html inside it
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

async function handleRequest(req: any, res: any) {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle CORS preflight for all endpoints
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  // Health check endpoints for Cloud Run, Nginx, and container probes
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

  // API Routes
  try {
    if (pathname === '/api/announcements') {
      return handleAnnouncementsGetRequest(req, res);
    }

    if (pathname === '/api/admin/announcements') {
      if (req.method === 'GET') {
        return handleAdminAnnouncementsListRequest(req, res);
      }
      if (req.method === 'POST') {
        return handleAdminAnnouncementCreateRequest(req, res);
      }
      if (req.method === 'PUT' || req.method === 'PATCH') {
        return handleAdminAnnouncementUpdateRequest(req, res);
      }
      if (req.method === 'DELETE') {
        return handleAdminAnnouncementDeleteRequest(req, res);
      }
    }

    if (pathname === '/api/admin/settings') {
      if (req.method === 'GET') {
        return handleAdminSettingsGetRequest(req, res);
      }
      return handleAdminSettingsUpdateRequest(req, res);
    }

    if (pathname === '/api/admin/users/status') {
      return handleAdminUserStatusRequest(req, res);
    }

    if (pathname === '/api/admin/users/delete') {
      return handleAdminUserDeleteRequest(req, res);
    }

    if (pathname === '/api/admin/stats') {
      return handleAdminStatsRequest(req, res);
    }

    if (pathname === '/api/admin/migration/dry-run') {
      return handleAdminMigrationDryRunRequest(req, res);
    }

    if (pathname === '/api/admin/cleanup-unverified') {
      return handleAdminCleanupUnverifiedRequest(req, res);
    }

    if (pathname === '/api/auth/check-registration') {
      return handleAuthCheckRegistration(req, res);
    }

    if (pathname === '/api/auth/provision-user') {
      return handleAuthProvisionUser(req, res);
    }

    if (pathname === '/api/auth/provision-google-user') {
      return handleAuthProvisionGoogleUser(req, res);
    }

    if (pathname === '/api/auth/provision-phone-user') {
      return handleAuthProvisionPhoneUser(req, res);
    }

    if (pathname === '/api/email-change/request') {
      return handleDevEmailChangeRequest(req, res);
    }

    if (pathname === '/api/email-change/resend') {
      return handleDevEmailChangeResend(req, res);
    }

    if (pathname === '/api/email-change/verify') {
      return handleDevEmailChangeVerify(req, res);
    }

    if (pathname === '/api/email-change/session-refresh') {
      return handleDevEmailChangeSessionRefresh(req, res);
    }

    if (pathname === '/api/email-change/cancel') {
      return handleDevEmailChangeCancel(req, res);
    }

    // Any other /api/* route that is not matched returns 404 JSON
    if (pathname.startsWith('/api/')) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }));
      return;
    }
  } catch (err) {
    console.error(`[Server API Error] ${req.method} ${pathname}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err?.message || String(err) }));
    }
    return;
  }

  // Static files handling
  const served = serveStaticFile(pathname, res);
  if (served) {
    return;
  }

  // If path has a file extension and wasn't found in dist, return 404
  if (path.extname(pathname)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found');
    return;
  }

  // SPA fallback - serve index.html for all page routes
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
}

const server = http.createServer(handleRequest);

server.on('error', (err: any) => {
  console.log('[LinkCloud Server Primary Error]', err?.message || err);
});

server.listen(PRIMARY_PORT, HOST, () => {
  console.log(`[LinkCloud Server] Primary running on http://${HOST}:${PRIMARY_PORT}`);
  console.log(`[LinkCloud Server] Serving static files from: ${DIST_DIR}`);
});

// If running standalone (without Nginx proxy) and PRIMARY_PORT is not 3000,
// also provide dual listener on 3000 for internal proxies and health checks.
const secondaryPort = (!isBehindNginx && envPort > 0 && envPort !== 3000) ? 3000 : 0;
if (secondaryPort > 0) {
  try {
    const secondaryServer = http.createServer(handleRequest);
    secondaryServer.on('error', (err: any) => {
      console.log(`[LinkCloud Server] Port ${secondaryPort} notice: ${err?.message || err}`);
    });
    secondaryServer.listen(secondaryPort, HOST, () => {
      console.log(`[LinkCloud Server] Secondary listener active on http://${HOST}:${secondaryPort}`);
    });
  } catch (secErr: any) {
    console.log('[LinkCloud Server] Secondary port setup note:', secErr?.message || secErr);
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
