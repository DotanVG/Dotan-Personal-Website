import { test } from "node:test";
import assert from "node:assert/strict";
import { applyKey, clearInput, createInput, isGameKey, resolveInput, stickValue } from "@/lib/game/input";

test("actions latch once per physical press; auto-repeat never re-fires", () => {
  const input = createInput();
  assert.equal(applyKey(input, "KeyE", true), true);
  assert.equal(input.actionQueued, true);
  input.actionQueued = false; // consumed by a sim step
  applyKey(input, "KeyE", true, true);
  applyKey(input, "KeyE", true, true);
  assert.equal(input.actionQueued, false, "repeat events are ignored");
  applyKey(input, "KeyE", false);
  applyKey(input, "KeyE", true);
  assert.equal(input.actionQueued, true, "a new press fires again");
});

test("non-game keys are left to the browser", () => {
  const input = createInput();
  assert.equal(applyKey(input, "Tab", true), false);
  assert.equal(applyKey(input, "KeyF", true), false);
  assert.equal(isGameKey("Escape"), false, "Escape is handled by overlays, not movement");
  assert.equal(input.keys.size, 0);
});

test("clearing input releases every held key, touch control and pending action", () => {
  const input = createInput();
  applyKey(input, "KeyW", true);
  applyKey(input, "Space", true);
  input.touch.steer = 0.8;
  input.touch.throttle = 1;
  input.touch.handbrake = true;
  input.lookDX = 30;
  clearInput(input);
  const r = resolveInput(input);
  assert.deepEqual(
    [r.moveX, r.moveY, r.steer, r.throttle, r.brake, r.handbrake, input.jumpQueued, input.lookDX],
    [0, 0, 0, 0, 0, false, false, 0],
  );
});

test("keyboard diagonals are normalised; touch fills in when the keyboard is idle", () => {
  const input = createInput();
  applyKey(input, "KeyW", true);
  applyKey(input, "KeyD", true);
  const r = resolveInput(input);
  assert.ok(Math.abs(Math.hypot(r.moveX, r.moveY) - 1) < 1e-9);
  applyKey(input, "KeyW", false);
  applyKey(input, "KeyD", false);
  input.touch.moveX = 0.3;
  input.touch.moveY = 0.4;
  input.touch.steer = -0.5;
  input.touch.throttle = 1;
  const t = resolveInput(input);
  assert.deepEqual([t.moveX, t.moveY, t.steer, t.throttle], [0.3, 0.4, -0.5, 1]);
});

test("releasing one touch control leaves the others untouched", () => {
  const input = createInput();
  // Steering thumb and throttle thumb down together, then the steering thumb lifts.
  input.touch.steer = 0.7;
  input.touch.throttle = 1;
  input.touch.steer = 0;
  const r = resolveInput(input);
  assert.equal(r.throttle, 1);
  assert.equal(r.steer, 0);
});

test("stick values: radial deadzone, clamped radius, full-range output", () => {
  assert.equal(stickValue(3, 0, 50).mag, 0, "inside the deadzone");
  const full = stickValue(200, 0, 50);
  assert.equal(full.x, 1);
  assert.equal(full.knobX, 50, "knob stops at the rim");
  const half = stickValue(0, -30, 50);
  assert.ok(half.y < 0 && half.y > -1);
  assert.ok(Math.abs(Math.hypot(half.x, half.y) - half.mag) < 1e-9);
});
