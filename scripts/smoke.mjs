import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Preview recorded for staging fbb16f1; see DEPLOYMENT.md for provenance.
export const DEFAULT_BASE_URL = "https://dotanv-gl36y6afj-dotanvgs-projects.vercel.app";

export function assetsFromHtml(html, base) {
  const groups = { js: new Set(), css: new Set(), icon: new Set(), og: new Set() };
  for (const tag of html.matchAll(/<(script|link|meta)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
      .map(([, name, double, single, bare]) => [name.toLowerCase(), (double ?? single ?? bare).replace(/&amp;/gi, "&")]));
    const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
    const kind = tag[1].toLowerCase();
    const group = kind === "script" && attrs.src ? "js"
      : kind === "link" && rel.includes("stylesheet") ? "css"
      : kind === "link" && rel.some((r) => r === "icon" || r === "apple-touch-icon") ? "icon"
      : kind === "meta" && attrs.property?.toLowerCase() === "og:image" ? "og" : null;
    if (!group) continue;
    const url = new URL(attrs.src ?? attrs.href ?? attrs.content, base);
    if (url.origin !== base.origin && url.origin !== "https://dotanv.vercel.app") continue;
    // Next metadata uses the canonical production origin, even on staging.
    url.protocol = base.protocol;
    url.host = base.host;
    groups[group].add(url.href);
  }
  for (const [group, urls] of Object.entries(groups)) {
    if (!urls.size) throw new Error(`${base.href}: HTML has no first-party ${group} reference`);
  }
  const urls = [...new Set(Object.values(groups).flatMap((set) => [...set]))];
  if (urls.length > 128) throw new Error(`${base.href}: more than 128 assets; review before increasing the limit`);
  return urls;
}

function get(url, html = false) {
  const args = ["--silent", "--show-error", "--max-time", "15", "--connect-timeout", "5",
    "--retry", "2", "--retry-max-time", "50", "--proto", "=http,https",
    "--write-out", "\n%{http_code}"];
  if (!html) args.push("--output", process.platform === "win32" ? "NUL" : "/dev/null");
  args.push("--url", url);
  // Bound the entire process too, including retries. Do not follow login redirects.
  const result = spawnSync("curl", args, { encoding: "utf8", timeout: 60000, maxBuffer: 10 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`${url}: curl failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  const split = result.stdout.lastIndexOf("\n");
  const status = result.stdout.slice(split + 1).trim();
  if (status !== "200") throw new Error(`${url}: expected HTTP 200, got ${status}`);
  console.log(`PASS 200 ${url}`);
  return result.stdout.slice(0, split);
}

export function smoke(input = DEFAULT_BASE_URL) {
  const base = new URL(input);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Base URL must be HTTP(S) without credentials");
  }
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  const urls = assetsFromHtml(get(base.href, true), base);
  for (const url of urls) get(url);
  console.log(`PASS smoke: home and ${urls.length} assets`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    smoke(process.argv[2] || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL);
  } catch (error) {
    console.error(`FAIL smoke: ${error.message}`);
    process.exitCode = 1;
  }
}
