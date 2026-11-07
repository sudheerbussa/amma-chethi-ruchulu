/** Absolute project root (works in src/ and in esbuild dist/server.js). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `src/` in dev → one level up; `dist/` in production bundle → one level up. */
export const projectRoot = path.join(here, '..');

export function resolveFromRoot(...parts) {
  return path.join(projectRoot, ...parts);
}
