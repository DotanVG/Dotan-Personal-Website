import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors, sleep } from "./lib.mjs";

for (const idleApi of [true, false]) {
  test(`Mini Dotan defers assets and stays interactive (${idleApi ? "idle" : "timer fallback"})`, async () => {
    const { browser, page, logs } = await launch({
      width: 390, mobile: true, reducedMotion: idleApi ? "no-preference" : "reduce",
      init: idleApi ? undefined : () => localStorage.setItem("mini-dotan-quiet", "true"),
    });
    await page.route("**/_vercel/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    await page.addInitScript((idleApi) => {
      if (!idleApi) {
        window.requestIdleCallback = undefined;
        return;
      }
      let id = 0;
      window.pendingIdle = new Map();
      window.requestIdleCallback = (callback) => { window.pendingIdle.set(++id, callback); return id; };
      window.cancelIdleCallback = (id) => window.pendingIdle.delete(id);
    }, idleApi);
    const requests = [];
    page.on("request", (request) => { if (request.url().includes("/pets/mini-dotan/")) requests.push(request.url()); });
    try {
      await page.goto(BASE);
      if (idleApi) {
        await page.waitForFunction(() => window.pendingIdle.size > 0);
        await sleep(700);
        assert.equal(await page.locator("[data-mini-dotan]").count(), 0);
        assert.deepEqual(requests, [], "no atlas or strip requests before idle");
        await page.evaluate(() => {
          history.pushState({}, "", "?mode=explore");
          dispatchEvent(new PopStateEvent("popstate"));
        });
        await page.waitForFunction(() => window.pendingIdle.size === 0);
        assert.deepEqual(requests, [], "unmount cancels pending initialization");
        await page.evaluate(() => {
          history.pushState({}, "", "/");
          dispatchEvent(new PopStateEvent("popstate"));
        });
        await page.waitForFunction(() => window.pendingIdle.size > 0);
        await page.evaluate(() => {
          for (const callback of window.pendingIdle.values()) callback({ didTimeout: false, timeRemaining: () => 50 });
          window.pendingIdle.clear();
        });
      }
      const dock = page.locator("[data-mini-dotan]");
      await dock.waitFor();
      await page.waitForFunction(() => {
        const dock = document.querySelector("[data-mini-dotan]");
        return dock?.dataset.state === "idle" && !dock.dataset.arriving;
      });
      const atlas = await page.evaluate(async () => {
        const image = new Image();
        image.src = "/pets/mini-dotan/spritesheet.webp";
        await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight };
      });
      assert.deepEqual(atlas, { width: 1536, height: 2288 });
      await dock.getByRole("button", { name: "Mini Dotan settings" }).click();
      await dock.getByRole("button", { name: "Hide Mini Dotan" }).click();
      assert.equal(await dock.getAttribute("data-state"), "hidden");
      await dock.getByRole("button", { name: "Show Mini Dotan" }).click();
      await page.waitForFunction(() => document.querySelector("[data-mini-dotan]")?.dataset.state !== "hidden");
      const timing = await page.evaluate(() => {
        const loadEnd = performance.getEntriesByType("navigation")[0].loadEventEnd;
        return performance.getEntriesByType("resource").filter((r) => r.name.includes("/pets/mini-dotan/")).map((r) => r.startTime >= loadEnd);
      });
      assert.ok(timing.length > 0 && timing.every(Boolean), "assets start after page load");
      assert.deepEqual(realErrors(logs), []);
    } finally {
      await browser.close();
    }
  });
}
