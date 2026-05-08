"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/content/site";
import { trackEvent } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("_gotcha")) {
      setStatus("success");
      return;
    }
    try {
      const res = await fetch(`https://formspree.io/f/${site.services.formspreeId}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`);
      setStatus("success");
      trackEvent("contact_form_submit_success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      trackEvent("contact_form_submit_error");
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-line bg-canvas-raised/60 p-6 transition-all duration-700 hover:border-ink/20 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(80% 60% at 0% 0%, rgb(var(--accent-glow) / 0.10), transparent 60%)",
        }}
      />

      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col items-start gap-3 py-8"
          >
            <span aria-hidden className="text-3xl">
              ✦
            </span>
            <h3 className="font-display text-2xl font-medium">Message sent.</h3>
            <p className="text-ink/70">
              Thanks for reaching out, I&apos;ll get back to you as soon as I
              can. In a hurry?{" "}
              <a
                href={site.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-ink"
              >
                Ping me on WhatsApp
              </a>
              .
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-2 text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
            >
              Send another →
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={onSubmit}
            className="relative flex flex-col gap-4"
            noValidate
          >
            <Field label="Name" htmlFor="name">
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                className="input"
                placeholder="Your name"
              />
            </Field>
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="_replyto"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Message" htmlFor="message">
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="input resize-y"
                placeholder="Tell me what you're working on…"
              />
            </Field>

            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />

            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="text-xs text-ink/50">
                Powered by Formspree. No spam, ever.
              </p>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-20px_rgb(var(--ink)_/_0.55)] disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full"
                />
                <span className="relative">
                  {status === "submitting" ? "Sending…" : "Send message"}
                </span>
                <span aria-hidden className="relative transition-transform duration-300 group-hover/btn:translate-x-1">
                  →
                </span>
              </button>
            </div>

            {status === "error" && (
              <p role="alert" className="mt-1 text-sm text-red-500">
                {error ?? "Couldn’t send. Try again, or email me directly."}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgb(var(--canvas));
          border: 1px solid rgb(var(--line));
          border-radius: 14px;
          padding: 0.85rem 1.05rem;
          color: rgb(var(--ink));
          font: inherit;
          transition: border-color 250ms ease, box-shadow 300ms ease,
            transform 250ms ease, background-color 250ms ease;
        }
        :global(.input:hover) {
          border-color: rgb(var(--ink) / 0.35);
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(var(--ink) / 0.7);
          background-color: rgb(var(--canvas-raised));
          box-shadow: 0 0 0 4px rgb(var(--ink) / 0.07),
            0 12px 30px -20px rgb(var(--ink) / 0.5);
        }
        :global(.input::placeholder) {
          color: rgb(var(--ink) / 0.3);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="group/field flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60 transition-colors duration-300 group-focus-within/field:text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}
