# Deployment

## Build and deployment configuration

- The canonical public URL is `https://dotanv.vercel.app`, set in `content/site.ts`.
- `vercel.json` enables Git deployments only for `main` and `staging`; other
  branches, including feature branches, are disabled. The production-branch
  dashboard setting is not specified in that file and is not verified here.
- `.nvmrc` selects Node 22. Use a current Node 22 patch (at least 22.18 for the
  existing test loader). `package.json` defines `npm run build` as `next build`;
  the repository has no custom Vercel build command or output-directory setting.
  Vercel dashboard overrides and its runtime version are not verified here.
- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`/`staging`.
  It installs with `npm ci`, then runs lint, typecheck, unit tests and the production
  build. A separate job builds with the test hook and runs the existing headless
  SEO/analytics browser smoke tests against a local server. CI does not deploy.

## Environment variables

The normal build does not require user-supplied environment variables. Site URL,
Formspree, GA and ProveSource configuration comes from `content/site.ts`.
The `NEXT_PUBLIC_*` entries in `.env.example` are not read by the current source;
setting them alone does not override that configuration.

`next.config.ts` reads `VERCEL_ENV` to disable the Mini Dotan debug panel in
production. `npm run build:e2e` sets `EXPLORE_TEST_HOOK=1` to compile in a test
hook. Do not deploy that test build; run `npm run build` for the normal output.

## Deployed-site HTTP smoke check

No staging URL was documented before this follow-up. The default below is the
Preview URL recorded by GitHub for staging commit
`fbb16f188a0d9803b1cbb0d838959619fdc2a8dd` (merged PR #45), as of 2026-10-29:

`https://dotanv-gl36y6afj-dotanvgs-projects.vercel.app`

Provenance: [GitHub deployment status](https://api.github.com/repos/DotanVG/Dotan-Personal-Website/deployments/7401789761/statuses).
This is a specific deployment URL, not a moving branch alias. Override it when
checking a newer staging deployment. It currently returns a Vercel authentication
redirect to an unauthenticated GET; the smoke check fails on that response.
No credentials or protection bypass are built into the script.

```bash
npm run smoke                    # documented staging preview above
npm run smoke -- https://your-staging-url.example
# Alternatively: set SMOKE_BASE_URL, then run npm run smoke.
```

`scripts/smoke.mjs` needs Node and `curl`, with no new npm dependencies. It uses
plain GETs and requires HTTP 200 for `/` and all first-party script sources,
stylesheets, icons and Open Graph images referenced in the returned HTML.
It requires at least one reference in each category, preserves query strings,
and checks canonical `dotanv.vercel.app` asset paths on the supplied staging
origin. Third-party URLs are skipped. It does not follow redirects, execute JS,
submit forms or call analytics. Failures name the URL (or the missing asset kind).

Each curl call uses `--max-time 15 --connect-timeout 5 --retry 2
--retry-max-time 50`, with a 60-second process timeout. HTML is limited to 10 MiB
and discovery to 128 distinct asset URLs, bounding the complete run as well.
This HTTP check is separate from `npm run test:e2e:smoke` and does not prove
browser behavior. To check local build output, start it with `npm start` and pass
`http://localhost:3000` explicitly.

## Netlify redirects and verification

`netlify.toml` sets `publish = "."` and contains no build command. It keeps
`/googlec37322bd49de680d.html` at status 200 and defines a forced 301 redirect
from all other paths to `https://dotanv.vercel.app/:splat`.
The root verification file remains; the obsolete root HTML/PHP/XML, `css/`,
`js/` and `images/` files were removed in PR #45. Netlify serves as the redirect
and verification endpoint under this configuration, not as the Next.js app.

Netlify's repository/branch connection, dashboard build command and framework
integration overrides are not verified by these files. The config alone does
not prove live redirect or verification behavior.

Next.js serves static assets from `public/` (including the separate verification
file) and routes from `app/`, including `app/sitemap.ts` and
`app/opengraph-image.tsx`. Root verification/configuration files are not Next.js
routes; there is no `.vercelignore` or Next.js configuration copying them into
the public output.
