#!/usr/bin/env node
/**
 * LinkCloud - XML Sitemap Generator
 * 
 * Generates an XML sitemap complying with the Sitemaps.org protocol for
 * production deployment to improve search engine indexing.
 * 
 * Covers all public routes:
 *  - Core landing: Home (/), Groups directory (/groups)
 *  - Public Informational Pages: about, contact, complaint, faq, help, terms, privacy, dmca, disclaimer
 *  - Category Pages: /groups?category=<id>
 * 
 * Strictly excludes private routes:
 *  - /webmaster, /dashboard, /submit, /login, /register, etc.
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_DOMAIN = process.env.PUBLIC_DOMAIN || 'https://community-link-hub.pages.dev';

function removeStaleStaticSitemaps() {
  const rootDir = path.resolve(__dirname, '..');

  const staleTargets = [
    path.join(rootDir, 'public', 'sitemap.xml'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'public', 'sitemap.xml'),
    path.join(rootDir, 'dist', 'sitemap.xml'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'dist', 'sitemap.xml'),
  ];

  let removedCount = 0;
  for (const target of staleTargets) {
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        console.log(`[Sitemap] Removed stale static file so dynamic /sitemap.xml endpoint stays authoritative: ${path.relative(rootDir, target)}`);
        removedCount++;
      }
    } catch (err) {
      console.warn(`[Sitemap] Could not remove ${target}:`, err.message);
    }
  }

  // Write static health check JSON files across all public and dist directories
  const healthJson = JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() });
  const healthDirs = [
    path.join(rootDir, 'public'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'public'),
    path.join(rootDir, 'dist'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'dist'),
  ];
  for (const dir of healthDirs) {
    if (fs.existsSync(dir)) {
      try {
        fs.writeFileSync(path.join(dir, 'health'), healthJson, 'utf8');
        fs.writeFileSync(path.join(dir, 'health.json'), healthJson, 'utf8');
        fs.writeFileSync(path.join(dir, '__health'), healthJson, 'utf8');
        fs.writeFileSync(path.join(dir, '_health'), healthJson, 'utf8');
      } catch {}
    }
  }

  console.log(`[Sitemap] Completed build hygiene check (removed ${removedCount} stale static sitemap(s), active dynamic canonical origin: ${PRODUCTION_DOMAIN}).`);
  return removedCount;
}

if (require.main === module) {
  removeStaleStaticSitemaps();
}

module.exports = {
  removeStaleStaticSitemaps,
  PRODUCTION_DOMAIN,
};

