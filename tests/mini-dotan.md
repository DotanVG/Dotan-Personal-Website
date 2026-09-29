# Mini Dotan verification

Run the logic checks and production build:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run start -- --port 3011
```

Against that server, run the real Chromium touch/keyboard checks (installed Chrome):

```powershell
$env:E2E_BASE_URL='http://localhost:3011'
node --test --test-concurrency=1 e2e/mini-dotan.spec.mjs e2e/mini-dotan-assets.spec.mjs
```

The original selected Codex atlas is unchanged:1536×2288,1,677,838bytes,
SHA-256 `D241653858BE209CEB776BB8E4BE5FB41A5DE97FA0949A8015D4ED2494DC2A7D`.
Its documented six-frame idle loop remains intact. No installed Codex files are modified.

Three supplemental lossless WebP strips use six192×208cells each (1152×208):

- `perching.webp`: original outfit, seated on a small ledge at the top dock.
- `flying.webp`: original outfit and a small jetpack, downward exhaust during vertical dragging.
- `typing.webp`: frame0 opens a laptop; frames1–5 type, then settle after1.2seconds without activity.

All sprites use exact scaled pixel crops, preserve alpha and smooth scaling, and are local website assets. Additional strips preload; the original sprite remains visible until decoding succeeds. No animation dependency was added.

Touch, mouse and pen dragging starts after12px. The pet chooses the nearest top/bottom and left/right dock, respecting the header and safe areas. Touch lifts it above the finger; horizontal travel still uses the original walking rows. Arrow keys and settings provide non-drag placement. Open forms and pending submissions cannot be dragged.

Quiet mode suppresses unsolicited movement/messages and typing reactions, while direct dragging still responds. System reduced motion holds the laptop/jetpack pose and avoids large motion; combining quiet and reduced motion keeps the pet still. Hide leaves the small face button for restoring him. Side, top, quiet and hidden preferences tolerate unavailable storage.

Typing observes activity only, not entered content. Password fields and shortcuts are ignored. Pending submission and result feedback take priority over typing. Top bubbles open downward; compressed keyboard layouts let the heading scroll and keep form controls reachable. The companion unmounts in Explore and restores preferences on return.

Browser checks cover contact access, top docking/persistence, touch gestures, keyboard placement, typing timeout, password exclusion, quiet/reduced motion, mocked submission results, Explore lifecycle, and decoding all six nonempty transparent cells of each strip. Test submissions are mocked; no messages are sent to Formspree.

Visual evidence is saved locally under `e2e/artifacts/mini-dotan/`. These checks use Chromium touch and viewport emulation; physical iOS/Android keyboards were not available. The build retains the existing unrelated Open Graph image lint warning.
