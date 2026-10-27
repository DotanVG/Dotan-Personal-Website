import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { BASE, OUT, report } from "./lib.mjs";
import path from "node:path";

for (const width of [390, 1440]) {
  for (const javaScriptEnabled of [false, true]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      test(`portfolio visibility: ${width}px, JS ${javaScriptEnabled}, ${reducedMotion}`, async () => {
        const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" });
        try {
          const context = await browser.newContext({
            viewport: { width, height: 900 }, javaScriptEnabled, reducedMotion,
          });
          await context.route(/googletagmanager|google-analytics|provesrc|formspree/, (route) => route.abort());
          await context.route(/\/_vercel\//, (route) => route.fulfill({ status: 204 }));
          const page = await context.newPage();
          await page.goto(BASE, { waitUntil: "load" });
          if (javaScriptEnabled) {
            await page.locator("[data-mini-dotan]").waitFor();
            const opacity = await page.locator("#contact [data-scroll-reveal]").first().evaluate((el) => getComputedStyle(el).opacity);
            assert.equal(opacity, reducedMotion === "reduce" ? "1" : "0", "offscreen reveal respects motion preference");
          }
          const results = [];
          const selectors = ["#about h2", "#about p.mt-8", "#experience h2", "#experience h3", "#experience li li", "#education h2", "#education h3", "#education li li", "#contact h2", "#contact form", '#contact a[href^="mailto:"]'];
          for (const selector of selectors) {
            const element = page.locator(selector).first();
            await element.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
            await page.waitForFunction((selector) => {
              for (let el = document.querySelector(selector); el; el = el.parentElement) {
                const style = getComputedStyle(el);
                if (Number(style.opacity) < 1 || style.visibility === "hidden" || style.display === "none") return false;
              }
              return true;
            }, selector);
            assert.ok(await element.isVisible(), selector);
            results.push(selector);
          }
          if (!javaScriptEnabled || reducedMotion === "reduce") {
            const hiddenText = await page.locator("#about p.mt-8, #experience h3, #experience p, #experience li li, #education h3, #education p, #education li li").evaluateAll((elements) => elements.filter((element) => {
              for (let el = element; el; el = el.parentElement) {
                const style = getComputedStyle(el);
                if (Number(style.opacity) < 1 || style.transform !== "none") return true;
              }
              return false;
            }).length);
            assert.equal(hiddenText, 0, "all biography and timeline text has a visible, motion-free baseline");
          }
          assert.equal(await page.locator("#contact form input[type='email']").isEnabled(), true);
          const name = `seo-${width}-js-${javaScriptEnabled}-${reducedMotion}`;
          await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
          const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
          assert.equal(schema["@graph"][0]["@id"], "https://dotanv.vercel.app/#person");
          assert.equal(schema["@graph"][1].dateModified, "2026-10-27");
          report(name, { width, javaScriptEnabled, reducedMotion, visible: results });
        } finally {
          await browser.close();
        }
      });
    }
  }
}
