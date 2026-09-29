import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, launch } from "./lib.mjs";

test("companion strips decode into six nonempty transparent cells without edge bleed", async () => {
  const { browser, page } = await launch();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    for (const pose of ["perching", "flying", "typing"]) {
      const result = await page.evaluate(async (pose) => {
        const image = new Image();
        image.src = `/pets/mini-dotan/${pose}.webp`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const frames = Array.from({ length: 6 }, (_, column) => {
          const rgba = context.getImageData(column * 192, 0, 192, 208).data;
          let solid = 0, clear = 0, sideBleed = 0;
          for (let pixel = 0; pixel < 192 * 208; pixel++) {
            const alpha = rgba[pixel * 4 + 3];
            if (alpha) solid++; else clear++;
            if ((pixel % 192 === 0 || pixel % 192 === 191) && alpha > 8) sideBleed++;
          }
          return { solid, clear, sideBleed };
        });
        return { width: image.width, height: image.height, frames };
      }, pose);
      assert.equal(result.width, 1152, `${pose}: six 192px columns`);
      assert.equal(result.height, 208, `${pose}: one 208px row`);
      result.frames.forEach((frame, column) => {
        assert.ok(frame.solid > 2000, `${pose}/${column}: visible artwork`);
        assert.ok(frame.clear > 10000, `${pose}/${column}: real transparency`);
        assert.equal(frame.sideBleed, 0, `${pose}/${column}: no neighboring-cell bleed`);
      });
    }
  } finally {
    await browser.close();
  }
});

