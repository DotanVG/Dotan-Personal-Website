import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import { ContactForm } from "./ContactForm";

export function Contact() {
  return (
    <section
      id="contact"
      className="relative mx-auto w-full max-w-page scroll-mt-24 px-6 py-32 md:px-8 md:py-48"
    >
      <RevealOnScroll>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
          05 — Contact
        </p>
        <h2 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Let&apos;s build{" "}
          <span className="text-ink/40 transition-colors duration-700 hover:text-ink">
            something.
          </span>
        </h2>
        <p className="mt-6 max-w-prose text-pretty text-lg text-ink/70">
          Reach out about full-stack work, integrations, indie-game collabs, or
          just to say hi. I read everything that comes through.
        </p>
      </RevealOnScroll>

      <div className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-16">
        <RevealOnScroll className="md:col-span-7">
          <ContactForm />
        </RevealOnScroll>

        <RevealOnScroll delay={0.15} className="md:col-span-5">
          <div className="flex flex-col gap-2">
            <ContactRow label="Email" value={site.email} href={`mailto:${site.email}`} />
            <ContactRow
              label="Phone"
              value={site.phone}
              href={`tel:${site.phoneIntl}`}
            />
            <ContactRow
              label="LinkedIn"
              value="dotan-v"
              href={site.social.linkedin}
              external
            />
            <ContactRow
              label="GitHub"
              value="DotanVG"
              href={site.social.github}
              external
            />

            <Link
              href={site.social.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative mt-6 flex items-center gap-5 overflow-hidden rounded-2xl border border-line bg-canvas-raised/60 p-4 transition-all duration-500 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_22px_55px_-30px_rgb(0_0_0_/_0.45)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(140% 90% at 0% 100%, rgba(16,185,129,0.18), transparent 60%)",
                }}
              />
              <div className="relative size-[120px] shrink-0 overflow-hidden rounded-xl bg-canvas">
                <Image
                  src="/images/WhatsApp-QR-CODE.jpeg"
                  alt="WhatsApp QR code for Dotan Veretzky"
                  fill
                  sizes="120px"
                  className="object-contain transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="relative">
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
                  WhatsApp
                </div>
                <div className="mt-1 text-sm text-ink/80">
                  Scan, or{" "}
                  <span className="font-medium underline underline-offset-4 transition-colors group-hover:text-ink">
                    open a chat ↗
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

function ContactRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group relative flex items-baseline justify-between gap-4 overflow-hidden border-b border-line py-4 transition-all duration-500 hover:border-ink/40"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-ink transition-transform duration-500 group-hover:scale-x-100"
        style={{ transformOrigin: "0% 50%" }}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 transition-colors duration-300 group-hover:text-ink/90">
        {label}
      </span>
      <span className="relative inline-flex items-baseline gap-2 font-display text-base text-ink md:text-lg">
        <span className="transition-transform duration-500 group-hover:-translate-x-1">
          {value}
        </span>
        <span
          aria-hidden
          className="text-ink/40 transition-all duration-500 group-hover:translate-x-1 group-hover:text-ink"
        >
          ↗
        </span>
      </span>
    </a>
  );
}
