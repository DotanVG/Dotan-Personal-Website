// Browser harness for Explore. Drives the real production build through real
// keyboard, mouse and (CDP) touch input; reads state through the read-only
// test hook that exists only in `npm run build:e2e` builds (EXPLORE_TEST_HOOK=1).
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3300";
export const OUT = process.env.E2E_OUT ?? path.resolve("e2e/artifacts");
mkdirSync(OUT, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Launch installed Chrome with GPU enabled (headless). */
export async function launch({ width = 1440, height = 900, mobile = false, touch = mobile, reducedMotion = "no-preference", init } = {}) {
  const browser = await chromium.launch({
    channel: process.env.E2E_CHANNEL ?? "chrome",
    headless: process.env.E2E_HEADED ? false : true,
    args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 3 : 1,
    hasTouch: touch,
    isMobile: mobile,
    reducedMotion,
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  // Never talk to third parties from tests (analytics, social proof, the contact form).
  await page.route(/googletagmanager|google-analytics|provesrc|formspree/, (r) => r.abort());
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  return { browser, context, page, logs };
}

/** Errors other than the blocked third-party requests above. */
export const realErrors = (logs) =>
  logs.filter((l) => !/Failed to load resource: net::ERR_FAILED|preloaded using link preload/.test(l));

export async function openExplore(page, query = "?mode=explore") {
  await page.goto(BASE + "/" + query, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__explore?.snapshot && !document.querySelector("[data-explore] .animate-spin"), null, {
    timeout: 60000,
  });
  // Let the first frames settle.
  await page.waitForFunction(() => window.__explore.snapshot().time > 0.4, null, { timeout: 20000 });
}

export const snap = (page) => page.evaluate(() => window.__explore.snapshot());

export async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

export function report(name, data) {
  writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
}

/** Walk to (x, z): aim the camera at the target, then hold real W (and Shift). */
export async function walkTo(page, x, z, { within = 1.2, run = true, timeout = 20000, until } = {}) {
  const t0 = Date.now();
  if (run) await page.keyboard.down("Shift");
  await page.keyboard.down("KeyW");
  try {
    while (Date.now() - t0 < timeout) {
      const s = await snap(page);
      if (Math.hypot(s.player.x - x, s.player.z - z) < within || until?.(s)) return s;
      await page.evaluate(([x, z]) => window.__explore.aimCamera(x, z), [x, z]);
      await sleep(60);
    }
    throw new Error(`walkTo(${x}, ${z}) timed out`);
  } finally {
    await page.keyboard.up("KeyW");
    if (run) await page.keyboard.up("Shift");
    await sleep(150);
  }
}

const wrap = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/**
 * Drive toward (x, z) with real keys: W held, A/D tapped from the heading error.
 * Stops when within `within` metres, when `until(snapshot)` is true, or on timeout.
 */
export async function driveTo(page, x, z, { within = 6, timeout = 20000, until, gas = true } = {}) {
  const t0 = Date.now();
  let steer = null;
  if (gas) await page.keyboard.down("KeyW");
  try {
    while (Date.now() - t0 < timeout) {
      const s = await snap(page);
      if (!s.car) throw new Error("not driving");
      if (until?.(s)) return s;
      if (Math.hypot(s.car.x - x, s.car.z - z) < within) return s;
      const want = Math.atan2(x - s.car.x, z - s.car.z);
      const err = wrap(want - s.car.yaw); // positive = target is to the left
      const next = err > 0.06 ? "KeyA" : err < -0.06 ? "KeyD" : null;
      if (next !== steer) {
        if (steer) await page.keyboard.up(steer);
        if (next) await page.keyboard.down(next);
        steer = next;
      }
      await sleep(40);
    }
    return snap(page);
  } finally {
    if (steer) await page.keyboard.up(steer);
    if (gas) await page.keyboard.up("KeyW");
  }
}

export async function press(page, key, holdMs = 60) {
  await page.keyboard.down(key);
  await sleep(holdMs);
  await page.keyboard.up(key);
}

export async function waitFor(page, pred, { timeout = 10000, every = 80 } = {}) {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < timeout) {
    s = await snap(page);
    if (pred(s)) return s;
    await sleep(every);
  }
  throw new Error("waitFor timed out; last state: " + JSON.stringify(s)?.slice(0, 400));
}

/** Raw multi-touch through the browser's input pipeline (CDP), so Pointer Events fire as on a phone. */
export async function touchSession(page) {
  const cdp = await page.context().newCDPSession(page);
  const active = new Map();
  const send = (type) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [...active.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 8, radiusY: 8, force: 1 })),
    });
  return {
    async down(id, x, y) {
      active.set(id, { x, y });
      await send(active.size === 1 ? "touchStart" : "touchStart");
    },
    async move(id, x, y) {
      active.set(id, { x, y });
      await send("touchMove");
    },
    async up(id) {
      // Chromium treats the points listed in touchEnd as the ones lifted
      // (like DOM changedTouches); the other fingers stay down.
      const p = active.get(id);
      active.delete(id);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: p ? [{ id, x: p.x, y: p.y }] : [] });
    },
    async cancel() {
      active.clear();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    },
  };
}

export async function boxOf(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error("no box for " + selector);
  return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

/** Counter-clockwise loop on right-hand lanes around the parking-lot block (x -24..24, z 28..84). */
export const LAP = [
  [-25.75, 26.25],
  [-25.75, 85.75],
  [25.75, 85.75],
  [25.75, 26.25],
];

/**
 * Lap the loop with real keys for `seconds`, braking for corners. Calls
 * `sample()` every `every` ms. Returns lap statistics.
 */
export async function lapDrive(page, seconds, { sample, every = 5000 } = {}) {
  const t0 = Date.now();
  let i = 0;
  let steer = null;
  let pedal = null;
  let next = t0 + every;
  let maxKmh = 0;
  let distance = 0;
  let stuckFor = 0;
  let last = null;
  const set = async (want, cur) => {
    if (want === cur) return cur;
    if (cur) await page.keyboard.up(cur);
    if (want) await page.keyboard.down(want);
    return want;
  };
  try {
    while (Date.now() - t0 < seconds * 1000) {
      const s = await snap(page);
      if (!s.car) break;
      if (last) distance += Math.hypot(s.car.x - last.x, s.car.z - last.z);
      last = s.car;
      maxKmh = Math.max(maxKmh, s.car.speedKmh);
      const [x, z] = LAP[i % LAP.length];
      const d = Math.hypot(s.car.x - x, s.car.z - z);
      if (d < 7) i++;
      const want = Math.atan2(x - s.car.x, z - s.car.z);
      const err = Math.atan2(Math.sin(want - s.car.yaw), Math.cos(want - s.car.yaw));
      // Stuck against something: back off with opposite lock, like a player would.
      stuckFor = s.car.speedKmh < 3 ? stuckFor + 1 : 0;
      if (stuckFor > 20) {
        steer = await set(err > 0 ? "KeyD" : "KeyA", steer);
        pedal = await set("KeyS", pedal);
        await sleep(1300);
        stuckFor = 0;
        continue;
      }
      steer = await set(err > 0.07 ? "KeyA" : err < -0.07 ? "KeyD" : null, steer);
      const tooFast = d < 26 && s.car.speedKmh > 26;
      pedal = await set(tooFast ? "KeyS" : Math.abs(err) > 1.2 && s.car.speedKmh > 15 ? null : "KeyW", pedal);
      if (sample && Date.now() >= next) {
        next += every;
        await sample(s);
      }
      await sleep(50);
    }
  } finally {
    if (steer) await page.keyboard.up(steer);
    if (pedal) await page.keyboard.up(pedal);
  }
  return { waypoints: i, laps: i / LAP.length, maxKmh, distance };
}
