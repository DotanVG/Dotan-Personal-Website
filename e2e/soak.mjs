// Ten-minute endurance run with real keyboard input: drive wildly, crash,
// bail out, steal the nearest car, repeat. Samples entity counts, heap, GPU
// resource counts and frame timing, then checks nothing accumulated or stuck.
import { launch, openExplore, press, report, sleep, snap } from "./lib.mjs";

const MINUTES = +(process.env.SOAK_MINUTES ?? 10);
const { browser, page, logs } = await launch({ width: 1440, height: 900 });
const cdp = await page.context().newCDPSession(page);
const heap = async (gc) => {
  if (gc) await cdp.send("HeapProfiler.collectGarbage");
  return (await cdp.send("Runtime.getHeapUsage")).usedSize;
};
const samples = [];
let entries = 0;
let exits = 0;
const held = new Set();
const hold = async (key, on) => {
  if (on && !held.has(key)) {
    await page.keyboard.down(key);
    held.add(key);
  } else if (!on && held.has(key)) {
    await page.keyboard.up(key);
    held.delete(key);
  }
};
const releaseAll = async () => {
  for (const k of [...held]) await hold(k, false);
};

try {
  await openExplore(page);
  await page.getByRole("button", { name: "Got it" }).click();
  const t0 = Date.now();
  let nextSample = t0;
  let nextGc = t0 + 60000;
  let drivingSince = 0;
  const skip = new Map();
  let chase = { id: -1, since: 0, best: Infinity };
  let rnd = 12345;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (Date.now() - t0 < MINUTES * 60000) {
    const s = await snap(page);
    if (Date.now() >= nextSample) {
      nextSample += 10000;
      const gc = Date.now() >= nextGc;
      if (gc) nextGc += 60000;
      samples.push({
        t: Math.round((Date.now() - t0) / 1000),
        state: s.state,
        counts: s.counts,
        lampsDown: s.lampsDown,
        heap: await heap(gc),
        gc,
        perf: await page.evaluate(() => window.__explore.perf()),
        render: await page.evaluate(() => window.__explore.renderInfo()),
        quality: await page.evaluate(() => window.__explore.quality()),
      });
    }
    if (s.state === "onFoot") {
      await releaseAll();
      drivingSince = 0;
      // Like a player: prefer parked/abandoned cars, give up on ones we can't reach.
      const ok = (c) => !c.wrecked && !c.flipped && !(skip.get(c.id) > Date.now());
      const target = s.nearby.find((c) => ok(c) && c.role !== "traffic") ?? s.nearby.find(ok);
      if (target && target.id !== chase.id) chase = { id: target.id, since: Date.now(), best: Infinity };
      if (!target) {
        await hold("KeyW", true);
        await hold("ShiftLeft", true);
        await sleep(700);
        await releaseAll();
        continue;
      }
      const door = await page.evaluate((id) => window.__explore.doorOf(id), target.id);
      if (!door) continue;
      await page.evaluate(([x, z]) => window.__explore.aimCamera(x, z), [door.x, door.z]);
      const d = Math.hypot(door.x - s.player.x, door.z - s.player.z);
      if (d < chase.best - 0.3) {
        chase.best = d;
        chase.since = Date.now();
      } else if (Date.now() - chase.since > 4000) {
        skip.set(target.id, Date.now() + 20000);
        chase = { id: -1, since: 0, best: Infinity };
        continue;
      }
      if (s.context === "enter") {
        await press(page, "KeyE");
        await sleep(600);
        if ((await snap(page)).state === "driving") entries++;
        continue;
      }
      await hold("KeyW", d > 0.5);
      await hold("ShiftLeft", d > 4);
      await sleep(120);
      continue;
    }
    if (s.state === "driving") {
      if (!drivingSince) drivingSince = Date.now();
      // Wild driving: throttle mostly, random steering, the odd handbrake or reverse.
      await hold("KeyW", rand() < 0.85);
      await hold("KeyS", !held.has("KeyW") && rand() < 0.5);
      const r = rand();
      await hold("KeyA", r < 0.3);
      await hold("KeyD", r > 0.7);
      await hold("Space", rand() < 0.12);
      if (s.car?.wrecked || Date.now() - drivingSince > 25000 + rand() * 20000) {
        await releaseAll();
        await press(page, "KeyE");
        await sleep(2500);
        if ((await snap(page)).state === "onFoot") exits++;
        drivingSince = 0;
        continue;
      }
      if (rand() < 0.01) await press(page, "KeyR");
      await sleep(250 + rand() * 500);
      continue;
    }
    await sleep(100);
  }
  await releaseAll();
  await sleep(500);
  const end = await snap(page);
  const input = await page.evaluate(() => window.__explore.input());
  const gcHeaps = samples.filter((s) => s.gc).map((s) => s.heap);
  const result = {
    minutes: MINUTES,
    entries,
    exits,
    finalState: end.state,
    finalCounts: end.counts,
    heldKeysAfterRelease: input.keys,
    heapAfterGcMB: gcHeaps.map((h) => +(h / 1048576).toFixed(1)),
    maxCars: Math.max(...samples.map((s) => s.counts.cars)),
    minTraffic: Math.min(...samples.slice(2).map((s) => s.counts.traffic)),
    meanTraffic: samples.reduce((a, s) => a + s.counts.traffic, 0) / samples.length,
    geometries: samples.map((s) => s.render?.geometries),
    textures: samples.map((s) => s.render?.textures),
    minFps: Math.min(...samples.map((s) => s.perf?.fps ?? Infinity)),
    errors: logs.filter((l) => !/Failed to load resource: net::ERR_FAILED|preloaded using link preload/.test(l)),
    samples,
  };
  report("soak", result);
  console.log(JSON.stringify({ ...result, samples: undefined }, null, 1));
} finally {
  await browser.close();
}
