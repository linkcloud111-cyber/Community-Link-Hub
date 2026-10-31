const http = require('http');

console.log("=== TELEMETRY BEHAVIORAL INTEGRATION TEST SUITE ===");

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message || err);
      failed++;
    }
  }

  // 1. Visitor Hit: Method Enforcement
  await assertTest("Visitor Hit: Rejects GET with 405 Method Not Allowed", async () => {
    const res = await makeRequest("/api/telemetry/visitor-hit", "GET");
    if (res.status !== 405) throw new Error(`Expected 405, got ${res.status}`);
  });

  // 2. Visitor Hit: Valid POST Ingestion
  await assertTest("Visitor Hit: Accepts POST and records hit safely", async () => {
    const res = await makeRequest("/api/telemetry/visitor-hit", "POST", {});
    if (res.status !== 200 && res.status !== 204) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body?.error) throw new Error(`Unexpected error: ${res.body.error}`);
  });

  // 3. Search Query: Method Enforcement
  await assertTest("Search Query: Rejects GET with 405 Method Not Allowed", async () => {
    const res = await makeRequest("/api/telemetry/search-query", "GET");
    if (res.status !== 405) throw new Error(`Expected 405, got ${res.status}`);
  });

  // 4. Search Query: Input Validation - Too Short
  await assertTest("Search Query: Rejects keyword under 2 chars with 400 Bad Request", async () => {
    const res = await makeRequest("/api/telemetry/search-query", "POST", { keyword: "a" });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 5. Search Query: Input Validation - Script Injection
  await assertTest("Search Query: Rejects keyword with only invalid script symbols", async () => {
    const res = await makeRequest("/api/telemetry/search-query", "POST", { keyword: "<script>" });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 6. Search Query: Valid Ingestion
  await assertTest("Search Query: Accepts valid search query with sanitized payload", async () => {
    const res = await makeRequest("/api/telemetry/search-query", "POST", {
      keyword: "python community",
      category: "Tech",
      platform: "WhatsApp"
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.success) throw new Error(`Expected success: true, got ${JSON.stringify(res.body)}`);
  });

  // 7. Search Query: Hindi / Indic Unicode Script Support
  await assertTest("Search Query: Accepts valid Hindi / Indic Unicode search query", async () => {
    const res = await makeRequest("/api/telemetry/search-query", "POST", {
      keyword: "यूपीएससी तैयारी",
      category: "Education",
      platform: "Telegram"
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status} (body: ${JSON.stringify(res.body)})`);
    if (!res.body?.success) throw new Error(`Expected success: true, got ${JSON.stringify(res.body)}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
