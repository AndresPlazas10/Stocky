#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnvFiles } from './env-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
loadEnvFiles(repoRoot);

function parseArg(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function normalizePath(input) {
  if (path.isAbsolute(input)) return input;
  return path.join(repoRoot, input);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeConnectionString(connectionString) {
  const raw = String(connectionString || '').trim();
  if (!raw) return raw;

  try {
    const url = new URL(raw);
    // Parametro usado en SDK/app, pero no reconocido por psql.
    if (url.searchParams.has('pgbouncer')) {
      url.searchParams.delete('pgbouncer');
    }
    return url.toString();
  } catch {
    // Si no es URI parseable, devolver original.
    return raw;
  }
}

function resolvePsqlBinary() {
  const candidates = [
    process.env.PSQL_BIN,
    'psql',
    '/opt/homebrew/opt/libpq/bin/psql',
    '/usr/local/opt/libpq/bin/psql',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (!check.error && check.status === 0) {
      return candidate;
    }
  }

  return null;
}

function evaluateSnapshot(snapshot) {
  const checks = [];
  const requiredTables = asArray(snapshot.required_tables);
  const missingTables = requiredTables.filter((row) => !row?.in_publication).map((row) => row?.tablename).filter(Boolean);

  checks.push({
    id: 'publication_exists',
    description: 'La publicacion supabase_realtime existe',
    status: snapshot.publication_exists ? 'PASS' : 'FAIL',
    severity: 'critical',
    details: snapshot.publication_exists
      ? 'supabase_realtime encontrada'
      : 'No existe la publicacion supabase_realtime',
  });

  checks.push({
    id: 'required_tables_in_publication',
    description: 'Todas las tablas criticas estan en la publicacion realtime',
    status: missingTables.length === 0 ? 'PASS' : 'FAIL',
    severity: 'critical',
    details: missingTables.length === 0
      ? 'Todas las tablas requeridas estan publicadas'
      : `Tablas faltantes: ${missingTables.join(', ')}`,
    meta: {
      missing_tables: missingTables,
      checked_tables: requiredTables.map((row) => row?.tablename).filter(Boolean),
    },
  });

  checks.push({
    id: 'can_access_business_function',
    description: 'Existe la funcion public.can_access_business',
    status: snapshot.can_access_business_exists ? 'PASS' : 'FAIL',
    severity: 'critical',
    details: snapshot.can_access_business_exists
      ? 'Funcion encontrada'
      : 'Funcion no encontrada',
  });

  const rlsRows = asArray(snapshot.rls);
  const rlsFailures = rlsRows.filter((row) => row?.rls_enabled !== true).map((row) => row?.table_name).filter(Boolean);
  const expectedRlsTables = ['order_items', 'sale_details'];
  const missingRlsRows = expectedRlsTables.filter((table) => !rlsRows.some((row) => row?.table_name === table));

  checks.push({
    id: 'rls_relational_tables',
    description: 'RLS habilitado para tablas relacionales de realtime',
    status: (rlsFailures.length === 0 && missingRlsRows.length === 0) ? 'PASS' : 'FAIL',
    severity: 'critical',
    details: (rlsFailures.length === 0 && missingRlsRows.length === 0)
      ? 'RLS habilitado en order_items y sale_details'
      : `Problemas RLS -> deshabilitado: [${rlsFailures.join(', ')}], faltantes: [${missingRlsRows.join(', ')}]`,
  });

  const policies = asArray(snapshot.policies);
  const relationalPolicyTargets = ['order_items', 'sale_details'];
  const missingRelationalPolicy = relationalPolicyTargets.filter((table) => !policies.some((policy) => policy?.tablename === table));

  checks.push({
    id: 'relational_policies_present',
    description: 'Existen politicas activas para order_items y sale_details',
    status: missingRelationalPolicy.length === 0 ? 'PASS' : 'FAIL',
    severity: 'high',
    details: missingRelationalPolicy.length === 0
      ? 'Politicas presentes para tablas relacionales'
      : `Faltan politicas en: ${missingRelationalPolicy.join(', ')}`,
  });

  const replicaRows = asArray(snapshot.replica_identity);
  const replicaFailures = replicaRows.filter((row) => String(row?.replica_identity || '').toUpperCase() !== 'FULL')
    .map((row) => row?.table_name)
    .filter(Boolean);
  const missingReplicaRows = ['order_items', 'sale_details'].filter(
    (table) => !replicaRows.some((row) => row?.table_name === table),
  );

  checks.push({
    id: 'replica_identity_full',
    description: 'Replica identity FULL en tablas relacionales de realtime',
    status: (replicaFailures.length === 0 && missingReplicaRows.length === 0) ? 'PASS' : 'FAIL',
    severity: 'high',
    details: (replicaFailures.length === 0 && missingReplicaRows.length === 0)
      ? 'Replica identity FULL validado en order_items y sale_details'
      : `Replica identity no FULL: [${replicaFailures.join(', ')}], faltantes: [${missingReplicaRows.join(', ')}]`,
  });

  return checks;
}

function main() {
  const sqlArg = parseArg('--sql', path.join('testing', 'realtime', 'sql', 'db_contract_snapshot.sql'));
  const outArg = parseArg('--out', path.join('testing', 'realtime', 'results', 'realtime-db-check.json'));
  const connectionArg = parseArg('--connection', null);

  const sqlPath = normalizePath(sqlArg);
  const outputPath = normalizePath(outArg);
  const connectionString = connectionArg
    || process.env.SUPABASE_DB_URL
    || process.env.DATABASE_URL
    || process.env.PGDATABASE_URL
    || '';
  const sanitizedConnectionString = sanitizeConnectionString(connectionString);

  if (!sanitizedConnectionString) {
    process.stderr.write('Missing DB connection string. Set SUPABASE_DB_URL or DATABASE_URL.\n');
    process.exit(1);
  }

  const psqlBin = resolvePsqlBinary();
  if (!psqlBin) {
    process.stderr.write('psql is required to run DB realtime checks. Install PostgreSQL client tools.\n');
    process.exit(1);
  }

  const run = spawnSync(
    psqlBin,
    [sanitizedConnectionString, '-X', '-A', '-t', '-q', '-f', sqlPath],
    { encoding: 'utf8' },
  );

  if (run.status !== 0) {
    process.stderr.write(run.stderr || 'Unknown psql error while running realtime DB check.\n');
    process.exit(run.status || 1);
  }

  const rawOutput = String(run.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  let snapshot = null;
  try {
    snapshot = JSON.parse(rawOutput);
  } catch {
    process.stderr.write('Could not parse SQL output as JSON snapshot.\n');
    process.stderr.write(`${rawOutput}\n`);
    process.exit(1);
  }

  const checks = evaluateSnapshot(snapshot);
  const failed = checks.filter((check) => check.status === 'FAIL');

  const report = {
    generated_at: new Date().toISOString(),
    status: failed.length === 0 ? 'PASS' : 'FAIL',
    checks,
    failed_count: failed.length,
    total_checks: checks.length,
    snapshot,
  };

  ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`Realtime DB report generated: ${path.relative(repoRoot, outputPath)}\n`);
  process.stdout.write(`Status: ${report.status} | Failed checks: ${failed.length}/${checks.length}\n`);

  if (failed.length > 0) {
    process.exitCode = 2;
  }
}

main();
