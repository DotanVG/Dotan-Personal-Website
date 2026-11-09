import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("e2e ignores only the known Bluetooth warning and preserves other policy/runtime failures", () => {
  const source = readFileSync("e2e/lib.mjs", "utf8");
  const expression = source.match(/export const realErrors = ([\s\S]*?);\r?\n/)?.[1];
  assert.ok(expression, "use the actual e2e log filter without loading the browser library");
  const realErrors = vm.runInNewContext(expression);
  const warning = "warning: Error with Permissions-Policy header: Unrecognized feature: 'bluetooth'.";
  const failures = [
    warning.replace("warning:", "error:"),
    warning.replace("bluetooth", "camera"),
    "pageerror: Uncaught TypeError",
    "error: Refused to load a script because it violates Content-Security-Policy",
  ];
  assert.deepEqual(realErrors([warning, ...failures]), failures);
});
