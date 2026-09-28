// Mini Dotan on a phone: speech bubbles and the walk while being dragged, across
// default settings, quiet mode and system reduced motion (real CDP touch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors, sleep, touchSession } from "./lib.mjs";

async function observe(opts, init) {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true, ...opts, init });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const pet = page.locator("[data-mini-dotan] button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await sleep(7000); // idle long enough for the greeting
    const greeted = (await page.locator("[data-mini-dotan]").innerText()).includes("Hi, I’m Mini Dotan");
    await page.locator("[aria-label='Dismiss message']").click({ timeout: 500 }).catch(() => {});
    const b = await pet.boundingBox();
    const touch = await touchSession(page);
    const frames = [];
    await touch.down(1, b.x + b.width / 2, b.y + b.height / 2);
    for (let i = 1; i <= 24; i++) {
      await touch.move(1, b.x + b.width / 2 - i * 10, b.y + b.height / 2 - i * 2);
      await sleep(50);
      frames.push(
        await page.evaluate(() => {
          const s = document.querySelector("[data-mini-dotan] [class*=sprite]")?.style;
          return [Number(s?.getPropertyValue("--row") || 0), Number(s?.getPropertyValue("--col") || 0)];
        }),
      );
    }
    await touch.up(1);
    const walkRows = frames.filter(([row]) => row === 2).length; // row 2 = walking left
    const cols = new Set(frames.filter(([row]) => row === 2).map(([, col]) => col));
    return { greeted, walkRows, animated: cols.size > 1, errors: realErrors(logs) };
  } finally {
    await browser.close();
  }
}

test("default: greets after a quiet moment and walks while dragged", { timeout: 60000 }, async () => {
  const r = await observe({});
  assert.equal(r.greeted, true);
  assert.ok(r.walkRows > 15 && r.animated, `walking animation during drag (${JSON.stringify(r)})`);
  assert.deepEqual(r.errors, []);
});

test("quiet mode: no unsolicited bubbles, but still walks when you drag him", { timeout: 60000 }, async () => {
  const r = await observe({}, () => localStorage.setItem("mini-dotan-quiet", "true"));
  assert.equal(r.greeted, false, "quiet mode keeps him silent");
  assert.ok(r.walkRows > 15 && r.animated, `walks during a drag (${JSON.stringify(r)})`);
});

test("reduced motion: still speaks; dragging shows a still frame facing the way", { timeout: 60000 }, async () => {
  const r = await observe({ reducedMotion: "reduce" });
  assert.equal(r.greeted, true, "reduced motion doesn't silence him");
  assert.ok(r.walkRows > 15, `faces the drag direction (${JSON.stringify(r)})`);
  assert.equal(r.animated, false, "but doesn't cycle walking frames");
});
