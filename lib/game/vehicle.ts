// Arcade vehicle dynamics. One rigid body per car on the ground plane with
// grip-limited lateral slip, speed-dependent steering, brake-then-reverse and a
// handbrake that lets the rear step out. Collisions live in sim.ts; this file
// only integrates forces from driver input and terrain.

import { approach, clamp } from "./math";

export type VehicleKind = "hatch" | "sedan" | "coupe" | "van";

export type VehicleSpec = {
  kind: VehicleKind;
  label: string;
  /** kg */
  mass: number;
  /** Body half extents and height, metres. */
  halfWidth: number;
  halfLength: number;
  height: number;
  wheelbase: number;
  track: number;
  wheelRadius: number;
  /** Peak drive force at low speed, N. */
  engineForce: number;
  /** Top speed, m/s. */
  maxSpeed: number;
  reverseForce: number;
  reverseMaxSpeed: number;
  /** Service brake force, N. */
  brakeForce: number;
  /** Aerodynamic drag, N per (m/s)^2. */
  dragCoef: number;
  /** Maximum front wheel angle, rad. */
  maxSteer: number;
  /** Lateral tyre friction coefficient. */
  grip: number;
  /** Yaw acceleration authority, rad/s^2. */
  yawAccel: number;
};

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  hatch: {
    kind: "hatch",
    label: "Hatchback",
    mass: 1050,
    halfWidth: 0.86,
    halfLength: 1.92,
    height: 1.45,
    wheelbase: 2.45,
    track: 1.46,
    wheelRadius: 0.31,
    engineForce: 7600,
    maxSpeed: 33,
    reverseForce: 5200,
    reverseMaxSpeed: 8,
    brakeForce: 10500,
    dragCoef: 1.2,
    maxSteer: 0.62,
    grip: 1.12,
    yawAccel: 9,
  },
  sedan: {
    kind: "sedan",
    label: "Sedan",
    mass: 1350,
    halfWidth: 0.9,
    halfLength: 2.25,
    height: 1.42,
    wheelbase: 2.75,
    track: 1.54,
    wheelRadius: 0.33,
    engineForce: 9400,
    maxSpeed: 38,
    reverseForce: 6600,
    reverseMaxSpeed: 8,
    brakeForce: 13500,
    dragCoef: 1.25,
    maxSteer: 0.58,
    grip: 1.08,
    yawAccel: 8,
  },
  coupe: {
    kind: "coupe",
    label: "Sports coupe",
    mass: 1200,
    halfWidth: 0.93,
    halfLength: 2.12,
    height: 1.2,
    wheelbase: 2.55,
    track: 1.6,
    wheelRadius: 0.33,
    engineForce: 12000,
    maxSpeed: 46,
    reverseForce: 6000,
    reverseMaxSpeed: 8,
    brakeForce: 14000,
    dragCoef: 1.1,
    maxSteer: 0.6,
    grip: 1.22,
    yawAccel: 10.5,
  },
  van: {
    kind: "van",
    label: "Delivery van",
    mass: 2100,
    halfWidth: 1.0,
    halfLength: 2.55,
    height: 2.25,
    wheelbase: 3.1,
    track: 1.7,
    wheelRadius: 0.36,
    engineForce: 12500,
    maxSpeed: 30,
    reverseForce: 9000,
    reverseMaxSpeed: 7,
    brakeForce: 17500,
    dragCoef: 1.8,
    maxSteer: 0.55,
    grip: 0.96,
    yawAccel: 6,
  },
};

// ---- Tuning constants (units in names) ----
export const GRAVITY_MPS2 = 9.81;
/** Arcade gravity applied to airborne cars so jumps don't float. */
export const CAR_GRAVITY_MPS2 = 15;
/** Below this forward speed the brake pedal becomes reverse. */
export const REVERSE_ENGAGE_MPS = 0.6;
export const STEER_IN_RADPS = 3.0;
export const STEER_OUT_RADPS = 4.8;
/** How far past the grip limit full steering may push the car (1 = exactly at the limit). */
export const STEER_GRIP_MARGIN = 1.55;
/** Rate at which lateral slip is scrubbed while within grip, 1/s. */
export const LATERAL_STIFFNESS_PER_S = 9;
export const HANDBRAKE_GRIP_FACTOR = 0.32;
export const HANDBRAKE_YAW_GAIN = 1.45;
/** Locked rear wheels: the strongest stop (above every car's service brake), rear still slides. */
export const HANDBRAKE_DECEL_MPS2 = 12;
/** Below this speed the handbrake brings the car to rest almost at once. */
export const HANDBRAKE_CREEP_MPS = 4;
export const HANDBRAKE_CREEP_DECEL_MPS2 = 18;
/** Off both pedals: engine braking coasts the car down gradually. */
export const COAST_DECEL_MPS2 = 1.7;
/** Rolling friction on any rolling car (scaled by surface), so it always comes to rest. */
export const ROLLING_DECEL_MPS2 = 0.35;
/** Seconds to regain full grip after releasing the handbrake. */
export const GRIP_RECOVER_S = 0.35;
/** Ground drops more than this under a grounded car → airborne. */
export const AIRBORNE_GAP_M = 0.12;
/** Landings faster than this (vertical) damage the car. */
export const LANDING_DAMAGE_MPS = 8.5;
/** Ground rising more than this in one step blocks the car like a wall. */
export const CAR_MAX_STEP_M = 0.5;
const SUSPENSION_K = 90;
const SUSPENSION_C = 13;

export type DriveInput = { throttle: number; brake: number; steer: number; handbrake: boolean };

export const NO_DRIVE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

export type Car = {
  id: number;
  spec: VehicleSpec;
  paint: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  yawRate: number;
  /** Current front wheel angle, rad, positive = right. */
  steer: number;
  airborne: boolean;
  gripScale: number;
  /** Visual suspension state (rad). Positive pitch = nose up, positive roll = left side up. */
  pitch: number;
  roll: number;
  pitchVel: number;
  rollVel: number;
  terrainPitch: number;
  terrainRoll: number;
  wheelSpin: number;
  /** 0..1 rollover animation progress; > 0.5 means lying on its roof. */
  flip: number;
  flipTarget: number;
  inWater: boolean;
  // Previous pose for render interpolation.
  px: number;
  pz: number;
  py: number;
  pyaw: number;
  /** Signed forward speed after the last step (m/s). */
  speed: number;
  /** Longitudinal acceleration of the last step (m/s^2), for visuals. */
  accel: number;
  /** Closing speed against a terrain wall this step (m/s), 0 if none. */
  wallImpact: number;
  wallNx: number;
  wallNz: number;
};

export function createCar(id: number, spec: VehicleSpec, x: number, z: number, yaw: number, paint: string): Car {
  return {
    id,
    spec,
    paint,
    x,
    z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw,
    yawRate: 0,
    steer: 0,
    airborne: false,
    gripScale: 1,
    pitch: 0,
    roll: 0,
    pitchVel: 0,
    rollVel: 0,
    terrainPitch: 0,
    terrainRoll: 0,
    wheelSpin: 0,
    flip: 0,
    flipTarget: 0,
    inWater: false,
    px: x,
    pz: z,
    py: 0,
    pyaw: yaw,
    speed: 0,
    accel: 0,
    wallImpact: 0,
    wallNx: 0,
    wallNz: 0,
  };
}

export type Terrain = {
  /** Ground height, smooth gradient and grip/drag multipliers at a point. */
  sample(x: number, z: number): { h: number; gx: number; gz: number; grip: number; drag: number; water: boolean };
};

/** Steering angle the tyres can support at this speed, rad. */
export function steerLimit(spec: VehicleSpec, speed: number, grip: number): number {
  const v2 = Math.max(speed * speed, 1);
  return Math.min(spec.maxSteer, Math.atan((spec.wheelbase * STEER_GRIP_MARGIN * grip * GRAVITY_MPS2) / v2));
}

/**
 * Advance one car by `dt` seconds from driver input and terrain. `propulsion`
 * scales engine output (0 for wrecks). Returns the vertical landing speed if the
 * car touched down this step (for damage), else 0.
 */
export function stepVehicle(car: Car, input: DriveInput, terrain: Terrain, dt: number, propulsion: number): number {
  const spec = car.spec;
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  // forward = (s, c), left = (c, -s)
  let vLong = car.vx * s + car.vz * c;
  let vLat = car.vx * c - car.vz * s;
  const ground = terrain.sample(car.x, car.z);
  const onRoof = car.flip > 0.5;
  const canDrive = propulsion > 0 && !onRoof && !car.inWater;

  // Steering: speed-dependent limit, smoothed toward the target angle.
  const limit = steerLimit(spec, Math.abs(vLong), spec.grip * ground.grip);
  const targetSteer = clamp(input.steer, -1, 1) * limit;
  const rate = Math.abs(targetSteer) > Math.abs(car.steer) ? STEER_IN_RADPS : STEER_OUT_RADPS;
  car.steer = approach(car.steer, targetSteer, rate * dt);

  const vLong0 = vLong;
  if (!car.airborne) {
    // Throttle / brake / reverse arbitration.
    let drive = 0;
    let brake = 0;
    const throttle = clamp(input.throttle, 0, 1);
    const pedal = clamp(input.brake, 0, 1);
    if (pedal > 0) {
      if (vLong > REVERSE_ENGAGE_MPS) brake = pedal;
      else drive -= pedal;
    }
    if (throttle > 0) {
      if (vLong < -REVERSE_ENGAGE_MPS) brake = Math.max(brake, throttle);
      else drive += throttle;
    }
    let force = 0;
    if (canDrive && drive > 0) {
      const f = vLong > 0 ? Math.max(0, 1 - (vLong / spec.maxSpeed) ** 2) : 1;
      force += spec.engineForce * propulsion * drive * f;
    } else if (canDrive && drive < 0) {
      const f = vLong < 0 ? Math.max(0, 1 - (vLong / spec.reverseMaxSpeed) ** 2) : 1;
      force += spec.reverseForce * propulsion * drive * f;
    }
    force -= spec.dragCoef * vLong * Math.abs(vLong);
    vLong += (force / spec.mass) * dt;

    // Brakes, engine braking and rolling friction never reverse the direction of
    // travel within a step: they bring the car to exactly 0.
    let decel = (brake * spec.brakeForce) / spec.mass + ROLLING_DECEL_MPS2 * ground.drag;
    if (drive === 0 && brake === 0) decel += COAST_DECEL_MPS2;
    if (input.handbrake) decel += Math.abs(vLong) < HANDBRAKE_CREEP_MPS ? HANDBRAKE_CREEP_DECEL_MPS2 : HANDBRAKE_DECEL_MPS2;
    if (onRoof || car.inWater) decel += 7;
    const dv = decel * dt;
    vLong = Math.abs(vLong) <= dv ? 0 : vLong - Math.sign(vLong) * dv;

    // Lateral grip: scrub sideways velocity up to the friction limit.
    car.gripScale = input.handbrake ? HANDBRAKE_GRIP_FACTOR : approach(car.gripScale, 1, dt / GRIP_RECOVER_S);
    const mu = spec.grip * ground.grip * car.gripScale * (onRoof ? 0.7 : 1);
    const maxDv = mu * GRAVITY_MPS2 * dt;
    vLat += clamp(-vLat * Math.min(1, LATERAL_STIFFNESS_PER_S * dt), -maxDv, maxDv);
    if (onRoof) vLat *= 1 - Math.min(1, 3 * dt);

    // Yaw: chase the kinematic yaw rate of the steered wheels, grip-limited.
    let yawTarget = onRoof ? 0 : (-vLong * Math.tan(car.steer)) / spec.wheelbase;
    let yawAuthority = spec.yawAccel * Math.min(1, ground.grip + 0.2);
    if (input.handbrake && Math.abs(vLong) > 2) {
      yawTarget *= HANDBRAKE_YAW_GAIN;
      yawAuthority *= 1.5;
    }
    car.yawRate = approach(car.yawRate, yawTarget, yawAuthority * dt);
  } else {
    // In the air: keep momentum, light drag, slow spin decay.
    vLong -= ((spec.dragCoef * vLong * Math.abs(vLong)) / spec.mass) * dt;
    car.yawRate *= 1 - Math.min(1, 0.5 * dt);
  }

  car.vx = s * vLong + c * vLat;
  car.vz = c * vLong - s * vLat;
  car.accel = (vLong - vLong0) / dt;
  car.speed = vLong;
  const x0 = car.x;
  const z0 = car.z;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.yaw += car.yawRate * dt;
  car.wheelSpin += (vLong / spec.wheelRadius) * dt;

  // Terrain higher than a kerb-sized step acts as a wall (ramp sides, pier edge).
  car.wallImpact = 0;
  if (terrain.sample(car.x, car.z).h > car.y + CAR_MAX_STEP_M) {
    const e = 0.7;
    let nx = terrain.sample(car.x - e, car.z).h - terrain.sample(car.x + e, car.z).h;
    let nz = terrain.sample(car.x, car.z - e).h - terrain.sample(car.x, car.z + e).h;
    let len = Math.hypot(nx, nz);
    if (len < 1e-3) {
      nx = -car.vx;
      nz = -car.vz;
      len = Math.hypot(nx, nz) || 1;
    }
    nx /= len;
    nz /= len;
    const vn = car.vx * nx + car.vz * nz;
    if (vn < 0) {
      car.vx -= 1.15 * vn * nx;
      car.vz -= 1.15 * vn * nz;
      car.wallImpact = -vn;
      car.wallNx = nx;
      car.wallNz = nz;
    }
    car.x = x0;
    car.z = z0;
  }

  // Vertical: follow terrain, leave it off ramp lips, land with gravity.
  const g = terrain.sample(car.x, car.z);
  let landing = 0;
  car.inWater = g.water && car.y < g.h + 0.6;
  if (car.airborne) {
    car.vy -= CAR_GRAVITY_MPS2 * dt;
    car.y += car.vy * dt;
    if (car.y <= g.h) {
      landing = -car.vy;
      car.y = g.h;
      car.vy = 0;
      car.airborne = false;
      car.pitchVel -= Math.min(landing, 12) * 0.12;
    }
  } else if (g.h < car.y - AIRBORNE_GAP_M) {
    car.airborne = true;
  } else {
    car.vy = car.vx * g.gx + car.vz * g.gz;
    car.y = g.h;
  }
  updateSuspension(car, terrain, dt);
  return landing;
}

function updateSuspension(car: Car, terrain: Terrain, dt: number) {
  const spec = car.spec;
  const s = Math.sin(car.yaw);
  const c = Math.cos(car.yaw);
  if (!car.airborne) {
    // Sample under the axles and sides to tilt the body with the ground.
    const a = spec.wheelbase / 2;
    const w = spec.track / 2;
    const hf = terrain.sample(car.x + s * a, car.z + c * a).h;
    const hr = terrain.sample(car.x - s * a, car.z - c * a).h;
    const hl = terrain.sample(car.x + c * w, car.z - s * w).h;
    const hrt = terrain.sample(car.x - c * w, car.z + s * w).h;
    car.terrainPitch = clamp(Math.atan2(hf - hr, spec.wheelbase), -0.5, 0.5);
    car.terrainRoll = clamp(Math.atan2(hl - hrt, spec.track), -0.4, 0.4);
  } else {
    car.terrainPitch = clamp(Math.atan2(car.vy, Math.max(4, Math.abs(car.speed))) * 0.6, -0.4, 0.4);
  }
  const pitchTarget = clamp(car.accel * 0.007, -0.07, 0.06);
  const rollTarget = clamp(car.speed * car.yawRate * 0.009, -0.09, 0.09);
  car.pitchVel += (SUSPENSION_K * (pitchTarget - car.pitch) - SUSPENSION_C * car.pitchVel) * dt;
  car.rollVel += (SUSPENSION_K * (rollTarget - car.roll) - SUSPENSION_C * car.rollVel) * dt;
  car.pitch += car.pitchVel * dt;
  car.roll += car.rollVel * dt;
  car.flip = approach(car.flip, car.flipTarget, dt * 1.6);
}

/** Speed in km/h for display. */
export const toKmh = (mps: number) => mps * 3.6;
