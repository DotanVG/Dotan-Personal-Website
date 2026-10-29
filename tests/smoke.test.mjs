import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assetsFromHtml } from "../scripts/smoke.mjs";

const html = `<script src="/app.js?v=1&amp;x=2"></script><script src="https://third.example/analytics.js"></script>
  <link href='/app.css' rel='stylesheet'><link rel="icon" href="/favicon.png?v=2">
  <meta content="https://dotanv.vercel.app/opengraph-image?abc=1&amp;v=2" property="og:image">`;

test("asset discovery preserves queries, rebases canonical OG, excludes third parties and requires each asset kind", () => {
  const base = new URL("https://staging.example/");
  assert.deepEqual(assetsFromHtml(html, base), [
    "https://staging.example/app.js?v=1&x=2", "https://staging.example/app.css",
    "https://staging.example/favicon.png?v=2", "https://staging.example/opengraph-image?abc=1&v=2",
  ]);
  for (const tag of [/<script src="\/app[^>]*><\/script>/, /<link href='[^>]*>/, /<link rel="icon"[^>]*>/, /<meta[^>]*>/]) {
    assert.throws(() => assetsFromHtml(html.replace(tag, ""), base), /no first-party/);
  }
});

test("CLI GETs home and every asset; names failing URLs and rejects redirects", async () => {
  const seen = [];
  let broken = "";
  const server = createServer((req, res) => {
    seen.push([req.method, req.url]);
    res.writeHead(req.url === broken ? (broken === "/" ? 302 : 404) : 200, { "Content-Type": req.url === "/" ? "text/html" : "text/plain" });
    res.end(req.url === "/" ? html : "asset");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = (args, env = process.env) => promisify(execFile)(process.execPath, ["scripts/smoke.mjs", ...args], { env, timeout: 15000 });
  try {
    const result = await run([base]);
    assert.match(result.stdout, /PASS smoke: home and 4 assets/);
    assert.deepEqual(seen, [["GET", "/"], ["GET", "/app.js?v=1&x=2"], ["GET", "/app.css"], ["GET", "/favicon.png?v=2"], ["GET", "/opengraph-image?abc=1&v=2"]]);
    for (const route of ["/app.js?v=1&x=2", "/app.css", "/favicon.png?v=2", "/opengraph-image?abc=1&v=2", "/"]) {
      broken = route;
      await assert.rejects(run([base]), (error) => {
        assert.equal(error.code, 1);
        assert.ok(error.stderr.includes(`${base}${route}: expected HTTP 200, got ${route === "/" ? 302 : 404}`));
        return true;
      });
    }
    broken = "";
    assert.match((await run([], { ...process.env, SMOKE_BASE_URL: base })).stdout, /PASS smoke/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
