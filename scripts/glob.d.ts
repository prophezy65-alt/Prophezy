// Minimal ambient typing for the `glob` package, used only so
// `import { globSync } from "glob"` in import-project-library.ts type-checks.
// Prefer running `npm i --save-dev @types/glob` and deleting this file if
// that package exists for your installed glob version — this is a fallback.
declare module "glob" {
  export function globSync(pattern: string, options?: Record<string, unknown>): string[];
  export function glob(pattern: string, options?: Record<string, unknown>): Promise<string[]>;
}
