import Link from "next/link";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="border-t border-line bg-canvas-inset">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-6 py-14 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <div className="font-display text-2xl font-medium">{site.fullName}</div>
          <div className="mt-1 text-sm text-ink/60">
            {site.tagline} · Based in {site.location}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink/70">
          <Link
            href={site.social.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink hover:underline"
          >
            LinkedIn
          </Link>
          <Link
            href={site.social.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink hover:underline"
          >
            GitHub
          </Link>
          <Link
            href={site.social.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink hover:underline"
          >
            WhatsApp
          </Link>
          <Link
            href="?mode=explore"
            className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] hover:border-ink/60 hover:text-ink"
          >
            Switch to Explore →
          </Link>
        </div>
      </div>
      <div className="border-t border-line/50">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-5 text-xs text-ink/50 md:px-8">
          <span>© {new Date().getFullYear()} Dotan Veretzky.</span>
          <span>Built with Next.js · React · Three.js</span>
        </div>
      </div>
    </footer>
  );
}
