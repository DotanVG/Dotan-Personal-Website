import { test } from "node:test";
import assert from "node:assert/strict";
import { QUALITY_WARMUP_S, createQualityGovernor } from "@/components/explore/quality";

const run = (g: ReturnType<typeof createQualityGovernor>, fps: number, seconds: number) => {
  const changes: string[] = [];
  for (let i = 0; i < fps * seconds; i++) {
    const q = g.frame(1 / fps);
    if (q) changes.push(q);
  }
  return changes;
};

test("fast frames never change the tier", () => {
  const g = createQualityGovernor("high");
  assert.deepEqual(run(g, 120, 120), []);
  assert.equal(g.quality, "high");
});

test("a start-up hitch inside the warm-up is ignored", () => {
  const g = createQualityGovernor("high");
  run(g, 10, QUALITY_WARMUP_S - 1);
  assert.deepEqual(run(g, 60, 30), []);
  assert.equal(g.quality, "high");
});

test("sustained slowness steps down one tier at a time, and never back up", () => {
  const g = createQualityGovernor("high");
  run(g, 60, 6);
  assert.deepEqual(run(g, 30, 8), ["low"], "30 fps is too slow for high");
  assert.deepEqual(run(g, 120, 60), [], "no climbing back up");
  assert.deepEqual(run(g, 20, 14), ["minimal"]);
  assert.deepEqual(run(g, 5, 30), [], "minimal is the floor");
});

test("a single slow window is not enough", () => {
  const g = createQualityGovernor("high");
  run(g, 60, 6);
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(run(g, 20, 3), []);
    assert.deepEqual(run(g, 60, 3), []);
  }
  assert.equal(g.quality, "high");
});
