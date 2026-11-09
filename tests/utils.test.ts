import { test } from "node:test";
import assert from "node:assert/strict";
import { ageFromDob } from "@/lib/age";
import { cn } from "@/lib/cn";

test("age changes on the birthday, including across a year boundary", () => {
  assert.equal(ageFromDob("2000-01-01", new Date("2025-12-31T23:59:59Z")), 25);
  assert.equal(ageFromDob("2000-01-01", new Date("2026-01-01T00:00:00Z")), 26);
  assert.equal(ageFromDob("2000-01-01", new Date("2026-01-02T00:00:00Z")), 26);
});

test("age uses the UTC date even when the local date differs", () => {
  assert.equal(ageFromDob("2000-03-15", new Date("2026-03-15T00:30:00+02:00")), 25);
  assert.equal(ageFromDob("2000-03-15", new Date("2026-03-14T23:30:00-02:00")), 26);
});

test("cn preserves conditional classes and ignores absent inputs", () => {
  assert.equal(cn("base", false, null, undefined, ["nested"], { active: true, hidden: false }), "base nested active");
  assert.equal(cn(), "");
});

test("cn lets later utilities override conflicts without losing responsive classes", () => {
  assert.equal(cn("px-2 text-sm md:px-4", "px-6 text-lg"), "md:px-4 px-6 text-lg");
});
