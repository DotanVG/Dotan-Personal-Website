import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "../app/sitemap";
import { lastContentChange, profileJsonLd, site } from "../content/site";

test("sitemap contains only the canonical root with a stable content date", () => {
  assert.equal(lastContentChange, "2026-10-27");
  assert.deepEqual(sitemap(), [{ url: site.url, lastModified: lastContentChange }]);
});

test("profile graph links the page to a stable person ID and absolute portrait", () => {
  const graph = JSON.parse(JSON.stringify(profileJsonLd));
  assert.equal(graph["@context"], "https://schema.org");
  assert.equal(graph["@graph"].length, 2);
  const person = graph["@graph"].find((node: Record<string, unknown>) => node["@type"] === "Person");
  const page = graph["@graph"].find((node: Record<string, unknown>) => node["@type"] === "ProfilePage");
  assert.equal(person["@id"], `${site.url}/#person`);
  assert.equal(person.image, `${site.url}/images/avatar.jpg`);
  assert.equal(page.url, site.url);
  assert.deepEqual(page.mainEntity, { "@id": person["@id"] });
  assert.equal(page.dateModified, lastContentChange);
  assert.match(readFileSync("app/layout.tsx", "utf8"), /JSON\.stringify\(profileJsonLd\)/);
});

test("Netlify preserves verification before the forced permanent catch-all", () => {
  const config = readFileSync("netlify.toml", "utf8");
  const [build, verification, redirect] = config.split("[[redirects]]");
  assert.match(build, /publish\s*=\s*"\."/);
  assert.doesNotMatch(build, /command\s*=/);
  assert.match(verification, /from\s*=\s*"\/googlec37322bd49de680d\.html"/);
  assert.match(verification, /to\s*=\s*"\/googlec37322bd49de680d\.html"/);
  assert.match(verification, /status\s*=\s*200/);
  assert.match(redirect, /from\s*=\s*"\/\*"/);
  assert.match(redirect, /to\s*=\s*"https:\/\/dotanv\.vercel\.app\/:splat"/);
  assert.match(redirect, /status\s*=\s*301/);
  assert.match(redirect, /force\s*=\s*true/);
  assert.ok(readFileSync("googlec37322bd49de680d.html", "utf8").includes("googlec37322bd49de680d.html"));
});
