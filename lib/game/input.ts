// Device-agnostic input state. Keyboard and touch controls write into their own
// source slots; `resolveInput` merges them each step. One-shot actions are
// latched as counts and consumed exactly once by the simulation.

export type TouchSource = {
  moveX: number;
  moveY: number;
  run: boolean;
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
};

export type InputState = {
  keys: Set<string>;
  touch: TouchSource;
  /** Accumulated look drag in CSS pixels, consumed by the camera each frame. */
  lookDX: number;
  lookDY: number;
  /** Time (ms) of the last manual look input, for camera recentring. */
  lastLookAt: number;
  jumpQueued: boolean;
  actionQueued: boolean;
  unstuckQueued: boolean;
  /** Bumped by clearInput so held touch controls know to let go too. */
  epoch: number;
};

/** Merged per-step values the simulation reads. */
export type ResolvedInput = {
  moveX: number;
  moveY: number;
  run: boolean;
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
};

export const STICK_DEADZONE = 0.14;

export function createInput(): InputState {
  return {
    keys: new Set(),
    touch: { moveX: 0, moveY: 0, run: false, steer: 0, throttle: 0, brake: 0, handbrake: false },
    lookDX: 0,
    lookDY: 0,
    lastLookAt: -Infinity,
    jumpQueued: false,
    actionQueued: false,
    unstuckQueued: false,
    epoch: 0,
  };
}

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyE",
  "KeyR",
]);

export const isGameKey = (code: string) => GAME_KEYS.has(code);

/**
 * Apply a key transition. Returns true when the key belongs to the game (the
 * caller then prevents the browser default). Auto-repeat never re-fires actions.
 */
export function applyKey(input: InputState, code: string, down: boolean, repeat = false): boolean {
  if (!GAME_KEYS.has(code)) return false;
  if (down) {
    if (!repeat && !input.keys.has(code)) {
      if (code === "Space") input.jumpQueued = true;
      if (code === "KeyE") input.actionQueued = true;
      if (code === "KeyR") input.unstuckQueued = true;
    }
    input.keys.add(code);
  } else {
    input.keys.delete(code);
  }
  return true;
}

/** Drop everything held: blur, tab hide, overlays, mode exit, unmount. */
export function clearInput(input: InputState) {
  input.keys.clear();
  const t = input.touch;
  t.moveX = t.moveY = t.steer = t.throttle = t.brake = 0;
  t.handbrake = false;
  t.run = false;
  input.lookDX = input.lookDY = 0;
  input.jumpQueued = input.actionQueued = input.unstuckQueued = false;
  input.epoch++;
}

const out: ResolvedInput = { moveX: 0, moveY: 0, run: false, steer: 0, throttle: 0, brake: 0, handbrake: false };

/** Merge keyboard and touch. Keyboard wins on any axis it is actively driving. */
export function resolveInput(input: InputState): ResolvedInput {
  const k = input.keys;
  const right = +(k.has("KeyD") || k.has("ArrowRight"));
  const left = +(k.has("KeyA") || k.has("ArrowLeft"));
  const up = +(k.has("KeyW") || k.has("ArrowUp"));
  const down = +(k.has("KeyS") || k.has("ArrowDown"));
  let mx = right - left;
  let my = up - down;
  const keyMove = mx !== 0 || my !== 0;
  if (!keyMove) {
    mx = input.touch.moveX;
    my = input.touch.moveY;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  out.moveX = mx;
  out.moveY = my;
  out.run = k.has("ShiftLeft") || k.has("ShiftRight") || (!keyMove && input.touch.run);
  out.steer = right - left !== 0 ? right - left : input.touch.steer;
  out.throttle = Math.max(up, input.touch.throttle);
  out.brake = Math.max(down, input.touch.brake);
  out.handbrake = k.has("Space") || input.touch.handbrake;
  return out;
}

/**
 * Convert a thumb offset (CSS px) into a stick value: clamped to the radius,
 * radial deadzone, rescaled so the output still spans 0..1.
 */
export function stickValue(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE) {
  const len = Math.hypot(dx, dy);
  const clampedLen = Math.min(len, radius);
  const mag = clampedLen / radius;
  if (mag <= deadzone || len === 0) return { x: 0, y: 0, mag: 0, knobX: 0, knobY: 0 };
  const scaled = (mag - deadzone) / (1 - deadzone);
  const ux = dx / len;
  const uy = dy / len;
  return { x: ux * scaled, y: uy * scaled, mag: scaled, knobX: ux * clampedLen, knobY: uy * clampedLen };
}
