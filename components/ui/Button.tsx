import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline";

const styles: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas hover:bg-ink hover:-translate-y-0.5 active:translate-y-0 hover:shadow-[0_18px_45px_-20px_rgb(var(--ink)_/_0.55)]",
  ghost:
    "bg-transparent text-ink hover:bg-canvas-raised hover:-translate-y-0.5 active:translate-y-0",
  outline:
    "border border-line text-ink hover:bg-canvas-raised hover:-translate-y-0.5 hover:border-ink/40 active:translate-y-0",
};

const base =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function Inner({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </>
  );
}

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href?: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">) {
  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    return (
      <Link
        href={href}
        className={cn(base, styles[variant], className)}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        <Inner>{children}</Inner>
      </Link>
    );
  }
  return (
    <button className={cn(base, styles[variant], className)} {...rest}>
      <Inner>{children}</Inner>
    </button>
  );
}
