// Lets `node --test` load the app's TypeScript modules directly (Node >= 22.18
// strips types natively): resolves extensionless relative imports and the
// "@/" path alias the same way the Next.js bundler does.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
      base = fileURLToPath(new URL(specifier, context.parentURL));
    if (base && !path.extname(base)) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
      }
    }
    if (base) return next(pathToFileURL(base).href, context);
    return next(specifier, context);
  },
});
