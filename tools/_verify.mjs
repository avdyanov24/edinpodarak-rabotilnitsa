import { readFile } from 'node:fs/promises'; import { homedir } from 'node:os'; import { join } from 'node:path'; import crypto from 'node:crypto';
async function vcTok(){ for (const p of [join(homedir(),'Library/Application Support/com.vercel.cli/auth.json'), join(homedir(),'.local/share/com.vercel.cli/auth.json')]) { try { return JSON.parse(await readFile(p,'utf8')).token; } catch {} } throw new Error('no vercel token'); }
const V = await vcTok();
const H = { Authorization: `Bearer ${V}`, 'Content-Type': 'application/json' };

// replace the one whose plaintext nobody kept
const list = await (await fetch('https://api.vercel.com/v9/projects/edinpodarak-rabotilnitsa/env', { headers: H })).json();
for (const e of list.envs.filter(e => e.key === 'CRON_SECRET')) {
  await fetch(`https://api.vercel.com/v9/projects/edinpodarak-rabotilnitsa/env/${e.id}`, { method: 'DELETE', headers: H });
}
const secret = crypto.randomBytes(24).toString('hex');
const res = await fetch('https://api.vercel.com/v10/projects/edinpodarak-rabotilnitsa/env?upsert=true', {
  method: 'POST', headers: H,
  body: JSON.stringify({ key: 'CRON_SECRET', value: secret, type: 'encrypted', target: ['production','preview'] }),
});
console.log('set:', res.status);
await writeSecret(secret);
async function writeSecret(s) { const { writeFile } = await import('node:fs/promises'); await writeFile('/tmp/cron-secret.txt', s); }

// a redeploy is needed for the new value to reach the running function
const dep = await (await fetch('https://api.vercel.com/v13/deployments?forceNew=1', {
  method: 'POST', headers: H,
  body: JSON.stringify({
    name: 'edinpodarak-rabotilnitsa',
    target: 'production',
    gitSource: { type: 'github', org: 'avdyanov24', repo: 'edinpodarak-rabotilnitsa', ref: 'main' },
  }),
})).json();
console.log('redeploy:', dep.id ?? JSON.stringify(dep).slice(0, 200));
