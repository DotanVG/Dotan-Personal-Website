import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectedProjects } from "@/content/selected-projects";

test("selected projects use only the approved public sources and HTTPS links", () => {
  assert.deepEqual(
    selectedProjects.map((project) => project.sourceUrl),
    [
      "https://github.com/DotanVG/BeatEmPie-Phaser",
      "https://github.com/DotanVG/Orbital-Breach",
      "https://github.com/DotanVG/Count-Dawn",
      "https://github.com/DotanVG/react-node-url-metadata-fetcher",
    ],
  );
  for (const project of selectedProjects) {
    for (const url of [project.url, project.sourceUrl]) {
      assert.equal(new URL(url).protocol, "https:");
    }
    assert.ok(project.title && project.description && project.role && project.tags.length);
  }
});

test("the clean page mounts projects and its Hero CTA and navigation reach them", () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(source("../components/clean/Hero.tsx"), /<Button href="#projects"[^>]*>\s*See my work/);
  assert.match(source("../components/clean/Nav.tsx"), /href: "#projects", label: "Projects"/);
  assert.match(source("../app/page.tsx"), /<About\s*\/>\s*<Projects\s*\/>\s*<ExperienceTimeline\s*\/>/);
  const section = source("../components/clean/Projects.tsx");
  assert.doesNotMatch(section, /["']use client["']/);
  assert.match(section, /<section\s+id="projects"/);
  assert.match(section, /<h2[\s\S]*?>\s*Selected projects/);
  assert.match(section, /<article[\s\S]*?<h3/);
});
