/**
 * Resolve the project's `@/…` alias for scripts that import application code.
 *
 * Node strips TypeScript types natively, but it does not read `tsconfig.json`,
 * so `import … from "@/lib/db"` fails with ERR_MODULE_NOT_FOUND the moment a
 * script pulls in anything from `src/`. This hook closes that gap and does
 * nothing else: it rewrites the one alias and hands every other specifier
 * straight back to the default resolver.
 *
 * Extension-less relative imports get the same treatment. `@/lib/db` names a
 * directory with an `index.ts`, and `./schema` names `schema.ts`; both are
 * ordinary in a bundled app and neither resolves under plain ESM rules.
 *
 * Usage:  node --import ./scripts/reader/ts-alias-hook.mjs <script>
 */

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../../src");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

/** `/abs/path` → the file that actually exists, trying each extension. */
function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const file = resolveFile(path.join(SRC, specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }

    // A relative import from inside `src/` with no extension.
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidate = path.resolve(parentDir, specifier);
      if (!path.extname(candidate) || !existsSync(candidate)) {
        const file = resolveFile(candidate);
        if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});
