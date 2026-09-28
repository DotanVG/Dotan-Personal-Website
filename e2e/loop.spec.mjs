// The core loop in a real browser with real keyboard input:
// walk → enter → drive → crash → wreck → exit → take another car → read a landmark.
import { test } from "node:test";
import assert from "node:assert/strict";
import { driveTo, launch, openExplore, press, realErrors, report, shot, sleep, snap, waitFor, walkTo } from "./lib.mjs";

test("desktop keyboard loop", { timeout: 240000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1440, height: 900 });
  const trail = [];
  const log = (label, s) => trail.push({ label, state: s.state, car: s.car, counts: s.counts, context: s.context, toast: s.toast });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).click();
    let s = await snap(page);
    log("spawn", s);
    assert.equal(s.state, "onFoot");
    await shot(page, "01-desktop-on-foot");

    // Walk to the hero coupe's kerbside door and get in with E.
    s = await walkTo(page, 3.4, 21.6, { within: 0.8, run: false });
    s = await waitFor(page, (x) => x.context === "enter");
    assert.match(s.contextLabel, /Enter/);
    await press(page, "KeyE");
    s = await waitFor(page, (x) => x.state === "driving");
    log("entered", s);
    assert.equal(s.controlledByPlayer.length, 1);
    assert.equal(s.car.ai, false);

    // Drive west along the street and out to the ring road.
    s = await driveTo(page, -60, 23.5, { within: 8, timeout: 15000 });
    await shot(page, "02-desktop-driving");
    log("driving", s);
    assert.ok(s.car.speedKmh > 40, `moving fast (${s.car.speedKmh} km/h)`);

    // Full throttle into the west retaining wall, repeatedly, until wrecked.
    for (let attempt = 0; attempt < 8; attempt++) {
      s = await snap(page);
      if (s.car.wrecked) break;
      if (s.car.flipped) {
        // Rolled onto its roof: Unstuck rights it without repairing it.
        const cond = s.car.condition;
        assert.equal((await snap(page)).context !== undefined, true);
        await press(page, "KeyR");
        s = await waitFor(page, (x) => !x.car.flipped, { timeout: 3000 });
        log("unstuck", s);
        assert.equal(s.car.condition, cond, "Unstuck keeps the damage");
      }
      const before = s.car.condition;
      s = await driveTo(page, -140, s.car.z < 0 ? s.car.z : 23.5, {
        within: 1,
        timeout: 12000,
        until: (x) => x.car.condition < before - 5 || x.car.wrecked,
      });
      log(`hit ${attempt}`, s);
      if (attempt === 0) {
        await sleep(250);
        await shot(page, "03-desktop-crash");
      }
      if (s.car.wrecked) break;
      // Back off for another run-up.
      await page.keyboard.down("KeyS");
      await sleep(2600);
      await page.keyboard.up("KeyS");
      await sleep(400);
    }
    s = await snap(page);
    assert.ok(s.car.wrecked, `wrecked after repeated hits (condition ${s.car.condition})`);
    assert.ok(s.car.dents > 0 && s.car.detached > 0, "damage is visible (dents and detached parts)");
    await sleep(1500);
    await shot(page, "04-desktop-wreck");

    // Propulsion is gone.
    await page.keyboard.down("KeyW");
    await sleep(1500);
    await page.keyboard.up("KeyW");
    s = await snap(page);
    assert.ok(s.car.speedKmh < 5, "wreck does not drive");
    const wreckId = s.car.id;

    // Get out, find another car, take it.
    await press(page, "KeyE");
    s = await waitFor(page, (x) => x.state === "onFoot");
    log("exited wreck", s);
    assert.ok(s.nearby.some((c) => c.id === wreckId), "wreck stays in the world");
    let entered = false;
    const tried = [];
    for (let tries = 0; tries < 10 && !entered; tries++) {
      s = await snap(page);
      const target = s.nearby.find((c) => !c.wrecked && !c.flipped && c.id !== wreckId && c.role !== "traffic");
      if (!target) {
        // Head back toward town, where the parked cars are.
        await walkTo(page, -100, 23.5, { within: 3, timeout: 6000 }).catch(() => {});
        continue;
      }
      const door = await page.evaluate((id) => window.__explore.doorOf(id), target.id);
      tried.push({ id: target.id, kind: target.kind, role: target.role, dist: target.dist });
      // Walk up to the door like a player: stop as soon as the Enter prompt shows.
      s = await walkTo(page, door.x, door.z, { within: 0.4, timeout: 10000, until: (x) => x.context === "enter" }).catch(() => snap(page));
      if (s.context === "enter") {
        await press(page, "KeyE");
        s = await waitFor(page, (x) => x.state === "driving", { timeout: 3000 }).catch(() => s);
        entered = s.state === "driving";
      }
    }
    log("replacement tries", { ...s, toast: JSON.stringify(tried) });
    assert.ok(entered, "took a replacement car");
    s = await snap(page);
    assert.notEqual(s.car.id, wreckId);
    log("replacement", s);
    await page.keyboard.down("KeyW");
    await sleep(1200);
    await page.keyboard.up("KeyW");
    await shot(page, "05-desktop-replacement-car");

    const errors = realErrors(logs);
    assert.deepEqual(errors, [], "no console errors or CSP violations");
  } finally {
    report("loop-desktop", { trail, logs });
    await browser.close();
  }
});

test("landmark info opens explicitly on foot, pauses the game, and closes cleanly", { timeout: 120000 }, async () => {
  const { browser, page, logs } = await launch({ width: 1440, height: 900 });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).click();
    // Walk along the plaza's south sidewalk, across the street, up to the Zota pad.
    await walkTo(page, 14, 20.5, { within: 1.5 });
    await walkTo(page, 31.6, 16, { within: 1.5 });
    let s = await walkTo(page, 31.6, 0.6, { within: 0.6, run: false });
    s = await waitFor(page, (x) => x.context === "inspect");
    assert.equal(s.inspectSlug, "zota");
    assert.equal(await page.getByRole("dialog").count(), 0, "nothing opens just by standing there");
    await shot(page, "06-desktop-landmark-pad");
    await press(page, "KeyE");
    const dialog = page.getByRole("dialog", { name: /Integration QA Specialist/ });
    await dialog.waitFor({ state: "visible" });
    await sleep(400);
    await shot(page, "07-desktop-info-panel");
    // Simulation is paused while the panel is open.
    const t0 = (await snap(page)).time;
    await sleep(800);
    assert.equal((await snap(page)).time, t0, "simulation paused under the modal");
    // Holding W while the panel is open must not leak into the game.
    await page.keyboard.down("KeyW");
    await press(page, "Escape");
    await page.keyboard.up("KeyW");
    await dialog.waitFor({ state: "hidden" });
    await sleep(500);
    s = await snap(page);
    assert.ok(s.time > t0, "resumed");
    assert.deepEqual(await page.evaluate(() => window.__explore.input().keys), [], "no held input after closing");
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});
