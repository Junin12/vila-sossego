'use strict';
// Sons sintetizados (WebAudio): sem arquivos de áudio. Só toca depois de um toque do usuário.
const Snd = (() => {
  let ctx = null;
  let muted = (() => { try { return localStorage.getItem('intruso-mudo') === '1'; } catch { return false; } })();
  const get = () => {
    if (muted) return null;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  };
  function tone(freq, start, dur, type = 'square', vol = 0.06) {
    const c = get(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const vib = (p) => { if (!muted && navigator.vibrate) navigator.vibrate(p); };
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('intruso-mudo', muted ? '1' : '0'); } catch { /* ok */ } return muted; },
    unlock() { get(); },
    pop() { tone(660, 0, 0.08, 'triangle'); },
    turn() { tone(523, 0, 0.1, 'triangle'); tone(784, 0.1, 0.14, 'triangle'); vib([70, 50, 70]); },
    tick(i = 0) { tone(300 + i * 70, 0, 0.12, 'square', 0.05); vib(25); },
    drum() { tone(110, 0, 0.35, 'sine', 0.12); tone(90, 0.4, 0.35, 'sine', 0.12); vib([120, 120, 120]); },
    low() { tone(196, 0, 0.18, 'sawtooth', 0.05); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.2, 'triangle', 0.09)); vib([60, 40, 60, 40, 160]); },
    lose() { [330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.26, 'sawtooth', 0.06)); vib([250]); },
    fanfare() { [392, 523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.22, 'triangle', 0.09)); vib([80, 50, 80, 50, 240]); },
    alarm() { tone(880, 0, 0.08); tone(880, 0.14, 0.08); },
  };
})();
