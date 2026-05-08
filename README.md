# Dotan Veretzky — Personal Website

A dual-mode personal site for Dotan Veretzky.

- **Clean mode** (default) — an Apple-style cinematic portfolio with a
  refractive 3D hero, scroll-driven reveals, and an expandable bio,
  experience and education timeline.
- **Explore mode** — a walkable 3D world built on `react-three-fiber`.
  Every chapter of Dotan's career stands on a small island as a low-poly
  building marked with the company / school logo. WASD on desktop,
  virtual joystick on touch.

The mode toggle lives in the top-right of the nav and the choice is
encoded in the URL (`?mode=explore`) so links are shareable.

## Tech

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind 3 + `next-themes` (dark by default)
- **Motion**: `framer-motion`
- **State**: `zustand` for mode and the active marker
- **3D**: `three` + `@react-three/fiber` + `@react-three/drei`,
  with `simplex-noise` for the hero displacement and `maath` for the
  camera damping
- **Services preserved**: Formspree (contact form), GA4 (`G-EFHW18YHGH`),
  ProveSource widget, Google site-verification file

## Repository map

```
app/
  layout.tsx              # fonts, metadata, GA + ProveSource, JSON-LD
  page.tsx                # mounts <ScrollProgress>, <Cursor>, <ModeRouter>
  globals.css             # Tailwind layers + light/dark CSS-var palette
  opengraph-image.tsx     # dynamic /opengraph-image
  sitemap.ts, robots.ts, not-found.tsx
components/
  mode/                   # ModeRouter (URL ↔ store), ModeToggle
  clean/                  # Nav, Hero, HeroCanvas, About, TimelineItem,
                          # ExperienceTimeline, EducationTimeline,
                          # ProjectsTeaser, Contact, ContactForm, Footer
  explore/                # ExploreScene, World, Player, PlayerControls,
                          # CameraRig, LocationMarker, InfoPanel,
                          # MobileJoystick, Instructions, LoadingScreen
  ui/                     # Button, ThemeToggle, RevealOnScroll,
                          # Magnetic, ScrollProgress, Cursor
  providers/              # Theme + Analytics
content/
  site.ts                 # personal info, social, service IDs
  experience.ts           # 4 roles + Explore building type + position
  education.ts            # 4 programs + Explore building type + position
  projects.ts             # empty until first indie game ships
lib/
  store.ts                # zustand: mode + activeMarker
  explore.ts              # mutable singleton (player position, axes)
  age.ts, cn.ts, analytics.ts, useReducedMotion.ts, useIsMobile.ts
public/
  images/{avatar.jpg, experience/*, education/*, WhatsApp-QR-CODE.jpeg}
  favicon.ico, *.png, site.webmanifest
  googlec37322bd49de680d.html  # Google site-verification (don't edit)
```

The legacy Bootstrap site (`index.html`, `css/`, `js/`, `scripts/`,
`index.php`, `composer.json`) still lives at the repo root and will be
deleted in the final cutover commit, after the new site is approved.

## Local development

```bash
nvm use              # Node 20+ (see .nvmrc)
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # production smoke
npm run typecheck    # tsc --noEmit
npm run lint
```

## Deploy

The new site deploys on Vercel as project **`dotanv`** so the URL mirrors
the existing `dotanv.netlify.app`:

> https://dotanv.vercel.app

One-time setup is in `DEPLOYMENT.md`. After the project is imported,
every push to `claude/redesign-personal-website-6RHw2` gets its own
preview URL automatically.

## Two-round delivery

This site is being delivered in two rounds:

1. **Round 1 — working website** _(current)_. Everything is functional
   and beautiful, ready for review at `dotanv.vercel.app`.
2. **Round 2 — perf & best-practices pass** _(post-approval)_.
   Lighthouse, accessibility audit, bundle analysis, font/image audits,
   cross-browser sweep. Triggered only after Dotan signs off on Round 1.

## Branch

All redesign work lives on `claude/redesign-personal-website-6RHw2`.
Do not push to `main` until the cutover commit is approved.
