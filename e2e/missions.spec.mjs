// Missions 1 and 2 in the production Explore build: chip, clean-view clearance,
// persistence, a blocked store, a phone layout, and reduced motion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { launch, openExplore, press, realErrors, snap } from "./lib.mjs";

async function dismissCoach(page) {
  const coach = page.getByRole("button", { name: "Got it" });
  if (await coach.count()) await coach.click();
}

async function boxes(page) {
  return page.evaluate(() => {
    const clean = document.querySelector("[data-testid='clean-view']");
    const chip = document.querySelector("[data-testid='mission-chip']");
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, shown: r.width > 0 && r.height > 0 };
    };
    return { clean: rect(clean), chip: rect(chip) };
  });
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

test("Read the City, then a driven lighthouse read, with the clean view left clear", { timeout: 180000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1280, height: 800 });
  try {
    await openExplore(page);
    await dismissCoach(page);
    const chip = page.getByTestId("mission-chip");
    await chip.waitFor();
    assert.match(await chip.getAttribute("aria-label"), /Read the City, 0 of 3/);
    const laid = await boxes(page);
    assert.ok(laid.clean?.shown, "clean view is on screen");
    assert.equal(overlaps(laid.clean, laid.chip), false);

    const pads = await page.evaluate(() => window.__explore.pads());
    const read = pads.filter((p) => p.slug !== "naval").slice(0, 3);
    for (let i = 0; i < read.length; i++) {
      const pad = read[i];
      await page.evaluate(([x, z]) => window.__explore.placePlayer(x, z, 0), [pad.x, pad.z]);
      await page.waitForFunction((slug) => window.__explore.snapshot().inspectSlug === slug, pad.slug);
      await press(page, "KeyE");
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      if (i < read.length - 1) await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    const reward = page.getByTestId("mission-reward");
    await reward.waitFor();
    assert.match(await reward.innerText(), /First Charter/);
    assert.match(await reward.innerText(), /take a car down to the pier/);
    await page.getByRole("button", { name: "Keep exploring" }).click();
    const done = await page.evaluate(() => window.__explore.missions());
    assert.deepEqual(done.done, ["read-city"]);
    assert.equal(done.visited.length, 3);

    await page.getByTestId("pause-button").click();
    await page.getByRole("button", { name: "Missions" }).click();
    assert.equal(await page.getByTestId("mission-check").locator("li").count(), 8);
    await page.getByRole("button", { name: "Resume" }).click();

    const door = await page.evaluate(() => window.__explore.nearestDoor());
    await page.evaluate(([x, z]) => window.__explore.placePlayer(x, z, 0), [door.x, door.z]);
    await page.waitForFunction(() => window.__explore.snapshot().context === "enter");
    await press(page, "KeyE");
    await page.waitForFunction(() => window.__explore.snapshot().state === "driving");
    assert.match(await chip.getAttribute("aria-label"), /Drive to the pier/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__explore?.snapshot && !document.querySelector("[data-explore] .animate-spin"));
    const back = await page.evaluate(() => window.__explore.missions());
    assert.ok(back.done.includes("read-city"));
    await page.getByText(/Welcome back/).waitFor();
  } finally {
    assert.deepEqual(realErrors(logs), []);
    await browser.close();
  }
});

test("Coast Run ends without mentioning an arcade, and replay starts over", { timeout: 120000 }, async () => {
  const seed = {
    v: 1,
    visited: ["ness", "kanomi", "electra"],
    drove: true,
    done: ["read-city"],
    hidden: false,
  };
  const { browser, page, logs } = await launch({
    width: 1280,
    height: 800,
    init: () =>
      localStorage.setItem(
        "dotanv-explore-missions-v1",
        JSON.stringify({ v: 1, visited: ["ness", "kanomi", "electra"], drove: true, done: ["read-city"], hidden: false }),
      ),
  });
  try {
    await openExplore(page);
    await dismissCoach(page);
    const chip = page.getByTestId("mission-chip");
    assert.match(await chip.getAttribute("aria-label"), /Read the lighthouse/);
    const naval = await page.evaluate(() => window.__explore.pads().find((p) => p.slug === "naval"));
    await page.evaluate(([x, z]) => window.__explore.placePlayer(x, z, 0), [naval.x, naval.z]);
    await page.waitForFunction(() => window.__explore.snapshot().inspectSlug === "naval");
    await press(page, "KeyE");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    const reward = page.getByTestId("mission-reward");
    await reward.waitFor();
    const text = await reward.innerText();
    assert.match(text, /The lighthouse is lit/);
    assert.doesNotMatch(text, /arcade|stunt/i);
    await page.getByRole("button", { name: "Keep exploring" }).click();

    await page.getByTestId("pause-button").click();
    await page.getByRole("button", { name: "Missions" }).click();
    await page.getByRole("button", { name: "Replay" }).click();
    await page.getByRole("button", { name: "Replay missions" }).click();
    const wiped = await page.evaluate(() => window.__explore.missions());
    assert.deepEqual(wiped.done, []);
    assert.deepEqual(wiped.visited, []);
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Resume" }).click();
    assert.match(await page.getByTestId("mission-chip").getAttribute("aria-label"), /Read the City, 0 of 3/);
  } finally {
    assert.deepEqual(realErrors(logs), []);
    await browser.close();
  }
});

test("a blocked store still shows the chip, on a phone and with reduced motion", { timeout: 120000 }, async () => {
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
    const chip = page.getByTestId("mission-chip");
    await chip.waitFor();
    const laid = await boxes(page);
    assert.ok(laid.clean?.shown);
    assert.equal(overlaps(laid.clean, laid.chip), false);
    const s = await snap(page);
    assert.equal(s.state, "onFoot");
  } finally {
    assert.deepEqual(realErrors(logs), []);
    await browser.close();
  }
});
