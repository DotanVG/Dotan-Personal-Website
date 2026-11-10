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
    if (context.parentURL?.startsWith("file:")) {
      const parent = fileURLToPath(context.parentURL);
      if (parent.includes(`${path.sep}node_modules${path.sep}`)) return next(specifier, context);
    }
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
      base = fileURLToPath(new URL(specifier, context.parentURL));
    if (base) {
      if (!path.extname(base)) {
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
        }
      } else if (existsSync(base)) {
        return next(pathToFileURL(base).href, context);
      }
    }
    return next(specifier, context);
  },
});
