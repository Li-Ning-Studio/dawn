import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'finder-build-'));
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error || new Error(`Check failed: ${args.join(' ')}`);
}
try {
  run(['--experimental-strip-types', '--test', 'tests/racket-finder.test.mjs']);
  run(['reax/node_modules/typescript/bin/tsc', '-b', 'reax']);
  run(['build-once.mjs', output], join(root, 'reax'));
  if (!existsSync(join(output, 'vx-racket-finder.js'))) throw new Error('Finder entry was not built');
} finally {
  rmSync(output, { recursive: true, force: true });
}
