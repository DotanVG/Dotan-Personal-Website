import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ink/60">
          404
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold">
          Lost in the world.
        </h1>
        <p className="mt-4 text-ink/70">
          You wandered off the map. Let&apos;s get you back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas hover:-translate-y-0.5"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
