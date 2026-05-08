import Link from "next/link";
import { site } from "@/content/site";
import { LinkedInIcon, GitHubIcon, ItchIcon, WhatsAppIcon } from "@/components/ui/icons";

const socials = [
  {
    label: "LinkedIn",
    href: site.social.linkedin,
    icon: <LinkedInIcon />,
  },
  {
    label: "GitHub",
    href: site.social.github,
    icon: <GitHubIcon />,
  },
  {
    label: "itch.io",
    href: site.social.itch,
    icon: <ItchIcon />,
  },
  {
    label: "WhatsApp",
    href: site.social.whatsapp,
    icon: <WhatsAppIcon />,
  },
];

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
          {socials.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center gap-2"
            >
              <span className="shrink-0 text-ink/50 transition-colors duration-300 group-hover:text-ink">
                {s.icon}
              </span>
              <span className="transition-colors duration-300 group-hover:text-ink">
                {s.label}
              </span>
              <span
                aria-hidden
                className="inline-block translate-x-0 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
              >
                ↗
              </span>
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-all duration-500 group-hover:w-full"
              />
            </Link>
          ))}
          <Link
            href="?mode=explore"
            className="group relative overflow-hidden rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] transition-all duration-500 hover:border-ink/60 hover:text-ink"
          >
            <span
              aria-hidden
              className="absolute inset-0 -translate-x-full bg-ink/10 transition-transform duration-500 group-hover:translate-x-0"
            />
            <span className="relative">Switch to Explore →</span>
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
