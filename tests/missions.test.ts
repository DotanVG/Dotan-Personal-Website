import { test } from "node:test";
import assert from "node:assert/strict";
import { projects } from "@/content/projects";
import { createCity } from "@/lib/game/city";
import {
  DEFAULT_MISSIONS,
  READ_GOAL,
  activeMissionIds,
  applyEvent,
  chipModel,
  currentMissionId,
  currentTarget,
  loadMissions,
  missionGoal,
  rewardCopy,
  type MissionState,
} from "@/lib/game/missions";

const city = createCity(7);
const slugs = city.landmarks.map((l) => l.slug);

function at(slug: string) {
  const l = city.landmarks.find((x) => x.slug === slug)!;
  return { x: l.pad.x, z: l.pad.z, driving: false };
}

function read(state: MissionState, slug: string, projects = 0) {
  return applyEvent(state, { type: "inspect", slug }, projects);
}

test("the games list is empty, so only the first two missions are live", () => {
  assert.equal(projects.length, 0);
  assert.deepEqual(activeMissionIds(0), ["read-city", "coast-run"]);
  assert.deepEqual(activeMissionIds(2), ["read-city", "coast-run", "arcade", "key"]);
  assert.equal(missionGoal("key", 0), slugs.length);
  assert.equal(missionGoal("key", 3), slugs.length + 1);
  assert.equal(missionGoal("read-city", 0), READ_GOAL);
});

test("a missing, corrupt or old save falls back to a fresh chain", () => {
  assert.deepEqual(loadMissions(null), DEFAULT_MISSIONS);
  assert.deepEqual(loadMissions("not-json"), DEFAULT_MISSIONS);
  assert.deepEqual(loadMissions("[]"), DEFAULT_MISSIONS);
  assert.deepEqual(loadMissions(JSON.stringify({ v: 2, visited: ["ness"] })), DEFAULT_MISSIONS);
  const loaded = loadMissions(
    JSON.stringify({ v: 1, visited: ["ness", "nope", "ness", "arcade"], drove: "yes", done: ["bogus", "read-city"], hidden: 1 }),
  );
  assert.deepEqual(loaded.visited, ["ness"]);
  assert.equal(loaded.drove, false);
  assert.deepEqual(loaded.done, ["read-city"]);
  assert.equal(loaded.hidden, false);
});

test("Read the City completes on the third distinct landmark, in any order", () => {
  let state = DEFAULT_MISSIONS;
  const order = ["hackeru", "ort", "zota"];
  for (let i = 0; i < order.length; i++) {
    const res = read(state, order[i]);
    state = res.state;
    if (i < 2) assert.equal(res.completed, undefined);
    else assert.equal(res.completed, "read-city");
  }
  assert.deepEqual(state.done, ["read-city"]);
  assert.equal(read(state, "zota").state, state);
  const chip = chipModel({ ...DEFAULT_MISSIONS, visited: ["ness"] }, { projectCount: 0, driving: false, targetName: "Kanomi" });
  assert.match(chip!.long, /Read the City · 1\/3 · Kanomi/);
  assert.equal(chip!.compact, "M1 · 1/3");
});

test("the hint points at the nearest unread landmark, and never leads with Zota", () => {
  const zota = city.landmarks.find((l) => l.slug === "zota")!;
  const target = currentTarget(DEFAULT_MISSIONS, city, { x: zota.pad.x, z: zota.pad.z, driving: false }, []);
  assert.ok(target);
  assert.notEqual(target.slug, "zota");
  const onlyZota = currentTarget(
    { ...DEFAULT_MISSIONS, visited: slugs.filter((s) => s !== "zota") },
    city,
    at("ness"),
    [],
  );
  assert.equal(onlyZota?.slug, "zota");
});

test("Coast Run needs a driven arrival and then the lighthouse, in that order", () => {
  let state: MissionState = { ...DEFAULT_MISSIONS, visited: ["ness", "kanomi", "electra"], done: ["read-city"] };
  let res = read(state, "naval");
  state = res.state;
  assert.equal(res.completed, undefined);
  assert.equal(state.drove, false);
  res = applyEvent(state, { type: "arrive", slug: "naval" });
  state = res.state;
  assert.equal(state.drove, true);
  assert.equal(res.completed, undefined);
  res = read(state, "naval");
  assert.equal(res.completed, "coast-run");
  const early = applyEvent(DEFAULT_MISSIONS, { type: "arrive", slug: "naval" });
  assert.equal(read(early.state, "naval").completed, undefined);
});

test("missions 3 and 4 stay gated while the games list is empty", () => {
  const finished: MissionState = {
    v: 1,
    visited: [...slugs],
    drove: true,
    done: ["read-city", "coast-run"],
    hidden: false,
  };
  assert.equal(currentMissionId(finished, 0), null);
  assert.equal(applyEvent(finished, { type: "inspect", slug: "arcade" }, 0).completed, undefined);
  assert.equal(currentMissionId(finished, 1), "arcade");
  const opened = applyEvent(finished, { type: "inspect", slug: "arcade" }, 1);
  assert.equal(opened.completed, "arcade");
  assert.equal(currentMissionId(opened.state, 1), "key");
});

test("hiding a mission does not stop it counting, and replay clears the chain", () => {
  const hidden = applyEvent(DEFAULT_MISSIONS, { type: "skip" }).state;
  assert.equal(hidden.hidden, true);
  const readHidden = read(hidden, "ness").state;
  assert.deepEqual(readHidden.visited, ["ness"]);
  assert.equal(readHidden.hidden, true);
  assert.equal(chipModel(readHidden, { projectCount: 0, driving: false, targetName: "Ness" }), null);
  const wiped = applyEvent(
    { v: 1, visited: ["ness"], drove: true, done: ["read-city"], hidden: true },
    { type: "replay" },
  );
  assert.deepEqual(wiped.state, DEFAULT_MISSIONS);
  assert.equal(applyEvent(DEFAULT_MISSIONS, { type: "replay" }).state, DEFAULT_MISSIONS);
});

test("the Coast Run card does not mention the arcade while there are no games", () => {
  const quiet = rewardCopy("coast-run", 0);
  assert.equal(quiet.toast, "The lighthouse is lit");
  assert.doesNotMatch(`${quiet.title} ${quiet.body} ${quiet.toast}`, /arcade|stunt/i);
  assert.match(rewardCopy("coast-run", 1).body, /stunt yard/);
  assert.equal(rewardCopy("read-city", 0).toast, "First Charter raised in the plaza");
  assert.match(rewardCopy("read-city", 0).body, /take a car down to the pier/);
});
