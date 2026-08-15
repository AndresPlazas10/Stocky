let audioContextRef: AudioContext | null = null;
let masterGainRef: GainNode | null = null;
let compressorRef: DynamicsCompressorNode | null = null;
let unlockListenersAttached = false;
const activeOscillators = new Set<OscillatorNode>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContextRef) {
    audioContextRef = new Ctor();

    compressorRef = audioContextRef.createDynamicsCompressor();
    compressorRef.threshold.value = -18;
    compressorRef.knee.value = 20;
    compressorRef.ratio.value = 6;
    compressorRef.attack.value = 0.003;
    compressorRef.release.value = 0.25;

    masterGainRef = audioContextRef.createGain();
    masterGainRef.gain.value = 0.7;

    compressorRef.connect(masterGainRef);
    masterGainRef.connect(audioContextRef.destination);
  }
  return audioContextRef;
}

function resumeAudioContext(): void {
  if (!audioContextRef) return;
  if (audioContextRef.state === 'suspended') {
    void audioContextRef.resume().catch(() => {});
  }
}

function attachGestureUnlock(): void {
  if (typeof window === 'undefined' || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    getAudioContext();
    resumeAudioContext();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

// Síntesis de campana: fundamental + parciales inharmónicos con decaimiento exponencial.
const BELL_PARTIALS = [
  { ratio: 1, amp: 1 },
  { ratio: 2.0, amp: 0.45 },
  { ratio: 2.76, amp: 0.25 },
  { ratio: 3.74, amp: 0.15 },
];

function playBellStrike(
  ctx: AudioContext,
  { frequency, startAt, volume, duration }: { frequency: number; startAt: number; volume: number; duration: number },
) {
  if (!compressorRef) return;
  BELL_PARTIALS.forEach((partial) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * partial.ratio;
    const start = ctx.currentTime + startAt;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * partial.amp, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(compressorRef);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
    activeOscillators.add(oscillator);
    oscillator.onended = () => {
      activeOscillators.delete(oscillator);
    };
  });
}

// Corta cualquier alarma en curso (para reiniciar al llegar otro pedido).
function stopActiveAlarm(): void {
  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Ya detenido
    }
  });
  activeOscillators.clear();
}

// Patrón de alarma: campana "ding-dong" (3 pares, ~5.4s en total).
// ding: C6 (1046.5 Hz) · dong: E5 (659.25 Hz)
const ALARM_STRIKES: Array<{ frequency: number; startAt: number; volume: number; duration: number }> = [];

function buildAlarmPattern() {
  const dingFreq = 1046.5;
  const dongFreq = 659.25;
  const dingDuration = 1.3;
  const dongDuration = 1.5;
  const pairGap = 1.7;
  const dingDongGap = 0.5;
  const volume = 0.5;

  for (let pair = 0; pair < 3; pair += 1) {
    ALARM_STRIKES.push({
      frequency: dingFreq,
      startAt: pair * pairGap,
      volume,
      duration: dingDuration,
    });
    ALARM_STRIKES.push({
      frequency: dongFreq,
      startAt: pair * pairGap + dingDongGap,
      volume,
      duration: dongDuration,
    });
  }
}

buildAlarmPattern();

export function playNewOrderBeep(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx || !compressorRef) return;

    attachGestureUnlock();
    resumeAudioContext();
    stopActiveAlarm();

    ALARM_STRIKES.forEach((strike) => playBellStrike(ctx, strike));
  } catch {
    // El sonido no es crítico: falla silenciosa
  }
}
