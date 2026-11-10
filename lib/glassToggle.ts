/** Header glass switch. Thumb on the right (1) is light/sun; left (0) is dark/moon. */
export const GLASS = {
  trackW: 60,
  trackH: 30,
  pad: 18,
  thumb: 24,
  travel: 15,
  cell: 2.55,
  scatter: 11,
} as const;

export const GLASS_CANVAS = {
  w: GLASS.trackW + GLASS.pad * 2,
  h: GLASS.trackH + GLASS.pad * 2,
} as const;

export const ICON_SIZE = 7;
export const DRAG_THRESHOLD_PX = 5;
export const THEME_MORPH_MS = 520;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function thumbForTheme(theme: "light" | "dark"): 0 | 1 {
  return theme === "light" ? 1 : 0;
}

export function themeForThumb(thumb: number): "light" | "dark" {
  return thumb >= 0.5 ? "light" : "dark";
}

export function thumbFromPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 0;
  return clamp01((clientX - left) / width);
}

export function pointerBecameDrag(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

export function morphDuration(distance: number): number {
  return Math.max(140, Math.abs(distance) * THEME_MORPH_MS);
}

/** Glass stays on under reduced motion; only a missing WebGL context falls back. */
export function shouldUseGlassShader(_reducedMotion: boolean, hasWebGL: boolean): boolean {
  return hasWebGL;
}

export type GlassThumbSettler = {
  setThumb: (value: number) => void;
  animateTo: (value: number) => void;
};

/** Finger-following motion stays live; autonomous travel snaps under reduced motion. */
export function settleGlassThumb(
  glass: GlassThumbSettler | null | undefined,
  value: number,
  reducedMotion: boolean,
): void {
  if (!glass) return;
  if (reducedMotion) glass.setThumb(value);
  else glass.animateTo(value);
}

/** 0 or 255 masks. Sun is symmetric; the moon is a crescent with two stars. */
export function buildIconMasks(size = ICON_SIZE): { sun: Uint8Array; moon: Uint8Array } {
  const sun = new Uint8Array(size * size);
  const moon = new Uint8Array(size * size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      const body = d <= 1.5;
      const ray = (dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) === 3;
      const diag = Math.abs(Math.abs(dx) - Math.abs(dy)) === 0 && Math.abs(dx) === 2;
      sun[y * size + x] = body || ray || diag ? 255 : 0;

      const crescent =
        Math.hypot(dx + 0.35, dy) <= 2.2 && Math.hypot(dx - 1.45, dy - 0.05) >= 1.65;
      const star = (dx === 2 && dy === -2) || (dx === 3 && dy === -1);
      moon[y * size + x] = crescent || star ? 255 : 0;
    }
  }
  return { sun, moon };
}

export function maskLitCount(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) if (v > 0) n++;
  return n;
}
