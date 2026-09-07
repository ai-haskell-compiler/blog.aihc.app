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
  // Deploy the returned ID directly: Wrangler's version-detail lookup can fail
  // for an assets-only Worker even when the version exists in the version list.
  const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
  if (!account || !token) throw new Error('Cloudflare deployment credentials are required');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/aihc-blog/deployments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy: 'percentage', versions: [{ version_id: uploads[0].version_id, percentage: 100 }] }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(`Cloudflare deployment failed (${response.status}): ${JSON.stringify(result.errors)}`);
  }
  console.log(`Deployed version ${uploads[0].version_id} to 100% of traffic (deployment ${result.result.id}).`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
