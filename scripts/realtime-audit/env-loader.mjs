import fs from 'node:fs';
import path from 'node:path';

function normalizeValue(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const idx = trimmed.indexOf('=');
  if (idx <= 0) return null;

  const key = trimmed.slice(0, idx).trim();
  if (!key || key.startsWith('#')) return null;

  const value = normalizeValue(trimmed.slice(idx + 1));
  return { key, value };
}

export function loadEnvFiles(repoRoot, files = ['.env', '.env.local']) {
  for (const relativePath of files) {
    const absPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (Object.prototype.hasOwnProperty.call(process.env, parsed.key)) continue;
      process.env[parsed.key] = parsed.value;
    }
  }
}
