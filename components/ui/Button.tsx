import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline";

const styles: Record<Variant, string> = {
  primary:
    "bg-ink text-canvas hover:bg-ink/90 hover:-translate-y-0.5 active:translate-y-0",
  ghost:
    "bg-transparent text-ink hover:bg-canvas-raised hover:-translate-y-0.5 active:translate-y-0",
  outline:
    "border border-line text-ink hover:bg-canvas-raised hover:-translate-y-0.5 active:translate-y-0",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

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
        {children}
      </Link>
    );
  }
  return (
    <button className={cn(base, styles[variant], className)} {...rest}>
      {children}
    </button>
  );
}
