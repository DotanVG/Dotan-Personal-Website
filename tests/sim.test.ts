import { test } from "node:test";
import assert from "node:assert/strict";
import { applyKey, createInput, type InputState } from "@/lib/game/input";
import { createRng } from "@/lib/game/math";
import {
  BUDGETS,
  DAMAGE_MIN_MPS,
  DAMAGE_PER_MPS,
  FIXED_DT,
  advance,
  createGame,
  findExit,
  getCar,
  registerImpact,
  stepGame,
  type Game,
  type SimCar,
} from "@/lib/game/sim";
import { VEHICLE_SPECS, createCar } from "@/lib/game/vehicle";

const newGame = () => createGame({ seed: 7, budget: BUDGETS.high });
/** Read through a function so TS doesn't narrow the live value after an assertion. */
const ctx = (g: Game) => g.hud.context;

function steps(g: Game, input: InputState, seconds: number, camYaw = 0) {
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) stepGame(g, input, camYaw);
}

/** Press and release a key through the real input path, with one step between. */
function tap(g: Game, input: InputState, code: string) {
  applyKey(input, code, true);
  stepGame(g, input, 0);
  applyKey(input, code, false);
}

/** Walk with W, steering the camera toward the target like a player would. */
function walkTo(g: Game, input: InputState, x: number, z: number, within = 1.2, maxS = 20) {
  applyKey(input, "KeyW", true);
  for (let i = 0; i < maxS / FIXED_DT; i++) {
    const p = g.player;
    if (Math.hypot(x - p.x, z - p.z) < within) break;
    stepGame(g, input, Math.atan2(x - p.x, z - p.z));
  }
  applyKey(input, "KeyW", false);
  steps(g, input, 0.3);
}

function spawnCar(g: Game): SimCar {
  return g.cars.find((c) => Math.hypot(c.x - g.city.spawn.carSpot.x, c.z - g.city.spawn.carSpot.z) < 0.5)!;
}

function enterSpawnCar(g: Game, input: InputState) {
  const car = spawnCar(g);
  // Walk to the kerb-side door (the right side of a west-facing car is north).
  walkTo(g, input, car.x - 0.3, car.z - 2.0, 0.6);
  assert.equal(ctx(g), "enter", "enter prompt should show beside the car");
  tap(g, input, "KeyE");
  assert.equal(g.player.state, "entering");
  steps(g, input, 0.5);
  assert.equal(g.player.state, "driving");
  return car;
}

function assertSingleController(g: Game) {
  const occupied = g.cars.filter((c) => c.role === "occupied");
  if (g.player.state === "driving" || g.player.state === "entering") {
    assert.equal(occupied.length, 1);
    assert.equal(occupied[0].id, g.player.vehicleId);
    assert.equal(occupied[0].ai, null, "AI must not drive the player's car");
  } else {
    assert.equal(occupied.length, 0);
    assert.equal(g.player.vehicleId, null);
  }
}

test("walk → enter → drive → exit → enter another car, with one controller at a time", () => {
  const g = newGame();
  const input = createInput();
  assert.equal(g.player.state, "onFoot");
  assert.equal(ctx(g), "none");
  tap(g, input, "KeyE"); // nothing in reach: no-op
  assert.equal(g.player.state, "onFoot");

  const car = enterSpawnCar(g, input);
  assertSingleController(g);
  assert.equal(g.player.vehicleId, car.id);

  // Drive west along the street for a couple of seconds.
  applyKey(input, "KeyW", true);
  steps(g, input, 2);
  applyKey(input, "KeyW", false);
  assert.ok(car.speed > 8, `should be moving, speed ${car.speed}`);

  // E while fast queues an exit: the car brakes to a stop, then the player gets out.
  tap(g, input, "KeyE");
  assert.equal(g.player.state, "driving");
  steps(g, input, 4);
  assert.equal(g.player.state, "onFoot");
  assertSingleController(g);
  assert.equal(car.role, "abandoned");
  assert.equal(car.ai, null, "an abandoned car never drives off on its own");
  const parkedAt = { x: car.x, z: car.z };
  steps(g, input, 3);
  assert.ok(Math.hypot(car.x - parkedAt.x, car.z - parkedAt.z) < 0.05, "abandoned car stays put");

  // Walk to a different car and take it.
  const other = g.cars
    .filter((c) => c !== car && !c.ai && !c.wrecked)
    .sort((a, b) => Math.hypot(a.x - g.player.x, a.z - g.player.z) - Math.hypot(b.x - g.player.x, b.z - g.player.z))[0];
  const s = Math.sin(other.yaw);
  const c = Math.cos(other.yaw);
  const side = other.spec.halfWidth + 1.2;
  // Approach whichever side is on the pavement (the one further from the road centre).
  const candidates = [1, -1].map((k) => ({ x: other.x + c * side * k, z: other.z - s * side * k }));
  walkTo(g, input, candidates[0].x, candidates[0].z, 0.5);
  if (ctx(g) !== "enter") walkTo(g, input, candidates[1].x, candidates[1].z, 0.5);
  assert.equal(ctx(g), "enter");
  tap(g, input, "KeyE");
  steps(g, input, 0.5);
  assert.equal(g.player.state, "driving");
  assert.equal(g.player.vehicleId, other.id);
  assertSingleController(g);
});

test("repeated action presses never double-fire a transition", () => {
  const g = newGame();
  const input = createInput();
  const car = spawnCar(g);
  walkTo(g, input, car.x - 0.3, car.z - 2.0, 0.6);
  // Two presses on consecutive steps: enter, then a stray press during the entry animation.
  tap(g, input, "KeyE");
  tap(g, input, "KeyE");
  steps(g, input, 0.5);
  assert.equal(g.player.state, "driving", "second press must not cancel or exit");
  // Key auto-repeat while held fires once.
  applyKey(input, "KeyE", true);
  applyKey(input, "KeyE", true, true);
  applyKey(input, "KeyE", true, true);
  stepGame(g, input, 0);
  applyKey(input, "KeyE", false);
  steps(g, input, 0.6);
  assert.equal(g.player.state, "onFoot");
  assertSingleController(g);
});

test("fast traffic is not enterable; a stopped traffic car loses its AI on possession", () => {
  const g = newGame();
  const input = createInput();
  const t = g.cars.find((c) => c.role === "traffic")!;
  assert.ok(t.ai);
  // Put the player on the kerb beside a moving car: no prompt while it moves.
  t.vx = Math.sin(t.yaw) * 10;
  t.vz = Math.cos(t.yaw) * 10;
  t.speed = 10;
  g.player.x = t.x + Math.cos(t.yaw) * 2.3;
  g.player.z = t.z - Math.sin(t.yaw) * 2.3;
  stepGame(g, input, 0);
  assert.notEqual(g.enterTarget?.car.id, t.id);
  // Stopped (e.g. at a junction): enterable, and AI is removed immediately.
  t.vx = t.vz = t.speed = 0;
  g.player.x = t.x + Math.cos(t.yaw) * 2.3;
  g.player.z = t.z - Math.sin(t.yaw) * 2.3;
  stepGame(g, input, 0);
  assert.equal(g.enterTarget?.car.id, t.id, "stopped traffic car is enterable from its driver side");
  tap(g, input, "KeyE");
  assert.equal(t.ai, null);
  assert.equal(t.role, "occupied");
  assert.equal(g.player.state, "entering");
});

test("a wall between the player and a door blocks entry", () => {
  const g = newGame();
  const input = createInput();
  const car = spawnCar(g);
  // Park the car right against the north retaining wall; stand on the far side of it.
  car.x = 0;
  car.z = -91.4;
  car.yaw = Math.PI / 2;
  g.player.x = 0.2;
  g.player.z = -95.2; // 2.3 m from the door anchor, but through the wall
  stepGame(g, input, 0);
  assert.notEqual(g.enterTarget?.car.id, car.id);
});

test("exit prefers the driver side, falls back, and refuses when boxed in", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  const left = findExit(g, car)!;
  // Driver side = the car's left.
  assert.ok((left.x - car.x) * c - (left.z - car.z) * s > 0.5, "driver side first");

  // Park blockers on both sides, behind and in front.
  const blockers: SimCar[] = [];
  const place = (lat: number, lon: number, yaw: number) => {
    const b = createCar(900 + blockers.length, VEHICLE_SPECS.van, car.x + c * lat + s * lon, car.z - s * lat + c * lon, yaw, "#888") as SimCar;
    Object.assign(b, { role: "parked", ai: null, drive: { throttle: 0, brake: 0, steer: 0, handbrake: true }, condition: 100, wrecked: false, sleeping: true, dents: [], damageVersion: 0, detached: 0, cracked: false, lastImpact: new Map(), waterS: 0, hiddenS: 0, stuckS: 0 });
    b.y = car.y;
    blockers.push(b);
    g.cars.push(b);
  };
  place(2.3, 0, car.yaw);
  const other = findExit(g, car)!;
  assert.ok((other.x - car.x) * c - (other.z - car.z) * s < -0.5, "falls back to passenger side");
  place(-2.3, 0, car.yaw);
  const rear = findExit(g, car)!;
  assert.ok((rear.x - car.x) * s + (rear.z - car.z) * c < -1, "then behind");
  place(0, -5.4, car.yaw);
  place(0, 5.4, car.yaw);
  assert.equal(findExit(g, car), null, "boxed in");
  tap(g, input, "KeyE");
  assert.equal(g.player.state, "driving", "stays in the car when every exit is blocked");
  assert.match(g.toast.text, /No room/);
  assert.equal(g.hud.suggestUnstuck, true, "Unstuck is offered right away");
});

/** Put the player's car on the north ring road heading straight at the retaining wall. */
function aimAtNorthWall(g: Game, car: SimCar, speed: number) {
  car.x = 10;
  car.z = -88;
  car.yaw = Math.PI; // forward = -z
  car.yawRate = 0;
  car.vx = 0;
  car.vz = -speed;
  car.speed = speed;
  car.sleeping = false;
}

test("resting and low-speed contact do not damage; hard impacts do, scaled by severity", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);

  aimAtNorthWall(g, car, 3); // ~11 km/h tap
  steps(g, input, 2);
  assert.equal(car.condition, 100, "a tap leaves no damage");

  // Hold the throttle against the wall: resting contact for 5 s.
  applyKey(input, "KeyW", true);
  steps(g, input, 5);
  applyKey(input, "KeyW", false);
  assert.equal(car.condition, 100, "pushing against a wall never accumulates damage");

  aimAtNorthWall(g, car, 17); // ~61 km/h
  steps(g, input, 2);
  const lost = 100 - car.condition;
  const expected = (17 - DAMAGE_MIN_MPS) * DAMAGE_PER_MPS;
  assert.ok(lost > expected * 0.6 && lost < expected * 1.4, `damage ${lost.toFixed(1)} vs ~${expected.toFixed(1)}`);
  assert.ok(car.dents.length >= 1, "a visible dent was recorded");
  assert.ok(car.detached > 0, "a severe hit knocks a part off");
  assert.equal(car.wrecked, false);
});

test("repeated severe impacts wreck the car: no propulsion, still collidable, still exitable", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  for (let i = 0; i < 5 && !car.wrecked; i++) {
    aimAtNorthWall(g, car, 22);
    steps(g, input, 1.5);
  }
  assert.ok(car.wrecked, `condition ${car.condition}`);
  assert.equal(g.hud.wrecked, true);
  // Throttle does nothing now (on a clear stretch, so nothing else nudges it).
  g.cars = g.cars.filter((c) => c === car || Math.hypot(c.x - 10, c.z + 80) > 15);
  car.x = 10;
  car.z = -80;
  car.yaw = Math.PI;
  car.vx = car.vz = car.speed = car.yawRate = 0;
  applyKey(input, "KeyW", true);
  steps(g, input, 3);
  applyKey(input, "KeyW", false);
  assert.ok(Math.hypot(car.vx, car.vz) < 0.2, "wreck cannot be driven");
  tap(g, input, "KeyE");
  steps(g, input, 0.5);
  assert.equal(g.player.state, "onFoot", "can leave a wreck");
  // The wreck stays in the world and a usable car is within reach.
  assert.ok(getCar(g, car.id));
  steps(g, input, 3);
  const usable = g.cars.some((c) => !c.wrecked && c.flip < 0.1 && Math.hypot(c.x - g.player.x, c.z - g.player.z) < 45);
  assert.ok(usable, "a fresh car is always within reach after a wreck");
});

test("at rest, full steering never spins the car in place", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  const yaw0 = car.yaw;
  applyKey(input, "KeyD", true);
  steps(g, input, 2);
  applyKey(input, "KeyD", false);
  assert.ok(Math.abs(car.yaw - yaw0) < 1e-6);
  assert.ok(Math.hypot(car.x - car.px, car.z - car.pz) < 1e-6);
});

test("the brake slows a forward-moving car before reverse engages", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  applyKey(input, "KeyW", true);
  steps(g, input, 2);
  applyKey(input, "KeyW", false);
  const v0 = car.speed;
  assert.ok(v0 > 8);
  applyKey(input, "KeyS", true);
  let reversedWhileFast = false;
  let minSpeed = v0;
  for (let i = 0; i < 4 / FIXED_DT; i++) {
    stepGame(g, input, 0);
    if (car.speed < 0 && minSpeed > 0.7) reversedWhileFast = true;
    minSpeed = Math.min(minSpeed, car.speed);
  }
  applyKey(input, "KeyS", false);
  assert.equal(reversedWhileFast, false);
  assert.ok(minSpeed < -2, `reverse engages after stopping (min ${minSpeed.toFixed(2)})`);
});

test("the handbrake breaks rear grip for a controllable slide", () => {
  const slip = (handbrake: boolean) => {
    const g = newGame();
    const input = createInput();
    const car = enterSpawnCar(g, input);
    car.x = 0;
    car.z = -84 + 1.75;
    car.yaw = -Math.PI / 2; // heading west along the north ring road
    car.vx = -18;
    car.vz = 0;
    car.speed = 18;
    applyKey(input, "KeyA", true);
    if (handbrake) applyKey(input, "Space", true);
    let maxSlip = 0;
    for (let i = 0; i < 0.8 / FIXED_DT; i++) {
      stepGame(g, input, 0);
      const lat = car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw);
      maxSlip = Math.max(maxSlip, Math.abs(lat));
    }
    return maxSlip;
  };
  const grip = slip(false);
  const slide = slip(true);
  assert.ok(slide > grip * 1.8 && slide > 2, `slide ${slide.toFixed(2)} vs grip ${grip.toFixed(2)}`);
});

test("vehicle kinds differ in acceleration and top speed", () => {
  const topSpeed = (kind: keyof typeof VEHICLE_SPECS) => {
    const g = newGame();
    const input = createInput();
    const car = enterSpawnCar(g, input);
    car.spec = VEHICLE_SPECS[kind];
    car.x = -110;
    car.z = -84 + 1.75;
    car.yaw = Math.PI / 2; // east along the north ring road (240 m straight)
    car.vx = car.vz = car.speed = 0;
    applyKey(input, "KeyW", true);
    steps(g, input, 3);
    const after3 = car.speed;
    return after3;
  };
  const coupe = topSpeed("coupe");
  const van = topSpeed("van");
  const hatch = topSpeed("hatch");
  assert.ok(coupe > hatch && hatch > van, `coupe ${coupe.toFixed(1)} hatch ${hatch.toFixed(1)} van ${van.toFixed(1)}`);
});

test("30 and 60 FPS frame pacing produce the identical simulation", () => {
  const run = (fps: number) => {
    const g = newGame();
    const input = createInput();
    const car = enterSpawnCar(g, input);
    applyKey(input, "KeyW", true);
    applyKey(input, "KeyA", true);
    for (let i = 0; i < 5 * fps; i++) advance(g, 1 / fps, input, 0);
    return [car.x, car.z, car.yaw, g.steps, g.cars.length];
  };
  assert.deepEqual(run(30), run(60));
});

test("a hidden tab cannot fast-forward physics", () => {
  const g = newGame();
  const input = createInput();
  const before = g.steps;
  advance(g, 30, input, 0); // 30 s away from the tab
  assert.ok(g.steps - before <= Math.ceil(0.1 / FIXED_DT));
});

test("Unstuck rights a flipped car in place without repairing it", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  car.condition = 42;
  car.flip = car.flipTarget = 1;
  const at = { x: car.x, z: car.z };
  tap(g, input, "KeyR");
  assert.equal(car.flip, 0);
  assert.equal(car.condition, 42);
  assert.ok(Math.hypot(car.x - at.x, car.z - at.z) < 0.5);
  assert.equal(g.player.state, "driving");
});

test("driving into the sea recovers the car automatically", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  car.x = -40;
  car.z = 118;
  car.y = -0.9;
  car.vx = car.vz = 0;
  steps(g, input, 3);
  assert.ok(car.z < 97, `car returned to land (z ${car.z.toFixed(1)})`);
  assert.equal(g.player.state, "driving");
});

test("ten minutes of chaotic play stays finite, bounded and populated", () => {
  const g = createGame({ seed: 11, budget: BUDGETS.low });
  const input = createInput();
  const rng = createRng(99);
  const budget = BUDGETS.low;
  const cap = budget.traffic + budget.parked + budget.abandoned + 4;
  let trafficSum = 0;
  let samples = 0;
  let maxCars = 0;
  let enters = 0;
  const codes = ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft"];
  for (let second = 0; second < 600; second++) {
    // Change held keys every second, press E/R now and then.
    for (const code of codes) applyKey(input, code, rng.chance(code === "KeyW" ? 0.7 : 0.25));
    if (rng.chance(0.15)) applyKey(input, "KeyE", true);
    if (rng.chance(0.03)) applyKey(input, "KeyR", true);
    const camYaw = rng.range(-Math.PI, Math.PI);
    const wasDriving = g.player.state === "driving";
    for (let i = 0; i < 60; i++) stepGame(g, input, camYaw);
    applyKey(input, "KeyE", false);
    applyKey(input, "KeyR", false);
    if (!wasDriving && g.player.state === "driving") enters++;
    // Pull the player toward the nearest car sometimes so the loop is exercised.
    if (g.player.state === "onFoot" && rng.chance(0.3)) {
      const near = g.cars.filter((c) => !c.wrecked).sort((a, b) => Math.hypot(a.x - g.player.x, a.z - g.player.z) - Math.hypot(b.x - g.player.x, b.z - g.player.z))[0];
      if (near) walkTo(g, input, near.x + Math.cos(near.yaw) * 2, near.z - Math.sin(near.yaw) * 2, 0.8, 8);
    }
    for (const c of g.cars) {
      for (const v of [c.x, c.y, c.z, c.vx, c.vz, c.yaw, c.yawRate, c.condition]) assert.ok(Number.isFinite(v), "car state finite");
    }
    for (const v of [g.player.x, g.player.y, g.player.z]) assert.ok(Number.isFinite(v), "player state finite");
    assertSingleController(g);
    maxCars = Math.max(maxCars, g.cars.length);
    trafficSum += g.cars.filter((c) => c.role === "traffic").length;
    samples++;
    assert.ok(g.events.length <= 96);
    g.events.length = 0;
  }
  assert.ok(maxCars <= cap, `car count bounded (${maxCars} <= ${cap})`);
  assert.ok(trafficSum / samples > budget.traffic * 0.5, `traffic not starved (avg ${(trafficSum / samples).toFixed(1)})`);
  assert.ok(enters >= 3, `the loop was exercised (${enters} entries)`);
});

test("traffic keeps flowing and never overlaps deeply", () => {
  const g = newGame();
  const input = createInput();
  let moving = 0;
  let total = 0;
  for (let s = 0; s < 180; s++) {
    steps(g, input, 1);
    for (const c of g.cars) {
      if (c.role !== "traffic") continue;
      total++;
      if (c.speed > 3) moving++;
    }
    for (let i = 0; i < g.cars.length; i++) {
      for (let j = i + 1; j < g.cars.length; j++) {
        const a = g.cars[i];
        const b = g.cars[j];
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.8, `cars ${a.id}/${b.id} stacked`);
      }
    }
  }
  assert.ok(moving / total > 0.6, `most traffic is moving (${((moving / total) * 100).toFixed(0)}%)`);
});

test("a fast hit knocks a lamp post over; a slow push does not; it returns later out of sight", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  const lamp = g.city.colliders.find((c) => c.shape === "circle" && c.lamp !== undefined && Math.abs(c.x) > 30 && c.z < -20)!;
  assert.ok(lamp && lamp.lamp !== undefined);
  g.cars = g.cars.filter((c) => c === car);
  const aim = (speed: number) => {
    // Head straight at the lamp from 6 m away along x.
    car.x = lamp.x - 6;
    car.z = lamp.z;
    car.yaw = Math.PI / 2;
    car.yawRate = 0;
    car.vx = speed;
    car.vz = 0;
    car.speed = speed;
    car.y = sampleGroundH(g, car.x, car.z);
  };
  aim(2);
  steps(g, input, 3);
  assert.equal(g.brokenLamps.size, 0, "rolling into a lamp slowly just stops the car");
  aim(15);
  const cond = car.condition;
  steps(g, input, 0.8);
  assert.ok(g.brokenLamps.has(lamp.lamp!), "fast hit flattens the lamp");
  assert.ok(Math.hypot(car.vx, car.vz) > 8, `car keeps most of its speed (${Math.hypot(car.vx, car.vz).toFixed(1)} m/s)`);
  assert.ok(cond - car.condition < 12, "only a small knock");
  // Far away and out of view for long enough: it stands again.
  g.player.x = car.x = lamp.x + 150;
  g.viewer = { x: lamp.x + 160, z: lamp.z, fx: 1, fz: 0, halfFov: 0.6, set: true };
  steps(g, input, 45);
  assert.equal(g.brokenLamps.has(lamp.lamp!), false, "lamp restored out of sight");
});

function sampleGroundH(g: Game, x: number, z: number) {
  return g.terrain.sample(x, z).h;
}

test("getting out while still holding the gas leaves the car parked, not driving itself", () => {
  const g = newGame();
  const input = createInput();
  const car = enterSpawnCar(g, input);
  // Creep forward, then press E with W still held (e.g. nosed into a wall).
  applyKey(input, "KeyW", true);
  steps(g, input, 0.25);
  assert.ok(Math.abs(car.speed) <= 2.5, "slow enough to exit directly");
  tap(g, input, "KeyE");
  assert.equal(g.player.state, "exiting");
  steps(g, input, 3);
  applyKey(input, "KeyW", false);
  assert.equal(g.player.state, "onFoot");
  assert.equal(car.drive.throttle, 0);
  assert.equal(car.drive.handbrake, true);
  assert.ok(Math.hypot(car.vx, car.vz) < 0.1, `abandoned car is stopped (${Math.hypot(car.vx, car.vz).toFixed(2)} m/s)`);
});

test("wrecked parked cars become recyclable and the parked budget holds", () => {
  const g = newGame();
  const input = createInput();
  const parked = g.cars.find((c) => c.role === "parked" && Math.hypot(c.x - g.player.x, c.z - g.player.z) > 60)!;
  parked.sleeping = false;
  registerImpact(g, parked, -5, 60, parked.x, parked.z, 1, 0, 1);
  registerImpact(g, parked, -6, 60, parked.x, parked.z, 1, 0, 1);
  assert.ok(parked.wrecked);
  assert.equal(parked.role, "stalled", "a wrecked parked car counts as abandoned, not parked");
  // Stand somewhere with no parked cars nearby for a while: the guarantee spawns
  // one, and the parked count never runs away past its budget.
  g.player.x = 40;
  g.player.z = 128;
  g.player.y = 0.14;
  let maxParked = 0;
  for (let s = 0; s < 60; s++) {
    steps(g, input, 1);
    maxParked = Math.max(maxParked, g.cars.filter((c) => c.role === "parked").length);
  }
  assert.ok(maxParked <= g.options.budget.parked + 1, `parked ${maxParked} within budget`);
  assert.ok(g.cars.filter((c) => c.role === "traffic").length >= g.options.budget.traffic - 2, "traffic still respawns");
});

test("an intersection lock that times out is not immediately reclaimed by the same car", () => {
  const g = newGame();
  const input = createInput();
  const car = g.cars.find((c) => c.ai)!;
  const ai = car.ai!;
  const node = g.city.nodes.find((n) => n.nbr.includes(-1) === false)!.id;
  ai.holding = node;
  ai.holdUntil = ai.i + 999;
  g.nodeLock[node] = car.id;
  g.nodeLockAt[node] = g.time - 30;
  stepGame(g, input, 0);
  assert.equal(ai.banNode, node);
  assert.notEqual(g.nodeLock[node], car.id);
});

test("a traffic car jammed behind a blockage gives up after a bounded delay, even in view", () => {
  const g = newGame();
  const input = createInput();
  const car = g.cars.find((c) => c.ai && c.role === "traffic")!;
  // Park the player on foot right in its path and keep the camera on it.
  const ai = car.ai!;
  const ahead = ai.pts[Math.min(ai.pts.length - 1, ai.i + 6)];
  g.player.x = ahead.x;
  g.player.z = ahead.z;
  g.viewer = { x: car.x - Math.sin(car.yaw) * 10, z: car.z - Math.cos(car.yaw) * 10, fx: Math.sin(car.yaw), fz: Math.cos(car.yaw), halfFov: 0.8, set: true };
  let gaveUpAt = -1;
  for (let i = 0; i < 40 / FIXED_DT; i++) {
    g.player.x = ahead.x; // keep standing there
    g.player.z = ahead.z;
    stepGame(g, input, 0);
    if (car.role !== "traffic") {
      gaveUpAt = g.time;
      break;
    }
  }
  assert.ok(gaveUpAt > 0 && gaveUpAt < 32, `gave up at ${gaveUpAt.toFixed(1)} s`);
  assert.equal(car.ai, null);
  assert.equal(car.role, "stalled");
});
