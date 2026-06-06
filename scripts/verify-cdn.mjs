#!/usr/bin/env node
// Verify every local public/ and .next/static/ file is actually reachable on the
// CDN, one by one. Run it where you HAVE network (not in CI sandboxes).
//
//   node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn
//   node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn --public-only
//
// Layout assumed (this project mirrors public/ under /public on the CDN, and
// uploads .next/static to /_next/static):
//   public/<x>        -> <base>/public/<x>
//   .next/static/<x>  -> <base>/_next/static/<x>
//
// NOTE: .next/static filenames are hashed per build — verify that tree only
// AFTER you upload the SAME build you're checking (re-run `npm run build`, then
// upload .next/static, then run this). The public/ tree is stable.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes(name);

const BASE = (arg('--base') || process.env.NEXT_PUBLIC_CDN_BASE || '').replace(/\/+$/, '');
const ORIGIN = arg('--origin', 'https://molamaker.cn');
const CONCURRENCY = Number(arg('--concurrency', '16'));
const SHOW = Number(arg('--show', '50'));

if (!BASE) {
  console.error('Usage: node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn [--public-only] [--origin https://molamaker.cn]');
  process.exit(2);
}

const TREES = [
  { name: 'public/ (stable: geogebra · live2d · media)', dir: 'public', prefix: `${BASE}/public` },
  ...(has('--public-only') ? [] : [
    { name: '_next/static/ (THIS build — re-upload after each `npm run build`)', dir: '.next/static', prefix: `${BASE}/_next/static` },
  ]),
];

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const toUrl = (prefix, dir, file) =>
  `${prefix}/${relative(dir, file).split(sep).map(encodeURIComponent).join('/')}`;

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    return { url, status: r.status, type: r.headers.get('content-type') || '' };
  } catch (e) {
    return { url, status: 0, type: '', error: e.message };
  }
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) || 1 }, async () => {
    for (;;) { const idx = i++; if (idx >= items.length) return; results[idx] = await fn(items[idx]); }
  }));
  return results;
}

const targets = [];
for (const t of TREES) {
  for (const f of walk(t.dir)) targets.push({ tree: t.name, url: toUrl(t.prefix, t.dir, f) });
}
if (!targets.length) {
  console.error('No local files under public/ or .next/static/ — nothing to check.');
  process.exit(2);
}

if (has('--dry')) {
  console.log(`${targets.length} URLs would be checked. First ${Math.min(SHOW, targets.length)}:`);
  for (const t of targets.slice(0, SHOW)) console.log(`  ${t.url}`);
  process.exit(0);
}

console.log(`Checking ${targets.length} files on ${BASE} (concurrency ${CONCURRENCY})…\n`);
const results = await pool(targets, CONCURRENCY, (t) => head(t.url));

for (const t of TREES) {
  const idxs = targets.map((x, i) => (x.tree === t.name ? i : -1)).filter((i) => i >= 0);
  const rs = idxs.map((i) => results[i]);
  const ok = rs.filter((r) => r.status === 200).length;
  const miss = rs.filter((r) => r.status === 404).length;
  const oth = rs.length - ok - miss;
  console.log(`  ${t.name}\n    ${ok}/${rs.length} ok · ${miss} missing · ${oth} other/err`);
}

// CORS + wasm spot checks
const sample = targets.find((t) => t.url.includes('/public/'))?.url;
if (sample) {
  try {
    const r = await fetch(sample, { headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(15000) });
    console.log(`\n  CORS: ACAO for ${ORIGIN} = ${r.headers.get('access-control-allow-origin') || '(none — fonts/geogebra will fail cross-origin!)'}`);
  } catch { console.log('\n  CORS: (request error)'); }
}
const wasmBad = results.filter((r) => r.status === 200 && r.url.endsWith('.wasm') && !/application\/wasm/i.test(r.type));
if (wasmBad.length) console.log(`  ⚠ ${wasmBad.length} .wasm served with wrong content-type (must be application/wasm)`);

const fails = results.filter((r) => r.status !== 200);
if (fails.length) {
  console.log(`\nFirst ${Math.min(SHOW, fails.length)} of ${fails.length} failures:`);
  for (const f of fails.slice(0, SHOW)) console.log(`  [${f.status || f.error}] ${f.url}`);
  process.exit(1);
}
console.log('\n✓ All checked resources are available.');
