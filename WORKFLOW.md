---
tracker:
  kind: github
  repo: DotanVG/Dotan-Personal-Website
polling:
  interval_ms: 30000
workspace:
  root: ~/code/dotan-personal-website-workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch staging https://github.com/DotanVG/Dotan-Personal-Website.git .
    npm install
  before_run: |
    git fetch origin
    git merge --ff-only origin/staging
agent:
  max_concurrent_agents: 2
  max_turns: 20
codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  stall_timeout_ms: 1800000
---

You are working on GitHub issue `{{ issue.identifier }}` for the **Dotan Personal Website** project.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} — issue is still open.
- Resume from current workspace state; do not restart from scratch.
- Do not repeat already-completed investigation unless needed for new changes.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Project context

**Dotan Personal Website** — portfolio and personal site for Dotan VG.
Stack: Next.js 15, React 19, Three.js via @react-three/fiber + @react-three/drei + @react-three/rapier, Framer Motion, Tailwind CSS, TypeScript.
Deploy: Vercel (production branch = `main`). Every push to `main` triggers a prod build; feature branches get preview URLs.

Repo layout:
- `app/` — Next.js App Router pages and layouts
- `components/` — shared React components (including R3F scenes)
- `content/` — site data, copy, and config (`site.ts`, etc.)
- `lib/` — utility functions and hooks
- `types/` — TypeScript type definitions
- `public/` — static assets

Key commands:
- `npm run dev` — local dev server (port 3000)
- `npm run build` — production build (runs `next build`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Instructions

1. Unattended orchestration session — never ask a human to perform follow-up actions.
2. Stop early only for true blockers (missing required auth/permissions/secrets). Record blocker in workpad and move issue to appropriate state.
3. Final message: completed actions and blockers only. No "next steps for user".
4. Work only inside the provided repository copy.

## Branching strategy

Feature → staging → main. Never push features directly to main.

```
feature/<name>  →  staging    via GitHub PR (squash merge)
staging         →  main       NEVER via GitHub PR — CLI only:
```

```bash
git fetch origin
git checkout main && git merge --ff-only origin/staging && git push origin main
```

Hotfix escape hatch: push hotfix directly to main, then sync staging:

```bash
git checkout staging && git merge origin/main && git push origin staging
```

After any sync: `origin/main` and `origin/staging` must point to the same SHA.

Branch naming: `feature/<kebab-name>` matching the issue title.
`main` must always build clean and be deployable to Vercel.

## Step 0: Determine current issue state and route

1. Fetch the issue by number.
2. Read current state.
3. Route: `open` → start work. `closed` → shut down.

## Step 1: Kickoff

1. Run `before_run` hook to sync with `origin/staging`.
2. Reproduce the bug or verify current behavior before changing code.
3. Create a feature branch from `staging`: `git checkout -b feature/<name>`.
4. Write a brief plan with acceptance criteria before touching code.

## Step 2: Execution

1. Implement against the plan.
2. After changes: run `npm run typecheck` — zero errors required.
3. After changes: run `npm run build` — must complete without errors.
4. Run `npm run lint` — no new lint errors.
5. Before pushing: confirm all checks pass.
6. Push branch, open PR against `staging`. PR body MUST include `Closes #<N>`.
7. Merge PR (squash) into `staging`.

## Step 3: Rework

1. Re-read full issue + all PR comments.
2. Close existing PR, create fresh branch from `origin/staging`.
3. Start fresh, execute end-to-end.

## Workpad template

```md
## Workpad

<hostname>:<abs-path>@<short-sha>

### Plan

- [ ] 1. Parent task
  - [ ] 1.1 Child task

### Acceptance Criteria

- [ ] Criterion 1

### Validation

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean build
- [ ] `npm run lint` — no new errors

### Notes

- <short progress note with timestamp>
```

## Knowledge graph (graphify)

`graphify-out/` — local-only, gitignored. Contains a clustered knowledge graph of the codebase.

**Claude/Codex uses it automatically** via `.claude/skills/graphify/SKILL.md` — no manual steps needed for AI-assisted work.

**Regenerate after major refactors:**
```bash
graphify extract . --backend ollama --model llama3
graphify cluster-only .
```
