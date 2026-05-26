#!/usr/bin/env node
// PostToolUse hook: run ESLint on the edited TypeScript file for immediate feedback.
// Called after Edit or Write tool use. Reads tool input from TOOL_INPUT env var.

const input = (() => {
  try { return JSON.parse(process.env.TOOL_INPUT || '{}'); }
  catch { return {}; }
})();

const fp = input.file_path || '';

// Only lint TypeScript/JavaScript files
if (!/\.(tsx?|jsx?)$/.test(fp)) process.exit(0);

const { execSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');

try {
  // Lint just the changed file — fast (~1-2s vs full project lint)
  const out = execSync(`npx eslint --max-warnings=0 "${fp}"`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (out.trim()) console.log(out.trim());
} catch (err) {
  // ESLint exits non-zero on lint errors — print them for Claude to see
  const msg = (err.stdout || '') + (err.stderr || '');
  if (msg.trim()) console.error(msg.trim());
  process.exit(1);
}
