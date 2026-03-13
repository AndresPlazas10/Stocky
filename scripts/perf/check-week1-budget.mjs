#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatMs(value) {
  const n = toNumber(value);
  if (n === null) return '-';
  return `${n.toFixed(1)}ms`;
}

function formatPct(value) {
  const n = toNumber(value);
  if (n === null) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function loadJson(absPath, label) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`No existe ${label}: ${path.relative(repoRoot, absPath)}`);
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON invalido en ${label}: ${path.relative(repoRoot, absPath)} (${error.message})`);
  }
}

function buildOpMap(currentReport) {
  const rows = Array.isArray(currentReport?.operations) ? currentReport.operations : [];
  const map = new Map();
  for (const row of rows) {
    const name = String(row?.name || '').trim();
    if (!name) continue;
    map.set(name, row);
  }
  return map;
}

function main() {
  const budgetArg = parseArg('--budget', path.join('testing', 'perf', 'perf-budget.json'));
  const defaultCurrentPath = path.join('testing', 'perf', 'perf-current.json');
  const hasExplicitCurrent = process.argv.includes('--current');
  const currentArg = parseArg('--current', defaultCurrentPath);
  const failOnSlo = hasFlag('--fail-on-slo');

  const budgetPath = path.isAbsolute(budgetArg) ? budgetArg : path.join(repoRoot, budgetArg);
  let currentPath = path.isAbsolute(currentArg) ? currentArg : path.join(repoRoot, currentArg);
  if (!hasExplicitCurrent && !fs.existsSync(currentPath)) {
    currentPath = path.join(repoRoot, 'testing', 'perf', 'perf-baseline.json');
  }

  const budget = loadJson(budgetPath, 'budget');
  const current = loadJson(currentPath, 'reporte actual');
  const budgetRules = Array.isArray(budget?.operations) ? budget.operations : [];
  if (budgetRules.length === 0) {
    throw new Error('El budget no tiene operaciones configuradas.');
  }

  const opMap = buildOpMap(current);
  const rows = [];
  const failures = [];
  const warnings = [];

  const defaultRegressionPct = toNumber(budget?.default_max_regression_pct) ?? 20;
  const defaultSloP95 = toNumber(budget?.default_slo_p95_ms);

  for (const rule of budgetRules) {
    const name = String(rule?.name || '').trim();
    if (!name) continue;

    const allowSkipped = Boolean(rule?.allow_skipped);
    const op = opMap.get(name);
    const status = String(op?.status || 'MISSING').toUpperCase();

    if (!op || status !== 'PASS') {
      if ((status === 'SKIPPED' || status === 'MISSING') && allowSkipped) {
        warnings.push(`${name}: ${status} permitido por budget.`);
        rows.push({
          name,
          baselineP95: toNumber(rule?.baseline_p95_ms),
          currentP95: null,
          deltaPct: null,
          allowedP95: null,
          result: 'SKIPPED',
        });
        continue;
      }

      failures.push(`${name}: operacion ${status}.`);
      rows.push({
        name,
        baselineP95: toNumber(rule?.baseline_p95_ms),
        currentP95: null,
        deltaPct: null,
        allowedP95: null,
        result: 'FAIL',
      });
      continue;
    }

    const baselineP95 = toNumber(rule?.baseline_p95_ms);
    const currentP95 = toNumber(op?.stats?.p95_ms);
    if (baselineP95 === null || baselineP95 <= 0) {
      failures.push(`${name}: baseline_p95_ms invalido.`);
      rows.push({
        name,
        baselineP95,
        currentP95,
        deltaPct: null,
        allowedP95: null,
        result: 'FAIL',
      });
      continue;
    }
    if (currentP95 === null || currentP95 <= 0) {
      failures.push(`${name}: p95 actual invalido.`);
      rows.push({
        name,
        baselineP95,
        currentP95,
        deltaPct: null,
        allowedP95: null,
        result: 'FAIL',
      });
      continue;
    }

    const maxRegressionPct = toNumber(rule?.max_regression_pct) ?? defaultRegressionPct;
    const computedMaxP95 = baselineP95 * (1 + (maxRegressionPct / 100));
    const maxP95 = toNumber(rule?.max_p95_ms) ?? computedMaxP95;
    const deltaPct = ((currentP95 - baselineP95) / baselineP95) * 100;

    let result = currentP95 <= maxP95 ? 'PASS' : 'FAIL';
    if (result === 'FAIL') {
      failures.push(
        `${name}: p95 actual ${formatMs(currentP95)} supera limite ${formatMs(maxP95)} (${formatPct(deltaPct)}).`,
      );
    }

    const sloP95 = toNumber(rule?.slo_p95_ms) ?? defaultSloP95;
    if (sloP95 !== null && currentP95 > sloP95) {
      const message = `${name}: p95 actual ${formatMs(currentP95)} supera SLO ${formatMs(sloP95)}.`;
      if (failOnSlo) {
        failures.push(message);
        result = 'FAIL';
      } else {
        warnings.push(message);
      }
    }

    rows.push({
      name,
      baselineP95,
      currentP95,
      deltaPct,
      allowedP95: maxP95,
      result,
    });
  }

  const untrackedOps = (Array.isArray(current?.operations) ? current.operations : [])
    .map((op) => String(op?.name || '').trim())
    .filter(Boolean)
    .filter((name) => !budgetRules.some((rule) => String(rule?.name || '').trim() === name));

  for (const opName of untrackedOps) {
    warnings.push(`Operacion fuera de budget: ${opName}.`);
  }

  const lines = [];
  lines.push('# Performance Budget Gate - Week 1');
  lines.push('');
  lines.push(`- Budget: \`${path.relative(repoRoot, budgetPath)}\``);
  lines.push(`- Actual: \`${path.relative(repoRoot, currentPath)}\``);
  lines.push(`- Regresion maxima por defecto: ${defaultRegressionPct}%`);
  lines.push('');
  lines.push('| Operacion | Baseline p95 | Actual p95 | Delta | Max permitido | Estado |');
  lines.push('|---|---:|---:|---:|---:|---|');
  for (const row of rows) {
    lines.push(
      `| ${row.name} | ${formatMs(row.baselineP95)} | ${formatMs(row.currentP95)} | ${formatPct(row.deltaPct)} | ${formatMs(row.allowedP95)} | ${row.result} |`,
    );
  }
  lines.push('');

  if (warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  if (failures.length > 0) {
    lines.push('## FAIL');
    lines.push('');
    for (const failure of failures) lines.push(`- ${failure}`);
    lines.push('');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 2;
    return;
  }

  lines.push('## PASS');
  lines.push('');
  lines.push('- Sin regresiones por encima del presupuesto configurado.');
  lines.push('');
  process.stdout.write(`${lines.join('\n')}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
}
