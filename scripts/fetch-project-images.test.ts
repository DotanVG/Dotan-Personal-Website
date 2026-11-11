import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  ASPECT_CONTAIN_SKEW,
  MAX_PROJECT_IMAGE_BYTES,
  PROJECT_IMAGE_HEIGHT,
  PROJECT_IMAGE_WIDTH,
  contentLengthWithinCap,
  isImageContentType,
  optimizeProjectPreview,
  previewBackgroundColor,
  readResponseBytes,
  resizeFitForAspect,
} from "./fetch-project-images";

test("isImageContentType accepts image/* including a parameter suffix", () => {
  assert.equal(isImageContentType("image/jpeg"), true);
  assert.equal(isImageContentType("image/png; charset=binary"), true);
  assert.equal(isImageContentType("IMAGE/WEBP"), true);
  assert.equal(isImageContentType("text/html"), false);
  assert.equal(isImageContentType("application/octet-stream"), false);
  assert.equal(isImageContentType(""), false);
  assert.equal(isImageContentType(null), false);
});

test("contentLengthWithinCap rejects declared bodies over the download cap", () => {
  assert.equal(contentLengthWithinCap(String(MAX_PROJECT_IMAGE_BYTES)), true);
  assert.equal(contentLengthWithinCap(String(MAX_PROJECT_IMAGE_BYTES + 1)), false);
  assert.equal(contentLengthWithinCap(null), true);
  assert.equal(contentLengthWithinCap(""), true);
  assert.equal(contentLengthWithinCap("12", 10), false);
  assert.equal(contentLengthWithinCap("10", 10), true);
});

test("readResponseBytes rejects a non-image type, an oversize body, and keeps a small image", async () => {
  const html = new Response("<html></html>", { headers: { "content-type": "text/html" } });
  assert.equal(await readResponseBytes(html, 1024), null);

  const declared = new Response("xxxxxxxxxxxxxxxxxxxx", {
    headers: { "content-type": "image/png", "content-length": "20" },
  });
  assert.equal(await readResponseBytes(declared, 10), null);

  const streamed = new Response(Buffer.alloc(20), { headers: { "content-type": "image/webp" } });
  assert.equal(await readResponseBytes(streamed, 10), null);

  const ok = new Response(Buffer.from("abc"), { headers: { "content-type": "image/jpeg; charset=binary" } });
  assert.deepEqual(await readResponseBytes(ok, 50), Buffer.from("abc"));
});

test("resizeFitForAspect uses contain for 1.91:1 og images and cover near 16:9", () => {
  assert.equal(resizeFitForAspect(1200, 630), "contain");
  assert.equal(resizeFitForAspect(1000, 1000), "contain");
  assert.equal(resizeFitForAspect(1200, 675), "cover");
  assert.equal(resizeFitForAspect(1920, 1080), "cover");
  assert.ok(ASPECT_CONTAIN_SKEW > 1);
});

test("optimizeProjectPreview letterboxes a 1.91:1 image so the bottom row is kept", async () => {
  const width = 1200;
  const height = 630;
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 16, g: 20, b: 40 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: { width, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } },
        })
          .png()
          .toBuffer(),
        top: height - 8,
        left: 0,
      },
    ])
    .jpeg()
    .toBuffer();

  assert.equal(resizeFitForAspect(width, height), "contain");
  const edge = await previewBackgroundColor(buffer);
  assert.ok(edge.b > edge.r);

  const webp = await optimizeProjectPreview(buffer);
  const { data, info } = await sharp(webp)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, PROJECT_IMAGE_WIDTH);
  assert.equal(info.height, PROJECT_IMAGE_HEIGHT);

  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  const midBottomContent = at(600, 22 + 630 - 4);
  assert.ok(midBottomContent[0] > 200 && midBottomContent[1] > 200 && midBottomContent[2] > 200);
});
