// Efeitos sonoros gerados na hora (sem arquivos de áudio).
// Uso: SONS.tocar('subir' | 'presente' | 'pedra' | 'queda' | 'vitoria' | 'entrou' | 'escudo')
window.SONS = (() => {
  let ac = null;
  let ultimo = {};
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  // destrava o áudio no primeiro clique (navegadores normais exigem isso)
  window.addEventListener('pointerdown', () => ctx(), { once: true });

  function tom(freq, dur, { tipo = 'sine', vol = 0.15, ate = null, atraso = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + atraso;
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function ruido(dur, vol = 0.25, corte = 800) {
    const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = corte; g.gain.value = vol;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const efeitos = {
    subir: () => tom(520 + Math.random() * 200, 0.06, { tipo: 'triangle', vol: 0.05 }),
    entrou: () => { tom(440, 0.1, { vol: 0.08 }); tom(660, 0.12, { vol: 0.08, atraso: 0.08 }); },
    escudo: () => tom(300, 0.4, { tipo: 'sine', vol: 0.12, ate: 900 }),
    presente: () => { [523, 659, 784, 1047].forEach((f, i) => tom(f, 0.18, { tipo: 'square', vol: 0.06, atraso: i * 0.07 })); },
    pedra: () => { ruido(0.5, 0.35, 400); tom(120, 0.4, { tipo: 'sawtooth', vol: 0.1, ate: 40 }); },
    queda: () => tom(700, 0.5, { tipo: 'sawtooth', vol: 0.07, ate: 120 }),
    bater: () => { ruido(0.08, 0.25, 1800); tom(180 + Math.random() * 60, 0.09, { tipo: 'square', vol: 0.06, ate: 90 }); },
    cair: () => tom(600, 0.9, { tipo: 'sine', vol: 0.12, ate: 60 }),
    bip: () => tom(880, 0.15, { tipo: 'square', vol: 0.08 }),
    luta: () => { tom(220, 0.6, { tipo: 'sawtooth', vol: 0.1 }); tom(330, 0.6, { tipo: 'sawtooth', vol: 0.08 }); },
    poder: () => { tom(200, 0.5, { tipo: 'sawtooth', vol: 0.08, ate: 1200 }); ruido(0.4, 0.15, 3000); },
    vitoria: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tom(f, 0.25, { tipo: 'square', vol: 0.08, atraso: i * 0.13 })); },
  };
  return {
    tocar(nome, intervaloMin = 0.05) {
      const agora = performance.now() / 1000;
      if (agora - (ultimo[nome] || 0) < intervaloMin) return; // evita barulho demais
      ultimo[nome] = agora;
      try { efeitos[nome] && efeitos[nome](); } catch { /* sem áudio */ }
    },
  };
})();
