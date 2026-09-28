// Phone-sized viewports with real multi-touch (CDP touch events → Pointer Events).
import { test } from "node:test";
import assert from "node:assert/strict";
import { boxOf, launch, openExplore, realErrors, report, shot, sleep, snap, touchSession, waitFor } from "./lib.mjs";

const inputState = (page) => page.evaluate(() => window.__explore.input());

test("portrait phone: walk with the stick, enter by tapping, steer + gas together", { timeout: 180000 }, async () => {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true });
  const notes = [];
  try {
    await openExplore(page);
    assert.ok(await page.locator("[data-touch-controls]").isVisible(), "touch controls shown on a touch phone");
    await shot(page, "10-portrait-on-foot");
    await page.getByRole("button", { name: "Got it" }).tap();

    const touch = await touchSession(page);
    // Thumb stick: push up (forward) toward the parked coupe, with the camera aimed at it.
    let s = await snap(page);
    await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
    await touch.down(1, 90, 700);
    await touch.move(1, 90, 640);
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      s = await snap(page);
      if (Math.hypot(s.player.x - 3.4, s.player.z - 21.6) < 0.9) break;
      await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
      await sleep(50);
    }
    await touch.up(1);
    await sleep(300);
    s = await snap(page);
    notes.push({ afterWalk: s.player, context: s.context });
    assert.equal(s.context, "enter", "reached the car using the stick");
    const action = page.getByRole("button", { name: /Enter/ });
    await action.waitFor({ state: "visible" });
    const ab = await action.boundingBox();
    assert.ok(ab.height >= 48 && ab.width >= 48, `action target ${ab.width}x${ab.height}`);
    await touch.down(2, ab.x + ab.width / 2, ab.y + ab.height / 2);
    await touch.up(2);
    s = await waitFor(page, (x) => x.state === "driving");
    await sleep(600);
    await shot(page, "11-portrait-driving-controls");

    // Two thumbs at once: steer right on the left zone, gas on the right.
    const gas = await boxOf(page, "button[aria-label='Accelerate']");
    const brake = await boxOf(page, "button[aria-label='Brake and reverse']");
    const hb = await boxOf(page, "button[aria-label='Handbrake']");
    for (const b of [gas, brake, hb]) assert.ok(b.width >= 48 && b.height >= 48, "pedals are big enough");
    await touch.down(3, 80, 740);
    await touch.move(3, 150, 740);
    await touch.down(4, gas.cx, gas.cy);
    await sleep(700);
    let inp = await inputState(page);
    notes.push({ bothDown: inp.touch });
    assert.ok(inp.touch.steer > 0.5 && inp.touch.throttle === 1, "steer and gas held simultaneously");
    s = await snap(page);
    assert.ok(s.car.speedKmh > 5, "car accelerates while steering");

    // Lift the steering thumb: gas must stay down.
    await touch.up(3);
    await sleep(200);
    inp = await inputState(page);
    notes.push({ steerLifted: inp.touch });
    assert.equal(inp.touch.steer, 0);
    assert.equal(inp.touch.throttle, 1, "releasing one finger does not cancel another");

    // Third finger on the handbrake while the gas is still held.
    await touch.down(5, hb.cx, hb.cy);
    await sleep(250);
    inp = await inputState(page);
    assert.equal(inp.touch.handbrake, true);
    assert.equal(inp.touch.throttle, 1);
    await touch.up(5);
    await touch.up(4);
    await sleep(150);
    inp = await inputState(page);
    assert.deepEqual([inp.touch.throttle, inp.touch.handbrake, inp.touch.steer], [0, false, 0]);

    // Touch cancel (e.g. an OS gesture) releases everything held.
    await touch.down(6, gas.cx, gas.cy);
    await touch.down(7, 80, 740);
    await touch.move(7, 20, 740);
    await sleep(150);
    await touch.cancel();
    await sleep(150);
    inp = await inputState(page);
    notes.push({ afterCancel: inp.touch });
    assert.deepEqual([inp.touch.throttle, inp.touch.steer], [0, 0], "touchcancel releases held controls");

    // A finger resting on Gas while a second finger opens the menu: after Resume
    // the pedal must not stay latched (the finger has to press again).
    await touch.down(9, gas.cx, gas.cy);
    await sleep(200);
    const menuBtn = await boxOf(page, "[data-testid=pause-button]");
    await touch.down(10, menuBtn.cx, menuBtn.cy);
    await touch.up(10);
    await page.getByRole("dialog", { name: "Paused" }).waitFor();
    await page.getByRole("button", { name: "Resume" }).tap();
    await sleep(400);
    inp = await inputState(page);
    assert.equal(inp.touch.throttle, 0, "no phantom throttle after the menu");
    assert.equal(await page.locator("button[aria-label='Accelerate']").getAttribute("aria-pressed"), "false", "pedal not shown as pressed");
    await touch.up(9);

    // Rare phone bug: a finger's release never reaches the control, leaving gas or
    // steering held. Reproduce by pressing with a pointer whose lift lands elsewhere.
    await page.evaluate(() => {
      const gasBtn = document.querySelector("button[aria-label='Accelerate']");
      gasBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, pointerType: "touch", isPrimary: false, bubbles: true }));
    });
    await sleep(100);
    assert.equal((await inputState(page)).touch.throttle, 1, "orphaned press holds the gas");
    await page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerup", { pointerId: 77, pointerType: "touch", bubbles: true })));
    await sleep(100);
    assert.equal((await inputState(page)).touch.throttle, 0, "a lift delivered elsewhere still releases the gas");
    assert.equal(await page.locator("button[aria-label='Accelerate']").getAttribute("aria-pressed"), "false");
    // Steering: press and drag, then the release is lost entirely; the moment no finger
    // is left on the screen (touchend with no touches) the stick lets go.
    await page.evaluate(() => {
      const zone = document.querySelector("[data-touch-controls] [role=presentation]");
      const r = zone.getBoundingClientRect();
      const x = r.left + 80;
      const y = r.bottom - 80;
      zone.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 78, pointerType: "touch", clientX: x, clientY: y, isPrimary: false, bubbles: true }));
      zone.dispatchEvent(new PointerEvent("pointermove", { pointerId: 78, pointerType: "touch", clientX: x + 60, clientY: y, isPrimary: false, bubbles: true }));
    });
    await sleep(100);
    assert.ok((await inputState(page)).touch.steer > 0.5, "orphaned drag steers");
    await page.evaluate(() => window.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true })));
    await sleep(100);
    assert.equal((await inputState(page)).touch.steer, 0, "no fingers on screen, no steering");
    // And the stick still takes a fresh real touch afterwards.
    await touch.down(11, 80, 740);
    await touch.move(11, 150, 740);
    await sleep(150);
    assert.ok((await inputState(page)).touch.steer > 0.5, "stick works again");
    await touch.up(11);
    await sleep(100);
    assert.equal((await inputState(page)).touch.steer, 0);

    // Drive for a moment and capture the portrait framing at speed.
    await touch.down(8, gas.cx, gas.cy);
    await sleep(2200);
    await shot(page, "12-portrait-driving-speed");
    await touch.up(8);
    assert.deepEqual(realErrors(logs), []);
  } finally {
    report("touch-portrait", { notes, logs });
    await browser.close();
  }
});

test("short landscape phone keeps the road visible and controls reachable", { timeout: 120000 }, async () => {
  const { browser, page, logs } = await launch({ width: 844, height: 390, mobile: true });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).tap();
    await shot(page, "13-landscape-on-foot");
    const touch = await touchSession(page);
    await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
    await touch.down(1, 100, 300);
    await touch.move(1, 100, 250);
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const s = await snap(page);
      if (Math.hypot(s.player.x - 3.4, s.player.z - 21.6) < 0.9) break;
      await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
      await sleep(50);
    }
    await touch.up(1);
    await sleep(300);
    await page.getByRole("button", { name: /Enter/ }).tap();
    await waitFor(page, (x) => x.state === "driving");
    const gas = await boxOf(page, "button[aria-label='Accelerate']");
    await touch.down(2, gas.cx, gas.cy);
    await sleep(1800);
    await shot(page, "14-landscape-driving");
    await touch.up(2);
    // Every control lies fully inside the viewport.
    for (const name of ["Accelerate", "Brake and reverse", "Handbrake"]) {
      const b = await boxOf(page, `button[aria-label='${name}']`);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 844 && b.y + b.height <= 390, `${name} inside viewport`);
    }
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});

test("rotating the phone mid-drive re-lays out without stuck input", { timeout: 120000 }, async () => {
  const { browser, page, logs } = await launch({ width: 390, height: 844, mobile: true });
  try {
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).tap();
    const touch = await touchSession(page);
    await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
    await touch.down(1, 90, 700);
    await touch.move(1, 90, 640);
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const s = await snap(page);
      if (Math.hypot(s.player.x - 3.4, s.player.z - 21.6) < 0.9) break;
      await page.evaluate(() => window.__explore.aimCamera(3.4, 21.6));
      await sleep(50);
    }
    await touch.up(1);
    await page.getByRole("button", { name: /Enter/ }).tap();
    await waitFor(page, (x) => x.state === "driving");
    for (const [w, h, name] of [
      [844, 390, "landscape"],
      [390, 844, "portrait"],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(700);
      const canvas = await page.locator("[data-explore] canvas").boundingBox();
      assert.ok(Math.abs(canvas.width - w) < 2 && Math.abs(canvas.height - h) < 2, `canvas fills the ${name} viewport`);
      for (const label of ["Accelerate", "Brake and reverse", "Handbrake"]) {
        const b = await boxOf(page, `button[aria-label='${label}']`);
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h, `${label} inside ${name}`);
      }
      const inp = await inputState(page);
      assert.deepEqual([inp.touch.throttle, inp.touch.steer, inp.keys.length], [0, 0, 0], "nothing held after rotating");
      await shot(page, `15-rotated-${name}`);
    }
    assert.deepEqual(realErrors(logs), []);
  } finally {
    await browser.close();
  }
});
