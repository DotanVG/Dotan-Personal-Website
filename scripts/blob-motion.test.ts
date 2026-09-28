import assert from "node:assert/strict";
import test from "node:test";
import {
  dampBlobAngle,
  getBlobPose,
  getBlobRollDelta,
  stepBlobSpring,
} from "../lib/blobMotion.ts";

test("blob route reaches both sides and recedes while crossing the center", () => {
  const poses = Array.from({ length: 101 }, (_, index) => getBlobPose(index / 100));
  const centerCrossings = poses.filter(({ x }) => Math.abs(x) < 0.25);
  const leftVisits = poses.filter(({ x }) => x < -2.2);

  assert.ok(Math.max(...poses.map(({ x }) => x)) > 1.8);
  assert.ok(Math.min(...poses.map(({ x }) => x)) < -2.2);
  assert.ok(centerCrossings.length > 0);
  assert.ok(leftVisits.length > 0);
  assert.ok(centerCrossings.every(({ scale, z }) => scale < 0.6 && z < -1.4));
  assert.ok(leftVisits.every(({ scale, z }) => scale < 0.7 && z < -0.7));
  assert.ok(poses.every((pose) => Object.values(pose).every(Number.isFinite)));
});

test("blob spring overshoots once and settles", () => {
  let value = 2;
  let velocity = 0;
  let crossedTarget = false;

  for (let frame = 0; frame < 240; frame++) {
    const next = stepBlobSpring(value, velocity, -2, 1 / 60);
    value = next.value;
    velocity = next.velocity;
    if (value < -2) crossedTarget = true;
  }

  assert.equal(crossedTarget, true);
  assert.ok(Math.abs(value + 2) < 0.001);
  assert.ok(Math.abs(velocity) < 0.001);
});

test("blob spring behaves consistently across frame rates", () => {
  function simulate(fps: number) {
    let value = 2;
    let velocity = 0;

    for (let frame = 0; frame < fps; frame++) {
      const next = stepBlobSpring(value, velocity, -2, 1 / fps);
      value = next.value;
      velocity = next.velocity;
    }

    return { value, velocity };
  }

  const results = [15, 30, 60].map(simulate);
  const values = results.map(({ value }) => value);
  const velocities = results.map(({ velocity }) => velocity);

  assert.ok(Math.max(...values) - Math.min(...values) < 0.001);
  assert.ok(Math.max(...velocities) - Math.min(...velocities) < 0.001);

  const largeFrame = stepBlobSpring(2, 0, -2, 1);
  assert.ok(Number.isFinite(largeFrame.value));
  assert.ok(Number.isFinite(largeFrame.velocity));
  assert.ok(largeFrame.value > -2.5 && largeFrame.value < 2);
});

test("blob heading takes the shortest route across the angle boundary", () => {
  const current = Math.PI - 0.05;
  const next = dampBlobAngle(current, -Math.PI + 0.05, 3.5, 1 / 60);

  assert.ok(next > current);
  assert.ok(next - current < 0.02);
});

test("blob roll follows its page movement and stops when movement stops", () => {
  const leftAndDown = getBlobRollDelta(-0.02, -0.03);
  const stopped = getBlobRollDelta(0, 0);

  assert.ok(leftAndDown.x > 0);
  assert.ok(leftAndDown.y < 0);
  assert.ok(stopped.x === 0);
  assert.ok(stopped.y === 0);
});

test("blob roll follows actual distance consistently across frame rates and stalls", () => {
  function simulate(fps: number) {
    let value = 2;
    let velocity = 0;
    let totalRoll = 0;

    for (let frame = 0; frame < fps; frame++) {
      const next = stepBlobSpring(value, velocity, -2, 1 / fps);
      totalRoll += getBlobRollDelta(next.value - value, 0).y;
      value = next.value;
      velocity = next.velocity;
    }

    return totalRoll;
  }

  const totals = [15, 30, 60].map(simulate);
  assert.ok(Math.max(...totals) - Math.min(...totals) < 0.001);

  const stalledFrame = stepBlobSpring(2, 0, -2, 1);
  const stalledRoll = getBlobRollDelta(stalledFrame.value - 2, 0);
  assert.ok(Math.abs(stalledRoll.y) < 2.5);
});
