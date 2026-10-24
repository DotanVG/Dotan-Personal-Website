import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdn.provesrc.com",
  "connect-src 'self' https://formspree.io https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.provesrc.com",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self' https://formspree.io",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

// Only features nothing on the site (or GTM / ProveSource) uses. Fullscreen,
// gamepad, XR and autoplay are deliberately left at browser defaults.
const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "hid=()",
  "bluetooth=()",
  "midi=()",
  "display-capture=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
].join(", ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Always inlined, so the Explore test hook compiles out of normal builds
  // (only `npm run build:e2e` sets it).
  env: {
    EXPLORE_TEST_HOOK: process.env.EXPLORE_TEST_HOOK === "1" ? "1" : "0",
    // Mini Dotan's ?mini-debug panel: local, staging and previews only.
    MINI_DEBUG: process.env.VERCEL_ENV === "production" ? "0" : "1",
  },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["three"],
  experimental: {
    optimizePackageImports: ["framer-motion", "@react-three/drei", "@react-three/fiber"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          // Not "same-origin": keeps opener links / OAuth-style popups working.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
