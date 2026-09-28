const SPRING_STIFFNESS = 34;
const SPRING_DAMPING = 7.5;
const MAX_SPRING_STEP = 1 / 60;
const MAX_SPRING_DELTA = 0.1;

export type BlobPose = {
  x: number;
  y: number;
  z: number;
  scale: number;
};

export function getBlobPose(progress: number): BlobPose {
  const scroll = Math.min(1, Math.max(0, progress));
  const phase = -0.2 + scroll * Math.PI * 4;
  const baseX = Math.cos(phase) * 2.05 + Math.sin(phase * 3) * 0.12;
  const left = Math.max(0, -baseX / 2.05);
  const x = baseX * (1 + left * 0.16);
  const y = Math.sin(phase * 1.5 + 0.5) * 0.65 + Math.sin(phase * 3.2) * 0.22;
  const edge = Math.min(1, Math.abs(x) / 2.35);
  const center = 1 - edge;

  return {
    x,
    y,
    z: -0.25 - center * 1.35 - left * 0.6 - scroll * 0.25,
    scale: (0.52 + edge * 0.36) * (1 - left * 0.27) * (1 - scroll * 0.08),
  };
}

export function stepBlobSpring(
  value: number,
  velocity: number,
  target: number,
  delta: number,
) {
  let nextValue = value;
  let nextVelocity = velocity;
  let remaining = Math.min(Math.max(delta, 0), MAX_SPRING_DELTA);

  while (remaining > 0) {
    const frame = Math.min(remaining, MAX_SPRING_STEP);
    const acceleration = (target - nextValue) * SPRING_STIFFNESS;
    nextVelocity = (nextVelocity + acceleration * frame) * Math.exp(-SPRING_DAMPING * frame);
    nextValue += nextVelocity * frame;
    remaining -= frame;
  }

  return {
    value: nextValue,
    velocity: nextVelocity,
  };
}

export function dampBlobAngle(current: number, target: number, lambda: number, delta: number) {
  const shortestDelta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + shortestDelta * (1 - Math.exp(-lambda * delta));
}

export function getBlobRollDelta(
  xMovement: number,
  yMovement: number,
  speed = 0.55,
) {
  return {
    x: -yMovement * speed,
    y: xMovement * speed,
  };
}
