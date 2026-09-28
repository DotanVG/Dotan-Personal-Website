// Game simulation: fixed-step world update, player state machine, contacts,
// damage, recovery and population management. No rendering or DOM here; the
// React layer reads state and drains `events` each frame.

import {
  PROMENADE_EDGE_Z,
  SURFACE_DRAG,
  SURFACE_GRIP,
  WATER_LEVEL,
  createCity,
  inWorldBounds,
  sampleGround,
  type City,
  type GroundSample,
  type Landmark,
  type ParkingSpot,
} from "./city";
import {
  boxBox,
  boxCircle,
  circleBox,
  circleCircle,
  newContact,
  pointInBox,
  segmentBox,
  segmentCircle,
  type BoxShape,
  type StaticCollider,
} from "./collide";
import { resolveInput, type InputState, type ResolvedInput } from "./input";
import { approach, clamp, createRng, dampAngle, wrapAngle, type Rng } from "./math";
import {
  CRUISE_MPS,
  PATH_SPACING_M,
  STOP_BEFORE_M,
  FOLLOW_GAP_M,
  LOCK_CLAIM_M,
  aiFromSample,
  extendPath,
  laneSamples,
  nextIntersection,
  pathHeading,
  pursuitSteer,
  stoppingSpeed,
  trackProgress,
  turnSpeedAhead,
  type Ai,
} from "./traffic";
import {
  LANDING_DAMAGE_MPS,
  NO_DRIVE,
  VEHICLE_SPECS,
  createCar,
  stepVehicle,
  toKmh,
  type Car,
  type DriveInput,
  type Terrain,
  type VehicleKind,
} from "./vehicle";

// ---- Timing ----
export const FIXED_DT = 1 / 60;
/** Longest real frame the accumulator accepts (tab switches, hitches). */
export const MAX_FRAME_S = 0.1;
/** Split a step when any car would travel further than this in it (anti-tunnelling). */
export const MAX_SUBSTEP_TRAVEL_M = 0.6;

// ---- Player ----
export const PLAYER_RADIUS_M = 0.36;
export const JOG_MPS = 5.2;
export const RUN_MPS = 8.2;
export const PLAYER_ACCEL_MPS2 = 38;
export const PLAYER_AIR_ACCEL_MPS2 = 10;
export const PLAYER_GRAVITY_MPS2 = 19;
export const JUMP_MPS = 6;
export const PLAYER_MAX_STEP_M = 0.55;
export const STRIDE_M = 1.45;
export const STUMBLE_S = 0.6;

// ---- Interaction ----
export const ENTER_RADIUS_M = 2.4;
export const ENTER_MAX_SPEED_MPS = 2.2;
export const ENTER_TIME_S = 0.4;
export const EXIT_TIME_S = 0.3;
export const EXIT_MAX_SPEED_MPS = 2.5;
/** Matches the glowing disc drawn around each landmark pad. */
export const INSPECT_RADIUS_M = 1.9;
export const LANDMARK_HINT_M = 14;

// ---- Damage ----
export const IMPACT_FEEDBACK_MPS = 1.2;
export const DAMAGE_MIN_MPS = 4.5;
export const DAMAGE_PER_MPS = 2.6;
/** No single impact takes more than this: wrecking needs repeated hard hits. */
export const MAX_IMPACT_DAMAGE = 62;
export const SEVERE_DAMAGE = 14;
export const IMPACT_COOLDOWN_S = 0.3;
export const FLIP_IMPACT_MPS = 15;
export const RESTITUTION_STATIC = 0.2;
export const RESTITUTION_CARS = 0.25;
export const CONTACT_FRICTION = 0.35;
/** Positional correction per step (fraction of penetration) and allowed slop. */
const CORRECTION = 0.85;
const SLOP_M = 0.01;

/** An AI car holding an intersection longer than this gives it up. */
const LOCK_TIMEOUT_S = 9;
/** A traffic car jammed this long gives up its route (even in view) and parks. */
export const JAM_GIVE_UP_S = 25;

// ---- Breakable street lamps ----
/** Closing speed above which a car knocks a lamp post over instead of stopping. */
export const LAMP_BREAK_MPS = 4.5;
/** Speed kept after flattening a lamp. */
const LAMP_SPEED_KEEP = 0.86;
/** Knocked-over lamps return once this old, out of view and away from the player. */
const LAMP_RESTORE_S = 40;

// ---- Recovery ----
export const WATER_RECOVER_S = 1.6;
export const UNSTUCK_COOLDOWN_S = 1.5;
export const STUCK_HINT_S = 2;

// ---- Population ----
export type Budget = { traffic: number; parked: number; abandoned: number };
export const BUDGETS: Record<"minimal" | "low" | "high", Budget> = {
  minimal: { traffic: 6, parked: 12, abandoned: 4 },
  low: { traffic: 8, parked: 14, abandoned: 5 },
  high: { traffic: 12, parked: 20, abandoned: 7 },
};
export const DESPAWN_DIST_M = 175;
export const SPAWN_MIN_DIST_M = 45;
export const SPAWN_MAX_DIST_M = 150;
/** Never recycle cars this close to the player. */
export const NEAR_PROTECT_M = 28;
export const FRESH_CAR_RADIUS_M = 45;
const HOUSEKEEP_EVERY = 15; // steps
const VIEW_DIST_M = 210;

export const PAINTS = [
  "#e0614b",
  "#f2e6cf",
  "#2f8f8a",
  "#e2b04a",
  "#2d4a6b",
  "#8fae8b",
  "#f5f3ee",
  "#3a3d44",
  "#c9543a",
  "#7aa2b8",
];
const TRAFFIC_KINDS: VehicleKind[] = ["hatch", "hatch", "sedan", "sedan", "sedan", "van", "van", "coupe"];
const PARKED_KINDS: VehicleKind[] = ["hatch", "hatch", "sedan", "sedan", "van", "coupe", "coupe"];

export type Role = "parked" | "traffic" | "abandoned" | "stalled" | "occupied";

export type Dent = { lx: number; ly: number; lz: number; nx: number; nz: number; depth: number; radius: number };

export type SimCar = Car & {
  role: Role;
  ai: Ai | null;
  drive: DriveInput;
  condition: number;
  wrecked: boolean;
  sleeping: boolean;
  dents: Dent[];
  /** Bumped whenever dents/detached parts change so the renderer can rebuild. */
  damageVersion: number;
  /** Bitmask of detached parts: 1 front bumper, 2 rear bumper, 4 left mirror, 8 right mirror, 16 hood. */
  detached: number;
  cracked: boolean;
  lastImpact: Map<number, number>;
  waterS: number;
  hiddenS: number;
  stuckS: number;
};

export type PlayerState = "onFoot" | "entering" | "driving" | "exiting";

export type Player = {
  state: PlayerState;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  facing: number;
  grounded: boolean;
  vehicleId: number | null;
  t: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  carStartX: number;
  carStartZ: number;
  walkPhase: number;
  /** Horizontal speed for animation (m/s). */
  moveSpeed: number;
  stumbleS: number;
  waterS: number;
  pendingExit: boolean;
  px: number;
  pz: number;
  py: number;
  pfacing: number;
};

export type ContextKind = "none" | "enter" | "inspect" | "exit" | "slowToExit" | "exitBlocked";

export type Hud = {
  state: PlayerState;
  speedKmh: number;
  condition: number;
  wrecked: boolean;
  flipped: boolean;
  vehicle: string | null;
  context: ContextKind;
  contextLabel: string;
  contextSlug: string | null;
  suggestUnstuck: boolean;
  nearLandmark: string | null;
};

export type GameEvent =
  | { type: "impact"; carId: number; severity: number; x: number; y: number; z: number; damage: number }
  | { type: "debris"; x: number; y: number; z: number; vx: number; vy: number; vz: number; color: string; size: number }
  | { type: "wreck"; carId: number }
  | { type: "splash"; x: number; z: number }
  | { type: "inspect"; slug: string }
  | { type: "enter"; carId: number }
  | { type: "exit"; carId: number }
  | { type: "recover"; what: "car" | "player" }
  | { type: "bump"; x: number; z: number }
  | { type: "lampDown"; lamp: number; x: number; z: number };

export type Viewer = { x: number; z: number; fx: number; fz: number; halfFov: number; set: boolean };

export type GameOptions = { seed: number; budget: Budget };

export type Game = {
  city: City;
  options: GameOptions;
  rng: Rng;
  cars: SimCar[];
  player: Player;
  time: number;
  steps: number;
  nextId: number;
  viewer: Viewer;
  events: GameEvent[];
  hud: Hud;
  toast: { text: string; until: number; id: number };
  nodeLock: Int32Array;
  nodeLockAt: Float64Array;
  lanes: ReturnType<typeof laneSamples>;
  accumulator: number;
  lastUnstuckAt: number;
  terrain: Terrain;
  /** Seconds the throttle has been held without moving (stuck hint). */
  enterTarget: { car: SimCar; ax: number; az: number } | null;
  inspectTarget: Landmark | null;
  /** Knocked-over lamps: lamp index to the time it fell. */
  brokenLamps: Map<number, number>;
  /** Bumped whenever the set of standing lamps changes (for the renderer). */
  lampVersion: number;
  /** Offer Unstuck until this time after every exit turned out to be blocked. */
  exitBlockedUntil: number;
};

/** Static colliders that still stand (knocked-over lamps are skipped). */
const standing = (g: Game, c: StaticCollider) => c.lamp === undefined || !g.brokenLamps.has(c.lamp);

const MAX_EVENTS = 96;

// ---------------------------------------------------------------------------
// Creation & reset

export function createGame(opts: Partial<GameOptions> = {}): Game {
  const options: GameOptions = { seed: 7, budget: BUDGETS.high, ...opts };
  const city = createCity(options.seed);
  const gs: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
  const tOut = { h: 0, gx: 0, gz: 0, grip: 1, drag: 1, water: false };
  const g: Game = {
    city,
    options,
    rng: createRng(options.seed * 7919 + 13),
    cars: [],
    player: null as unknown as Player,
    time: 0,
    steps: 0,
    nextId: 1,
    viewer: { x: 0, z: 0, fx: 0, fz: 1, halfFov: 0.6, set: false },
    events: [],
    hud: emptyHud(),
    toast: { text: "", until: 0, id: 0 },
    nodeLock: new Int32Array(city.nodes.length).fill(-1),
    nodeLockAt: new Float64Array(city.nodes.length),
    lanes: laneSamples(city),
    accumulator: 0,
    lastUnstuckAt: -Infinity,
    terrain: {
      sample(x, z) {
        sampleGround(city, x, z, gs);
        tOut.h = gs.h;
        tOut.gx = gs.gx;
        tOut.gz = gs.gz;
        tOut.grip = SURFACE_GRIP[gs.surface];
        tOut.drag = SURFACE_DRAG[gs.surface];
        tOut.water = gs.surface === "water";
        return tOut;
      },
    },
    enterTarget: null,
    inspectTarget: null,
    brokenLamps: new Map(),
    lampVersion: 0,
    exitBlockedUntil: -1,
  };
  populate(g);
  return g;
}

function emptyHud(): Hud {
  return {
    state: "onFoot",
    speedKmh: 0,
    condition: 100,
    wrecked: false,
    flipped: false,
    vehicle: null,
    context: "none",
    contextLabel: "",
    contextSlug: null,
    suggestUnstuck: false,
    nearLandmark: null,
  };
}

function newPlayer(x: number, z: number, facing: number, y: number): Player {
  return {
    state: "onFoot",
    x,
    z,
    y,
    vx: 0,
    vz: 0,
    vy: 0,
    facing,
    grounded: true,
    vehicleId: null,
    t: 0,
    fromX: x,
    fromZ: z,
    toX: x,
    toZ: z,
    carStartX: 0,
    carStartZ: 0,
    walkPhase: 0,
    moveSpeed: 0,
    stumbleS: 0,
    waterS: 0,
    pendingExit: false,
    px: x,
    pz: z,
    py: y,
    pfacing: facing,
  };
}

function populate(g: Game) {
  const { city } = g;
  const s = city.spawn;
  g.player = newPlayer(s.x, s.z, s.yaw, groundH(g, s.x, s.z));
  // A bright coupe waits at the kerb right by the spawn point.
  spawnParked(g, s.carSpot, "coupe", PAINTS[0]);
  // Fill parking: a few guaranteed near spawn, the rest spread through the city.
  // Keep the hero car the obvious first pick with an open lane ahead of it.
  const heroClear = (p: ParkingSpot) =>
    Math.hypot(p.x - s.carSpot.x, p.z - s.carSpot.z) > 12 && !(Math.abs(p.z - s.carSpot.z) < 1 && p.x < s.carSpot.x && p.x > s.carSpot.x - 40);
  const near = city.parking
    .filter((p) => heroClear(p) && Math.hypot(p.x - s.x, p.z - s.z) < 60)
    .sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
  for (let i = 0; i < near.length && countRole(g, "parked") < 4; i += 3) spawnParked(g, near[i]);
  // The lot beside the plaza shows one of each vehicle type, so it never reads as empty.
  const bays = city.parking.filter((p) => p.lot);
  (["hatch", "sedan", "coupe", "van", "sedan"] as VehicleKind[]).forEach((kind, i) => {
    const bay = bays[(i * 3 + 1) % bays.length];
    if (bay && spotFree(g, bay, 3)) spawnParked(g, bay, kind);
  });
  const spots = [...city.parking];
  for (let tries = 0; tries < 400 && countRole(g, "parked") < g.options.budget.parked; tries++) {
    const spot = g.rng.pick(spots);
    if (spotFree(g, spot, 7) && heroClear(spot)) spawnParked(g, spot);
  }
  for (let tries = 0; tries < 200 && countRole(g, "traffic") < g.options.budget.traffic; tries++) {
    const lane = g.rng.pick(g.lanes);
    const d = Math.hypot(lane.x - s.x, lane.z - s.z);
    if (d < 30 || !laneClear(g, lane.x, lane.z, 16)) continue;
    spawnTraffic(g, lane);
  }
}

/** Restart the city: fresh cars, player back at spawn. The city layout is unchanged. */
export function resetGame(g: Game) {
  g.cars = [];
  g.events.length = 0;
  g.nodeLock.fill(-1);
  g.time = 0;
  g.steps = 0;
  g.accumulator = 0;
  g.rng = createRng(g.options.seed * 7919 + 13);
  g.lastUnstuckAt = -Infinity;
  g.exitBlockedUntil = -1;
  g.toast = { text: "", until: 0, id: g.toast.id + 1 };
  g.hud = emptyHud();
  if (g.brokenLamps.size) {
    g.brokenLamps.clear();
    g.lampVersion++;
  }
  populate(g);
}

// ---------------------------------------------------------------------------
// Helpers

const gsTmp: GroundSample = { h: 0, gx: 0, gz: 0, surface: "road" };
function groundH(g: Game, x: number, z: number) {
  return sampleGround(g.city, x, z, gsTmp).h;
}

function emit(g: Game, e: GameEvent) {
  if (g.events.length >= MAX_EVENTS) g.events.shift();
  g.events.push(e);
}

export function toast(g: Game, text: string, seconds = 2.2) {
  g.toast = { text, until: g.time + seconds, id: g.toast.id + 1 };
}

const countRole = (g: Game, role: Role) => g.cars.reduce((n, c) => n + (c.role === role ? 1 : 0), 0);

export const carBox = (c: Car): BoxShape => ({ x: c.x, z: c.z, hx: c.spec.halfWidth, hz: c.spec.halfLength, yaw: c.yaw });

const boxA: BoxShape = { x: 0, z: 0, hx: 0, hz: 0, yaw: 0 };
const boxB: BoxShape = { x: 0, z: 0, hx: 0, hz: 0, yaw: 0 };
function writeBox(c: Car, b: BoxShape) {
  b.x = c.x;
  b.z = c.z;
  b.hx = c.spec.halfWidth;
  b.hz = c.spec.halfLength;
  b.yaw = c.yaw;
  return b;
}

export function getCar(g: Game, id: number | null): SimCar | null {
  if (id === null) return null;
  for (const c of g.cars) if (c.id === id) return c;
  return null;
}

export function isVisible(g: Game, x: number, z: number): boolean {
  const v = g.viewer.set
    ? g.viewer
    : {
        x: g.player.x - Math.sin(g.player.facing) * 6,
        z: g.player.z - Math.cos(g.player.facing) * 6,
        fx: Math.sin(g.player.facing),
        fz: Math.cos(g.player.facing),
        halfFov: 0.7,
      };
  const dx = x - v.x;
  const dz = z - v.z;
  const d = Math.hypot(dx, dz);
  if (d < 18) return true;
  if (d > VIEW_DIST_M) return false;
  return (dx * v.fx + dz * v.fz) / d > Math.cos(Math.min(Math.PI, v.halfFov + 0.25));
}

function spotFree(g: Game, spot: { x: number; z: number }, radius = 3.4) {
  if (Math.hypot(g.player.x - spot.x, g.player.z - spot.z) < 2.5) return false;
  return g.cars.every((c) => Math.hypot(c.x - spot.x, c.z - spot.z) > radius);
}

function laneClear(g: Game, x: number, z: number, radius: number) {
  if (Math.hypot(g.player.x - x, g.player.z - z) < radius) return false;
  return g.cars.every((c) => Math.hypot(c.x - x, c.z - z) > radius);
}

function makeCar(g: Game, kind: VehicleKind, x: number, z: number, yaw: number, paint: string, role: Role): SimCar {
  const car = createCar(g.nextId++, VEHICLE_SPECS[kind], x, z, yaw, paint) as SimCar;
  car.y = car.py = groundH(g, x, z);
  car.role = role;
  car.ai = null;
  car.drive = { ...NO_DRIVE, handbrake: role === "parked" };
  car.condition = 100;
  car.wrecked = false;
  car.sleeping = role === "parked";
  car.dents = [];
  car.damageVersion = 0;
  car.detached = 0;
  car.cracked = false;
  car.lastImpact = new Map();
  car.waterS = 0;
  car.hiddenS = 0;
  car.stuckS = 0;
  g.cars.push(car);
  return car;
}

function spawnParked(g: Game, spot: ParkingSpot, kind?: VehicleKind, paint?: string) {
  return makeCar(g, kind ?? g.rng.pick(PARKED_KINDS), spot.x, spot.z, spot.yaw, paint ?? g.rng.pick(PAINTS), "parked");
}

function spawnTraffic(g: Game, lane: Game["lanes"][number]) {
  const car = makeCar(g, g.rng.pick(TRAFFIC_KINDS), lane.x, lane.z, lane.yaw, g.rng.pick(PAINTS), "traffic");
  car.ai = aiFromSample(g.city, lane, g.rng);
  const v = CRUISE_MPS * 0.8;
  car.vx = Math.sin(lane.yaw) * v;
  car.vz = Math.cos(lane.yaw) * v;
  car.speed = v;
  return car;
}

function removeCar(g: Game, car: SimCar) {
  releaseLock(g, car);
  const i = g.cars.indexOf(car);
  if (i >= 0) g.cars.splice(i, 1);
}

function releaseLock(g: Game, car: SimCar) {
  if (car.ai && car.ai.holding >= 0) {
    if (g.nodeLock[car.ai.holding] === car.id) g.nodeLock[car.ai.holding] = -1;
    car.ai.holding = -1;
  }
}

/** Remove AI authority immediately (possession, crash, stall). */
function stopAi(g: Game, car: SimCar) {
  releaseLock(g, car);
  car.ai = null;
}

// ---------------------------------------------------------------------------
// Frame advance

/**
 * Advance the simulation by a real frame duration using a fixed timestep.
 * Returns the interpolation factor for rendering (0..1).
 */
export function advance(g: Game, frameS: number, input: InputState, camYaw: number): number {
  g.accumulator += Math.min(Math.max(frameS, 0), MAX_FRAME_S);
  while (g.accumulator >= FIXED_DT) {
    stepGame(g, input, camYaw);
    g.accumulator -= FIXED_DT;
  }
  return g.accumulator / FIXED_DT;
}

export function stepGame(g: Game, input: InputState, camYaw: number) {
  const dt = FIXED_DT;
  g.time += dt;
  g.steps++;
  const r = resolveInput(input);
  const action = input.actionQueued;
  const jump = input.jumpQueued;
  const unstuck = input.unstuckQueued;
  input.actionQueued = input.jumpQueued = input.unstuckQueued = false;

  for (const c of g.cars) {
    c.px = c.x;
    c.pz = c.z;
    c.py = c.y;
    c.pyaw = c.yaw;
  }
  const p = g.player;
  p.px = p.x;
  p.pz = p.z;
  p.py = p.y;
  p.pfacing = p.facing;

  updatePlayerIntent(g, r, action, unstuck);
  for (const c of g.cars) if (c.ai) planAi(g, c, dt);

  let fastest = 0;
  for (const c of g.cars) if (!c.sleeping) fastest = Math.max(fastest, Math.hypot(c.vx, c.vz));
  const sub = clamp(Math.ceil((fastest * dt) / MAX_SUBSTEP_TRAVEL_M), 1, 4);
  const h = dt / sub;
  for (let k = 0; k < sub; k++) {
    for (const c of g.cars) integrateCar(g, c, h);
    collideCars(g);
    for (const c of g.cars) if (!c.sleeping) collideCarStatic(g, c);
  }
  for (const c of g.cars) updateSleep(c);

  updatePlayerBody(g, r, jump, camYaw, dt);
  if (g.steps % HOUSEKEEP_EVERY === 0) housekeeping(g, HOUSEKEEP_EVERY * dt);
  updateContext(g);
  updateHud(g);
}

// ---------------------------------------------------------------------------
// Player

function updatePlayerIntent(g: Game, r: ResolvedInput, action: boolean, unstuck: boolean) {
  const p = g.player;
  const car = getCar(g, p.vehicleId);
  if (p.vehicleId !== null && !car) {
    // Vehicle vanished (should not happen: occupied cars are never recycled).
    p.vehicleId = null;
    p.state = "onFoot";
  }
  if (unstuck && car && p.state === "driving") recoverCar(g, car, "manual");

  switch (p.state) {
    case "onFoot": {
      if (action) {
        if (g.enterTarget && (!g.inspectTarget || distTo(p, g.enterTarget.ax, g.enterTarget.az) <= distTo(p, g.inspectTarget.pad.x, g.inspectTarget.pad.z))) {
          beginEnter(g, g.enterTarget.car, g.enterTarget.ax, g.enterTarget.az);
        } else if (g.inspectTarget) {
          emit(g, { type: "inspect", slug: g.inspectTarget.slug });
        }
      }
      break;
    }
    case "entering": {
      if (!car || Math.hypot(car.x - p.carStartX, car.z - p.carStartZ) > 1.5) {
        // Car was knocked away mid-entry: stay on foot.
        if (car) {
          car.role = "abandoned";
        }
        p.vehicleId = null;
        p.state = "onFoot";
        break;
      }
      car.drive.throttle = 0;
      car.drive.brake = 0;
      car.drive.steer = 0;
      car.drive.handbrake = true;
      p.t += FIXED_DT / ENTER_TIME_S;
      if (p.t >= 1) {
        p.state = "driving";
        p.t = 0;
        car.drive.handbrake = false;
        emit(g, { type: "enter", carId: car.id });
      }
      break;
    }
    case "driving": {
      if (!car) break;
      if (action) {
        if (Math.abs(car.speed) > EXIT_MAX_SPEED_MPS || car.airborne) {
          p.pendingExit = true;
          toast(g, "Stopping to get out…", 1.2);
        } else tryExit(g, car);
      }
      // Got out this step: the car keeps the parked controls tryExit set.
      if (p.state !== "driving") break;
      if (p.pendingExit && (r.throttle > 0.1 || r.brake > 0.1)) p.pendingExit = false;
      if (p.pendingExit) {
        // Brake whichever way the car is rolling without engaging reverse.
        car.drive.throttle = car.speed < -0.8 ? 1 : 0;
        car.drive.brake = car.speed > 0.8 ? 1 : 0;
        car.drive.steer = r.steer;
        car.drive.handbrake = Math.abs(car.speed) < 3;
        if (Math.abs(car.speed) <= EXIT_MAX_SPEED_MPS && !car.airborne) {
          p.pendingExit = false;
          tryExit(g, car);
        }
      } else {
        car.drive.throttle = r.throttle;
        car.drive.brake = r.brake;
        car.drive.steer = r.steer;
        car.drive.handbrake = r.handbrake;
      }
      break;
    }
    case "exiting": {
      p.t += FIXED_DT / EXIT_TIME_S;
      if (p.t >= 1) {
        p.state = "onFoot";
        p.t = 0;
        p.x = p.toX;
        p.z = p.toZ;
        p.vx = p.vz = p.vy = 0;
      }
      break;
    }
  }
}

const distTo = (p: Player, x: number, z: number) => Math.hypot(p.x - x, p.z - z);

function beginEnter(g: Game, car: SimCar, ax: number, az: number) {
  const p = g.player;
  if (p.state !== "onFoot" || p.vehicleId !== null) return;
  stopAi(g, car);
  car.role = "occupied";
  car.sleeping = false;
  p.state = "entering";
  p.vehicleId = car.id;
  p.t = 0;
  p.fromX = p.x;
  p.fromZ = p.z;
  p.toX = ax;
  p.toZ = az;
  p.carStartX = car.x;
  p.carStartZ = car.z;
  p.vx = p.vz = 0;
  p.pendingExit = false;
  g.enterTarget = null;
}

/** Door anchors on both sides, slightly ahead of the car centre. */
export function doorAnchor(car: Car, side: 1 | -1, out: { x: number; z: number }) {
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  const off = car.spec.halfWidth + 0.55;
  // left = (c, -s)
  out.x = car.x + c * off * side + s * 0.2;
  out.z = car.z - s * off * side + c * 0.2;
  return out;
}

const anchorTmp = { x: 0, z: 0 };

function findEnterTarget(g: Game): Game["enterTarget"] {
  const p = g.player;
  let best: Game["enterTarget"] = null;
  let bestD = ENTER_RADIUS_M;
  for (const car of g.cars) {
    if (car.wrecked || car.flip > 0.1 || car.inWater) continue;
    if (Math.abs(car.speed) > ENTER_MAX_SPEED_MPS) continue;
    if (Math.abs(car.y - p.y) > 1.2) continue;
    if (Math.hypot(car.x - p.x, car.z - p.z) > ENTER_RADIUS_M + 3) continue;
    for (const side of [1, -1] as const) {
      doorAnchor(car, side, anchorTmp);
      const d = Math.hypot(anchorTmp.x - p.x, anchorTmp.z - p.z);
      if (d >= bestD) continue;
      if (!clearPath(g, p.x, p.z, anchorTmp.x, anchorTmp.z, car.id, p.y)) continue;
      bestD = d;
      best = { car, ax: anchorTmp.x, az: anchorTmp.z };
    }
  }
  return best;
}

/** Straight-line access between two ground points, ignoring one car. */
function clearPath(g: Game, x0: number, z0: number, x1: number, z1: number, ignoreId: number, y: number): boolean {
  let blocked = false;
  g.city.grid.forEachNear(Math.min(x0, x1) - 1, Math.min(z0, z1) - 1, Math.max(x0, x1) + 1, Math.max(z0, z1) + 1, (c) => {
    if (blocked || c.top < y + 0.6 || !standing(g, c)) return;
    const t = c.shape === "box" ? segmentBox(x0, z0, x1, z1, c) : segmentCircle(x0, z0, x1, z1, c.x, c.z, c.r);
    if (t >= 0) blocked = true;
  });
  if (blocked) return false;
  for (const car of g.cars) {
    if (car.id === ignoreId) continue;
    if (Math.hypot(car.x - x0, car.z - z0) > 8) continue;
    if (segmentBox(x0, z0, x1, z1, writeBox(car, boxA)) >= 0) return false;
  }
  return true;
}

const exitCandidates: [number, number][] = [
  [1, 0], // driver side (left)
  [-1, 0], // passenger side
  [0, -1], // behind
  [0, 1], // in front
];

/** Pick a safe exit point: driver side, passenger side, then rear and front. */
export function findExit(g: Game, car: SimCar): { x: number; z: number } | null {
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  for (const [side, fwd] of exitCandidates) {
    const lat = side * (car.spec.halfWidth + 0.8);
    const lon = fwd * (car.spec.halfLength + 0.9) + (fwd === 0 ? 0.2 : 0);
    const x = car.x + c * lat + s * lon;
    const z = car.z - s * lat + c * lon;
    if (exitPointOk(g, car, x, z)) return { x, z };
  }
  return null;
}

function exitPointOk(g: Game, car: SimCar, x: number, z: number): boolean {
  if (!inWorldBounds(x, z)) return false;
  const gs = sampleGround(g.city, x, z, gsTmp);
  if (gs.surface === "water" || gs.h < WATER_LEVEL + 0.1) return false;
  if (Math.abs(gs.h - car.y) > 0.6) return false;
  const h = gs.h;
  const contact = newContact();
  let blocked = false;
  const r = PLAYER_RADIUS_M + 0.08;
  g.city.grid.forEachNear(x - 2, z - 2, x + 2, z + 2, (col) => {
    if (blocked || col.top < h + 0.3 || !standing(g, col)) return;
    if (col.shape === "box" ? circleBox(x, z, r, col, contact) : circleCircle(x, z, r, col.x, col.z, col.r, contact)) blocked = true;
  });
  if (blocked) return false;
  for (const other of g.cars) {
    if (other.id === car.id) continue;
    if (Math.hypot(other.x - x, other.z - z) > 6) continue;
    if (circleBox(x, z, r, writeBox(other, boxA), contact)) return false;
  }
  // Nothing solid between the car and the exit point.
  return clearPath(g, car.x, car.z, x, z, car.id, h);
}

function tryExit(g: Game, car: SimCar) {
  const p = g.player;
  if (p.state !== "driving") return;
  const spot = findExit(g, car);
  if (!spot) {
    toast(g, "No room to get out here. Move the car or use Unstuck.", 2.6);
    g.exitBlockedUntil = g.time + 5;
    return;
  }
  p.state = "exiting";
  p.t = 0;
  p.fromX = car.x;
  p.fromZ = car.z;
  p.toX = spot.x;
  p.toZ = spot.z;
  p.pendingExit = false;
  p.vehicleId = null;
  p.y = groundH(g, spot.x, spot.z);
  p.facing = car.yaw;
  car.role = "abandoned";
  car.drive.throttle = 0;
  car.drive.brake = 0;
  car.drive.steer = 0;
  car.drive.handbrake = true;
  emit(g, { type: "exit", carId: car.id });
}

const playerContact = newContact();

function updatePlayerBody(g: Game, r: ResolvedInput, jump: boolean, camYaw: number, dt: number) {
  const p = g.player;
  if (p.state === "driving" || p.state === "entering" || p.state === "exiting") {
    const car = getCar(g, p.vehicleId);
    if (p.state === "driving" && car) {
      p.x = car.x;
      p.z = car.z;
      p.y = car.y;
      p.facing = car.yaw;
    } else {
      const t = clamp(p.t, 0, 1);
      p.x = p.fromX + (p.toX - p.fromX) * t;
      p.z = p.fromZ + (p.toZ - p.fromZ) * t;
      const target = Math.atan2(p.toX - p.fromX, p.toZ - p.fromZ);
      if (p.state === "entering") p.facing = dampAngle(p.facing, target, 12, dt);
      p.y = groundH(g, p.x, p.z);
    }
    p.moveSpeed = 0;
    p.vy = 0;
    p.grounded = true;
    return;
  }

  // Camera-relative movement.
  const fs = Math.sin(camYaw);
  const fc = Math.cos(camYaw);
  // camera forward = (fs, fc), camera right = (-fc, fs)
  const wx = -fc * r.moveX + fs * r.moveY;
  const wz = fs * r.moveX + fc * r.moveY;
  const mag = Math.min(1, Math.hypot(r.moveX, r.moveY));
  const speed = mag * (r.run ? RUN_MPS : JOG_MPS);
  const len = Math.hypot(wx, wz) || 1;
  const tx = (wx / len) * speed;
  const tz = (wz / len) * speed;
  const controllable = p.stumbleS <= 0;
  if (p.stumbleS > 0) p.stumbleS -= dt;
  const accel = (p.grounded ? PLAYER_ACCEL_MPS2 : PLAYER_AIR_ACCEL_MPS2) * dt;
  if (controllable) {
    p.vx = approach(p.vx, mag > 0 ? tx : 0, accel);
    p.vz = approach(p.vz, mag > 0 ? tz : 0, accel);
  } else {
    p.vx = approach(p.vx, 0, 6 * dt);
    p.vz = approach(p.vz, 0, 6 * dt);
  }
  if (mag > 0.05 && controllable) p.facing = dampAngle(p.facing, Math.atan2(wx, wz), 14, dt);

  if (jump && p.grounded && controllable) {
    p.vy = JUMP_MPS;
    p.grounded = false;
  }

  const x0 = p.x;
  const z0 = p.z;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  // Steps taller than a kerb block walking (ramp sides, pier edge from the beach).
  if (groundH(g, p.x, p.z) > p.y + PLAYER_MAX_STEP_M) {
    p.x = x0;
    p.z = z0;
  }
  collidePlayer(g);

  const gh = groundH(g, p.x, p.z);
  p.vy -= PLAYER_GRAVITY_MPS2 * dt;
  p.y += p.vy * dt;
  if (p.y <= gh) {
    p.y = gh;
    p.vy = 0;
    p.grounded = true;
  } else if (p.grounded && p.y - gh < 0.3 && p.vy <= 0) {
    // Walk down kerbs without a hop.
    p.y = gh;
    p.vy = 0;
  } else {
    p.grounded = false;
  }
  p.moveSpeed = Math.hypot(p.vx, p.vz);
  if (p.grounded) p.walkPhase += (p.moveSpeed * dt) / STRIDE_M;
}

function collidePlayer(g: Game) {
  const p = g.player;
  const r = PLAYER_RADIUS_M;
  g.city.grid.forEachNear(p.x - 3, p.z - 3, p.x + 3, p.z + 3, (c) => {
    if (c.top < p.y + 0.35 || !standing(g, c)) return;
    const hit = c.shape === "box" ? circleBox(p.x, p.z, r, c, playerContact) : circleCircle(p.x, p.z, r, c.x, c.z, c.r, playerContact);
    if (!hit) return;
    p.x += playerContact.nx * playerContact.depth;
    p.z += playerContact.nz * playerContact.depth;
    const vn = p.vx * playerContact.nx + p.vz * playerContact.nz;
    if (vn < 0) {
      p.vx -= vn * playerContact.nx;
      p.vz -= vn * playerContact.nz;
    }
  });
  for (const car of g.cars) {
    if (Math.abs(car.x - p.x) > 5 || Math.abs(car.z - p.z) > 5) continue;
    if (p.y > car.y + car.spec.height * 0.9 || p.y + 1.7 < car.y) continue;
    if (!circleBox(p.x, p.z, r, writeBox(car, boxA), playerContact)) continue;
    p.x += playerContact.nx * playerContact.depth;
    p.z += playerContact.nz * playerContact.depth;
    // Car velocity at the contact point pushes the player aside (no injury model).
    const rx = playerContact.px - car.x;
    const rz = playerContact.pz - car.z;
    const cvx = car.vx + car.yawRate * rz;
    const cvz = car.vz - car.yawRate * rx;
    const closing = (cvx - p.vx) * playerContact.nx + (cvz - p.vz) * playerContact.nz;
    if (closing > 3) {
      p.vx += playerContact.nx * closing * 0.9;
      p.vz += playerContact.nz * closing * 0.9;
      p.vy = Math.max(p.vy, 2.5);
      p.grounded = false;
      p.stumbleS = STUMBLE_S;
      emit(g, { type: "bump", x: p.x, z: p.z });
    } else {
      const vn = p.vx * playerContact.nx + p.vz * playerContact.nz;
      if (vn < 0) {
        p.vx -= vn * playerContact.nx;
        p.vz -= vn * playerContact.nz;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Vehicles

function propulsionOf(c: SimCar): number {
  if (c.wrecked) return 0;
  return c.condition < 40 ? 0.55 + (c.condition / 40) * 0.45 : 1;
}

function integrateCar(g: Game, c: SimCar, h: number) {
  if (c.sleeping) return;
  const landing = stepVehicle(c, c.drive, g.terrain, h, propulsionOf(c));
  if (landing > LANDING_DAMAGE_MPS) {
    registerImpact(g, c, -2, landing, c.x, c.z, 0, 0, 1, true);
  }
  if (c.wallImpact > 0) {
    registerImpact(g, c, -3, c.wallImpact, c.x - c.wallNx * c.spec.halfLength, c.z - c.wallNz * c.spec.halfLength, c.wallNx, c.wallNz, 1);
  }
}

function updateSleep(c: SimCar) {
  const idle = c.role !== "occupied" && !c.ai;
  if (!idle) {
    c.sleeping = false;
    return;
  }
  if (!c.sleeping && !c.airborne && Math.hypot(c.vx, c.vz) < 0.05 && Math.abs(c.yawRate) < 0.05 && Math.abs(c.flip - c.flipTarget) < 1e-3) {
    c.vx = c.vz = c.yawRate = 0;
    c.speed = 0;
    c.sleeping = true;
    c.drive.throttle = c.drive.brake = c.drive.steer = 0;
    c.drive.handbrake = true;
  }
}

const inertia = (c: Car) => (c.spec.mass * ((2 * c.spec.halfWidth) ** 2 + (2 * c.spec.halfLength) ** 2)) / 12;

const staticContact = newContact();

function collideCarStatic(g: Game, c: SimCar) {
  const box = writeBox(c, boxA);
  const reach = Math.hypot(c.spec.halfWidth, c.spec.halfLength) + 0.5;
  g.city.grid.forEachNear(c.x - reach, c.z - reach, c.x + reach, c.z + reach, (col) => {
    if (col.top < c.y + 0.25 || !standing(g, col)) return;
    box.x = c.x;
    box.z = c.z;
    box.yaw = c.yaw;
    const hit = col.shape === "box" ? boxBox(box, col, staticContact) : boxCircle(box, col.x, col.z, col.r, staticContact);
    if (!hit) return;
    if (col.lamp !== undefined && knockLamp(g, c, col.lamp, staticContact)) return;
    resolveStatic(g, c, staticContact, col.id);
  });
}

function resolveStatic(g: Game, c: SimCar, k: typeof staticContact, colliderId: number) {
  const corr = Math.max(0, k.depth - SLOP_M) * CORRECTION + (k.depth > 0.3 ? 0.05 : 0);
  c.x += k.nx * corr;
  c.z += k.nz * corr;
  const rx = k.px - c.x;
  const rz = k.pz - c.z;
  // Point velocity: v + w * (rz, -rx)
  const vpx = c.vx + c.yawRate * rz;
  const vpz = c.vz - c.yawRate * rx;
  const vn = vpx * k.nx + vpz * k.nz;
  if (vn >= 0) return;
  const m = c.spec.mass;
  const I = inertia(c);
  const pn = rz * k.nx - rx * k.nz;
  const j = (-(1 + RESTITUTION_STATIC) * vn) / (1 / m + (pn * pn) / I);
  c.vx += (k.nx * j) / m;
  c.vz += (k.nz * j) / m;
  c.yawRate += (pn * j) / I;
  // Friction along the contact tangent.
  const tx = -k.nz;
  const tz = k.nx;
  const vt = vpx * tx + vpz * tz;
  const pt = rz * tx - rx * tz;
  const jt = clamp(-vt / (1 / m + (pt * pt) / I), -CONTACT_FRICTION * j, CONTACT_FRICTION * j);
  c.vx += (tx * jt) / m;
  c.vz += (tz * jt) / m;
  c.yawRate += (pt * jt) / I;
  c.yawRate = clamp(c.yawRate, -6, 6);
  c.sleeping = false;
  registerImpact(g, c, -100 - colliderId, -vn, k.px, k.pz, k.nx, k.nz, 1);
}

/** A fast hit flattens the lamp: the car loses a little speed and takes a small knock. */
function knockLamp(g: Game, c: SimCar, lamp: number, k: typeof staticContact): boolean {
  const rx = k.px - c.x;
  const rz = k.pz - c.z;
  const vn = (c.vx + c.yawRate * rz) * k.nx + (c.vz - c.yawRate * rx) * k.nz;
  if (-vn < LAMP_BREAK_MPS) return false;
  g.brokenLamps.set(lamp, g.time);
  g.lampVersion++;
  c.vx *= LAMP_SPEED_KEEP;
  c.vz *= LAMP_SPEED_KEEP;
  c.sleeping = false;
  // Feedback without the full wall-impact damage.
  registerImpact(g, c, -1e6 - lamp, Math.min(-vn * 0.35, DAMAGE_MIN_MPS + 2), k.px, k.pz, k.nx, k.nz, 1);
  emit(g, { type: "lampDown", lamp, x: k.px, z: k.pz });
  for (let i = 0; i < 3; i++) {
    emit(g, {
      type: "debris",
      x: k.px,
      y: 1 + i * 1.4,
      z: k.pz,
      vx: c.vx * 0.6 + (g.rng.next() - 0.5) * 2,
      vy: 1.5 + g.rng.next() * 2,
      vz: c.vz * 0.6 + (g.rng.next() - 0.5) * 2,
      color: i === 2 ? "#fff0c6" : "#56615f",
      size: 0.5,
    });
  }
  return true;
}

const carContact = newContact();

function collideCars(g: Game) {
  const cars = g.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (a.sleeping && b.sleeping) continue;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const rr = a.spec.halfLength + b.spec.halfLength + 0.3;
      if (dx * dx + dz * dz > rr * rr) continue;
      if (Math.abs(a.y - b.y) > 1.3) continue;
      if (!boxBox(writeBox(a, boxA), writeBox(b, boxB), carContact)) continue;
      resolvePair(g, a, b, carContact);
    }
  }
}

function resolvePair(g: Game, a: SimCar, b: SimCar, k: typeof carContact) {
  const ma = a.spec.mass;
  const mb = b.spec.mass;
  const ia = inertia(a);
  const ib = inertia(b);
  const corr = Math.max(0, k.depth - SLOP_M) * CORRECTION;
  const wa = 1 / ma / (1 / ma + 1 / mb);
  const wb = 1 - wa;
  a.x += k.nx * corr * wa;
  a.z += k.nz * corr * wa;
  b.x -= k.nx * corr * wb;
  b.z -= k.nz * corr * wb;
  const rax = k.px - a.x;
  const raz = k.pz - a.z;
  const rbx = k.px - b.x;
  const rbz = k.pz - b.z;
  const vax = a.vx + a.yawRate * raz;
  const vaz = a.vz - a.yawRate * rax;
  const vbx = b.vx + b.yawRate * rbz;
  const vbz = b.vz - b.yawRate * rbx;
  const rvx = vax - vbx;
  const rvz = vaz - vbz;
  const vn = rvx * k.nx + rvz * k.nz;
  if (vn >= 0) return;
  const pa = raz * k.nx - rax * k.nz;
  const pb = rbz * k.nx - rbx * k.nz;
  const denom = 1 / ma + 1 / mb + (pa * pa) / ia + (pb * pb) / ib;
  const j = (-(1 + RESTITUTION_CARS) * vn) / denom;
  a.vx += (k.nx * j) / ma;
  a.vz += (k.nz * j) / ma;
  a.yawRate += (pa * j) / ia;
  b.vx -= (k.nx * j) / mb;
  b.vz -= (k.nz * j) / mb;
  b.yawRate -= (pb * j) / ib;
  const tx = -k.nz;
  const tz = k.nx;
  const vt = rvx * tx + rvz * tz;
  const pta = raz * tx - rax * tz;
  const ptb = rbz * tx - rbx * tz;
  const jt = clamp(-vt / (1 / ma + 1 / mb + (pta * pta) / ia + (ptb * ptb) / ib), -CONTACT_FRICTION * j, CONTACT_FRICTION * j);
  a.vx += (tx * jt) / ma;
  a.vz += (tz * jt) / ma;
  a.yawRate = clamp(a.yawRate + (pta * jt) / ia, -6, 6);
  b.vx -= (tx * jt) / mb;
  b.vz -= (tz * jt) / mb;
  b.yawRate = clamp(b.yawRate - (ptb * jt) / ib, -6, 6);
  a.sleeping = b.sleeping = false;
  const closing = -vn;
  registerImpact(g, a, b.id, closing, k.px, k.pz, k.nx, k.nz, clamp((2 * mb) / (ma + mb), 0.4, 1.6));
  registerImpact(g, b, a.id, closing, k.px, k.pz, -k.nx, -k.nz, clamp((2 * ma) / (ma + mb), 0.4, 1.6));
}

/**
 * Turn a contact into feedback and damage. Only fresh impacts count: closing
 * speed must exceed a threshold and the same pair is ignored for a cooldown,
 * so resting or grinding contact never accumulates damage.
 */
export function registerImpact(
  g: Game,
  c: SimCar,
  otherKey: number,
  closing: number,
  px: number,
  pz: number,
  nx: number,
  nz: number,
  massFactor: number,
  landing = false,
) {
  if (closing < IMPACT_FEEDBACK_MPS) return;
  const last = c.lastImpact.get(otherKey);
  if (last !== undefined && g.time - last < IMPACT_COOLDOWN_S) return;
  c.lastImpact.set(otherKey, g.time);
  if (c.lastImpact.size > 16) {
    for (const [key, t] of c.lastImpact) if (g.time - t > 2) c.lastImpact.delete(key);
  }
  const effective = landing ? closing - LANDING_DAMAGE_MPS + DAMAGE_MIN_MPS : closing;
  const damage = effective > DAMAGE_MIN_MPS ? Math.min(MAX_IMPACT_DAMAGE, (effective - DAMAGE_MIN_MPS) * DAMAGE_PER_MPS * massFactor) : 0;
  emit(g, { type: "impact", carId: c.id, severity: closing, x: px, y: c.y + 0.6, z: pz, damage });
  if (damage > 0) applyDamage(g, c, damage, px, pz, nx, nz, closing, landing);
}

function applyDamage(g: Game, c: SimCar, damage: number, px: number, pz: number, nx: number, nz: number, closing: number, landing: boolean) {
  c.condition = Math.max(0, c.condition - damage);
  // Contact point and normal in car-local space (x = left, z = forward).
  const s = Math.sin(c.yaw);
  const co = Math.cos(c.yaw);
  const dx = px - c.x;
  const dz = pz - c.z;
  const lx = dx * co - dz * s;
  const lz = dx * s + dz * co;
  const lnx = nx * co - nz * s;
  const lnz = nx * s + nz * co;
  if (!landing) {
    const depth = Math.min(0.32, 0.05 + damage * 0.011);
    const radius = 0.7 + Math.min(0.9, damage * 0.025);
    const existing = c.dents.find((d) => Math.hypot(d.lx - lx, d.lz - lz) < 0.6);
    if (existing) existing.depth = Math.min(0.42, existing.depth + depth * 0.6);
    else {
      c.dents.push({ lx, ly: c.spec.height * 0.45, lz, nx: lnx, nz: lnz, depth, radius });
      if (c.dents.length > 10) c.dents.shift();
    }
  }
  if (damage >= SEVERE_DAMAGE && !landing) {
    const hl = c.spec.halfLength;
    let part = 0;
    if (lz > hl * 0.5 && !(c.detached & 1)) part = 1;
    else if (lz < -hl * 0.5 && !(c.detached & 2)) part = 2;
    else if (lx > 0 && !(c.detached & 4)) part = 4;
    else if (lx <= 0 && !(c.detached & 8)) part = 8;
    else if (!(c.detached & 16)) part = 16;
    if (part) {
      c.detached |= part;
      emit(g, {
        type: "debris",
        x: px,
        y: c.y + 0.5,
        z: pz,
        vx: c.vx * 0.5 + nx * 3 + (g.rng.next() - 0.5) * 2,
        vy: 3 + g.rng.next() * 2,
        vz: c.vz * 0.5 + nz * 3 + (g.rng.next() - 0.5) * 2,
        color: part === 16 ? c.paint : "#3b3f46",
        size: part === 16 ? 0.9 : 0.6,
      });
    }
    if (lz > hl * 0.3) c.cracked = true;
    for (let i = 0; i < 3; i++) {
      emit(g, {
        type: "debris",
        x: px,
        y: c.y + 0.6,
        z: pz,
        vx: nx * 2 + (g.rng.next() - 0.5) * 4,
        vy: 2 + g.rng.next() * 3,
        vz: nz * 2 + (g.rng.next() - 0.5) * 4,
        color: i === 0 ? c.paint : "#dfe7ea",
        size: 0.18 + g.rng.next() * 0.15,
      });
    }
    // Hard hits on the side of a lighter car can roll it onto its roof.
    if (closing > FLIP_IMPACT_MPS && Math.abs(lnx) > 0.75 && c.spec.mass < 1500 && c.flipTarget === 0) {
      c.flipTarget = 1;
    }
  }
  c.damageVersion++;
  if (c.condition <= 0 && !c.wrecked) {
    c.wrecked = true;
    c.condition = 0;
    emit(g, { type: "wreck", carId: c.id });
  }
  if (c.ai && (c.condition < 55 || c.wrecked)) stall(g, c);
  else if (c.role === "parked" && (c.wrecked || c.flipTarget > 0)) c.role = "stalled";
}

// ---------------------------------------------------------------------------
// Traffic AI

const aheadCars: SimCar[] = [];

function planAi(g: Game, car: SimCar, dt: number) {
  const ai = car.ai!;
  const d = car.drive;
  if (car.wrecked || car.flip > 0.3) {
    stall(g, car);
    return;
  }
  extendPath(ai, g.city, g.rng);
  const off = trackProgress(ai, car.x, car.z);
  const headingErr = Math.abs(wrapAngle(pathHeading(ai) - car.yaw));
  if (off > 6 || headingErr > 1.9) {
    // Knocked off its lane: stop and stay put.
    stall(g, car);
    return;
  }
  // Release the intersection once past it, or if held too long (then let others in first).
  if (ai.holding >= 0 && ai.i > ai.holdUntil) releaseLock(g, car);
  else if (ai.holding >= 0 && g.time - g.nodeLockAt[ai.holding] > LOCK_TIMEOUT_S) {
    ai.banNode = ai.holding;
    ai.banUntil = g.time + LOCK_TIMEOUT_S;
    releaseLock(g, car);
  }

  const v = car.speed;
  let target = turnSpeedAhead(ai);
  const nx = nextIntersection(ai, LOCK_CLAIM_M);
  let waitingForLock = false;
  if (nx && nx.node === ai.banNode && g.time < ai.banUntil) {
    // Timed out here: creep on under normal car-following instead of re-locking.
  } else if (nx) {
    const owner = g.nodeLock[nx.node];
    if (ai.holding < 0 && (owner === -1 || owner === car.id)) {
      g.nodeLock[nx.node] = car.id;
      g.nodeLockAt[nx.node] = g.time;
      ai.holding = nx.node;
      ai.holdUntil = nx.lastIdx;
    } else if (owner !== car.id) {
      target = Math.min(target, stoppingSpeed(nx.dist - STOP_BEFORE_M - car.spec.halfLength));
      waitingForLock = true;
    }
  }

  // Obstacles along the path ahead (cars and the player).
  const scan = obstacleAhead(g, car, ai);
  if (scan.dist < Infinity) target = Math.min(target, stoppingSpeed(scan.dist - FOLLOW_GAP_M));

  if ((scan.dist < Infinity || waitingForLock) && target < 0.5 && Math.abs(v) < 0.5) ai.blockedS += dt;
  else ai.blockedS = Math.max(0, ai.blockedS - dt * 2);
  if (ai.blockedS > JAM_GIVE_UP_S) {
    // Bounded jam recovery: stop being traffic; it is recycled once unseen and replaced.
    stall(g, car);
    return;
  }

  // Pass a stopped obstacle through the opposite lane when it is clear.
  if (ai.blockedS > 4 && scan.stationary && ai.offset === 0 && oncomingClear(g, car)) {
    ai.offset = 3.6;
    ai.offsetUntil = g.time + 5;
    ai.blockedS = 0;
  }
  if (ai.offset > 0 && g.time > ai.offsetUntil) ai.offset = approach(ai.offset, 0, 1.5 * dt);

  d.steer = pursuitSteer(ai, car.x, car.z, car.yaw, 4 + 0.5 * Math.abs(v));
  if (target < 0.3 && Math.abs(v) < 0.6) {
    d.throttle = 0;
    d.brake = 0;
    d.handbrake = true;
  } else {
    d.handbrake = false;
    d.throttle = clamp((target - v) * 0.7, 0, 1);
    d.brake = v > 0.6 ? clamp((v - target) * 0.5, 0, 1) : 0;
  }
}

/** AI gives up: hold still with the handbrake (the brake pedal would reverse). */
function stall(g: Game, car: SimCar) {
  stopAi(g, car);
  car.role = "stalled";
  car.drive.throttle = 0;
  car.drive.brake = 0;
  car.drive.steer = 0;
  car.drive.handbrake = true;
}

const scanResult = { dist: Infinity, stationary: false };

function obstacleAhead(g: Game, car: SimCar, ai: Ai) {
  scanResult.dist = Infinity;
  scanResult.stationary = false;
  aheadCars.length = 0;
  for (const o of g.cars) {
    if (o === car) continue;
    if (Math.abs(o.x - car.x) < 34 && Math.abs(o.z - car.z) < 34) aheadCars.push(o);
  }
  const p = g.player;
  const playerNear = p.state === "onFoot" && Math.abs(p.x - car.x) < 34 && Math.abs(p.z - car.z) < 34;
  if (!aheadCars.length && !playerNear) return scanResult;
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  const n = Math.min(ai.pts.length, ai.i + 18);
  for (let k = ai.i + 1; k < n; k++) {
    const pt = ai.pts[k];
    const px = pt.x + c * ai.offset;
    const pz = pt.z - s * ai.offset;
    const along = (k - ai.i) * PATH_SPACING_M;
    for (const o of aheadCars) {
      if (pointInBox(writeBox(o, boxB), px, pz, car.spec.halfWidth + 0.35)) {
        scanResult.dist = Math.max(0, along - car.spec.halfLength);
        scanResult.stationary = Math.hypot(o.vx, o.vz) < 0.5;
        return scanResult;
      }
    }
    if (playerNear && Math.hypot(p.x - px, p.z - pz) < car.spec.halfWidth + 0.9) {
      scanResult.dist = Math.max(0, along - car.spec.halfLength);
      scanResult.stationary = false;
      return scanResult;
    }
  }
  return scanResult;
}

function oncomingClear(g: Game, car: SimCar): boolean {
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  for (const o of g.cars) {
    if (o === car) continue;
    const dx = o.x - car.x;
    const dz = o.z - car.z;
    const fwd = dx * s + dz * c;
    const left = dx * c - dz * s;
    if (fwd > -4 && fwd < 30 && left > 1.5 && left < 6) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Recovery

/** Nearest free lane position to relocate a car or the player. */
function nearestFreeLane(g: Game, x: number, z: number, ignoreId: number) {
  let best: Game["lanes"][number] | null = null;
  let bd = Infinity;
  for (const l of g.lanes) {
    const d = Math.hypot(l.x - x, l.z - z);
    if (d >= bd) continue;
    if (!g.cars.every((c) => c.id === ignoreId || Math.hypot(c.x - l.x, c.z - l.z) > 6)) continue;
    bd = d;
    best = l;
  }
  return best;
}

function carOverlapsStatic(g: Game, c: SimCar): boolean {
  const box = writeBox(c, boxA);
  let hit = false;
  g.city.grid.forEachNear(c.x - 3, c.z - 3, c.x + 3, c.z + 3, (col) => {
    if (hit || col.top < c.y + 0.25 || !standing(g, col)) return;
    if (col.shape === "box" ? boxBox(box, col, staticContact) : boxCircle(box, col.x, col.z, col.r, staticContact)) {
      if (staticContact.depth > 0.05) hit = true;
    }
  });
  return hit;
}

/**
 * Right a flipped car in place when its spot is valid, otherwise move it to the
 * nearest free lane. Damage is kept: this is recovery, not repair.
 */
export function recoverCar(g: Game, car: SimCar, why: "manual" | "auto") {
  if (why === "manual") {
    if (g.time - g.lastUnstuckAt < UNSTUCK_COOLDOWN_S) return;
    g.lastUnstuckAt = g.time;
  }
  const gs = sampleGround(g.city, car.x, car.z, gsTmp);
  const validSpot = inWorldBounds(car.x, car.z) && gs.surface !== "water" && !carOverlapsStatic(g, car) && !car.airborne;
  const onlyFlipped = car.flip > 0.3 && validSpot;
  car.vx = car.vz = car.vy = car.yawRate = 0;
  car.speed = 0;
  car.flip = car.flipTarget = 0;
  car.pitch = car.roll = car.pitchVel = car.rollVel = 0;
  car.airborne = false;
  car.inWater = false;
  car.waterS = 0;
  car.stuckS = 0;
  if (!onlyFlipped) {
    const lane = nearestFreeLane(g, car.x, car.z, car.id);
    if (lane) {
      car.x = lane.x;
      car.z = lane.z;
      car.yaw = lane.yaw;
    }
  }
  car.y = groundH(g, car.x, car.z);
  car.px = car.x;
  car.pz = car.z;
  car.py = car.y;
  car.pyaw = car.yaw;
  emit(g, { type: "recover", what: "car" });
  toast(g, why === "auto" ? "Back on the road." : onlyFlipped ? "Back on four wheels." : "Recovered to the nearest road.", 1.8);
}

function recoverPlayer(g: Game) {
  const p = g.player;
  // Nearest promenade point for the sea, nearest lane-side sidewalk otherwise.
  if (p.z > PROMENADE_EDGE_Z - 2) {
    p.x = clamp(p.x, -120, 120);
    p.z = PROMENADE_EDGE_Z - 2.5;
  } else {
    const lane = nearestFreeLane(g, p.x, p.z, -1);
    if (lane) {
      p.x = lane.x - Math.cos(lane.yaw) * 5.5;
      p.z = lane.z + Math.sin(lane.yaw) * 5.5;
    }
  }
  p.y = groundH(g, p.x, p.z);
  p.vx = p.vz = p.vy = 0;
  p.px = p.x;
  p.pz = p.z;
  p.py = p.y;
  p.waterS = 0;
  emit(g, { type: "recover", what: "player" });
  toast(g, "Back on dry land.", 1.8);
}

// ---------------------------------------------------------------------------
// Housekeeping: recovery checks, visibility, spawning and recycling.

function housekeeping(g: Game, dt: number) {
  const p = g.player;
  const occupied = getCar(g, p.vehicleId);

  // Water / bounds recovery.
  for (const c of g.cars) {
    if (c.inWater) {
      if (c.waterS === 0) emit(g, { type: "splash", x: c.x, z: c.z });
      c.waterS += dt;
    } else c.waterS = 0;
    const lost = !inWorldBounds(c.x, c.z) || c.y < -20 || !Number.isFinite(c.x + c.z + c.vx + c.vz + c.yaw);
    if (c === occupied && (c.waterS > WATER_RECOVER_S || lost)) recoverCar(g, c, "auto");
    if (c !== occupied && lost) c.x = Number.NaN; // flagged for removal below
    if (c.role === "parked" && c.inWater) c.role = "stalled";
    const idleStuck = c === occupied && c.drive.throttle > 0.5 && Math.abs(c.speed) < 0.6;
    c.stuckS = idleStuck || c.flip > 0.5 ? c.stuckS + dt : 0;
  }
  if (p.state === "onFoot") {
    const gs = sampleGround(g.city, p.x, p.z, gsTmp);
    if (gs.surface === "water" && p.y < WATER_LEVEL - 0.25) {
      if (p.waterS === 0) emit(g, { type: "splash", x: p.x, z: p.z });
      p.waterS += dt;
    } else p.waterS = 0;
    if (p.waterS > 1 || !inWorldBounds(p.x, p.z) || p.y < -20 || !Number.isFinite(p.x + p.z)) recoverPlayer(g);
  }

  // Visibility bookkeeping.
  for (const c of g.cars) c.hiddenS = isVisible(g, c.x, c.z) ? 0 : c.hiddenS + dt;

  // Quietly stand knocked-over lamps back up when nobody is looking.
  for (const [lamp, since] of g.brokenLamps) {
    if (g.time - since < LAMP_RESTORE_S) continue;
    const col = lampCollider(g, lamp);
    if (!col || isVisible(g, col.x, col.z) || Math.hypot(col.x - p.x, col.z - p.z) < 50) continue;
    if (g.cars.some((c) => Math.hypot(c.x - col.x, c.z - col.z) < 3)) continue;
    g.brokenLamps.delete(lamp);
    g.lampVersion++;
  }

  const protectedCar = (c: SimCar) =>
    c === occupied || c.role === "occupied" || Math.hypot(c.x - p.x, c.z - p.z) < NEAR_PROTECT_M;

  // Recycle: invalid, far traffic, stalled and surplus abandoned cars (never the occupied one).
  for (let i = g.cars.length - 1; i >= 0; i--) {
    const c = g.cars[i];
    if (c === occupied) continue;
    if (!Number.isFinite(c.x)) {
      removeCar(g, c);
      continue;
    }
    if (protectedCar(c)) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    const hidden = c.hiddenS > 0.5;
    if (c.role === "traffic" && hidden && (d > DESPAWN_DIST_M || (c.ai && c.ai.blockedS > 14))) removeCar(g, c);
    else if (c.role === "stalled" && hidden && d > 50) removeCar(g, c);
  }
  // Parked surplus (from the usable-car guarantee) goes once it is out of sight.
  const parked = g.cars.filter((c) => c.role === "parked");
  if (parked.length > g.options.budget.parked) {
    const far = parked
      .filter((c) => !protectedCar(c) && c.hiddenS > 0.5)
      .sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
    if (far[0]) removeCar(g, far[0]);
  }
  const abandoned = g.cars.filter((c) => (c.role === "abandoned" || c.role === "stalled") && c !== occupied);
  if (abandoned.length > g.options.budget.abandoned) {
    const candidates = abandoned
      .filter((c) => !protectedCar(c) && c.hiddenS > 0.5)
      .sort((a, b) => Math.hypot(b.x - p.x, b.z - p.z) - Math.hypot(a.x - p.x, a.z - p.z));
    if (candidates[0]) removeCar(g, candidates[0]);
  }

  // Spawning (at most one car of each kind per tick, always outside the view).
  const budget = g.options.budget;
  const cap = budget.traffic + budget.parked + budget.abandoned + 2;
  if (g.cars.length < cap && countRole(g, "traffic") < budget.traffic) {
    const options = g.lanes.filter((l) => {
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      return d > SPAWN_MIN_DIST_M && d < SPAWN_MAX_DIST_M && !isVisible(g, l.x, l.z) && laneClear(g, l.x, l.z, 16);
    });
    if (options.length) {
      options.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      spawnTraffic(g, options[Math.floor(g.rng.next() * Math.min(options.length, 10))]);
    }
  }
  if (g.cars.length < cap && countRole(g, "parked") < budget.parked && g.rng.chance(0.25)) {
    const spot = g.rng.pick(g.city.parking);
    if (Math.hypot(spot.x - p.x, spot.z - p.z) > 40 && !isVisible(g, spot.x, spot.z) && spotFree(g, spot, 7)) spawnParked(g, spot);
  }
  // Guarantee a usable car within reach of a player on foot. "Reach" grows to the
  // nearest parking bay so places far from parking (the pier) can be satisfied.
  if (p.state === "onFoot" && g.cars.length < cap + 2) {
    const spots = g.city.parking
      .map((s) => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) }))
      .filter((o) => o.d > 10 && o.d < 120)
      .sort((a, b) => a.d - b.d);
    const reach = Math.max(FRESH_CAR_RADIUS_M, (spots[0]?.d ?? 0) + 8);
    // Moving traffic doesn't count: it is only enterable when it happens to stop.
    const usable = g.cars.some(
      (c) =>
        (c.role === "parked" || c.role === "abandoned") &&
        !c.wrecked &&
        c.flip < 0.1 &&
        !c.inWater &&
        Math.hypot(c.x - p.x, c.z - p.z) < reach,
    );
    if (!usable) {
      const free = spots.filter((o) => spotFree(g, o.s));
      const hidden = free.find((o) => !isVisible(g, o.s.x, o.s.z));
      const pick = hidden ?? free.find((o) => o.d > 25) ?? free[0];
      if (pick) spawnParked(g, pick.s);
    }
  }
}

function lampCollider(g: Game, lamp: number) {
  for (const c of g.city.colliders) if (c.lamp === lamp) return c;
  return null;
}

// ---------------------------------------------------------------------------
// Context & HUD

function updateContext(g: Game) {
  const p = g.player;
  g.enterTarget = null;
  g.inspectTarget = null;
  if (p.state !== "onFoot" || p.stumbleS > 0) return;
  g.enterTarget = findEnterTarget(g);
  let best = INSPECT_RADIUS_M;
  for (const l of g.city.landmarks) {
    const d = Math.hypot(l.pad.x - p.x, l.pad.z - p.z);
    if (d < best && Math.abs(groundH(g, l.pad.x, l.pad.z) - p.y) < 1) {
      best = d;
      g.inspectTarget = l;
    }
  }
}

function updateHud(g: Game) {
  const p = g.player;
  const h = g.hud;
  const car = getCar(g, p.vehicleId);
  h.state = p.state;
  h.vehicle = car ? car.spec.label : null;
  h.speedKmh = car ? Math.abs(toKmh(car.speed)) : 0;
  h.condition = car ? car.condition : 100;
  h.wrecked = !!car?.wrecked;
  h.flipped = !!car && car.flip > 0.5;
  h.suggestUnstuck =
    !!car && p.state === "driving" && (car.stuckS > STUCK_HINT_S || car.flip > 0.5 || car.inWater || g.time < g.exitBlockedUntil);
  h.contextSlug = null;
  h.nearLandmark = null;
  if (p.state === "onFoot") {
    const e = g.enterTarget;
    const l = g.inspectTarget;
    if (e && (!l || distTo(p, e.ax, e.az) <= distTo(p, l.pad.x, l.pad.z))) {
      h.context = "enter";
      h.contextLabel = `Enter ${e.car.spec.label.toLowerCase()}`;
    } else if (l) {
      h.context = "inspect";
      h.contextLabel = `About ${l.name}`;
      h.contextSlug = l.slug;
    } else {
      h.context = "none";
      h.contextLabel = "";
    }
  } else if (p.state === "driving" && car) {
    if (Math.abs(car.speed) > EXIT_MAX_SPEED_MPS) {
      h.context = "slowToExit";
      h.contextLabel = "Get out";
    } else {
      h.context = "exit";
      h.contextLabel = "Get out";
    }
    for (const l of g.city.landmarks) {
      if (Math.hypot(l.pad.x - car.x, l.pad.z - car.z) < LANDMARK_HINT_M) h.nearLandmark = l.name;
    }
  } else {
    h.context = "none";
    h.contextLabel = "";
  }
}

// ---------------------------------------------------------------------------
// Read-only snapshot for tests and the dev harness.

export function snapshot(g: Game) {
  const p = g.player;
  const car = getCar(g, p.vehicleId);
  const round = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
  const nearby = g.cars
    .map((c) => ({
      id: c.id,
      kind: c.spec.kind,
      role: c.role,
      dist: round(Math.hypot(c.x - p.x, c.z - p.z), 1),
      wrecked: c.wrecked,
      flipped: c.flip > 0.5,
    }))
    .filter((c) => c.dist < 30)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6);
  const roles: Record<Role, number> = { parked: 0, traffic: 0, abandoned: 0, stalled: 0, occupied: 0 };
  for (const c of g.cars) roles[c.role]++;
  return {
    time: round(g.time, 3),
    steps: g.steps,
    state: p.state,
    player: { x: round(p.x), y: round(p.y), z: round(p.z), facing: round(p.facing, 3), grounded: p.grounded },
    vehicleId: p.vehicleId,
    car: car
      ? {
          id: car.id,
          kind: car.spec.kind,
          x: round(car.x),
          z: round(car.z),
          yaw: round(car.yaw, 3),
          speedKmh: round(Math.abs(toKmh(car.speed)), 1),
          condition: round(car.condition, 1),
          wrecked: car.wrecked,
          flipped: car.flip > 0.5,
          role: car.role,
          ai: !!car.ai,
          dents: car.dents.length,
          detached: car.detached,
        }
      : null,
    context: g.hud.context,
    contextLabel: g.hud.contextLabel,
    enterTargetId: g.enterTarget?.car.id ?? null,
    inspectSlug: g.inspectTarget?.slug ?? null,
    counts: { cars: g.cars.length, ...roles },
    nearby,
    controlledByPlayer: g.cars.filter((c) => c.role === "occupied").map((c) => c.id),
    aiCars: g.cars.filter((c) => c.ai).length,
    lampsDown: g.brokenLamps.size,
    toast: g.time < g.toast.until ? g.toast.text : null,
  };
}

export type Snapshot = ReturnType<typeof snapshot>;
