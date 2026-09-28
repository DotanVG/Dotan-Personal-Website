// Production build with the read-only test hook compiled in (never deploy this build).
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, EXPLORE_TEST_HOOK: "1" },
});
process.exit(r.status ?? 1);
