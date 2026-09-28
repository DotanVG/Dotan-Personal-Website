// Layout checks across the required viewports: nothing clipped, overlapping,
// scrolling sideways, or too small to hit. Screenshots on foot and driving.
import { test } from "node:test";
import assert from "node:assert/strict";
import { launch, openExplore, press, report, shot, sleep, snap, waitFor, walkTo } from "./lib.mjs";

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: true },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "320x640", width: 320, height: 640, mobile: true },
];

async function layoutIssues(page, width, height) {
  return page.evaluate(
    ([W, H]) => {
      const issues = [];
      const doc = document.scrollingElement;
      if (doc.scrollWidth > W + 1) issues.push(`horizontal overflow ${doc.scrollWidth}px`);
      const els = [...document.querySelectorAll("[data-explore] button, [data-explore] a")].filter((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !e.closest("dialog:not([open])");
      });
      const boxes = els.map((e) => ({ e, r: e.getBoundingClientRect(), label: e.getAttribute("aria-label") || e.textContent.trim() }));
      for (const { r, label } of boxes) {
        if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) issues.push(`${label} outside viewport`);
        if (r.height < 43.5 || r.width < 43.5) issues.push(`${label} too small ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          if (boxes[i].e.contains(boxes[j].e) || boxes[j].e.contains(boxes[i].e)) continue;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) issues.push(`${boxes[i].label} overlaps ${boxes[j].label}`);
        }
      return issues;
    },
    [width, height],
  );
}

for (const vp of VIEWPORTS) {
  test(`layout at ${vp.name}`, { timeout: 120000 }, async () => {
    const { browser, page } = await launch(vp);
    const found = {};
    try {
      await openExplore(page);
      found.withCoach = await layoutIssues(page, vp.width, vp.height);
      await page.getByRole("button", { name: "Got it" }).click();
      await sleep(300);
      found.onFoot = await layoutIssues(page, vp.width, vp.height);
      await shot(page, `30-${vp.name}-on-foot`);
      // Get into the hero coupe (keyboard walk; the layout is what's under test here).
      await walkTo(page, 3.4, 21.6, { within: 0.8, run: false });
      await press(page, "KeyE");
      await waitFor(page, (s) => s.state === "driving");
      await page.keyboard.down("KeyW");
      await sleep(1500);
      await page.keyboard.up("KeyW");
      found.driving = await layoutIssues(page, vp.width, vp.height);
      await shot(page, `31-${vp.name}-driving`);
      // The pause menu fits without clipping.
      await page.getByRole("button", { name: /Pause/ }).click();
      const dlg = await page.getByRole("dialog", { name: "Paused" }).boundingBox();
      found.menuFits = dlg.x >= 0 && dlg.y >= 0 && dlg.x + dlg.width <= vp.width && dlg.y + dlg.height <= vp.height;
      await shot(page, `32-${vp.name}-menu`);
      report(`layout-${vp.name}`, found);
      assert.deepEqual(found.onFoot, [], "on-foot layout");
      assert.deepEqual(found.driving, [], "driving layout");
      assert.equal(found.menuFits, true, "menu fits");
      const s = await snap(page);
      assert.equal(s.state, "driving");
    } finally {
      await browser.close();
    }
  });
}
