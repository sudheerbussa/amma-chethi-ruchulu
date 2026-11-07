import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.join(here, '..');

export function resolveFromRoot(...parts) {
  return path.join(projectRoot, ...parts);
}
