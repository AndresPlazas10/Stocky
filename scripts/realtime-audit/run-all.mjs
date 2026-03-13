#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function runNode(scriptRelativePath, args = []) {
  const scriptPath = path.join(repoRoot, scriptRelativePath);
  const run = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  return {
    script: scriptRelativePath,
    status: run.status ?? 1,
  };
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const skipDb = hasFlag('--skip-db');
const skipSmoke = hasFlag('--skip-smoke');

const results = [];

results.push(runNode('scripts/realtime-audit/generate-realtime-map.mjs'));
if (!skipDb) {
  results.push(runNode('scripts/realtime-audit/run-db-contract-check.mjs'));
}
if (!skipSmoke) {
  results.push(runNode('scripts/realtime-audit/run-realtime-smoke.mjs'));
}
results.push(runNode('scripts/realtime-audit/build-audit-report.mjs'));

const failed = results.filter((row) => row.status !== 0);
if (failed.length > 0) {
  process.exitCode = 2;
}
