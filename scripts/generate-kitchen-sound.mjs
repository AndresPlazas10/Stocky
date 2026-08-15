// Genera apps/mobile/assets/sounds/kitchen.wav
// Patrón idéntico al beep web (notificationSound.ts):
// campana "ding-dong" — 3 pares de golpes (C6 → E5) con parciales inharmónicos
// y decaimiento exponencial, ~5.4s.
// Uso: node scripts/generate-kitchen-sound.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SAMPLE_RATE = 22050;

const BELL_PARTIALS = [
  { ratio: 1, amp: 1 },
  { ratio: 2.0, amp: 0.45 },
  { ratio: 2.76, amp: 0.25 },
  { ratio: 3.74, amp: 0.15 },
];

const DING_FREQ = 1046.5;
const DONG_FREQ = 659.25;
const DING_DURATION = 1.3;
const DONG_DURATION = 1.5;
const PAIR_GAP = 1.7;
const DING_DONG_GAP = 0.5;
const VOLUME = 0.5;
const PAIRS = 3;

const lastStrikeStart = (PAIRS - 1) * PAIR_GAP + DING_DONG_GAP;
const totalSeconds = lastStrikeStart + DONG_DURATION + 0.3;
const totalSamples = Math.floor(totalSeconds * SAMPLE_RATE);

const samples = new Float64Array(totalSamples);

function strike(frequency, startAt, duration) {
  const startSample = Math.floor(startAt * SAMPLE_RATE);
  const durationSamples = Math.floor(duration * SAMPLE_RATE);

  BELL_PARTIALS.forEach((partial) => {
    const partialFreq = frequency * partial.ratio;
    const amp = VOLUME * partial.amp;
    let phase = 0;
    for (let s = 0; s < durationSamples; s += 1) {
      const idx = startSample + s;
      if (idx >= totalSamples) break;
      const t = s / SAMPLE_RATE;
      phase += partialFreq / SAMPLE_RATE;
      let attack = t / 0.006;
      if (attack > 1) attack = 1;
      const decay = Math.exp((-t * Math.LN2) / (duration * 0.25));
      samples[idx] += amp * attack * decay * Math.sin(2 * Math.PI * phase);
    }
  });
}

for (let pair = 0; pair < PAIRS; pair += 1) {
  strike(DING_FREQ, pair * PAIR_GAP, DING_DURATION);
  strike(DONG_FREQ, pair * PAIR_GAP + DING_DONG_GAP, DONG_DURATION);
}

const pcm = Buffer.alloc(totalSamples * 2);
for (let i = 0; i < totalSamples; i += 1) {
  let value = samples[i];
  if (value > 1) value = 1;
  if (value < -1) value = -1;
  pcm.writeInt16LE(Math.round(value * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'apps', 'mobile', 'assets', 'sounds', 'kitchen.wav');
writeFileSync(outputPath, Buffer.concat([header, pcm]));

console.log(`kitchen.wav generado: ${outputPath} (${totalSeconds.toFixed(2)}s, ${(pcm.length / 1024).toFixed(0)} KB)`);
