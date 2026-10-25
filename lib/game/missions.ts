// Explore missions: one pure table and a reducer. No quest framework beyond this.
// Missions 3 and 4 stay in the table but only turn on when the games list is non-empty.

import { projects } from "@/content/projects";
import { LANDMARK_SLUGS, type City } from "./city";

export const MISSIONS_KEY = "dotanv-explore-missions-v1";
/** Driving distance to the naval pad that counts as arriving. Matches the sim's landmark hint. */
export const ARRIVE_M = 14;
export const PILLAR_HIDE_M = 6;
export const READ_GOAL = 3;

const LANDMARK_SET = new Set<string>(LANDMARK_SLUGS);

export type MissionId = "read-city" | "coast-run" | "arcade" | "key";

export type MissionState = {
  v: 1;
  visited: string[];
  drove: boolean;
  done: string[];
  hidden: boolean;
};

export const DEFAULT_MISSIONS: MissionState = {
  v: 1,
  visited: [],
  drove: false,
  done: [],
  hidden: false,
};

export type MissionEvent =
  | { type: "inspect"; slug: string }
  | { type: "enter" }
  | { type: "arrive"; slug: string }
  | { type: "hide"; hidden: boolean }
  | { type: "skip" }
  | { type: "replay" };

export type ApplyResult = { state: MissionState; completed?: MissionId; completedAll: MissionId[] };

export type MissionDef = { id: MissionId; title: string; short: string };

const TABLE: readonly MissionDef[] = [
  { id: "read-city", title: "Read the City", short: "M1" },
  { id: "coast-run", title: "Coast Run", short: "M2" },
  { id: "arcade", title: "The Arcade", short: "M3" },
  { id: "key", title: "Key to the City", short: "M4" },
];

export type MissionTarget = { x: number; z: number; name: string; slug: string };
export type GuidePlayer = { x: number; z: number; driving: boolean };
export type GuideCar = { x: number; z: number };

export type ChipModel = { long: string; compact: string; live: string };
export type RewardCopy = { id: MissionId; title: string; toast: string; body: string; sayHi: boolean };
export type CheckItem = { id: string; label: string; checked: boolean };

export const liveProjectCount = () => projects.length;

export function activeMissionIds(projectCount: number): MissionId[] {
  const ids: MissionId[] = ["read-city", "coast-run"];
  if (projectCount > 0) ids.push("arcade", "key");
  return ids;
}

export function missionTable(projectCount: number): MissionDef[] {
  const ids = new Set(activeMissionIds(projectCount));
  return TABLE.filter((m) => ids.has(m.id));
}

/** Key to the City counts every landmark plus the arcade. The total follows the data, not a fixed 9. */
export function missionGoal(id: MissionId, projectCount: number): number {
  if (id === "read-city") return READ_GOAL;
  if (id === "coast-run") return 3;
  if (id === "arcade") return 1;
  if (id === "key") return LANDMARK_SLUGS.length + (projectCount > 0 ? 1 : 0);
  return 0;
}

export function currentMissionId(state: MissionState, projectCount: number): MissionId | null {
  for (const id of activeMissionIds(projectCount)) {
    if (!state.done.includes(id)) return id;
  }
  return null;
}

function knownSlug(slug: string, projectCount: number): boolean {
  if (LANDMARK_SET.has(slug)) return true;
  return slug === "arcade" && projectCount > 0;
}

function knownDone(id: string, projectCount: number): id is MissionId {
  return (activeMissionIds(projectCount) as string[]).includes(id);
}

function dedupe(list: string[]): string[] {
  const out: string[] = [];
  for (const s of list) if (!out.includes(s)) out.push(s);
  return out;
}

function landmarkCount(visited: readonly string[]): number {
  let n = 0;
  for (const s of visited) if (LANDMARK_SET.has(s)) n++;
  return n;
}

function keyCount(visited: readonly string[], projectCount: number): number {
  return landmarkCount(visited) + (projectCount > 0 && visited.includes("arcade") ? 1 : 0);
}

export function loadMissions(raw: string | null, projectCount = liveProjectCount()): MissionState {
  if (!raw) return DEFAULT_MISSIONS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_MISSIONS;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return DEFAULT_MISSIONS;
  const o = data as Record<string, unknown>;
  if (o.v !== 1) return DEFAULT_MISSIONS;
  const visited = Array.isArray(o.visited)
    ? dedupe(o.visited.filter((s): s is string => typeof s === "string" && knownSlug(s, projectCount)))
    : [];
  const done = Array.isArray(o.done)
    ? dedupe(o.done.filter((s): s is string => typeof s === "string" && knownDone(s, projectCount)))
    : [];
  return {
    v: 1,
    visited,
    drove: o.drove === true,
    done,
    hidden: o.hidden === true,
  };
}

function reduce(state: MissionState, event: MissionEvent, projectCount: number): MissionState {
  switch (event.type) {
    case "hide":
      return event.hidden === state.hidden ? state : { ...state, hidden: event.hidden };
    case "skip":
      return state.hidden ? state : { ...state, hidden: true };
    case "replay":
      if (!state.visited.length && !state.drove && !state.done.length && !state.hidden) return state;
      return { v: 1, visited: [], drove: false, done: [], hidden: false };
    case "enter":
      return state;
    case "arrive":
      if (event.slug !== "naval" || state.drove) return state;
      return { ...state, drove: true };
    case "inspect": {
      if (!knownSlug(event.slug, projectCount)) return state;
      const visited = state.visited.includes(event.slug) ? state.visited : [...state.visited, event.slug];
      const base = visited === state.visited ? state : { ...state, visited };
      const id = currentMissionId(base, projectCount);
      let done = base.done;
      if (id === "read-city" && landmarkCount(visited) >= READ_GOAL) done = [...done, "read-city"];
      else if (id === "coast-run" && event.slug === "naval" && base.drove) done = [...done, "coast-run"];
      else if (id === "arcade" && event.slug === "arcade") done = [...done, "arcade"];
      else if (id === "key" && keyCount(visited, projectCount) >= missionGoal("key", projectCount)) done = [...done, "key"];
      if (done === base.done && visited === state.visited) return state;
      return { ...base, done };
    }
    default:
      return state;
  }
}

function missionMet(state: MissionState, id: MissionId, projectCount: number): boolean {
  if (id === "read-city") return landmarkCount(state.visited) >= READ_GOAL;
  // A lighthouse read from an earlier mission counts. Do not send the player back.
  if (id === "coast-run") return state.visited.includes("naval");
  if (id === "arcade") return state.visited.includes("arcade");
  return keyCount(state.visited, projectCount) >= missionGoal("key", projectCount);
}

/** Mark every mission whose work is already done. Stops at the first one that still needs a new visit. */
export function reconcile(state: MissionState, projectCount = liveProjectCount()): { state: MissionState; completed: MissionId[] } {
  const completed: MissionId[] = [];
  let next = state;
  for (const id of activeMissionIds(projectCount)) {
    if (next.done.includes(id)) continue;
    if (!missionMet(next, id, projectCount)) break;
    completed.push(id);
    next = { ...next, done: [...next.done, id] };
  }
  return { state: completed.length ? next : state, completed };
}

export function applyEvent(state: MissionState, event: MissionEvent, projectCount = liveProjectCount()): ApplyResult {
  const reduced = reduce(state, event, projectCount);
  const settled = reconcile(reduced, projectCount);
  const next = settled.state;
  if (next === state) return { state, completedAll: [] };
  const completedAll: MissionId[] = [];
  for (const id of activeMissionIds(projectCount)) {
    if (next.done.includes(id) && !state.done.includes(id)) completedAll.push(id);
  }
  return { state: next, completed: completedAll[0], completedAll };
}

function padOf(city: City, slug: string, name?: string): MissionTarget | null {
  const l = city.landmarks.find((x) => x.slug === slug);
  if (!l) return null;
  return { x: l.pad.x, z: l.pad.z, name: name ?? l.name, slug: l.slug };
}

/** Nearest unread landmark. Zota counts, but it is never the hint while any other landmark is still unread. */
function nearestUnread(state: MissionState, city: City, player: GuidePlayer, includeArcade: boolean): MissionTarget | null {
  let zota: MissionTarget | null = null;
  let zotaD = Infinity;
  let other: MissionTarget | null = null;
  let otherD = Infinity;
  for (const l of city.landmarks) {
    const counts = LANDMARK_SET.has(l.slug) || (includeArcade && l.slug === "arcade");
    if (!counts || state.visited.includes(l.slug)) continue;
    const d = Math.hypot(l.pad.x - player.x, l.pad.z - player.z);
    const target = { x: l.pad.x, z: l.pad.z, name: l.name, slug: l.slug };
    if (l.slug === "zota") {
      if (d < zotaD) {
        zota = target;
        zotaD = d;
      }
    } else if (d < otherD) {
      other = target;
      otherD = d;
    }
  }
  return other ?? zota;
}

function nearestCar(cars: readonly GuideCar[], player: GuidePlayer): GuideCar | null {
  let best: GuideCar | null = null;
  let bestD = Infinity;
  for (const c of cars) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** Arrow target. Null when missions are hidden or the chain is finished. */
export function currentTarget(
  state: MissionState,
  city: City,
  player: GuidePlayer,
  cars: readonly GuideCar[],
  projectCount = liveProjectCount(),
): MissionTarget | null {
  if (state.hidden) return null;
  const id = currentMissionId(state, projectCount);
  if (id === "read-city") return nearestUnread(state, city, player, false);
  if (id === "key") return nearestUnread(state, city, player, true);
  if (id === "coast-run") {
    if (state.visited.includes("naval")) return null;
    if (!state.drove && !player.driving) {
      const car = nearestCar(cars, player);
      if (car) return { x: car.x, z: car.z, name: "the nearest car", slug: "car" };
    }
    return padOf(city, "naval");
  }
  if (id === "arcade") return padOf(city, "arcade", "Arcade");
  return null;
}

/** Light pillar. Coast Run keeps it on the lighthouse even while the arrow points at a car. */
export function pillarTarget(
  state: MissionState,
  city: City,
  player: GuidePlayer,
  cars: readonly GuideCar[],
  projectCount = liveProjectCount(),
): MissionTarget | null {
  if (state.hidden) return null;
  const id = currentMissionId(state, projectCount);
  if (id === "coast-run") return state.visited.includes("naval") ? null : padOf(city, "naval");
  return currentTarget(state, city, player, cars, projectCount);
}

function coastStep(state: MissionState, driving: boolean): { n: number; text: string } {
  if (state.drove) return { n: 3, text: "Read the lighthouse" };
  if (driving) return { n: 2, text: "Drive to the pier" };
  return { n: 1, text: "Take any car" };
}

export function chipModel(
  state: MissionState,
  opts: { projectCount: number; driving: boolean; targetName: string | null },
): ChipModel | null {
  if (state.hidden) return null;
  const id = currentMissionId(state, opts.projectCount);
  const def = TABLE.find((m) => m.id === id);
  if (!id || !def) return null;
  if (id === "read-city") {
    const n = Math.min(READ_GOAL, landmarkCount(state.visited));
    const name = opts.targetName;
    return {
      long: `Read the City · ${n}/${READ_GOAL}${name ? ` · ${name}` : ""}`,
      compact: `${def.short} · ${n}/${READ_GOAL}`,
      live: `Read the City, ${n} of ${READ_GOAL}.${name ? ` Next is ${name}.` : ""}`,
    };
  }
  if (id === "coast-run") {
    const step = coastStep(state, opts.driving);
    return {
      long: `Coast Run · ${step.text}`,
      compact: `${def.short} · ${step.n}/3`,
      live: `Coast Run. ${step.text}.`,
    };
  }
  if (id === "arcade") {
    return { long: "The Arcade · Open it", compact: `${def.short} · 1/1`, live: "The Arcade. Open it." };
  }
  const goal = missionGoal("key", opts.projectCount);
  const n = Math.min(goal, keyCount(state.visited, opts.projectCount));
  const name = opts.targetName;
  return {
    long: `Key to the City · ${n}/${goal}${name ? ` · ${name}` : ""}`,
    compact: `${def.short} · ${n}/${goal}`,
    live: `Key to the City, ${n} of ${goal}.${name ? ` Next is ${name}.` : ""}`,
  };
}

export type MissionBrief = { title: string; what: string; progress: string };

/** Copy for the mission panel. One or two sentences, plus a progress fraction. */
export function missionBrief(state: MissionState, opts: { projectCount: number; driving: boolean }): MissionBrief | null {
  if (state.hidden) return null;
  const id = currentMissionId(state, opts.projectCount);
  if (id === "read-city") {
    const n = Math.min(READ_GOAL, landmarkCount(state.visited));
    return {
      title: "Read the City",
      what: "Open any 3 landmarks. The marker leads to the nearest one you have not read.",
      progress: `${n}/${READ_GOAL}`,
    };
  }
  if (id === "coast-run") {
    const step = coastStep(state, opts.driving);
    const what = state.drove
      ? "Step out and read the Naval Officers School. One visit is enough."
      : opts.driving
        ? "Drive to the pier. The marker stays on the Naval Officers School."
        : "Take any car, then follow the marker down to the Naval Officers School.";
    return { title: "Coast Run", what, progress: `${step.n}/3` };
  }
  if (id === "arcade") {
    return { title: "The Arcade", what: "Open the Arcade. If you already did, this mission finishes on its own.", progress: "0/1" };
  }
  if (id === "key") {
    const goal = missionGoal("key", opts.projectCount);
    const n = Math.min(goal, keyCount(state.visited, opts.projectCount));
    return {
      title: "Key to the City",
      what: "Open every stop you have not read yet. Places you already visited stay checked.",
      progress: `${n}/${goal}`,
    };
  }
  return null;
}

export function menuLine(state: MissionState, projectCount: number, driving: boolean): string {
  const chip = chipModel({ ...state, hidden: false }, { projectCount, driving, targetName: null });
  if (!chip) return "Missions complete";
  return state.hidden ? `Hidden · ${chip.long}` : chip.long;
}

export function rewardCopy(id: MissionId, projectCount: number): RewardCopy {
  if (id === "read-city") {
    return {
      id,
      title: "First Charter",
      toast: "First Charter raised in the plaza",
      body: "Next: take a car down to the pier.",
      sayHi: true,
    };
  }
  if (id === "coast-run") {
    return {
      id,
      title: "The lighthouse is lit",
      toast: "The lighthouse is lit",
      body: projectCount > 0 ? "Something just lit up at the stunt yard." : "You drove the coast and read the Naval Officers School.",
      sayHi: false,
    };
  }
  if (id === "arcade") {
    return { id, title: "Arcade open", toast: "Arcade open", body: "One mission left: Key to the City.", sayHi: false };
  }
  return {
    id,
    title: "Key to the City",
    toast: "Key to the City",
    body: "You've seen the whole city. Thanks for exploring Dotan's work.",
    sayHi: true,
  };
}

export function welcomeToast(state: MissionState, projectCount: number): string | null {
  if (!state.visited.length && !state.drove && !state.done.length) return null;
  const ids = activeMissionIds(projectCount);
  const cur = currentMissionId(state, projectCount);
  if (!cur) return "Welcome back · Missions complete";
  return `Welcome back · Mission ${ids.indexOf(cur) + 1} of ${ids.length}`;
}

export function checklist(
  state: MissionState,
  landmarks: readonly { slug: string; name: string }[],
  projectCount: number,
): CheckItem[] {
  const items: CheckItem[] = [];
  for (const l of landmarks) {
    if (!LANDMARK_SET.has(l.slug)) continue;
    items.push({ id: l.slug, label: l.name, checked: state.visited.includes(l.slug) });
  }
  if (projectCount > 0) items.push({ id: "arcade", label: "Arcade", checked: state.visited.includes("arcade") });
  return items;
}
