#!/usr/bin/env node
// Verification gate for the autonomous-web-loop skill.
// Runs lint, typecheck, and tests; add --build to also run `next build`.
// Cross-platform (Node >= 22). Exits non-zero if any step fails.

import { spawnSync } from "node:child_process";

const runBuild = process.argv.includes("--build");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const steps = [
  { name: "lint", cmd: npmCmd, args: ["run", "lint"] },
  { name: "typecheck", cmd: npxCmd, args: ["tsc", "--noEmit"] },
  { name: "test", cmd: npmCmd, args: ["test"] },
];
if (runBuild) {
  steps.push({ name: "build", cmd: npmCmd, args: ["run", "build"] });
}

const results = [];
for (const step of steps) {
  process.stdout.write(`\n=== ${step.name} ===\n`);
  const r = spawnSync(step.cmd, step.args, { stdio: "inherit", shell: false });
  const ok = r.status === 0 && !r.error;
  results.push({ name: step.name, ok });
  if (r.error) {
    process.stdout.write(`\n[${step.name}] failed to start: ${r.error.message}\n`);
  }
}

process.stdout.write("\n=== verification summary ===\n");
let allOk = true;
for (const r of results) {
  process.stdout.write(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n`);
  if (!r.ok) allOk = false;
}

process.exit(allOk ? 0 : 1);
