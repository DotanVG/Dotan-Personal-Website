// The decorative hero blob (three.js + HDR) must stay off the load path until the visitor interacts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors, sleep } from "./lib.mjs";

test("hero blob waits for interaction before loading three.js and the HDR", async () => {
  const { browser, page, logs } = await launch({ width: 1440, height: 900 });
  try {
    // /_vercel/* analytics scripts only exist when deployed on Vercel.
    await page.route(/\/_vercel\//, (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
    const hdr = [];
    page.on("request", (r) => r.url().endsWith(".hdr") && hdr.push(r.url()));
    await page.goto(BASE + "/", { waitUntil: "load" });
    await sleep(1500);
    assert.equal(await page.locator("canvas").count(), 0, "no WebGL canvas before interaction");
    assert.equal(hdr.length, 0, "no HDR request before interaction");

    await page.mouse.move(400, 300);
    await page.mouse.move(600, 400);
    await page.waitForSelector("canvas", { timeout: 20000 });
    await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.endsWith(".hdr")), null, { timeout: 20000 });
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});
