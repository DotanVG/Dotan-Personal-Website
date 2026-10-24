import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors, sleep } from "./lib.mjs";

for (const width of [390, 1440]) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`hero stays visible through hydration: ${width}px, ${reducedMotion}`, async () => {
      const { browser, page, logs } = await launch({ width, reducedMotion });
      // Vercel injects these scripts only on hosted builds.
      await page.route("**/_vercel/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
      let release;
      const scripts = new Promise((resolve) => { release = resolve; });
      await page.route(/\/_next\/static\/.*\.js/, async (route) => {
        await scripts;
        await route.continue();
      });
      try {
        await page.goto(BASE, { waitUntil: "commit" });
        await page.locator("#top h1").waitFor();
        // Hold hydration to verify the actual server HTML, then sample every frame.
        await page.evaluate(() => {
          const heading = document.querySelector("#top h1");
          const paragraph = document.querySelector("#top p.mt-8");
          window.heroCheck = { heading, paragraph, samples: 0, failures: [] };
          const sample = () => {
            const check = window.heroCheck;
            check.samples++;
            for (const text of [heading, paragraph]) {
              if (!text.isConnected) check.failures.push("server text remounted");
              for (let el = text; el; el = el.parentElement) {
                if (Number(getComputedStyle(el).opacity) < 1) check.failures.push("transparent text or ancestor");
              }
            }
          };
          sample();
          const tick = () => { sample(); window.heroCheck.raf = requestAnimationFrame(tick); };
          tick();
        });
        release();
        await page.waitForLoadState("load");
        await page.locator("[data-mini-dotan]").waitFor();
        await sleep(1500);
        const result = await page.evaluate(() => {
          cancelAnimationFrame(window.heroCheck.raf);
          return { samples: window.heroCheck.samples, failures: [...new Set(window.heroCheck.failures)] };
        });
        assert.ok(result.samples > 10);
        assert.deepEqual(result.failures, []);
        assert.deepEqual(realErrors(logs), []);
      } finally {
        release();
        await browser.close();
      }
    });
  }
}

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`mode switches retain the enter fade, respecting ${reducedMotion}`, async () => {
    const { browser, page, logs } = await launch({ reducedMotion });
    await page.route("**/_vercel/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
    try {
      await page.goto(BASE);
      await page.locator("[data-mini-dotan]").waitFor();
      await page.evaluate(() => {
        history.pushState({}, "", "?mode=explore");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.locator("#top").waitFor({ state: "detached" });
      await page.evaluate(() => {
        window.fadeSamples = [];
        const tick = () => {
          const hero = document.querySelector("#top");
          if (hero) {
            let opacity = 1;
            for (let el = hero; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
            window.fadeSamples.push(opacity);
          }
          window.fadeRaf = requestAnimationFrame(tick);
        };
        tick();
        history.pushState({}, "", "/");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.locator("#top h1").waitFor();
      await sleep(700);
      const samples = await page.evaluate(() => { cancelAnimationFrame(window.fadeRaf); return window.fadeSamples; });
      assert.ok(samples.length > 0);
      assert.equal(samples.at(-1), 1);
      assert.equal(samples.some((opacity) => opacity < 1), reducedMotion !== "reduce");
      assert.deepEqual(realErrors(logs), []);
    } finally {
      await browser.close();
    }
  });
}
