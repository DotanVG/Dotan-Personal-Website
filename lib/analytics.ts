import { site } from "@/content/site";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function initAnalytics(): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // Preserve the existing gtag arguments-object queue format.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", site.services.gaId);
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  initAnalytics();
  window.gtag?.("event", name, params);
}
