// Adaptive rendering quality. After a warm-up, two consecutive slow windows
// step the tier down once; it never steps back up, so it cannot oscillate.
// Tiers change rendering detail and traffic density only, never controls or physics.

export type Quality = "high" | "low" | "minimal";

export const QUALITY_WARMUP_S = 5;
export const QUALITY_WINDOW_S = 3;
/** Step down when a window averages below this many frames per second. */
export const QUALITY_FLOOR_FPS: Record<Quality, number> = { high: 45, low: 28, minimal: 0 };
const NEXT: Record<Quality, Quality> = { high: "low", low: "minimal", minimal: "minimal" };

export function createQualityGovernor(start: Quality) {
  let quality = start;
  let live = 0;
  let t = 0;
  let frames = 0;
  let slow = 0;
  return {
    get quality() {
      return quality;
    },
    /** Pauses and loading must not count as slow frames. */
    pause() {
      t = frames = 0;
    },
    /** Feed one rendered frame; returns the new tier when it changes. */
    frame(dt: number): Quality | null {
      live += dt;
      if (live < QUALITY_WARMUP_S) return null;
      t += dt;
      frames++;
      if (t < QUALITY_WINDOW_S) return null;
      const fps = frames / t;
      t = frames = 0;
      slow = fps < QUALITY_FLOOR_FPS[quality] ? slow + 1 : 0;
      if (slow < 2 || quality === "minimal") return null;
      slow = 0;
      live = 0; // the new tier gets its own warm-up (shader recompiles, shadow maps)
      quality = NEXT[quality];
      return quality;
    },
  };
}
