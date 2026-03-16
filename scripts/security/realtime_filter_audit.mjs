import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIR = path.join(ROOT, 'src');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.vercel', '.cache']);

async function walk(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), results);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!EXTENSIONS.has(ext)) continue;
    results.push(path.join(dir, entry.name));
  }
  return results;
}

function findMissingBusinessFilter(lines) {
  const missing = [];
  const windowSize = 40;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('useRealtimeSubscription(')) continue;
    const windowText = lines.slice(i, i + windowSize).join('\n');
    if (!/business_id\s*[:=]/.test(windowText)) {
      missing.push(i + 1);
    }
  }
  return missing;
}

async function main() {
  const files = await walk(TARGET_DIR);
  const findings = [];

  for (const file of files) {
    if (file.endsWith(path.join('src', 'hooks', 'useRealtime.js'))) {
      continue;
    }
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    const missingLines = findMissingBusinessFilter(lines);
    if (missingLines.length > 0) {
      findings.push({ file, lines: missingLines });
    }
  }

  if (findings.length === 0) {
    console.log('OK: Todas las suscripciones useRealtimeSubscription contienen business_id.');
    return;
  }

  console.log('WARN: Se encontraron suscripciones sin business_id en el bloque cercano:' );
  for (const item of findings) {
    const relative = path.relative(ROOT, item.file);
    console.log(`- ${relative}: ${item.lines.join(', ')}`);
  }
  console.log('\nRecomendacion: revisar cada ocurrencia y asegurar filtro por business_id.');
}

main().catch((err) => {
  console.error('ERROR: No se pudo completar la auditoria de realtime.');
  console.error(err);
  process.exit(1);
});
