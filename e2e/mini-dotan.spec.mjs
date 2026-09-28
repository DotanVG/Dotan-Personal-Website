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
  let watch;
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
    watch = setInterval(() => {
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
    clearInterval(watch);
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

test("no-preference: a tap gets a glance, a scroll gets a hop", { timeout: 60000 }, async () => {
  const r = await glances({});
  const detail = JSON.stringify(r);
  assert.ok(r.tap[0] >= 9, `looks toward the tap (${detail})`);
  assert.ok(r.afterTap[0] < 9, `and back to neutral after it (${detail})`);
  assert.ok(r.held[0] < 9, `pressing alone isn't a tap yet: no glance (${detail})`);
  assert.ok(r.scrolled > 100, `the gesture scrolled the page (${detail})`);
  assert.equal(r.hopped, true, `the scroll made him hop (${detail})`);
  assert.ok(r.afterScroll[0] < 9, `settles once the page stops (${detail})`);
  assert.deepEqual(r.errors, []);
});

test("reduce: a tap gets a glance; a scroll, which can't hop, gets one held glance", { timeout: 60000 }, async () => {
  const r = await glances({ reducedMotion: "reduce" });
  const detail = JSON.stringify(r);
  assert.ok(r.tap[0] >= 9, `looks toward the tap (${detail})`);
  assert.ok(r.afterTap[0] < 9, `and back to neutral after it (${detail})`);
  assert.ok(r.held[0] < 9, `pressing alone isn't a tap yet: no glance (${detail})`);
  assert.equal(r.poses.length, 1, `one glance, held while scrolling (${detail})`);
  assert.ok(Number(r.poses[0].split(",")[0]) >= 9, `toward the finger (${detail})`);
  assert.equal(r.hopped, false, `no hop under reduced motion (${detail})`);
  assert.ok(r.afterScroll[0] < 9, `settles once the page stops (${detail})`);
  assert.deepEqual(r.errors, []);
});

test("a swipe that starts on an in-page link still hops; tapping the link doesn't", { timeout: 60000 }, async () => {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true });
  let watch;
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const dock = page.locator("[data-mini-dotan]");
    await dock.locator("button[aria-label='Contact Dotan']").waitFor({ timeout: 30000 });
    await sleep(1500);
    const link = page.getByRole("link", { name: /get in touch/i }).first();
    const l = await link.boundingBox();
    const states = [];
    watch = setInterval(() => dock.getAttribute("data-state").then((s) => states.push(s), () => {}), 50);
    const touch = await touchSession(page);
    await touch.down(1, l.x + l.width / 2, l.y + l.height / 2);
    for (let i = 1; i <= 12; i++) {
      await touch.move(1, l.x + l.width / 2, l.y + l.height / 2 - i * 30);
      await sleep(60);
    }
    await touch.up(1);
    await sleep(1200);
    const swiped = states.includes("hopping");
    states.length = 0;
    await sleep(3500); // past the hop cooldown
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await sleep(300);
    await link.tap();
    await sleep(2000);
    clearInterval(watch);
    const scrolledTo = await page.evaluate(() => scrollY);
    assert.equal(swiped, true, "swipe from a link hops");
    assert.ok(scrolledTo > 500, "the tap followed the link");
    assert.equal(states.includes("hopping"), false, "no hop for the link's own scroll");
    assert.deepEqual(realErrors(logs), []);
  } finally {
    clearInterval(watch);
    await browser.close();
  }
});

test("touch drag holds him above the finger; release glides into the corner", { timeout: 60000 }, async () => {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const pet = page.locator("[data-mini-dotan] button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await sleep(1000);
    const b = await pet.boundingBox();
    const touch = await touchSession(page);
    let x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await touch.down(1, x, y);
    for (let i = 0; i < 20; i++) {
      x -= 12;
      y -= 10;
      await touch.move(1, x, y);
      await sleep(30);
    }
    await sleep(250); // past the 140 ms lift
    const held = await pet.boundingBox();
    const gear = await page.locator("[data-mini-dotan] button[aria-label='Mini Dotan settings']").evaluate((el) => getComputedStyle(el).visibility);
    await touch.up(1);
    await sleep(500);
    const side = await page.locator("[data-mini-dotan]").getAttribute("data-side");
    const detail = JSON.stringify({ x, y, held, gear, side });
    assert.ok(Math.abs(held.x + held.width / 2 - x) <= 2, `centred on the finger (${detail})`);
    assert.ok(Math.abs(held.y + held.height - (y - 40)) <= 2, `feet 40 px above it (${detail})`);
    assert.equal(gear, "hidden", `settings button out of the way while held (${detail})`);
    assert.equal(side, "left", `docks on the side he was carried to (${detail})`);
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("desktop mouse drag is unchanged: he stays under the cursor", { timeout: 60000 }, async () => {
  const { browser, page } = await launch({});
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const pet = page.locator("[data-mini-dotan] button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await sleep(1000);
    const b = await pet.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(b.x + b.width / 2 - i * 20, b.y + b.height / 2 - i * 10);
      await sleep(20);
    }
    await sleep(100);
    const held = await pet.boundingBox();
    await page.mouse.up();
    assert.ok(Math.abs(held.x - (b.x - 200)) <= 2 && Math.abs(held.y - (b.y - 100)) <= 2, JSON.stringify({ b, held }));
  } finally {
    await browser.close();
  }
});

test("hidden: a round face button stays; it summons him with a whirl", { timeout: 60000 }, async () => {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const dock = page.locator("[data-mini-dotan]");
    const pet = dock.locator("button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await dock.locator("button[aria-label='Mini Dotan settings']").click();
    await dock.getByRole("button", { name: "Hide Mini Dotan" }).click();
    const show = dock.locator("button[aria-label='Show Mini Dotan']");
    await show.waitFor({ timeout: 2000 });
    assert.equal(await pet.count(), 0, "he's gone");
    assert.equal(await show.evaluate((el) => el === document.activeElement), true, "focus stays on the round button");
    assert.equal(await show.locator("[class*=face]").evaluate((el) => getComputedStyle(el).display), "block", "shows his face");

    await page.reload({ waitUntil: "domcontentloaded" });
    await show.waitFor({ timeout: 30000 });
    assert.equal(await pet.count(), 0, "hidden survives a reload");

    await show.click();
    await pet.waitFor({ timeout: 2000 });
    assert.equal(await dock.getAttribute("data-arriving"), "true", "arrival animation running");
    assert.equal(await dock.getAttribute("data-state"), "hopping", "jumps in");
    // Freeze the whirl and check it: two full turns with the head intact, then dots.
    const at = (t) =>
      page.evaluate((t) => {
        const anims = document.getAnimations();
        anims.forEach((a) => {
          a.pause();
          a.currentTime = t;
        });
        const gear = document.querySelector("[data-mini-dotan] [class*=gear]");
        const angle = (() => {
          const m = new DOMMatrix(getComputedStyle(gear).transform);
          return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
        })();
        const opacity = (sel) => Number(getComputedStyle(gear.querySelector(sel)).opacity);
        return { angle, face: opacity("[class*=face]"), dots: opacity("[class*=dots]") };
      }, t);
    const mid = await at(400),
      landed = await at(800),
      done = await at(1100);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
    const whirl = JSON.stringify({ mid, landed, done });
    assert.ok(Math.abs(mid.angle) > 20 && mid.face === 1, `mid-spin, head still whole (${whirl})`);
    assert.ok(landed.angle === 0 && landed.face === 1 && landed.dots === 0, `two full turns, head upright (${whirl})`);
    assert.ok(done.face === 0 && done.dots === 1, `then the dots (${whirl})`);
    await sleep(1500);
    assert.equal(await dock.getAttribute("data-arriving"), null);
    assert.equal(await dock.locator("button[aria-label='Mini Dotan settings']").count(), 1, "back to the ··· menu");
    assert.equal(await page.evaluate(() => localStorage.getItem("mini-dotan-hidden")), "false");
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("settings are just quiet mode and hide; arrow keys change corners", { timeout: 60000 }, async () => {
  const { browser, page } = await launch({ width: 390, height: 844, mobile: true });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const dock = page.locator("[data-mini-dotan]");
    const pet = dock.locator("button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await dock.locator("button[aria-label='Mini Dotan settings']").click();
    const items = await dock.locator("[class*=settings] button").allInnerTexts();
    assert.deepEqual(items.map((t) => t.replace(/\s+/g, " ").trim()), ["Quiet mode Off", "Hide Mini Dotan"]);
    await page.keyboard.press("Escape");
    await pet.focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(await dock.getAttribute("data-side"), "left");
    await page.keyboard.press("ArrowRight");
    assert.equal(await dock.getAttribute("data-side"), "right");
    assert.equal(await page.locator("footer").getByText("Show Mini Dotan").count(), 0, "footer link removed");
  } finally {
    await browser.close();
  }
});

test("dragged up or down, he jumps through the whole hop", { timeout: 60000 }, async () => {
  const { browser, page } = await launch({ width: 390, height: 844, mobile: true });
  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const pet = page.locator("[data-mini-dotan] button[aria-label='Contact Dotan']");
    await pet.waitFor({ timeout: 30000 });
    await sleep(1000);
    const b = await pet.boundingBox();
    const touch = await touchSession(page);
    const x = b.x + b.width / 2;
    let y = b.y + b.height / 2;
    const frames = [];
    await touch.down(1, x, y);
    for (let i = 0; i < 30; i++) {
      y -= 12;
      await touch.move(1, x, y);
      await sleep(70);
      frames.push(await frame(page));
    }
    await touch.up(1);
    const cols = new Set(frames.filter(([row]) => row === 4).map(([, col]) => col));
    assert.equal(cols.size, 5, `all five jump frames (${JSON.stringify(frames)})`);
  } finally {
    await browser.close();
  }
});
