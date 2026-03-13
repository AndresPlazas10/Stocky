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

function resolveRepoPath(input) {
  if (path.isAbsolute(input)) return input;
  return path.join(repoRoot, input);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function severityRank(value) {
  if (value === 'critical') return 0;
  if (value === 'high') return 1;
  if (value === 'medium') return 2;
  if (value === 'low') return 3;
  return 4;
}

function classifyDbFailures(dbReport) {
  if (!dbReport) return [];

  const failedChecks = (dbReport.checks || []).filter((check) => check.status === 'FAIL');
  return failedChecks.map((check) => {
    let type = 'filtro/config_roto';
    let severity = 'high';

    if (check.id === 'publication_exists' || check.id === 'required_tables_in_publication') {
      type = 'filtro/config_roto';
      severity = 'critical';
    } else if (check.id === 'rls_relational_tables' || check.id === 'can_access_business_function') {
      type = 'realtime_roto';
      severity = 'critical';
    } else if (check.id === 'replica_identity_full') {
      type = 'filtro/config_roto';
      severity = 'high';
    }

    return {
      source: 'db_check',
      type,
      severity,
      table: null,
      message: check.details || check.description,
      check_id: check.id,
    };
  });
}

function classifyMapRisks(mapReport) {
  if (!mapReport) return [];

  const findings = [];
  const channels = Array.isArray(mapReport.channels) ? mapReport.channels : [];
  const mobileFallback = Array.isArray(mapReport.mobile_non_realtime_modules)
    ? mapReport.mobile_non_realtime_modules
    : [];

  const tableCoverage = new Set(channels.map((entry) => entry.table).filter(Boolean));
  const criticalTables = ['tables', 'orders', 'order_items', 'sales', 'purchases', 'products', 'employees', 'combos', 'sale_details'];
  const derivedCoverageRules = {
    sale_details: ['sales'],
    order_items: ['orders'],
  };

  criticalTables.forEach((table) => {
    if (tableCoverage.has(table)) return;

    const derivedBy = (derivedCoverageRules[table] || []).filter((parentTable) => tableCoverage.has(parentTable));
    if (derivedBy.length > 0) {
      return;
    }

    if (!tableCoverage.has(table)) {
      findings.push({
        source: 'map_scan',
        type: 'filtro/config_roto',
        severity: 'high',
        table,
        message: `No se detectaron consumidores realtime para la tabla critica ${table}.`,
      });
    }
  });

  mobileFallback.forEach((entry) => {
    findings.push({
      source: 'map_scan',
      type: 'sincronizacion_lenta_por_polling',
      severity: 'low',
      table: null,
      message: `${entry.module} usa sincronizacion fallback (${(entry.fallback_modes || []).join(', ')}).`,
    });
  });

  return findings;
}

function buildReleaseGate({ dbReport, smokeReport }) {
  const gates = [
    {
      id: 'db_contract_pass',
      label: 'DB contract realtime',
      status: dbReport?.status === 'PASS' ? 'PASS' : 'FAIL',
      severity: 'critical',
    },
    {
      id: 'smoke_multiclient_pass',
      label: 'Smoke multi-cliente',
      status: smokeReport?.status === 'PASS' ? 'PASS' : 'FAIL',
      severity: 'critical',
    },
  ];

  const failed = gates.filter((gate) => gate.status === 'FAIL');
  return {
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    gates,
  };
}

function main() {
  const mapPath = resolveRepoPath(parseArg('--map', path.join('testing', 'realtime', 'results', 'realtime-map.json')));
  const dbPath = resolveRepoPath(parseArg('--db', path.join('testing', 'realtime', 'results', 'realtime-db-check.json')));
  const smokePath = resolveRepoPath(parseArg('--smoke', path.join('testing', 'realtime', 'results', 'realtime-smoke-report.json')));
  const outPath = resolveRepoPath(parseArg('--out', path.join('testing', 'realtime', 'results', 'realtime-audit-report.json')));

  const mapReport = readJson(mapPath);
  const dbReport = readJson(dbPath);
  const smokeReport = readJson(smokePath);

  const findings = [
    ...classifyDbFailures(dbReport),
    ...classifyMapRisks(mapReport),
    ...((smokeReport?.findings || []).map((entry) => ({
      source: 'smoke',
      type: entry.type || 'realtime_roto',
      severity: entry.severity || 'high',
      table: entry.table || null,
      message: entry.message,
      evidence: entry.evidence || null,
    }))),
  ].sort((a, b) => {
    const severityCmp = severityRank(a.severity) - severityRank(b.severity);
    if (severityCmp !== 0) return severityCmp;
    return String(a.message || '').localeCompare(String(b.message || ''));
  });

  const releaseGate = buildReleaseGate({ dbReport, smokeReport });

  const report = {
    generated_at: new Date().toISOString(),
    scope: 'web+mobile+supabase',
    artifacts: {
      realtime_map: path.relative(repoRoot, mapPath),
      realtime_db_check: path.relative(repoRoot, dbPath),
      realtime_smoke_report: path.relative(repoRoot, smokePath),
    },
    statuses: {
      map_scan: mapReport ? 'PASS' : 'MISSING',
      db_check: dbReport?.status || 'MISSING',
      smoke: smokeReport?.status || 'MISSING',
    },
    release_gate: releaseGate,
    findings,
  };

  ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`Realtime final report generated: ${path.relative(repoRoot, outPath)}\n`);
  process.stdout.write(`Release gate: ${releaseGate.status} | Findings: ${findings.length}\n`);

  if (releaseGate.status === 'FAIL') {
    process.exitCode = 2;
  }
}

main();
