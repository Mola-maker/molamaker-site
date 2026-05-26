#!/usr/bin/env node
// PreToolUse hook: block writes to .env.local (contains secrets).
// Called before Edit or Write tool use. Reads tool input from TOOL_INPUT env var.

const input = (() => {
  try { return JSON.parse(process.env.TOOL_INPUT || '{}'); }
  catch { return {}; }
})();

const fp = input.file_path || '';

// Block .env.local but allow .env.local.example
if (fp.endsWith('.env.local') && !fp.endsWith('.env.local.example')) {
  console.error(
    'BLOCKED: .env.local contains secrets and must not be edited directly.\n' +
    'To add a new variable: edit .env.local.example instead, then set the real value manually.'
  );
  process.exit(2);
}
