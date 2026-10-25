// Two-note chime, synthesized. Created on the first user gesture and closed with the scene.

let ctx: AudioContext | null = null;

function ctor(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Create or resume the context. Call from a click or key handler. Silent if WebAudio is missing. */
export function primeChime() {
  try {
    const AC = ctor();
    if (!AC) return;
    if (!ctx || ctx.state === "closed") ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

function tone(c: AudioContext, freq: number, t: number, dur: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playChime(opts?: { vibrate?: boolean }) {
  try {
    primeChime();
    const c = ctx;
    if (!c) return;
    const start = () => {
      const t = c.currentTime;
      tone(c, 523.25, t, 0.18);
      tone(c, 659.25, t + 0.16, 0.28);
      if (opts?.vibrate) {
        try {
          navigator.vibrate?.([24, 40, 28]);
        } catch {
          // no vibrator, or the call was blocked
        }
      }
    };
    if (c.state === "suspended") void c.resume().then(start).catch(() => {});
    else start();
  } catch {
    // WebAudio unavailable: the mission still completes in silence
  }
}

export function closeChime() {
  const c = ctx;
  ctx = null;
  if (!c) return;
  try {
    void c.close().catch(() => {});
  } catch {
    // already closed
  }
}
