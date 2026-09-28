// Frame-rate measurement while driving. Desktop runs on this machine's GPU;
// "phone" is Chrome device emulation plus CPU throttling: a proxy only, not a
// measurement of a real phone.
import { lapDrive, launch, openExplore, press, report, waitFor, walkTo } from "./lib.mjs";

async function measure(label, opts, cpuThrottle = 1) {
  const { browser, page } = await launch(opts);
  try {
    if (cpuThrottle > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
    }
    await openExplore(page);
    await page.getByRole("button", { name: "Got it" }).click();
    await walkTo(page, 3.4, 21.6, { within: 0.8, run: false, timeout: 60000 });
    await press(page, "KeyE");
    await waitFor(page, (s) => s.state === "driving", { timeout: 20000 });
    // Lap the block with real keys for 45 s, sampling frame timing every 5 s.
    const samples = [];
    const lap = await lapDrive(page, 45, {
      sample: async (s) =>
        samples.push({
          ...(await page.evaluate(() => window.__explore.perf())),
          ...(await page.evaluate(() => window.__explore.renderInfo())),
          quality: await page.evaluate(() => window.__explore.quality()),
          speed: s.car.speedKmh,
          cars: s.counts.cars,
        }),
    });
    const fps = samples.map((s) => s.fps);
    const result = { label, cpuThrottle, lap, viewport: `${opts.width}x${opts.height}`, minFps: Math.min(...fps), meanFps: fps.reduce((a, b) => a + b, 0) / fps.length, samples };
    console.log(label, "laps", lap.laps.toFixed(2), "max km/h", lap.maxKmh.toFixed(0), "mean fps", result.meanFps.toFixed(1), "min window fps", result.minFps.toFixed(1), "p95ms", Math.max(...samples.map((s) => s.p95ms)).toFixed(1), "calls", samples.at(-1).calls, "tris", samples.at(-1).triangles, "quality", samples.at(-1).quality);
    return result;
  } finally {
    await browser.close();
  }
}

const results = [];
results.push(await measure("desktop-1440x900", { width: 1440, height: 900 }));
results.push(await measure("phone-emulated-390x844-cpu4x", { width: 390, height: 844, mobile: true }, 4));
results.push(await measure("phone-emulated-390x844-cpu6x", { width: 390, height: 844, mobile: true }, 6));
report("perf", results);
