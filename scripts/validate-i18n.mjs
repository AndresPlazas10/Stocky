import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'packages', 'shared', 'src', 'locales');

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`ERROR: Invalid JSON in ${filePath}`);
    console.error(`  ${err.message}`);
    return null;
  }
}

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function deepCompareKeys(enKeys, esKeys, lang, file) {
  const enSet = new Set(enKeys);
  const esSet = new Set(esKeys);
  const missingInEs = [...enSet].filter((k) => !esSet.has(k));
  const missingInEn = [...esSet].filter((k) => !enSet.has(k));
  let errors = 0;

  for (const key of missingInEs) {
    console.error(`ERROR: Key "${key}" exists in en/${file} but is MISSING in es/${file}`);
    errors++;
  }
  for (const key of missingInEn) {
    console.error(`ERROR: Key "${key}" exists in es/${file} but is MISSING in en/${file}`);
    errors++;
  }
  return errors;
}

function validateNamespace(namespace) {
  const enFile = join(localesDir, 'en', `${namespace}.json`);
  const esFile = join(localesDir, 'es', `${namespace}.json`);

  const enData = loadJson(enFile);
  const esData = loadJson(esFile);
  if (!enData || !esData) return 1;

  const enKeys = getAllKeys(enData);
  const esKeys = getAllKeys(esData);

  const errors = deepCompareKeys(enKeys, esKeys, 'es', `${namespace}.json`);
  if (errors === 0) {
    console.log(`OK: en/${namespace}.json ↔ es/${namespace}.json (${enKeys.length} keys)`);
  }
  return errors;
}

const namespaces = ['common', 'ventas', 'compras', 'facturas', 'mesas', 'reports'];

const langs = ['en', 'es'];
for (const lang of langs) {
  const langDir = join(localesDir, lang);
  if (!readdirSync(langDir)) {
    console.error(`ERROR: Language directory ${langDir} is empty or missing`);
    process.exit(1);
  }
}

let totalErrors = 0;
for (const ns of namespaces) {
  totalErrors += validateNamespace(ns);
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} i18n key mismatch(es) found. Fix them before committing.`);
  process.exit(1);
} else {
  console.log(`\nAll ${namespaces.length} namespaces are synchronized between en ↔ es.`);
}
