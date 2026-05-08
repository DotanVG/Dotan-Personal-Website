# Deployment

The site is set up to deploy on Vercel as project **`dotanv`**, mirroring the
existing Netlify URL (`dotanv.netlify.app` → `dotanv.vercel.app`).

## One-time setup (Dotan, in the browser)

1. Go to <https://vercel.com/new>.
2. **Import** the `DotanVG/Dotan-Personal-Website` GitHub repo.
3. Set the **Project Name** to exactly `dotanv` so the preview URL becomes
   `https://dotanv.vercel.app`.
4. Vercel will auto-detect Next.js. Leave the framework preset, root directory
   (`./`), and build command (`next build`) as defaults.
5. Set the **Production Branch** to `main`.
6. Hit **Deploy**.

That's it — every push to `main` will trigger a production build, and every
push to `claude/redesign-personal-website-6RHw2` will get its own preview URL.

## Environment variables

None are required for the current build. The Formspree, GA, and ProveSource
IDs live in `content/site.ts`. If we want to move them to env vars later:

```
NEXT_PUBLIC_GA_ID=G-EFHW18YHGH
NEXT_PUBLIC_FORMSPREE_ID=xqknykyd
NEXT_PUBLIC_SITE_URL=https://dotanv.vercel.app
```

## Custom domain

The current public domain is served by Netlify. We will only swap DNS to
Vercel after Round 2 (the perf/best-practices pass) and after Dotan gives the
green light. To swap:

1. In Vercel → `dotanv` project → **Settings → Domains**, add
   `dotanvg.com` (or whichever apex domain you use).
2. Update the DNS records on the registrar to the values Vercel shows.
3. Decommission the Netlify deploy.

Until cutover, the Netlify site stays the canonical public URL.
