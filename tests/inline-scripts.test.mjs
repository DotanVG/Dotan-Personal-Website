import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const payloads = [
  '</script><script>globalThis.injected = true</script>',
  '\"});globalThis.injected = true;//',
  'quotes " \' backslash \\ newline\n<>&\u2028\u2029',
];

test("JSON-LD cannot close its script element and round-trips content", () => {
  const source = readFileSync("app/layout.tsx", "utf8");
  const expression = source.match(/__html: (.*?) \}\}/)?.[1];
  assert.ok(expression, "use the actual layout serialization expression");
  for (const name of payloads) {
    const profileJsonLd = { "@type": "Person", name };
    const serialized = vm.runInNewContext(expression, { profileJsonLd });
    assert.doesNotMatch(serialized, /</);
    assert.deepEqual(JSON.parse(serialized), profileJsonLd);
  }
});

test("ProveSource inline values stay data, including quotes and script end tags", () => {
  const source = readFileSync("components/providers/AnalyticsProvider.tsx", "utf8");
  const template = source.match(/<Script id="provesrc"[^>]*>\s*\{(`[^]*?`)\}/)?.[1];
  assert.ok(template, "use the actual Script child template");
  for (const value of payloads) {
    const script = vm.runInNewContext(template, {
      site: { services: { proveSourceApiKey: value, proveSourceVersion: value } },
    });
    assert.doesNotMatch(script, /</);
    let received;
    const context = vm.createContext({
      window: {},
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
      },
    });
    vm.runInContext(script, context);
    context.provesrc.init = (config) => { received = config; };
    context.window._provesrcAsyncInit();
    assert.equal(received.apiKey, value);
    assert.equal(received.v, value);
    assert.equal(context.injected, undefined);
  }
});
