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

// Core public informational pages with their crawl priority and change frequency
const PUBLIC_PAGES = [
  { path: '', priority: '1.0', changefreq: 'daily' },
  { path: 'groups', priority: '0.9', changefreq: 'hourly' },
  { path: 'about', priority: '0.7', changefreq: 'monthly' },
  { path: 'contact', priority: '0.6', changefreq: 'monthly' },
  { path: 'complaint', priority: '0.5', changefreq: 'monthly' },
  { path: 'faq', priority: '0.6', changefreq: 'weekly' },
  { path: 'help', priority: '0.6', changefreq: 'weekly' },
  { path: 'terms', priority: '0.4', changefreq: 'monthly' },
  { path: 'privacy', priority: '0.4', changefreq: 'monthly' },
  { path: 'dmca', priority: '0.4', changefreq: 'monthly' },
  { path: 'disclaimer', priority: '0.4', changefreq: 'monthly' },
];

// Active categories in the LinkCloud directory
const CATEGORIES = [
  'technology',
  'education',
  'jobs',
  'business',
  'news',
  'entertainment',
  'gaming',
  'sports',
  'shopping',
  'travel',
  'health',
  'food',
  'finance',
  'real-estate',
  'government',
  'social',
  'agriculture',
  'automobile',
  'movies',
  'music',
  'books',
  'events',
];

function generateSitemapXml() {
  const today = new Date().toISOString().split('T')[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // 1. Core and Information Pages
  for (const page of PUBLIC_PAGES) {
    const loc = page.path ? `${PRODUCTION_DOMAIN}/${page.path}` : `${PRODUCTION_DOMAIN}/`;
    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // 2. Category Pages
  for (const cat of CATEGORIES) {
    const encodedCategory = encodeURIComponent(cat);
    const loc = `${PRODUCTION_DOMAIN}/groups?category=${encodedCategory}`;
    xml += '  <url>\n';
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';
  return xml;
}

function writeSitemapToPaths() {
  const xml = generateSitemapXml();
  const rootDir = path.resolve(__dirname, '..');

  const targets = [
    path.join(rootDir, 'public', 'sitemap.xml'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'public', 'sitemap.xml'),
    path.join(rootDir, 'dist', 'sitemap.xml'),
    path.join(rootDir, 'artifacts', 'linkcloud', 'dist', 'sitemap.xml'),
  ];

  let writtenCount = 0;
  for (const target of targets) {
    try {
      const parentDir = path.dirname(target);
      if (fs.existsSync(parentDir)) {
        fs.writeFileSync(target, xml, 'utf8');
        console.log(`[Sitemap] Generated: ${path.relative(rootDir, target)}`);
        writtenCount++;
      }
    } catch (err) {
      console.warn(`[Sitemap] Could not write to ${target}:`, err.message);
    }
  }

  console.log(`[Sitemap] Completed: XML sitemap successfully generated across ${writtenCount} locations.`);
  return xml;
}

if (require.main === module) {
  writeSitemapToPaths();
}

module.exports = {
  generateSitemapXml,
  writeSitemapToPaths,
  PUBLIC_PAGES,
  CATEGORIES,
};
