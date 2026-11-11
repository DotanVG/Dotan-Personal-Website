import { test } from "node:test";
import assert from "node:assert/strict";
import { absoluteUrl, extractPreviewImage } from "./extract-preview-image";

const base = "https://example.com/games/pie/";

test("prefers og:image:secure_url over later fallbacks and resolves relative URLs", () => {
  const html = `
    <meta property="og:image:secure_url" content="/secure.jpg">
    <meta property="og:image" content="https://cdn.example.com/ignored.jpg">
    <meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
    <meta property="og:image:alt" content="A pie fight">
  `;
  assert.deepEqual(extractPreviewImage(html, base), {
    url: "https://example.com/secure.jpg",
    source: "og",
    alt: "A pie fight",
  });
});

test("uses twitter:image when Open Graph is absent, including swapped attribute order", () => {
  const html = `<meta content='/img/card.png' name="twitter:image"><meta name="twitter:image:alt" content="Card">`;
  assert.deepEqual(extractPreviewImage(html, base), {
    url: "https://example.com/img/card.png",
    source: "twitter",
    alt: "Card",
  });
});

test("falls back to link[rel=image_src] then JSON-LD image objects", () => {
  const withLink = `<link rel="image_src" href="assets/cover.webp">`;
  assert.equal(extractPreviewImage(withLink, base)?.url, "https://example.com/games/pie/assets/cover.webp");
  assert.equal(extractPreviewImage(withLink, base)?.source, "html");

  const withJson = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage","image":{"url":"https://cdn.example.com/ld.jpg"}}]}</script>`;
  assert.deepEqual(extractPreviewImage(withJson, base), {
    url: "https://cdn.example.com/ld.jpg",
    source: "jsonld",
    alt: "",
  });
});

test("rejects javascript: and data: URLs and returns null when nothing is usable", () => {
  const html = `
    <meta property="og:image" content="javascript:alert(1)">
    <meta name="twitter:image" content="data:image/png;base64,xxxx">
  `;
  assert.equal(extractPreviewImage(html, base), null);
  assert.equal(absoluteUrl("javascript:alert(1)", base), "");
  assert.equal(absoluteUrl("", base), "");
});
