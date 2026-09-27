/**
 * LinkCloud Production Entrypoint
 * Universal runtime compatible with Node.js 18, 20, 22, and 24.
 * Loads the compiled production bundle (dist/server.cjs or server.cjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const candidates = [
  path.resolve(process.cwd(), 'dist/server.cjs'),
  path.resolve(process.cwd(), 'server.cjs'),
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
  console.error('[LinkCloud Launcher] Critical error: could not locate server bundle.');
  process.exit(1);
}
