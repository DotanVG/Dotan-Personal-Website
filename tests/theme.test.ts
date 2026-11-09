import assert from "node:assert/strict";
import { test } from "node:test";
import { fragmentShader, vertexShader } from "@/lib/glassShader";
import {
  ICON_SIZE,
  GLASS,
  buildIconMasks,
  easeOutCubic,
  maskLitCount,
  morphDuration,
  pointerBecameDrag,
  shouldUseGlassShader,
  themeForThumb,
  thumbForTheme,
  thumbFromPointer,
} from "@/lib/glassToggle";
import { THEME_STORAGE_KEY, resolveTheme, themeBootScript } from "@/lib/theme";

test("resolveTheme follows the OS until a light or dark choice is stored", () => {
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme(null, false), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("nope", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("theme boot script matches resolveTheme and survives a blocked store", () => {
  assert.match(themeBootScript, new RegExp(THEME_STORAGE_KEY));
  for (const stored of [null, "light", "dark", "system"]) {
    for (const systemDark of [true, false]) {
      assert.equal(runBoot(stored, systemDark), resolveTheme(stored, systemDark));
    }
  }
  assert.equal(runBoot(null, true, { storageThrows: true }), "dark");
  assert.equal(runBoot("light", true, { mediaThrows: true }), "light");
});

test("thumb maps light to the right and snaps at the midpoint", () => {
  assert.equal(thumbForTheme("light"), 1);
  assert.equal(thumbForTheme("dark"), 0);
  assert.equal(themeForThumb(0.5), "light");
  assert.equal(themeForThumb(0.499), "dark");
  assert.equal(thumbFromPointer(10, 10, 60), 0);
  assert.equal(thumbFromPointer(70, 10, 60), 1);
  assert.equal(thumbFromPointer(40, 10, 60), 0.5);
  assert.equal(thumbFromPointer(0, 0, 0), 0);
});

test("a small pointer wobble is a click and a sideways move is a drag", () => {
  assert.equal(pointerBecameDrag(2, 2), false);
  assert.equal(pointerBecameDrag(5, 0), true);
  assert.equal(pointerBecameDrag(3, 4), true);
});

test("shader motion is skipped for reduced motion or missing WebGL", () => {
  assert.equal(shouldUseGlassShader(false, true), true);
  assert.equal(shouldUseGlassShader(true, true), false);
  assert.equal(shouldUseGlassShader(false, false), false);
});

test("morph timing eases out and short snaps stay quick", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  assert.ok(morphDuration(1) > morphDuration(0.2));
});

test("sun and moon masks are lit grids and only the sun is symmetric", () => {
  const { sun, moon } = buildIconMasks();
  assert.equal(sun.length, ICON_SIZE * ICON_SIZE);
  assert.ok(maskLitCount(sun) > 8);
  assert.ok(maskLitCount(moon) > 8);
  assert.ok(maskLitCount(sun) < sun.length);
  assert.ok(maskLitCount(moon) < moon.length);
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      assert.equal(sun[y * ICON_SIZE + x], sun[y * ICON_SIZE + (ICON_SIZE - 1 - x)]);
    }
  }
  let moonSymmetric = true;
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      if (moon[y * ICON_SIZE + x] !== moon[y * ICON_SIZE + (ICON_SIZE - 1 - x)]) moonSymmetric = false;
    }
  }
  assert.equal(moonSymmetric, false);
});

test("fragment shader is a pixel rebuild driven by the thumb uniform", () => {
  const source = fragmentShader();
  assert.match(vertexShader(), /gl_Position/);
  assert.match(source, /uniform float u_t/);
  assert.match(source, new RegExp(`y < ${ICON_SIZE}`));
  assert.match(source, new RegExp((GLASS.trackW / 2).toFixed(1)));
  assert.match(source, new RegExp(GLASS.scatter.toFixed(1)));
  assert.match(source, /gl_FragColor/);
});

function runBoot(
  stored: string | null,
  systemDark: boolean,
  faults: { storageThrows?: boolean; mediaThrows?: boolean } = {},
) {
  const classes = new Set<string>();
  const root = {
    classList: {
      remove(...names: string[]) {
        for (const name of names) classes.delete(name);
      },
      add(name: string) {
        classes.add(name);
      },
    },
    style: { colorScheme: "" },
  };
  const document = { documentElement: root };
  const localStorage = {
    getItem() {
      if (faults.storageThrows) throw new Error("blocked");
      return stored;
    },
  };
  const matchMedia = () => {
    if (faults.mediaThrows) throw new Error("no media");
    return { matches: systemDark };
  };
  const run = new Function("document", "localStorage", "matchMedia", themeBootScript);
  run(document, localStorage, matchMedia);
  assert.equal(classes.size, 1);
  assert.equal(root.style.colorScheme, [...classes][0]);
  return [...classes][0];
}
