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
          Let&apos;s build something.
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
          <div className="flex flex-col gap-6">
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

            <div className="mt-2 flex items-center gap-5 rounded-2xl border border-line bg-canvas-raised/60 p-4">
              <div className="relative size-[120px] shrink-0 overflow-hidden rounded-xl bg-canvas">
                <Image
                  src="/images/WhatsApp-QR-CODE.jpeg"
                  alt="WhatsApp QR code for Dotan Veretzky"
                  fill
                  sizes="120px"
                  className="object-contain"
                />
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
                  WhatsApp
                </div>
                <div className="mt-1 text-sm text-ink/80">
                  Scan the code, or{" "}
                  <Link
                    href={site.social.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-4 hover:text-ink"
                  >
                    open a chat ↗
                  </Link>
                </div>
              </div>
            </div>
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
      className="group flex items-baseline justify-between gap-4 border-b border-line pb-4 transition-colors hover:border-ink/40"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
        {label}
      </span>
      <span className="font-display text-base text-ink transition-transform group-hover:-translate-x-0.5 md:text-lg">
        {value} <span aria-hidden className="text-ink/40">↗</span>
      </span>
    </a>
  );
}
