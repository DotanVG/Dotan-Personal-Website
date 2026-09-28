import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampPetDrag,
  cycles,
  lookPose,
  scrollGesture,
} from "../lib/miniDotan.ts";

test("mobile drag stays within the viewport and selects the nearest dock", () => {
  assert.deepEqual(clampPetDrag(-100, -100, 100, 88, 320, 568, 24), {
    left: 24,
    top: 72,
    side: "left",
  });
  assert.deepEqual(clampPetDrag(900, 900, 100, 88, 320, 568, 24), {
    left: 196,
    top: 456,
    side: "right",
  });
  assert.equal(clampPetDrag(60, 200, 100, 88, 390, 844, 24).side, "left");
  assert.equal(clampPetDrag(240, 200, 100, 88, 390, 844, 24).side, "right");
});

test("direction convention, neutral deadzone and angular hysteresis", () => {
  assert.equal(lookPose(0, -100, null), 0);
  assert.equal(lookPose(100, 0, null), 4);
  assert.equal(lookPose(0, 100, null), 8);
  assert.equal(lookPose(-100, 0, null), 12);
  assert.equal(lookPose(2, 4, 8), null);
  assert.equal(lookPose(23, -100, 0), 0);
  assert.equal(lookPose(30, -100, 0), 1);
});

test("one hop per burst, cooldown, both directions and intent gating", () => {
  let g = { y: 0, at: 0, distance: 0, hopped: false, lastHop: -Infinity };
  g = scrollGesture(g, 60, 2000, true);
  assert.equal(g.hop, false);
  g = scrollGesture(g, 120, 2100, true);
  assert.equal(g.hop, true);
  g = scrollGesture(g, 260, 2200, true);
  assert.equal(g.hop, false);
  g = scrollGesture(g, 140, 2700, true);
  assert.equal(g.hop, false);
  g = scrollGesture(g, 20, 4100, true);
  assert.equal(g.hop, true);
  g = scrollGesture(g, 500, 6100, false);
  assert.equal(g.hop, false);
  assert.equal(g.distance, 0);
});

test("only documented animation cells and timings", () => {
  assert.deepEqual(cycles.idle.times, [280, 110, 110, 140, 140, 320]);
  assert.equal(cycles.hopping.row, 4);
  assert.equal(cycles.hopping.times.length, 5);
  assert.equal(cycles.submitting.row, 7);
  assert.equal(cycles.error.row, 5);
  assert.equal(cycles.left.row, 2);
  assert.equal(cycles.right.row, 1);
  assert.deepEqual(cycles.left.times, [120, 120, 120, 120, 120, 120, 120, 220]);
  assert.deepEqual(cycles.left.times, cycles.right.times);
  for (const cycle of Object.values(cycles)) {
    assert.ok(cycle.times.length <= 8);
    assert.ok(cycle.times.every((time) => time > 0));
  }
});
