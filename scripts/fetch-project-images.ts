/**
 * Build-time fetch of each selected project's preview image, using the same
 * extraction order as the URL Metadata Fetcher. Optimized WebP files are
 * written to public/projects/ and a manifest is written to
 * content/selected-project-images.ts.
 *
 * Failures must never fail the Vercel build: each project is isolated, a
 * rejected image (bad type, oversize, timeout, or sharp error) keeps the
 * existing committed file when present, otherwise the card uses the uniform
 * site-colored fallback. The script always exits 0.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { selectedProjects } from "@/content/selected-projects";
import { extractPreviewImage, type ImageSource } from "./extract-preview-image";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "projects");
const manifestPath = path.join(root, "content", "selected-project-images.ts");

const USER_AGENT = "DotanPersonalWebsite/1.0 (+https://dotanv.vercel.app)";

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_PROJECT_IMAGE_BYTES = 5 * 1024 * 1024;
export const PROJECT_IMAGE_WIDTH = 1200;
export const PROJECT_IMAGE_HEIGHT = 675; // 16:9
export const ASPECT_CONTAIN_SKEW = 1.06;
export const SITE_PREVIEW_BACKGROUND = { r: 12, g: 12, b: 16 };

export type SelectedProjectImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  source: ImageSource;
};

export function projectImageSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

export function isImageContentType(contentType: string | null | undefined): boolean {
  const media = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return media.startsWith("image/");
}

export function contentLengthWithinCap(
  contentLength: string | null | undefined,
  maxBytes = MAX_PROJECT_IMAGE_BYTES,
): boolean {
  if (contentLength == null || contentLength === "") return true;
  const length = Number(contentLength);
  if (!Number.isFinite(length) || length < 0) return true;
  return length <= maxBytes;
}

/** Use contain (letterbox) when the source aspect is meaningfully off 16:9, e.g. 1.91:1 og:image. */
export function resizeFitForAspect(
  width: number,
  height: number,
  target = PROJECT_IMAGE_WIDTH / PROJECT_IMAGE_HEIGHT,
  skewLimit = ASPECT_CONTAIN_SKEW,
): "cover" | "contain" {
  if (!width || !height) return "cover";
  const aspect = width / height;
  const skew = Math.max(aspect / target, target / aspect);
  return skew > skewLimit ? "contain" : "cover";
}

export async function previewBackgroundColor(
  input: Buffer,
): Promise<{ r: number; g: number; b: number }> {
  try {
    const base = sharp(input).rotate().removeAlpha();
    const { width = 0, height = 0 } = await base.metadata();
    if (width < 2 || height < 2) return SITE_PREVIEW_BACKGROUND;
    const points: Array<[number, number]> = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [Math.floor(width / 2), 0],
      [Math.floor(width / 2), height - 1],
      [0, Math.floor(height / 2)],
      [width - 1, Math.floor(height / 2)],
    ];
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [x, y] of points) {
      const pixel = await base
        .clone()
        .extract({ left: x, top: y, width: 1, height: 1 })
        .raw()
        .toBuffer();
      r += pixel[0];
      g += pixel[1];
      b += pixel[2];
    }
    const n = points.length;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } catch {
    return SITE_PREVIEW_BACKGROUND;
  }
}

export async function optimizeProjectPreview(buffer: Buffer): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(buffer).rotate().metadata();
  const fit = resizeFitForAspect(width, height);
  const background = fit === "contain" ? await previewBackgroundColor(buffer) : SITE_PREVIEW_BACKGROUND;
  return sharp(buffer)
    .rotate()
    .resize(PROJECT_IMAGE_WIDTH, PROJECT_IMAGE_HEIGHT, {
      fit,
      position: "centre",
      background,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

export async function readResponseBytes(
  response: Response,
  maxBytes = MAX_PROJECT_IMAGE_BYTES,
): Promise<Buffer | null> {
  if (!isImageContentType(response.headers.get("content-type"))) return null;
  if (!contentLengthWithinCap(response.headers.get("content-length"), maxBytes)) return null;

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) return null;
    return bytes;
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // already over the cap
      }
      return null;
    }
    chunks.push(value);
  }
  return size > 0 ? Buffer.concat(chunks) : null;
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept },
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url: string): Promise<Buffer | null> {
  const response = await fetchWithTimeout(url, "image/avif,image/webp,image/*,*/*;q=0.8");
  if (!response) return null;
  return readResponseBytes(response);
}

function manifestSource(images: Record<string, SelectedProjectImage | null>): string {
  return `// Generated by scripts/fetch-project-images.ts. Do not edit by hand.

export type SelectedProjectImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  source: "og" | "twitter" | "html" | "jsonld";
};

export const selectedProjectImages: Record<string, SelectedProjectImage | null> = ${JSON.stringify(images, null, 2)};
`;
}

function keptOrFallback(
  dest: string,
  src: string,
  title: string,
  alt: string,
  source: ImageSource,
  reason: string,
): SelectedProjectImage | null {
  if (existsSync(dest)) {
    console.warn(`${title}: ${reason}, keeping existing ${path.basename(dest)}`);
    return {
      src,
      width: PROJECT_IMAGE_WIDTH,
      height: PROJECT_IMAGE_HEIGHT,
      alt,
      source,
    };
  }
  console.warn(`${title}: ${reason}, using site-colored fallback`);
  return null;
}

export async function fetchProjectImages(): Promise<Record<string, SelectedProjectImage | null>> {
  await mkdir(outDir, { recursive: true });
  const images: Record<string, SelectedProjectImage | null> = {};

  for (const project of selectedProjects) {
    const slug = projectImageSlug(project.title);
    const filename = `${slug}.webp`;
    const dest = path.join(outDir, filename);
    const src = `/projects/${filename}`;

    try {
      const page = await fetchWithTimeout(project.url, "text/html,application/xhtml+xml");
      const html = page ? await page.text() : "";
      const preview = html ? extractPreviewImage(html, page?.url || project.url) : null;
      const alt = preview?.alt || `${project.title} preview`;
      const source = preview?.source ?? "og";

      let buffer: Buffer | null = null;
      if (preview) buffer = await downloadImage(preview.url);

      if (buffer) {
        const { width = 0, height = 0 } = await sharp(buffer).rotate().metadata();
        const fit = resizeFitForAspect(width, height);
        const webp = await optimizeProjectPreview(buffer);
        await writeFile(dest, webp);
        images[project.url] = {
          src,
          width: PROJECT_IMAGE_WIDTH,
          height: PROJECT_IMAGE_HEIGHT,
          alt,
          source,
        };
        console.log(`${project.title}: ${preview?.source} ${preview?.url} -> ${filename} (${fit})`);
        continue;
      }

      images[project.url] = keptOrFallback(
        dest,
        src,
        project.title,
        alt,
        source,
        preview ? "image download failed" : "fetch failed",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      images[project.url] = keptOrFallback(
        dest,
        src,
        project.title,
        `${project.title} preview`,
        "og",
        message,
      );
    }
  }

  await writeFile(manifestPath, manifestSource(images));
  return images;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (process.env.SKIP_PROJECT_IMAGE_FETCH === "1") {
    console.log("SKIP_PROJECT_IMAGE_FETCH=1, skipping project image fetch");
  } else {
    fetchProjectImages()
      .then(() => {
        process.exit(0);
      })
      .catch((error) => {
        console.warn("fetch-project-images: unexpected error, continuing the build");
        console.warn(error);
        process.exit(0);
      });
  }
}
