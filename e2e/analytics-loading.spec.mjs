import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors } from "./lib.mjs";

test("gtag waits for load + idle and keeps pageview and contact events across loading", async () => {
  const { browser, page, logs } = await launch({ width: 390, mobile: true, reducedMotion: "reduce" });
  await page.route("**/_vercel/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("https://formspree.io/**", (route) => route.fulfill({
    contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"ok":true}',
  }));
  await page.addInitScript(() => {
    window.idleTasks = [];
    window.requestIdleCallback = (callback) => window.idleTasks.push(callback);
    window.cancelIdleCallback = (id) => { window.idleTasks[id - 1] = null; };
  });
  let requests = 0;
  let release;
  const downloaded = new Promise((resolve) => { release = resolve; });
  await page.route("https://www.googletagmanager.com/gtag/js**", async (route) => {
    requests++;
    await downloaded;
    // Exercise the Google command-queue contract without sending test telemetry.
    await route.fulfill({ contentType: "application/javascript", body: `
      window.receivedAnalytics = window.dataLayer.map(command => Array.from(command));
      const push = window.dataLayer.push.bind(window.dataLayer);
      window.dataLayer.push = function(command) {
        window.receivedAnalytics.push(Array.from(command));
        return push(command);
      };
      window.analyticsLoaded = true;
    ` });
  });
  const submit = async () => {
    const contact = page.locator("#contact");
    await contact.getByLabel("Name", { exact: true }).fill("Local test");
    await contact.getByLabel("Email", { exact: true }).fill("test@example.com");
    await contact.getByLabel("Message", { exact: true }).fill("Local test; request intercepted.");
    await contact.locator('button[type="submit"]').click();
    await contact.getByRole("status").filter({ hasText: "Message sent." }).waitFor();
  };
  try {
    await page.goto(BASE);
    await page.waitForFunction(() => typeof window.gtag === "function" && window.idleTasks.length > 0);
    assert.equal(requests, 0, "no Google loader request before idle");
    await submit();
    const early = await page.evaluate(() => window.dataLayer.map((command) => Array.from(command)));
    assert.equal(early.filter(([command]) => command === "config").length, 1, "initial pageview config queued once");
    assert.equal(early.filter(([command, name]) => command === "event" && name === "contact_form_submit_success").length, 1);
    await page.evaluate(() => { for (const task of window.idleTasks.splice(0)) task?.({ didTimeout: false, timeRemaining: () => 50 }); });
    await page.waitForFunction(() => document.querySelector('script[src*="googletagmanager.com/gtag/js"]'));
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js"]').getAttribute("data-nscript"), "lazyOnload");
    release();
    await page.waitForFunction(() => window.analyticsLoaded);
    await page.locator("#contact").getByRole("button", { name: /Send another/ }).click();
    await submit();
    const received = await page.evaluate(() => window.receivedAnalytics);
    assert.equal(requests, 1);
    assert.deepEqual(received.map(([command, name]) => [command, command === "js" ? "timestamp" : name]), [
      ["js", "timestamp"], ["config", "G-EFHW18YHGH"],
      ["event", "contact_form_submit_success"], ["event", "contact_form_submit_success"],
    ]);
    assert.deepEqual(realErrors(logs), []);
  } finally {
    release();
    await browser.close();
  }
});
