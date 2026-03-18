// ============================================
// THE UNDERGROWTH — Procedural Audio
// Web Audio API sound effects
// ============================================

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function initAudio() {
  try {
    getCtx();
  } catch {
    // Audio not supported
  }
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio errors
  }
}

export function sfxStep() {
  playTone(100 + Math.random() * 50, 0.05, 'square', 0.05);
}

export function sfxHit() {
  playTone(200, 0.1, 'sawtooth', 0.2);
  setTimeout(() => playTone(150, 0.1, 'square', 0.15), 30);
}

export function sfxPlayerHurt() {
  playTone(300, 0.15, 'sawtooth', 0.2);
  setTimeout(() => playTone(200, 0.15, 'sawtooth', 0.15), 50);
  setTimeout(() => playTone(100, 0.2, 'square', 0.1), 100);
}

export function sfxPickup() {
  playTone(400, 0.08, 'sine', 0.15);
  setTimeout(() => playTone(600, 0.08, 'sine', 0.15), 60);
  setTimeout(() => playTone(800, 0.12, 'sine', 0.12), 120);
}

export function sfxLevelUp() {
  const notes = [400, 500, 600, 800, 1000];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.15, 'sine', 0.15), i * 80);
  });
}

export function sfxDeath() {
  playTone(400, 0.3, 'sawtooth', 0.2);
  setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.18), 100);
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.15), 200);
  setTimeout(() => playTone(100, 0.5, 'square', 0.12), 300);
}

export function sfxDescend() {
  playTone(600, 0.2, 'sine', 0.15);
  setTimeout(() => playTone(400, 0.2, 'sine', 0.12), 100);
  setTimeout(() => playTone(300, 0.3, 'sine', 0.1), 200);
}

export function sfxBoss() {
  playTone(150, 0.4, 'sawtooth', 0.2);
  setTimeout(() => playTone(100, 0.4, 'sawtooth', 0.2), 200);
  setTimeout(() => playTone(80, 0.6, 'square', 0.15), 400);
}

export function sfxVictory() {
  const melody = [523, 659, 784, 1047, 784, 1047, 1319];
  melody.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.2, 'sine', 0.15), i * 120);
  });
}

export function sfxUseItem() {
  playTone(500, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(700, 0.1, 'sine', 0.1), 60);
}

// Ambient cave drip (subtle)
let ambientInterval: ReturnType<typeof setInterval> | null = null;
export function startAmbient() {
  if (ambientInterval) return;
  ambientInterval = setInterval(() => {
    if (Math.random() < 0.3) {
      const freq = 1000 + Math.random() * 2000;
      playTone(freq, 0.08, 'sine', 0.02);
    }
  }, 2000);
}

export function stopAmbient() {
  if (ambientInterval) {
    clearInterval(ambientInterval);
    ambientInterval = null;
  }
}
