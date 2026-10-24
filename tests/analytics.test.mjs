import { test } from "node:test";
import assert from "node:assert/strict";
import { initAnalytics, trackEvent } from "../lib/analytics.ts";
import { site } from "../content/site.ts";

test("analytics is safe during server rendering", () => {
  assert.equal(typeof window, "undefined");
  assert.doesNotThrow(() => { initAnalytics(); trackEvent("server"); });
});

test("an early event queues config first, preserves the dataLayer and initializes once", () => {
  const existing = { existing: true };
  const queue = [existing];
  globalThis.window = { dataLayer: queue };
  try {
    trackEvent("mode_toggle", { to: "explore" });
    const gtag = window.gtag;
    initAnalytics();
    trackEvent("contact_form_submit_success");
    assert.equal(window.gtag, gtag);
    assert.equal(window.dataLayer, queue);
    assert.equal(queue[0], existing);
    assert.deepEqual(Array.from(queue[1]).slice(0, 1), ["js"]);
    assert.ok(Array.from(queue[1])[1] instanceof Date);
    assert.deepEqual(Array.from(queue[2]), ["config", site.services.gaId]);
    assert.deepEqual(Array.from(queue[3]), ["event", "mode_toggle", { to: "explore" }]);
    assert.deepEqual(Array.from(queue[4]), ["event", "contact_form_submit_success", {}]);
    assert.equal(queue.length, 5, "one config/pageview, both events kept");
    assert.equal(Object.prototype.toString.call(queue[3]), "[object Arguments]");
  } finally {
    delete globalThis.window;
  }
});

test("events still use an existing gtag function after the loader takes over", () => {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  globalThis.window = { gtag };
  try {
    initAnalytics();
    trackEvent("marker_open", { slug: "zota" });
    assert.equal(window.gtag, gtag);
    assert.deepEqual(calls, [["event", "marker_open", { slug: "zota" }]]);
  } finally {
    delete globalThis.window;
  }
});
