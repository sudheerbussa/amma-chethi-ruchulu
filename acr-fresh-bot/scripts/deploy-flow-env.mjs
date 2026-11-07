#!/usr/bin/env node
/**
 * Push Flow env vars to VPS without printing the private key.
 * Usage: node scripts/deploy-flow-env.mjs [flow_id]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const flowId = process.argv[2] || process.env.WHATSAPP_FLOW_ID || '2222222978357187';
const privPath = path.join(root, '.flow-keys', 'flow_private.pem');
const host = process.env.FRESH_VPS_HOST || 'root@162.35.105.110';
const allowlist = process.env.WHATSAPP_FLOW_ALLOWLIST || '918055292935,918886128995';

if (!fs.existsSync(privPath)) {
  console.error('Missing', privPath, '— run node scripts/flow-setup.mjs first');
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acr-flow-'));
const remotePriv = '/tmp/acr-fresh-flow_private.pem';
const remotePy = '/tmp/acr-fresh-patch-flow-env.py';

fs.copyFileSync(privPath, path.join(tmpDir, 'flow_private.pem'));

const py = `#!/usr/bin/env python3
import pathlib, re
env_path = pathlib.Path('/opt/acr-fresh-bot/.env')
priv = pathlib.Path('${remotePriv}').read_text().strip().replace('\\\\r', '')
escaped = priv.replace('\\\\', '\\\\\\\\').replace('"', '\\\\"').replace('\\n', '\\\\n')
lines = []
for line in env_path.read_text().splitlines():
    if line.startswith('WHATSAPP_FLOW_'):
        continue
    lines.append(line)
lines.extend([
    f'WHATSAPP_FLOW_ID=${flowId}',
    f'WHATSAPP_FLOW_PRIVATE_KEY="{escaped}"',
    'WHATSAPP_FLOW_PASSPHRASE=',
    'WHATSAPP_FLOW_MODE=published',
    f'WHATSAPP_FLOW_ALLOWLIST=${allowlist}',
])
env_path.write_text('\\n'.join(lines) + '\\n')
print('patched', env_path)
`;

fs.writeFileSync(path.join(tmpDir, 'patch-flow-env.py'), py);
execSync(`scp "${path.join(tmpDir, 'flow_private.pem')}" ${host}:${remotePriv}`, { stdio: 'inherit' });
execSync(`scp "${path.join(tmpDir, 'patch-flow-env.py')}" ${host}:${remotePy}`, { stdio: 'inherit' });
execSync(
  `ssh ${host} "python3 ${remotePy} && pm2 restart acr-fresh-bot --update-env && sleep 2 && curl -s http://127.0.0.1:3001/health"`,
  { stdio: 'inherit' },
);
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Flow env deployed. Flow ID:', flowId);
