const AudioFX = (() => {
  let ctx = null;
  let muted = false;

  function init() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, type = 'square', volume = 0.08, slide = 0) {
    if (muted) return;
    const ac = init();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, ac.currentTime + duration);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  return {
    init, toggleMute, isMuted,
    jump: () => tone(300, 0.1, 'square', 0.06, 150),
    dash: () => tone(520, 0.08, 'sawtooth', 0.05, -200),
    coin: () => tone(1047, 0.06, 'sine', 0.06),
    heart: () => { tone(440, 0.1, 'sine', 0.07); tone(554, 0.15, 'sine', 0.07); },
    collect: (type) => {
      if (type === 'coke') tone(880, 0.08, 'square', 0.07);
      else if (type === 'meth') tone(200, 0.15, 'sawtooth', 0.09, 400);
      else tone(440, 0.2, 'sine', 0.07, -100);
    },
    stomp: () => tone(150, 0.12, 'square', 0.1, -80),
    hurt: () => { tone(120, 0.2, 'sawtooth', 0.1); tone(80, 0.3, 'sawtooth', 0.08); },
    checkpoint: () => { tone(523, 0.1, 'sine', 0.07); tone(659, 0.15, 'sine', 0.07); },
    levelComplete: () => {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'square', 0.07), i * 120));
    },
    gameOver: () => tone(200, 0.4, 'sawtooth', 0.08, -150),
    combo: () => tone(660, 0.06, 'square', 0.06, 200),
  };
})();