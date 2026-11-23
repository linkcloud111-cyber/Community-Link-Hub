const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright-core");

console.log("=== LINKCLOUD HEADLESS BROWSER SEO & HEAD DEDUP VERIFICATION ===");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function startDistServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      let filePath = path.join(distDir, urlPath === "/" ? "index.html" : urlPath);
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function findChromiumExecutable() {
  const candidates = [
    "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function readHeadSnapshot(page) {
  return page.evaluate(() => {
    const getAll = (selector) => Array.from(document.head.querySelectorAll(selector));
    return {
      title: document.title,
      canonicalCount: getAll('link[rel="canonical"]').length,
      canonicalHref: getAll('link[rel="canonical"]')[0]?.getAttribute("href") || "",
      robotsCount: getAll('meta[name="robots"]').length,
      robotsContent: getAll('meta[name="robots"]')[0]?.getAttribute("content") || "",
      descriptionCount: getAll('meta[name="description"]').length,
      descriptionContent: getAll('meta[name="description"]')[0]?.getAttribute("content") || "",
      ogTitleCount: getAll('meta[property="og:title"]').length,
      ogTitleContent: getAll('meta[property="og:title"]')[0]?.getAttribute("content") || "",
      ogDescCount: getAll('meta[property="og:description"]').length,
      ogDescContent: getAll('meta[property="og:description"]')[0]?.getAttribute("content") || "",
      ogImageCount: getAll('meta[property="og:image"]').length,
      ogImageContent: getAll('meta[property="og:image"]')[0]?.getAttribute("content") || "",
      globalJsonLdCount: getAll("#linkcloud-global-jsonld").length,
      legacyWebmasterJsonLdCount: getAll("#lc-webmaster-jsonld").length,
    };
  });
}

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function run() {
  const distDir = path.resolve(__dirname, "../artifacts/linkcloud/dist");
  assert(fs.existsSync(path.join(distDir, "index.html")), "dist/index.html must exist");

  const { server, port } = await startDistServer(distDir);
  const baseUrl = `http://127.0.0.1:${port}`;
  const executablePath = findChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const pageErrors = [];
  let privacyPublishedMode = false;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.route("**/api/cms/pages**", async (route) => {
      const reqUrl = new URL(route.request().url());
      const slug = reqUrl.searchParams.get("slug");
      if (slug === "privacy") {
        if (!privacyPublishedMode) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ published: false, page: null }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            published: true,
            page: {
              slug: "privacy",
              title: "Privacy Policy",
              subtitle: "Official Policy",
              description: "Published privacy overview",
              status: "published",
              publishedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              seo: {
                seoTitle: "Custom Privacy Policy Meta",
                seoDescription: "Custom Privacy Meta Desc",
                canonicalUrl: "https://linkcloud.in/legal/custom-privacy",
                ogTitle: "Custom OG Privacy",
                ogDescription: "Custom OG Desc",
                ogImage: "https://cdn.linkcloud.in/privacy.png",
                noIndex: false,
              },
              blocks: [
                { id: "s1", type: "paragraph", title: "Overview", body: "Published privacy body." },
              ],
            },
          }),
        });
        return;
      }

      if (slug === "about") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            published: true,
            page: {
              slug: "about",
              title: "About LinkCloud",
              subtitle: "Community Directory",
              description: "About description",
              status: "published",
              publishedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              seo: {
                seoTitle: "About LinkCloud Directory",
                seoDescription: "About Meta Desc",
                canonicalUrl: "/about",
                noIndex: false,
              },
              blocks: [
                { id: "s1", type: "paragraph", title: "Mission", body: "Verified communities." },
              ],
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
    });

    // 1. Homepage /
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll('link[rel="canonical"]').length === 1);
    await page.waitForTimeout(600);
    const homeHead = await readHeadSnapshot(page);
    check(
      homeHead.canonicalCount === 1 &&
        homeHead.robotsCount === 1 &&
        homeHead.descriptionCount === 1 &&
        homeHead.ogTitleCount === 1 &&
        homeHead.ogDescCount === 1 &&
        homeHead.legacyWebmasterJsonLdCount === 0 &&
        homeHead.globalJsonLdCount <= 1,
      `Browser (/): Exactly 1 canonical/robots/description/og tags and 0 legacy #lc-webmaster-jsonld`
    );

    // 2. Unpublished /privacy -> must force noindex, nofollow
    privacyPublishedMode = false;
    await page.goto(`${baseUrl}/privacy`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelector('meta[name="robots"]')?.getAttribute("content") === "noindex, nofollow"
    );
    await page.waitForTimeout(300);
    const unpubPrivacyHead = await readHeadSnapshot(page);
    check(
      unpubPrivacyHead.robotsCount === 1 &&
        unpubPrivacyHead.robotsContent === "noindex, nofollow" &&
        unpubPrivacyHead.canonicalCount === 1 &&
        unpubPrivacyHead.legacyWebmasterJsonLdCount === 0,
      `Browser (/privacy unpublished): Forces robots="noindex, nofollow" with zero duplicate tags`
    );

    // 3. Published /privacy with custom canonicalUrl, ogTitle, ogDescription, ogImage
    privacyPublishedMode = true;
    await page.goto(`${baseUrl}/privacy`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ===
        "https://linkcloud.in/legal/custom-privacy"
    );
    await page.waitForTimeout(300);
    const pubPrivacyHead = await readHeadSnapshot(page);
    check(
      pubPrivacyHead.canonicalCount === 1 &&
        pubPrivacyHead.canonicalHref === "https://linkcloud.in/legal/custom-privacy" &&
        pubPrivacyHead.ogTitleCount === 1 &&
        pubPrivacyHead.ogTitleContent === "Custom OG Privacy" &&
        pubPrivacyHead.ogDescCount === 1 &&
        pubPrivacyHead.ogDescContent === "Custom OG Desc" &&
        pubPrivacyHead.ogImageContent === "https://cdn.linkcloud.in/privacy.png" &&
        pubPrivacyHead.robotsContent === "index, follow" &&
        pubPrivacyHead.legacyWebmasterJsonLdCount === 0,
      `Browser (/privacy published): Renders custom canonicalUrl, ogTitle, ogDescription, ogImage & index,follow with zero duplicates`
    );

    // 4. Published /about
    await page.goto(`${baseUrl}/about`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.title.includes("About LinkCloud Directory"));
    await page.waitForTimeout(300);
    const aboutHead = await readHeadSnapshot(page);
    check(
      aboutHead.canonicalCount === 1 &&
        aboutHead.canonicalHref.endsWith("/about") &&
        aboutHead.robotsContent === "index, follow" &&
        aboutHead.title.includes("About LinkCloud Directory"),
      `Browser (/about published): Renders relative canonical "/about" resolved to origin with index, follow`
    );

    // 5. Private route /login -> must force noindex, nofollow
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelector('meta[name="robots"]')?.getAttribute("content") === "noindex, nofollow"
    );
    await page.waitForTimeout(300);
    const loginHead = await readHeadSnapshot(page);
    check(
      loginHead.robotsCount === 1 &&
        loginHead.robotsContent === "noindex, nofollow" &&
        loginHead.canonicalCount === 1,
      `Browser (/login): Private auth route enforces robots="noindex, nofollow"`
    );

    check(
      pageErrors.length === 0,
      `Browser Runtime: Zero uncaught pageerror exceptions (count=${pageErrors.length})`
    );
    if (pageErrors.length > 0) {
      console.error("Page errors observed:", pageErrors);
    }

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nBrowser SEO Verification Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Browser SEO test failed:", err);
  process.exit(1);
});
