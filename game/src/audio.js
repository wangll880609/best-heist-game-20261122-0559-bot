// Tiny synth sound effects, made with the Web Audio API — no audio files.
// Everything is created lazily on the first user gesture, so the page
// never needs a network request for sound.
let context = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function ensureContext() {
  if (context) return context;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    context = new AC();
  } catch {
    return null;
  }
  return context;
}

function tone(freq, seconds, type, gainValue, when = 0, slideTo = null) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

export const sfx = {
  pickup() {
    tone(880, 0.12, 'sine', 0.12);
    tone(1318, 0.16, 'sine', 0.1, 0.07);
  },
  gold() {
    tone(659, 0.1, 'triangle', 0.12);
    tone(988, 0.14, 'triangle', 0.12, 0.06);
    tone(1318, 0.2, 'triangle', 0.1, 0.12);
  },
  diamond() {
    tone(1046, 0.14, 'sine', 0.12);
    tone(1568, 0.18, 'sine', 0.12, 0.08);
    tone(2093, 0.3, 'sine', 0.1, 0.16);
  },
  crack() {
    tone(220, 0.1, 'square', 0.05);
    tone(180, 0.14, 'square', 0.05, 0.08);
  },
  smoke() {
    tone(300, 0.35, 'sine', 0.08, 0, 90);
  },
  emp() {
    tone(1200, 0.3, 'sawtooth', 0.05, 0, 120);
  },
  spotted() {
    tone(196, 0.22, 'square', 0.09);
    tone(147, 0.3, 'square', 0.09, 0.14);
  },
  alarm() {
    tone(740, 0.16, 'square', 0.06);
    tone(740, 0.16, 'square', 0.06, 0.22);
  },
  caught() {
    tone(392, 0.25, 'sawtooth', 0.1, 0, 98);
    tone(98, 0.5, 'sawtooth', 0.1, 0.2);
  },
  clear() {
    tone(523, 0.14, 'triangle', 0.12);
    tone(659, 0.14, 'triangle', 0.12, 0.1);
    tone(784, 0.22, 'triangle', 0.12, 0.2);
  },
  win() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.12, i * 0.12));
  },
  click() {
    tone(660, 0.06, 'sine', 0.07);
  },
};
