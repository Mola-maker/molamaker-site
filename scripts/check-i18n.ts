#!/usr/bin/env tsx
// Build-time i18n completeness check.
// Reads messages/en.json and messages/zh.json, compares keys recursively,
// and exits 1 if any key is missing in either locale.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as unknown;
const zh = JSON.parse(readFileSync(join(ROOT, 'messages/zh.json'), 'utf8')) as unknown;

const enKeys = new Set(flatKeys(en));
const zhKeys = new Set(flatKeys(zh));

const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));
const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));

let hasErrors = false;

if (missingInZh.length) {
  console.error('Keys present in en.json but MISSING in zh.json:');
  missingInZh.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (missingInEn.length) {
  console.error('Keys present in zh.json but MISSING in en.json:');
  missingInEn.forEach((k) => console.error(`  - ${k}`));
  hasErrors = true;
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`✓ i18n parity check passed — ${enKeys.size} keys in both locales.`);
}
