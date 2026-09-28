import { test } from "node:test";
import assert from "node:assert/strict";
import { experience } from "@/content/experience";
import { education } from "@/content/education";
import {
  CURB_HEIGHT,
  LANDMARK_SLUGS,
  createCity,
  inWorldBounds,
  isRoad,
  sampleGround,
  type GroundSample,
} from "@/lib/game/city";
import { boxBox, circleBox, circleCircle, newContact } from "@/lib/game/collide";
import { laneSamples } from "@/lib/game/traffic";
import { VEHICLE_SPECS } from "@/lib/game/vehicle";

const city = createCity(7);
const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
const contact = newContact();

function overlapsStatic(x: number, z: number, r: number, above = 0) {
  return city.colliders.some((c) => {
    if (c.top < above + 0.3) return false;
    return c.shape === "box" ? circleBox(x, z, r, c, contact) : circleCircle(x, z, r, c.x, c.z, c.r, contact);
  });
}

test("every portfolio entry has exactly one landmark lot", () => {
  const slugs = [...experience.map((e) => e.slug), ...education.map((e) => e.slug)].sort();
  assert.deepEqual([...LANDMARK_SLUGS].sort(), slugs);
  assert.deepEqual(city.landmarks.map((l) => l.slug).sort(), slugs);
});

test("landmark pads sit on walkable ground, clear of colliders, next to their building", () => {
  for (const l of city.landmarks) {
    sampleGround(city, l.pad.x, l.pad.z, gs);
    assert.equal(gs.h, CURB_HEIGHT, `${l.slug} pad height`);
    assert.ok(!overlapsStatic(l.pad.x, l.pad.z, 0.5, gs.h), `${l.slug} pad is blocked`);
    const toBuilding = Math.max(Math.abs(l.pad.x - l.x) - l.hx, Math.abs(l.pad.z - l.z) - l.hz);
    assert.ok(toBuilding < 8, `${l.slug} pad is ${toBuilding.toFixed(1)} m from its building`);
  }
});

test("the same seed builds the same city; decoration varies with seed", () => {
  const again = createCity(7);
  assert.deepEqual(
    again.buildings.map((b) => [b.x, b.z, b.h, b.body]),
    city.buildings.map((b) => [b.x, b.z, b.h, b.body]),
  );
  const other = createCity(8);
  assert.notDeepEqual(
    other.buildings.map((b) => b.h),
    city.buildings.map((b) => b.h),
  );
  // Landmarks and roads are authored, not random.
  assert.deepEqual(
    other.landmarks.map((l) => [l.slug, l.x, l.z]),
    city.landmarks.map((l) => [l.slug, l.x, l.z]),
  );
});

test("no building or prop collider intrudes onto the road", () => {
  for (const c of city.colliders) {
    const pts: [number, number][] =
      c.shape === "box"
        ? [
            [c.x, c.z],
            [c.x - c.hx, c.z - c.hz],
            [c.x + c.hx, c.z - c.hz],
            [c.x - c.hx, c.z + c.hz],
            [c.x + c.hx, c.z + c.hz],
          ]
        : [[c.x, c.z]];
    for (const [x, z] of pts) {
      // Rotated benches are small; axis-aligned corners are exact for everything else.
      if (c.shape === "box" && c.yaw !== 0) continue;
      assert.ok(!isRoad(x, z), `collider ${c.id} at (${x.toFixed(1)}, ${z.toFixed(1)}) is on the road`);
    }
  }
});

test("parking spots are on the road, clear of each other and of colliders", () => {
  const car = VEHICLE_SPECS.van;
  for (const s of city.parking) {
    assert.ok(isRoad(s.x, s.z) || sampleGround(city, s.x, s.z, gs).surface === "road", `spot ${s.id} surface`);
    const box = { x: s.x, z: s.z, hx: car.halfWidth, hz: car.halfLength, yaw: s.yaw };
    const hit = city.colliders.some((c) =>
      c.shape === "box" ? boxBox(box, c, contact) : circleBox(c.x, c.z, c.r, box, contact),
    );
    assert.ok(!hit, `spot ${s.id} at (${s.x}, ${s.z}) overlaps scenery`);
  }
});

test("lane samples are on asphalt and inside the world", () => {
  const lanes = laneSamples(city);
  assert.ok(lanes.length > 200);
  for (const l of lanes) {
    assert.ok(isRoad(l.x, l.z), `lane (${l.x}, ${l.z}) off road`);
    assert.ok(inWorldBounds(l.x, l.z));
  }
});

test("spawn point is walkable and its car is parked beside it", () => {
  const s = city.spawn;
  assert.ok(!overlapsStatic(s.x, s.z, 0.5, CURB_HEIGHT));
  assert.ok(Math.hypot(s.carSpot.x - s.x, s.carSpot.z - s.z) < 10);
});

test("the sea is water, the promenade is dry, and the beach slopes between them", () => {
  assert.equal(sampleGround(city, 0, 92, gs).surface, "paving");
  assert.equal(sampleGround(city, 0, 100, gs).surface, "sand");
  assert.equal(sampleGround(city, 0, 130, gs).surface, "water");
  assert.equal(sampleGround(city, 40, 120, gs).surface, "wood", "pier deck");
});

test("collision primitives return separating normals", () => {
  const a = { x: 0, z: 0, hx: 1, hz: 2, yaw: 0 };
  const b = { x: 1.8, z: 0, hx: 1, hz: 2, yaw: 0 };
  assert.ok(boxBox(a, b, contact));
  assert.ok(contact.nx < -0.99 && Math.abs(contact.depth - 0.2) < 1e-9);
  assert.ok(!boxBox(a, { ...b, x: 2.1 }, contact));
  assert.ok(circleBox(0, 2.3, 0.5, a, contact));
  assert.ok(contact.nz > 0.99 && Math.abs(contact.depth - 0.2) < 1e-9);
});

test("rendered city geometry never stands on the asphalt", async () => {
  // Guards against mis-sized render-only geometry (walls, blobs) crossing streets.
  const { buildCityGeometry } = await import("@/components/explore/cityMesh");
  const geo = buildCityGeometry(city);
  let offending = 0;
  let sample = "";
  for (const g of geo.chunks) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (y > 0.3 && isRoad(x, z)) {
        offending++;
        sample ||= `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
      }
    }
  }
  assert.equal(offending, 0, `triangles above the road, e.g. ${sample}`);
});
