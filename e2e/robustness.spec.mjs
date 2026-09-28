// Navigation, lifecycle and failure handling in the production build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, openExplore, realErrors, report, shot, sleep, snap, waitFor } from "./lib.mjs";

const inExplore = (page) => page.locator("[data-explore]").count().then((n) => n > 0);

test("clean ↔ explore navigation, deep links, Back/Forward, Clean view keeps the query", { timeout: 180000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1280, height: 800 });
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    assert.equal(await inExplore(page), false, "clean is the default");

    // Hero link (was a soft Link that never switched modes).
    await page.getByRole("link", { name: /enter explore mode/i }).click();
    await page.waitForURL(/mode=explore/);
    await page.locator("[data-explore]").waitFor();
    assert.equal(await inExplore(page), true);

    await page.goBack();
    await page.waitForURL((u) => !u.search.includes("mode=explore"));
    await page.waitForFunction(() => !document.querySelector("[data-explore]"));
    await page.goForward();
    await page.locator("[data-explore]").waitFor();

    // Header toggle.
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^explore$/i }).first().click();
    await page.locator("[data-explore]").waitFor();

    // Deep link with unrelated params: Clean view drops only `mode`.
    await openExplore(page, "?utm_source=test&mode=explore");
    await page.getByRole("button", { name: /Clean view/ }).click();
    await page.waitForURL((u) => u.searchParams.get("utm_source") === "test" && !u.searchParams.has("mode"));
    await page.waitForFunction(() => !document.querySelector("[data-explore]"));

    // Contact from Explore lands on the contact section of the clean page (no form is sent).
    await openExplore(page);
    await page.getByRole("button", { name: /^Contact$/ }).click();
    await page.waitForURL(/#contact$/);
    await page.locator("#contact").waitFor();
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("blur, tab hide, and overlays release held input; pause freezes time", { timeout: 120000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1280, height: 800 });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).click();
    const keys = () => page.evaluate(() => window.__explore.input().keys);

    await page.keyboard.down("KeyW");
    await sleep(400);
    assert.deepEqual(await keys(), ["KeyW"]);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.deepEqual(await keys(), [], "blur clears held keys");
    const a = await snap(page);
    await sleep(500);
    const b = await snap(page);
    assert.ok(Math.hypot(b.player.x - a.player.x, b.player.z - a.player.z) < 0.4, "player stops after blur");
    await page.keyboard.up("KeyW");

    // Tab hidden while holding: cleared, and the simulation does not run hidden.
    await page.keyboard.down("KeyD");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.deepEqual(await keys(), [], "hide clears held keys");
    await sleep(100); // a frame already in flight may finish
    const t0 = (await snap(page)).time;
    await sleep(700);
    assert.equal((await snap(page)).time, t0, "no simulation while hidden");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.keyboard.up("KeyD");
    await sleep(300);
    assert.ok((await snap(page)).time > t0, "resumes when visible");

    // Escape pauses; the menu is a focused modal; Escape resumes.
    await page.keyboard.down("KeyW");
    await page.keyboard.press("Escape");
    const menu = page.getByRole("dialog", { name: "Paused" });
    await menu.waitFor();
    assert.deepEqual(await keys(), [], "opening the menu drops held keys");
    await page.keyboard.up("KeyW");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Resume", "focus moves into the menu");
    const t1 = (await snap(page)).time;
    await sleep(600);
    assert.equal((await snap(page)).time, t1, "paused");
    await shot(page, "20-desktop-pause-menu");
    await page.getByRole("button", { name: "Controls", exact: true }).click();
    await page.getByRole("heading", { name: "Controls" }).waitFor();
    await shot(page, "21-desktop-help");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" });
    await sleep(300);
    assert.ok((await snap(page)).time > t1, "resumed");
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("works with storage blocked and honours reduced motion", { timeout: 90000 }, async () => {
  const { browser, page, logs } = await launch({
    width: 390,
    height: 844,
    mobile: true,
    reducedMotion: "reduce",
    init: () => {
      const deny = () => {
        throw new DOMException("blocked", "SecurityError");
      };
      Object.defineProperty(window, "localStorage", { get: deny });
      Object.defineProperty(window, "sessionStorage", { get: deny });
    },
  });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).tap();
    await page.getByRole("button", { name: /Pause/ }).tap();
    await page.getByText(/Motion: reduced/).waitFor();
    // Changing a stored preference must not throw either.
    await page.locator("label", { hasText: /^off$/i }).tap();
    await page.getByRole("button", { name: "Resume" }).tap();
    assert.equal(await page.locator("[data-touch-controls]").count(), 0, "touch override respected without storage");
    assert.ok((await snap(page)).time > 0);
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("no WebGL: clear fallback with a way back to the portfolio", { timeout: 60000 }, async () => {
  const { browser, page } = await launch({
    width: 390,
    height: 844,
    mobile: true,
    init: () => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (String(type).startsWith("webgl")) return null;
        return orig.call(this, type, ...rest);
      };
    },
  });
  try {
    await page.goto(BASE + "/?mode=explore");
    await page.getByRole("alert").waitFor();
    await page.getByText("Explore needs 3D graphics").waitFor();
    await shot(page, "22-no-webgl");
    const href = await page.getByRole("link", { name: "Clean view" }).getAttribute("href");
    assert.equal(href, "/");
  } finally {
    await browser.close();
  }
});

test("GPU context loss pauses with Retry, and Retry restores the same city", { timeout: 90000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1280, height: 800 });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).click();
    const before = await snap(page);
    await page.evaluate(() => {
      const c = document.querySelector("[data-explore] canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      window.__lose = gl.getExtension("WEBGL_lose_context");
      window.__lose.loseContext();
    });
    await page.getByText("Graphics were interrupted").waitFor();
    await shot(page, "23-context-lost");
    await page.getByRole("button", { name: "Retry" }).click();
    await page.waitForFunction(() => !document.querySelector("[role=alert]"));
    await waitFor(page, (s) => s.time > before.time + 0.5, { timeout: 15000 });
    const after = await snap(page);
    assert.equal(after.counts.cars > 0, true);
    assert.ok(Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z) < 1, "same game state");
    // The lost-context warning three.js logs is expected; nothing else.
    assert.deepEqual(realErrors(logs).filter((l) => !/Context Lost|context lost|WEBGL_lose_context/i.test(l)), []);
  } finally {
    await browser.close();
  }
});

test("repeated in-page mount/unmount does not leak", { timeout: 180000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1280, height: 800 });
  const samples = [];
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const cycle = async () => {
      await page.evaluate(() => {
        history.pushState(null, "", "/?mode=explore");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForFunction(() => window.__explore?.snapshot && window.__explore.snapshot().time > 0.5, null, { timeout: 30000 });
      await page.evaluate(() => {
        history.pushState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForFunction(() => !document.querySelector("[data-explore]") && !window.__explore, null, { timeout: 15000 });
    };
    const heap = async () => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("HeapProfiler.collectGarbage");
      const { usedSize } = await cdp.send("Runtime.getHeapUsage");
      await cdp.detach();
      return usedSize;
    };
    await cycle();
    samples.push(await heap());
    for (let i = 0; i < 8; i++) {
      await cycle();
      samples.push(await heap());
    }
    report("mount-cycles", { heapBytes: samples });
    const growth = samples[samples.length - 1] - samples[1];
    assert.ok(growth < 12 * 1024 * 1024, `heap growth over 7 cycles: ${(growth / 1048576).toFixed(1)} MB`);
    assert.equal(await page.locator("canvas").count() <= 1, true, "no orphaned canvases");
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("the clean portfolio never downloads the game unless Explore is wanted", { timeout: 60000 }, async () => {
  const { browser, page } = await launch({ width: 1280, height: 800 });
  try {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await sleep(4000); // past the old idle-prefetch window
    const gameLoaded = await page.evaluate(async () => {
      const urls = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.endsWith(".js"));
      for (const u of urls) {
        const text = await (await fetch(u)).text();
        if (text.includes("Grab a car and go")) return u;
      }
      return null;
    });
    assert.equal(gameLoaded, null, "explore bundle fetched on the clean page");
    // Hovering the mode toggle signals intent and warms the bundle.
    await page.getByRole("button", { name: /^explore$/i }).first().hover();
    await page.waitForFunction(
      async () => {
        for (const e of performance.getEntriesByType("resource")) {
          if (!e.name.endsWith(".js")) continue;
          if ((await (await fetch(e.name)).text()).includes("Grab a car and go")) return true;
        }
        return false;
      },
      null,
      { timeout: 10000, polling: 500 },
    );
  } finally {
    await browser.close();
  }
});
