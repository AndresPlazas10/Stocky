#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function avg(values) {
  if (!values.length) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function parseCsv(content) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function formatMs(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Number(value).toFixed(1)}ms`;
}

function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const result = String(row.resultado || '').toLowerCase();
    const ms = Number(row.run_ms || 0);
    if (result !== 'ok' || !Number.isFinite(ms) || ms <= 0) continue;

    const key = `${row.plataforma}|${row.flujo}|${row.escenario}`;
    if (!groups.has(key)) {
      groups.set(key, {
        plataforma: row.plataforma,
        flujo: row.flujo,
        escenario: row.escenario,
        runs: [],
      });
    }
    groups.get(key).runs.push(ms);
  }

  return Array.from(groups.values())
    .map((g) => ({
      plataforma: g.plataforma,
      flujo: g.flujo,
      escenario: g.escenario,
      samples: g.runs.length,
      avg_ms: avg(g.runs),
      p50_ms: percentile(g.runs, 50),
      p95_ms: percentile(g.runs, 95),
      p99_ms: percentile(g.runs, 99),
    }))
    .sort((a, b) => Number(b.p95_ms || 0) - Number(a.p95_ms || 0));
}

function buildMarkdown(summary) {
  const lines = [];
  lines.push('# Baseline CSV Summary');
  lines.push('');
  lines.push('| Plataforma | Flujo | Escenario | Samples | Avg | p50 | p95 | p99 |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|');
  for (const row of summary) {
    lines.push(
      `| ${row.plataforma} | ${row.flujo} | ${row.escenario} | ${row.samples} | ${formatMs(row.avg_ms)} | ${formatMs(row.p50_ms)} | ${formatMs(row.p95_ms)} | ${formatMs(row.p99_ms)} |`,
    );
  }
  if (!summary.length) {
    lines.push('| - | - | - | 0 | - | - | - | - |');
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const repoRoot = process.cwd();
  const inputPath = parseArg('--in', 'docs/perf/BASELINE_CAPTURE_TEMPLATE.csv');
  const outJsonPath = parseArg('--out-json', 'testing/perf/perf-manual-summary.json');
  const outMdPath = parseArg('--out-md', 'docs/perf/PERF_MANUAL_SUMMARY.md');

  const absoluteInput = path.resolve(repoRoot, inputPath);
  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`No existe archivo de entrada: ${absoluteInput}`);
  }

  const csv = fs.readFileSync(absoluteInput, 'utf8');
  const rows = parseCsv(csv);
  const summary = summarize(rows);
  const markdown = buildMarkdown(summary);

  const absoluteJson = path.resolve(repoRoot, outJsonPath);
  const absoluteMd = path.resolve(repoRoot, outMdPath);
  fs.mkdirSync(path.dirname(absoluteJson), { recursive: true });
  fs.mkdirSync(path.dirname(absoluteMd), { recursive: true });

  fs.writeFileSync(absoluteJson, JSON.stringify({ generated_at: new Date().toISOString(), summary }, null, 2));
  fs.writeFileSync(absoluteMd, markdown);

  // eslint-disable-next-line no-console
  console.log(`Manual summary JSON: ${absoluteJson}`);
  // eslint-disable-next-line no-console
  console.log(`Manual summary MD:   ${absoluteMd}`);
}

main();
