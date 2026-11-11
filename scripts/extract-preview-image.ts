/**
 * Preview-image extraction that follows the same preference order as
 * DotanVG/react-node-url-metadata-fetcher (`Backend/src/extractMetadata.js`):
 * Open Graph → Twitter Card → link[rel=image_src] → JSON-LD.
 * Relative URLs are resolved against the page URL; only http(s) survive.
 */
export type ImageSource = "og" | "twitter" | "html" | "jsonld";

export type PreviewImage = {
  url: string;
  source: ImageSource;
  alt: string;
};

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

export function absoluteUrl(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return "";
    return resolved.href;
  } catch {
    return "";
  }
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const body = tag.replace(/^<\w+\s*/i, "");
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function metaContents(html: string, key: "property" | "name", name: string): string[] {
  const out: string[] = [];
  const tagRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const attrs = parseAttrs(match[0]);
    if ((attrs[key] || "").toLowerCase() === name.toLowerCase()) {
      const content = clean(attrs.content);
      if (content) out.push(content);
    }
  }
  return out;
}

function firstMeta(html: string, key: "property" | "name", name: string): string {
  return metaContents(html, key, name)[0] ?? "";
}

function linkHref(html: string, rel: string): string {
  const tagRe = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const attrs = parseAttrs(match[0]);
    const rels = (attrs.rel || "").toLowerCase().split(/\s+/);
    if (rels.includes(rel.toLowerCase())) {
      const href = clean(attrs.href);
      if (href) return href;
    }
  }
  return "";
}

function firstJsonLdImage(html: string): string {
  const tagRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const entries = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((entry) => {
        if (entry && typeof entry === "object" && "@graph" in entry) {
          const graph = (entry as { "@graph": unknown })["@graph"];
          return Array.isArray(graph) ? graph : [graph];
        }
        return [entry];
      });
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const record = entry as { image?: unknown; thumbnailUrl?: unknown };
        const image = record.image ?? record.thumbnailUrl;
        const candidate = Array.isArray(image) ? image[0] : image;
        if (typeof candidate === "string" && clean(candidate)) return clean(candidate);
        if (candidate && typeof candidate === "object") {
          const url = clean((candidate as { url?: unknown }).url);
          if (url) return url;
        }
      }
    } catch {
      // Invalid JSON-LD is skipped, same as the fetcher.
    }
  }
  return "";
}

export function extractPreviewImage(html: string, baseUrl: string): PreviewImage | null {
  const candidates: Array<[string, ImageSource]> = [
    [firstMeta(html, "property", "og:image:secure_url"), "og"],
    [firstMeta(html, "property", "og:image:url"), "og"],
    [firstMeta(html, "property", "og:image"), "og"],
    [firstMeta(html, "name", "og:image"), "og"],
    [firstMeta(html, "name", "twitter:image"), "twitter"],
    [firstMeta(html, "name", "twitter:image:src"), "twitter"],
    [linkHref(html, "image_src"), "html"],
    [firstJsonLdImage(html), "jsonld"],
  ];

  for (const [value, source] of candidates) {
    const url = absoluteUrl(value, baseUrl);
    if (!url) continue;
    const alt =
      firstMeta(html, "property", "og:image:alt") ||
      firstMeta(html, "name", "twitter:image:alt") ||
      "";
    return { url, source, alt };
  }
  return null;
}
