# Dotan Veretzky — Personal Website

A dual-mode personal site for Dotan Veretzky.

- **Clean mode** — an Apple-style minimal cinematic portfolio. Default.
- **Explore mode** — a Bruno Simon-style walkable 3D world of every chapter of Dotan's career. _(In progress.)_

A single mode toggle in the top-right switches between the two and shareable URLs encode the mode (`?mode=explore`).

## Tech

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS, `next-themes` (light/dark)
- `framer-motion` for transitions
- `zustand` for mode/UI state
- `three` + `@react-three/fiber` + `@react-three/drei` for the 3D scene (Explore mode)
- Formspree (contact form), GA4 + ProveSource (preserved from the previous site)

## Local development

```bash
nvm use            # Node 20+
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Deploy

Deployed on Vercel as project **`dotanv`** → <https://dotanv.vercel.app>.
Every push to `claude/redesign-personal-website-6RHw2` triggers a preview build.
The current Netlify site (`dotanv.netlify.app`) stays live until DNS is swapped.

## Branch

All redesign work lives on `claude/redesign-personal-website-6RHw2`. The legacy
HTML/Bootstrap site is preserved at the repo root until the final cutover commit
deletes it.

## Content

All copy and links live in `content/`:

- `site.ts` — name, contacts, social, GA/ProveSource/Formspree IDs
- `experience.ts` — the four roles
- `education.ts` — the four programs
- `projects.ts` — placeholders for the indie-game studio

Both Clean and Explore mode read from these same files.
