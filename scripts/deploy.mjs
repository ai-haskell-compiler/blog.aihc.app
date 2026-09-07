import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporary = mkdtempSync(join(tmpdir(), 'aihc-deploy-'));
const output = join(temporary, 'upload.jsonl');
try {
  execFileSync('npx', ['wrangler', 'versions', 'upload'], {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: output },
  });
  const records = readFileSync(output, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const uploads = records.filter(record => record.type === 'version-upload');
  if (uploads.length !== 1 || !/^[a-f0-9-]{36}$/.test(uploads[0].version_id)) {
    throw new Error('Expected exactly one uploaded Worker version');
  }
  execFileSync('npx', ['wrangler', 'versions', 'deploy', `${uploads[0].version_id}@100%`, '--yes'], { stdio: 'inherit' });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
