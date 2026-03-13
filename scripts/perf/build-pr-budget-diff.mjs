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

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildDiffRows({ budget, current }) {
  const budgetRules = Array.isArray(budget?.operations) ? budget.operations : [];
  const opMap = buildOpMap(current);
  const defaultRegressionPct = toNumber(budget?.default_max_regression_pct) ?? 20;

  return budgetRules.map((rule) => {
    const name = String(rule?.name || '').trim();
    const baselineP95 = toNumber(rule?.baseline_p95_ms);
    const currentOp = opMap.get(name);
    const currentP95 = toNumber(currentOp?.stats?.p95_ms);
    const opStatus = String(currentOp?.status || 'MISSING').toUpperCase();

    const maxRegressionPct = toNumber(rule?.max_regression_pct) ?? defaultRegressionPct;
    const computedMaxP95 = baselineP95 !== null
      ? baselineP95 * (1 + (maxRegressionPct / 100))
      : null;
    const maxP95 = toNumber(rule?.max_p95_ms) ?? computedMaxP95;
    const deltaPct = (baselineP95 && currentP95)
      ? ((currentP95 - baselineP95) / baselineP95) * 100
      : null;

    let gateStatus = 'PASS';
    if (opStatus !== 'PASS') {
      gateStatus = (opStatus === 'SKIPPED' && rule?.allow_skipped) ? 'SKIPPED' : 'FAIL';
    } else if (currentP95 === null || baselineP95 === null || maxP95 === null) {
      gateStatus = 'FAIL';
    } else if (currentP95 > maxP95) {
      gateStatus = 'FAIL';
    }

    return {
      name,
      operation_status: opStatus,
      baseline_p95_ms: baselineP95,
      current_p95_ms: currentP95,
      delta_pct: deltaPct,
      max_allowed_p95_ms: maxP95,
      gate_status: gateStatus,
    };
  });
}

function buildMarkdown({ budgetPath, currentPath, rows }) {
  const generatedAt = new Date().toISOString();
  const failedRows = rows.filter((row) => row.gate_status === 'FAIL');
  const skippedRows = rows.filter((row) => row.gate_status === 'SKIPPED');
  const passRows = rows.filter((row) => row.gate_status === 'PASS');
  const overallStatus = failedRows.length === 0 ? 'PASS' : 'FAIL';

  const lines = [];
  lines.push('## Performance p95 Diff');
  lines.push('');
  lines.push(`- Status: **${overallStatus}**`);
  lines.push(`- Baseline (before): \`${path.relative(repoRoot, budgetPath)}\``);
  lines.push(`- Current (after): \`${path.relative(repoRoot, currentPath)}\``);
  lines.push(`- Generated at: ${generatedAt}`);
  lines.push('');
  lines.push(`- Totals: ${passRows.length} pass, ${failedRows.length} fail, ${skippedRows.length} skipped`);
  lines.push('');
  lines.push('| Operation | Before p95 | After p95 | Delta | Max allowed | Gate |');
  lines.push('|---|---:|---:|---:|---:|---|');

  rows.forEach((row) => {
    lines.push(
      `| ${row.name} | ${formatMs(row.baseline_p95_ms)} | ${formatMs(row.current_p95_ms)} | ${formatPct(row.delta_pct)} | ${formatMs(row.max_allowed_p95_ms)} | ${row.gate_status} |`,
    );
  });
  lines.push('');

  if (failedRows.length > 0) {
    lines.push('### Failing Operations');
    lines.push('');
    failedRows.forEach((row) => {
      lines.push(
        `- ${row.name}: ${formatMs(row.current_p95_ms)} > ${formatMs(row.max_allowed_p95_ms)} (${formatPct(row.delta_pct)})`,
      );
    });
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const budgetArg = parseArg('--budget', path.join('testing', 'perf', 'perf-budget.json'));
  const currentArg = parseArg('--current', path.join('testing', 'perf', 'perf-current.json'));
  const outMdArg = parseArg('--out-md', path.join('testing', 'perf', 'perf-pr-diff.md'));
  const outJsonArg = parseArg('--out-json', path.join('testing', 'perf', 'perf-pr-diff.json'));

  const budgetPath = path.isAbsolute(budgetArg) ? budgetArg : path.join(repoRoot, budgetArg);
  const currentPath = path.isAbsolute(currentArg) ? currentArg : path.join(repoRoot, currentArg);
  const outMdPath = path.isAbsolute(outMdArg) ? outMdArg : path.join(repoRoot, outMdArg);
  const outJsonPath = path.isAbsolute(outJsonArg) ? outJsonArg : path.join(repoRoot, outJsonArg);

  const budget = loadJson(budgetPath, 'budget');
  const current = loadJson(currentPath, 'reporte actual');
  const rows = buildDiffRows({ budget, current });
  if (rows.length === 0) {
    throw new Error('No hay operaciones configuradas para generar diff.');
  }

  const markdown = buildMarkdown({
    budgetPath,
    currentPath,
    rows,
  });

  const payload = {
    generated_at: new Date().toISOString(),
    budget_path: path.relative(repoRoot, budgetPath),
    current_path: path.relative(repoRoot, currentPath),
    rows,
  };

  ensureDirSync(path.dirname(outMdPath));
  ensureDirSync(path.dirname(outJsonPath));
  fs.writeFileSync(outMdPath, markdown, 'utf8');
  fs.writeFileSync(outJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(`PR perf diff markdown: ${path.relative(repoRoot, outMdPath)}\n`);
  process.stdout.write(`PR perf diff json: ${path.relative(repoRoot, outJsonPath)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
}
