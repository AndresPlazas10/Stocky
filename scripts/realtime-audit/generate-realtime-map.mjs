#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const SCAN_ROOTS = ['src', path.join('apps', 'mobile', 'src')];
const VALID_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.cache', 'coverage', 'build']);

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

function walkFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;

    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
        stack.push(path.join(current, entry.name));
      }
      continue;
    }

    const ext = path.extname(current);
    if (VALID_EXTENSIONS.has(ext)) files.push(current);
  }

  return files;
}

function normalizeRelPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function inferPlatform(filePath) {
  return filePath.includes('/apps/mobile/') ? 'mobile' : 'web';
}

function inferDomain(filePath) {
  const p = filePath.toLowerCase();
  if (p.includes('mesas')) return 'mesas';
  if (p.includes('ventas') || p.includes('sales')) return 'ventas';
  if (p.includes('compras') || p.includes('purchases')) return 'compras';
  if (p.includes('inventario') || p.includes('inventory')) return 'inventario';
  if (p.includes('combos')) return 'combos';
  if (p.includes('proveedores') || p.includes('suppliers')) return 'proveedores';
  if (p.includes('empleados') || p.includes('employees')) return 'empleados';
  if (p.includes('reportes') || p.includes('reports')) return 'reportes';
  if (p.includes('configuracion') || p.includes('settings')) return 'configuracion';
  if (p.includes('notification') || p.includes('navbar')) return 'notificaciones';
  if (p.includes('auth')) return 'auth';
  return 'general';
}

function inferExpectedRoles(filePath) {
  const p = filePath.toLowerCase();
  if (p.includes('empleados') || p.includes('employees')) return ['owner', 'admin'];
  if (p.includes('configuracion') || p.includes('settings')) return ['owner', 'admin'];
  return ['owner', 'admin', 'employee'];
}

function extractCallExpression(content, callName, startIdx) {
  const callStart = content.indexOf(`${callName}(`, startIdx);
  if (callStart === -1) return null;

  let idx = callStart + callName.length;
  if (content[idx] !== '(') return null;

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (; idx < content.length; idx += 1) {
    const ch = content[idx];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return {
          start: callStart,
          end: idx + 1,
          text: content.slice(callStart, idx + 1),
        };
      }
    }
  }

  return null;
}

function parseFilterFromCall(callText) {
  const filterMatch = callText.match(/filter\s*:\s*([^,}\n]+)/);
  if (!filterMatch) return null;
  return String(filterMatch[1] || '').trim();
}

function parseEventsFromCall(callText, mode = 'hook') {
  const events = [];
  if (mode === 'hook') {
    if (/onInsert\s*:/.test(callText)) events.push('INSERT');
    if (/onUpdate\s*:/.test(callText)) events.push('UPDATE');
    if (/onDelete\s*:/.test(callText)) events.push('DELETE');
  } else {
    const eventMatch = callText.match(/event\s*:\s*['"`]([^'"`]+)['"`]/);
    const rawEvent = String(eventMatch?.[1] || '*').toUpperCase();
    if (rawEvent === '*') return ['INSERT', 'UPDATE', 'DELETE'];
    events.push(rawEvent);
  }
  return events;
}

function detectFallbackModes(content, platform) {
  const fallback = [];

  if (/setInterval\s*\(/.test(content)) fallback.push('polling:setInterval');
  if (/useFocusEffect\s*\(/.test(content)) fallback.push('refresh:onFocus');
  if (/onReconnect\s*:/.test(content)) fallback.push('reconnect:onReconnect');
  if (/refresh[A-Za-z0-9_]*\s*\(/.test(content)) fallback.push('manualRefresh:handler');

  if (platform === 'mobile' && fallback.length === 0) {
    if (/load[A-Za-z0-9_]*\s*\(/.test(content) && /useEffect\s*\(/.test(content)) {
      fallback.push('refresh:effectReload');
    }
  }

  return Array.from(new Set(fallback));
}

function extractRealtimeChannels(filePath, content) {
  const relPath = normalizeRelPath(filePath);
  const platform = inferPlatform(relPath);
  const domain = inferDomain(relPath);
  const fallbackModes = detectFallbackModes(content, platform);
  const expectedRoles = inferExpectedRoles(relPath);
  const channels = [];

  let idx = 0;
  while (idx < content.length) {
    const call = extractCallExpression(content, 'useRealtimeSubscription', idx);
    if (!call) break;
    idx = call.end;

    const tableMatch = call.text.match(/useRealtimeSubscription\(\s*['"`]([^'"`]+)['"`]/);
    const table = String(tableMatch?.[1] || '').trim();

    channels.push({
      kind: 'hook',
      source: 'useRealtimeSubscription',
      table: table || null,
      events: parseEventsFromCall(call.text, 'hook'),
      filter: parseFilterFromCall(call.text),
      consumer: relPath,
      domain,
      platform,
      expected_roles: expectedRoles,
      fallback_modes: fallbackModes,
      transport: 'supabase_realtime',
    });
  }

  idx = 0;
  while (idx < content.length) {
    const call = extractCallExpression(content, 'subscribeToPostgresChanges', idx);
    if (!call) break;
    idx = call.end;

    const tableMatch = call.text.match(/table\s*:\s*['"`]([^'"`]+)['"`]/);
    const table = String(tableMatch?.[1] || '').trim();

    channels.push({
      kind: 'direct',
      source: 'subscribeToPostgresChanges',
      table: table || null,
      events: parseEventsFromCall(call.text, 'direct'),
      filter: parseFilterFromCall(call.text),
      consumer: relPath,
      domain,
      platform,
      expected_roles: expectedRoles,
      fallback_modes: fallbackModes,
      transport: 'supabase_realtime',
    });
  }

  idx = 0;
  while (idx < content.length) {
    const call = extractCallExpression(content, 'channel', idx);
    if (!call) break;
    idx = call.end;

    channels.push({
      kind: 'direct',
      source: 'supabase.channel',
      table: null,
      events: ['UNKNOWN'],
      filter: null,
      consumer: relPath,
      domain,
      platform,
      expected_roles: expectedRoles,
      fallback_modes: fallbackModes,
      transport: 'supabase_realtime',
    });
  }

  return channels;
}

function extractMobileNonRealtimeModules(filePath, content) {
  const relPath = normalizeRelPath(filePath);
  if (!relPath.startsWith('apps/mobile/src/')) return null;
  if (relPath.startsWith('apps/mobile/src/services/')) return null;

  const hasRealtimeChannel = /useRealtimeSubscription\s*\(|subscribeToPostgresChanges\s*\(|\.channel\s*\(/.test(content);
  if (hasRealtimeChannel) return null;

  const hasPolling = /setInterval\s*\(/.test(content);
  const hasFocusRefresh = /useFocusEffect\s*\(/.test(content);
  const hasManualRefresh = /refresh[A-Za-z0-9_]*\s*\(/.test(content);

  if (!hasPolling && !hasFocusRefresh && !hasManualRefresh) return null;

  const fallback_modes = [];
  if (hasPolling) fallback_modes.push('polling:setInterval');
  if (hasFocusRefresh) fallback_modes.push('refresh:onFocus');
  if (hasManualRefresh) fallback_modes.push('manualRefresh:handler');

  return {
    module: relPath,
    domain: inferDomain(relPath),
    platform: 'mobile',
    sync_model: 'fallback_only',
    fallback_modes,
    reason: 'No usa canal realtime directo; sincroniza por polling/refresh.',
    classification_hint: 'sincronizacion_lenta_por_polling',
    expected_roles: inferExpectedRoles(relPath),
  };
}

function collectSourceFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    const abs = path.join(repoRoot, root);
    files.push(...walkFiles(abs));
  }
  return files;
}

function uniqueByKey(items, keyBuilder) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyBuilder(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function summarize(channels, mobileFallback) {
  const byTable = {};
  channels.forEach((channel) => {
    const key = channel.table || 'unknown';
    if (!byTable[key]) byTable[key] = { table: key, total: 0, consumers: new Set(), events: new Set() };
    byTable[key].total += 1;
    byTable[key].consumers.add(channel.consumer);
    (channel.events || []).forEach((evt) => byTable[key].events.add(evt));
  });

  const tableSummary = Object.values(byTable).map((row) => ({
    table: row.table,
    total_channels: row.total,
    consumers: Array.from(row.consumers).sort(),
    events: Array.from(row.events).sort(),
  })).sort((a, b) => a.table.localeCompare(b.table));

  return {
    total_channels: channels.length,
    total_mobile_fallback_modules: mobileFallback.length,
    web_channels: channels.filter((channel) => channel.platform === 'web').length,
    mobile_channels: channels.filter((channel) => channel.platform === 'mobile').length,
    tables_covered: tableSummary.length,
    by_table: tableSummary,
  };
}

function main() {
  const outArg = parseArg('--out', path.join('testing', 'realtime', 'results', 'realtime-map.json'));
  const outputPath = path.isAbsolute(outArg) ? outArg : path.join(repoRoot, outArg);

  const files = collectSourceFiles();
  const channels = [];
  const mobileFallbackModules = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    channels.push(...extractRealtimeChannels(filePath, content));

    const fallbackEntry = extractMobileNonRealtimeModules(filePath, content);
    if (fallbackEntry) mobileFallbackModules.push(fallbackEntry);
  }

  const dedupChannels = uniqueByKey(channels, (item) => {
    const events = Array.isArray(item.events) ? item.events.join('|') : '';
    return [item.consumer, item.source, item.table || '', events, item.filter || ''].join('::');
  }).sort((a, b) => {
    const tableA = a.table || 'zzz';
    const tableB = b.table || 'zzz';
    if (tableA !== tableB) return tableA.localeCompare(tableB);
    return a.consumer.localeCompare(b.consumer);
  });

  const dedupMobileFallback = uniqueByKey(mobileFallbackModules, (item) => item.module)
    .sort((a, b) => a.module.localeCompare(b.module));

  const payload = {
    generated_at: new Date().toISOString(),
    scope: 'web+mobile',
    description: 'Mapa automatico de suscripciones realtime y modulos mobile con sincronizacion por fallback.',
    summary: summarize(dedupChannels, dedupMobileFallback),
    channels: dedupChannels,
    mobile_non_realtime_modules: dedupMobileFallback,
  };

  ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(`Realtime map generated: ${normalizeRelPath(outputPath)}\n`);
}

main();
