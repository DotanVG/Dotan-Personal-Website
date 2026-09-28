// Evidence generator: stands the player at authored viewpoints and captures the
// art in each neighbourhood. Not a test (placement is a camera setup, not play).
import { launch, openExplore, shot, sleep } from "./lib.mjs";

const N = Math.PI;
const E = Math.PI / 2;
const S = 0;
const SPOTS = [
  ["plaza", 0, 16, N],
  ["zota-tower", 31.5, 12, N + 0.4],
  ["ness-civic", -31.5, -10, S - 0.5],
  ["kanomi-studio", 40, -30.5, N + 0.3],
  ["ort-college", -56, -30.5, N - 0.3],
  ["hackeru-glass", 76, -12, E - 0.35],
  ["nitzanim-academy", 58, 30.5, S + 0.3],
  ["electra-depot", -88, 30.5, S - 0.3],
  ["waterfront", 10, 93.5, E],
  ["pier-lighthouse", 40, 118, S],
  ["stunt-yard", 96, 80, N],
  ["residential-hills", -96, -30.5, N],
  ["market-street", -110, 5, E],
  ["parking-lot-cars", 0, 58, S + 0.25],
];

const width = +(process.env.W ?? 1440);
const height = +(process.env.H ?? 900);
const mobile = width < 700;
const { browser, page } = await launch({ width, height, mobile });
await openExplore(page);
await page.getByRole("button", { name: "Got it" }).click();
for (const [name, x, z, yaw] of SPOTS) {
  await page.evaluate(([x, z, yaw]) => window.__explore.placePlayer(x, z, yaw), [x, z, yaw]);
  await sleep(1400);
  await shot(page, `tour-${width}x${height}-${name}`);
}
await browser.close();
