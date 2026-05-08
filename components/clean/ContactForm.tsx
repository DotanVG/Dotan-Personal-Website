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
      trackEvent("contact_form_submit", { ok: true });
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      trackEvent("contact_form_submit", { ok: false });
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-canvas-raised/60 p-6 md:p-8">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-start gap-3 py-8"
          >
            <span aria-hidden className="text-3xl">
              ✦
            </span>
            <h3 className="font-display text-2xl font-medium">Message sent.</h3>
            <p className="text-ink/70">
              Thanks for reaching out — I&apos;ll get back to you as soon as I
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
            className="flex flex-col gap-4"
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
              />
            </Field>
            <Field label="Message" htmlFor="message">
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="input resize-y"
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
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-all hover:-translate-y-0.5 disabled:opacity-50"
              >
                {status === "submitting" ? "Sending…" : "Send message"}
                <span aria-hidden>→</span>
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
          border-radius: 12px;
          padding: 0.75rem 1rem;
          color: rgb(var(--ink));
          font: inherit;
          transition: border-color 200ms ease, box-shadow 200ms ease;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(var(--ink) / 0.6);
          box-shadow: 0 0 0 4px rgb(var(--ink) / 0.06);
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
    <label htmlFor={htmlFor} className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
        {label}
      </span>
      {children}
    </label>
  );
}
