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
  reconcile,
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

test("Coast Run still needs the lighthouse when it has not been read", () => {
  const state: MissionState = { ...DEFAULT_MISSIONS, visited: ["ness", "kanomi", "electra"], done: ["read-city"] };
  const arrived = applyEvent(state, { type: "arrive", slug: "naval" });
  assert.equal(arrived.completed, undefined);
  assert.equal(arrived.state.drove, true);
  const done = read(arrived.state, "naval");
  assert.deepEqual(done.completedAll, ["coast-run"]);
  const early = applyEvent(DEFAULT_MISSIONS, { type: "arrive", slug: "naval" });
  assert.equal(read(early.state, "naval").completed, undefined);
  const guide = currentTarget(state, city, { ...at("ness"), driving: false }, [{ x: 2, z: 3 }]);
  assert.equal(guide?.slug, "car");
  const pier = currentTarget({ ...state, drove: true }, city, { ...at("ness"), driving: true }, []);
  assert.equal(pier?.slug, "naval");
});

test("a landmark read before its mission starts finishes that mission, and the guide never repeats it", () => {
  const ahead = reconcile({ ...DEFAULT_MISSIONS, visited: ["ness", "kanomi", "naval"] }, 0);
  assert.deepEqual(ahead.completed, ["read-city", "coast-run"]);
  assert.equal(currentTarget(ahead.state, city, at("naval"), [{ x: 1, z: 1 }], 0), null);

  let state = DEFAULT_MISSIONS;
  state = read(state, "ness").state;
  state = read(state, "naval").state;
  const both = read(state, "kanomi");
  assert.deepEqual(both.completedAll, ["read-city", "coast-run"]);
  assert.equal(currentTarget(both.state, city, at("zota"), [], 0), null);

  const partial = { ...DEFAULT_MISSIONS, visited: ["ness", "naval"] };
  const next = currentTarget(partial, city, at("naval"), [{ x: 8, z: 8 }], 0);
  assert.ok(next);
  assert.equal(partial.visited.includes(next.slug), false);

  const loaded = reconcile(loadMissions(JSON.stringify({ v: 1, visited: ["ness", "kanomi", "naval"], drove: false, done: ["read-city"], hidden: false })), 0);
  assert.deepEqual(loaded.completed, ["coast-run"]);
  assert.equal(currentTarget(loaded.state, city, at("ness"), [], 0)?.slug, undefined);
});

test("later missions also accept work done early, and point at somewhere still unread", () => {
  const previsited = {
    v: 1 as const,
    visited: [...slugs, "arcade"],
    drove: true,
    done: ["read-city", "coast-run"],
    hidden: false,
  };
  const finished = reconcile(previsited, 1);
  assert.deepEqual(finished.completed, ["arcade", "key"]);
  assert.equal(currentMissionId(finished.state, 1), null);
  assert.equal(reconcile(finished.state, 1).completed.length, 0);

  const almost = {
    ...previsited,
    visited: slugs.filter((s) => s !== "ort"),
    done: ["read-city", "coast-run", "arcade"],
  };
  const aim = currentTarget(almost, city, at("ness"), [], 1);
  assert.ok(aim);
  assert.equal(almost.visited.includes(aim.slug), false);
  assert.equal(aim.slug, "ort");
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
  assert.deepEqual(opened.completedAll, ["arcade", "key"]);
  const notYet = { ...finished, visited: slugs.filter((s) => s !== "ort") };
  const onlyArcade = applyEvent(notYet, { type: "inspect", slug: "arcade" }, 1);
  assert.deepEqual(onlyArcade.completedAll, ["arcade"]);
  assert.equal(currentMissionId(onlyArcade.state, 1), "key");
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
