"use client";

export function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-canvas-inset">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-12">
          <div
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-ink"
            style={{ animationDuration: "1.2s" }}
          />
        </div>
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-ink/60">
          Loading the world…
        </div>
      </div>
    </div>
  );
}
