// Mini Dotan on a phone: speech bubbles, the walk while being dragged and glances
// toward the visitor's finger, across default settings, quiet mode and system
// reduced motion (real CDP touch).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch, realErrors, sleep, touchSession } from "./lib.mjs";

const frame = (page) =>
  page.evaluate(() => {
    const s = document.querySelector("[data-mini-dotan] [class*=sprite]")?.style;
    return [Number(s?.getPropertyValue("--row") || 0), Number(s?.getPropertyValue("--col") || 0)];
  });

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
      frames.push(await frame(page));
    }
    await touch.up(1);
    const walkRows = frames.filter(([row]) => row === 2).length; // row 2 = walking left
    const cols = new Set(frames.filter(([row]) => row === 2).map(([, col]) => col));
    return { greeted, walkRows, animated: cols.size > 1, errors: realErrors(logs) };
  } finally {
    await browser.close();
  }
}

/** Tap, then hold-and-scroll, somewhere above-left of him; record what he does. */
async function glances(opts, init) {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true, ...opts, init });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.locator("[data-mini-dotan] button[aria-label='Contact Dotan']").waitFor({ timeout: 30000 });
    await sleep(1500);
    // A spot on plain page content, so the tap doesn't follow a link.
    const spot = await page.evaluate(() => {
      for (let y = 180; y < 520; y += 20)
        for (let x = 24; x < 200; x += 16) {
          const el = document.elementFromPoint(x, y);
          if (el && !el.closest("a, button, input, textarea, select, label, [role=button]")) return { x, y };
        }
      return null;
    });
    assert.ok(spot, "found a non-interactive spot to tap");
    const touch = await touchSession(page);
    const states = new Set();
    const watch = setInterval(() => {
      page.evaluate(() => document.querySelector("[data-mini-dotan]")?.dataset.state).then((s) => states.add(s), () => {});
    }, 60);

    await touch.down(1, spot.x, spot.y);
    await sleep(120);
    await touch.up(1);
    await sleep(250);
    const tap = await frame(page);
    await sleep(1000);
    const afterTap = await frame(page);

    await sleep(2700); // a fresh scroll session
    await touch.down(1, spot.x, 620);
    await sleep(120);
    const held = await frame(page);
    const poses = new Set();
    for (let i = 1; i <= 12; i++) {
      await touch.move(1, spot.x, 620 - i * 30);
      await sleep(60);
      const [row, col] = await frame(page);
      poses.add(`${row},${col}`);
    }
    await touch.up(1);
    const scrolled = await page.evaluate(() => scrollY);
    await sleep(1800);
    const afterScroll = await frame(page);
    clearInterval(watch);
    return { spot, tap, afterTap, held, poses: [...poses], scrolled, afterScroll, hopped: states.has("hopping"), errors: realErrors(logs) };
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

test("reduced motion: still speaks, and the walk follows the finger", { timeout: 60000 }, async () => {
  const r = await observe({ reducedMotion: "reduce" });
  assert.equal(r.greeted, true, "reduced motion doesn't silence him");
  assert.ok(r.walkRows > 15 && r.animated, `walks through the frames (${JSON.stringify(r)})`);
});

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`${reducedMotion}: glances at a tap and at the scrolling finger, then settles`, { timeout: 60000 }, async () => {
    const r = await glances({ reducedMotion });
    const detail = JSON.stringify(r);
    assert.ok(r.tap[0] >= 9, `looks toward the tap (${detail})`);
    assert.ok(r.afterTap[0] < 9, `and back to neutral after it (${detail})`);
    assert.ok(r.held[0] >= 9, `looks toward the finger on the page (${detail})`);
    assert.ok(r.scrolled > 100, `the gesture scrolled the page (${detail})`);
    assert.ok(r.afterScroll[0] < 9, `settles once the page stops (${detail})`);
    assert.equal(r.hopped, false, `no hop for an ordinary phone scroll (${detail})`);
    if (reducedMotion === "reduce") assert.equal(r.poses.length, 1, `reduced motion holds one glance (${detail})`);
    assert.deepEqual(r.errors, []);
  });
}
