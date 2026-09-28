import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampPetDrag,
  cycles,
  lookPose,
  scrollGesture,
  startWalk,
  walkFrame,
  walkStep,
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
  // Touch glances use a wider 20° band: 17° off still holds the pose.
  assert.equal(lookPose(30, -100, 0, 20), 0);
});

test("drag walk steps with distance, turns with hysteresis, dangles when carried", () => {
  const drive = (w, steps) => {
    for (const [dx, dy, now] of steps) w = walkStep(w, dx, dy, now);
    return w;
  };
  // 6 px per 100 ms: a frame every second step, i.e. per 12 px, not per tick.
  let w = drive(startWalk(1), [[6, 0, 100], [6, 0, 200], [6, 0, 300], [6, 0, 400]]);
  assert.equal(w.col, 2);
  assert.deepEqual(walkFrame(w), [cycles.right.row, 2]);
  // A fast finger can't spin the legs: at most one frame per 60 ms, extra dropped.
  w = drive(startWalk(1), [[40, 0, 1000], [40, 0, 1010], [40, 0, 1020], [40, 0, 1070]]);
  assert.equal(w.col, 2);
  // Jitter back and forth under 16 px never turns him around...
  w = drive(startWalk(1), [[30, 0, 0], [-10, 0, 200], [8, 0, 400], [-12, 0, 600]]);
  assert.equal(w.dir, 1);
  // ...a real reversal does, and the leg phase carries on.
  const before = w.col;
  w = drive(w, [[-20, 0, 800]]);
  assert.equal(w.dir, -1);
  assert.deepEqual(walkFrame(w), [cycles.left.row, (before + 1) % 8]);
  // Mostly vertical: carried pose; horizontal again: walking.
  w = drive(startWalk(1), [[1, 12, 0], [1, 12, 100], [1, 12, 200]]);
  assert.equal(w.carried, true);
  assert.deepEqual(walkFrame(w), [cycles.hopping.row, 1]);
  w = drive(w, [[14, 0, 300], [14, 0, 400]]);
  assert.equal(w.carried, false);
  // Quiet + reduced motion: one frame, facing the way.
  assert.deepEqual(walkFrame(w, true), [cycles.right.row, 0]);
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
  assert.equal(g.hop, false, "6 s cooldown between wheel hops");
  g = scrollGesture(g, 140, 8200, true);
  assert.equal(g.hop, true);
  g = scrollGesture(g, 500, 16200, false);
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
