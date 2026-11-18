/**
 * AudioManager: real Mixkit samples first, Web Audio synth fallback.
 */
(function (global) {
  const SFX_BASE = 'assets/sfx';
  const SAMPLE_IDS = [
    'WHALE', 'PHOENIX', 'DRAGON', 'ELEPHANT', 'LION', 'TIGER', 'LEOPARD',
    'FORTUNE', 'WOLF', 'DOG', 'CAT', 'MOUSE',
    'flip', 'move', 'capture', 'win', 'draw', 'select'
  ];

  const FILE_MAP = {
    WHALE: 'whale',
    PHOENIX: 'phoenix',
    DRAGON: 'dragon',
    ELEPHANT: 'elephant',
    LION: 'lion',
    TIGER: 'tiger',
    LEOPARD: 'leopard',
    FORTUNE: 'fortune',
    WOLF: 'wolf',
    DOG: 'dog',
    CAT: 'cat',
    MOUSE: 'mouse',
    flip: 'flip',
    move: 'move',
    capture: 'capture',
    win: 'win',
    draw: 'draw',
    select: 'select'
  };

  function AudioManager() {
    this.ctx = null;
    this.buffers = Object.create(null);
    this.missing = Object.create(null);
    this.muted = localStorage.getItem('animalgame-muted') === '1';
    this._unlocked = false;
    this._preloadStarted = false;
  }

  AudioManager.prototype.ensureCtx = function () {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    return this.ctx;
  };

  AudioManager.prototype.unlock = function () {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    this._unlocked = true;
    this.preload();
  };

  AudioManager.prototype.isMuted = function () {
    return this.muted;
  };

  AudioManager.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    localStorage.setItem('animalgame-muted', this.muted ? '1' : '0');
  };

  AudioManager.prototype.toggleMuted = function () {
    this.setMuted(!this.muted);
    return this.muted;
  };

  AudioManager.prototype.preload = function () {
    if (this._preloadStarted) return;
    this._preloadStarted = true;
    const self = this;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    SAMPLE_IDS.forEach(function (id) {
      self.loadSample(id);
    });
  };

  AudioManager.prototype.loadSample = function (id) {
    const self = this;
    const file = FILE_MAP[id];
    if (!file || this.buffers[id] || this.missing[id]) {
      return Promise.resolve(null);
    }
    const url = SFX_BASE + '/' + file + '.mp3';
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('missing');
        return res.arrayBuffer();
      })
      .then(function (ab) {
        return self.ensureCtx().decodeAudioData(ab.slice(0));
      })
      .then(function (buf) {
        self.buffers[id] = buf;
        return buf;
      })
      .catch(function () {
        self.missing[id] = true;
        return null;
      });
  };

  AudioManager.prototype.play = function (id) {
    if (this.muted || !id) return;
    this.unlock();
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const self = this;
    const buf = this.buffers[id];
    if (buf) {
      this.playBuffer(buf);
      return;
    }
    if (!this.missing[id] && FILE_MAP[id]) {
      this.loadSample(id).then(function (loaded) {
        if (self.muted) return;
        if (loaded) self.playBuffer(loaded);
        else self.playSynth(id);
      });
      return;
    }
    this.playSynth(id);
  };

  AudioManager.prototype.playBuffer = function (buf) {
    const ctx = this.ensureCtx();
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(ctx.destination);
    try {
      src.start(0);
    } catch (e) { /* ignore */ }
  };

  AudioManager.prototype.playAnimal = function (type) {
    if (!type) return;
    this.play(String(type).toUpperCase());
  };

  AudioManager.prototype.tone = function (opts) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const type = opts.type || 'sine';
    const freq = opts.freq || 440;
    const freqEnd = opts.freqEnd != null ? opts.freqEnd : freq;
    const dur = opts.dur || 0.2;
    const vol = opts.vol != null ? opts.vol : 0.2;
    const delay = opts.delay || 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + delay);
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + delay + dur);
    }
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + dur + 0.02);
  };

  AudioManager.prototype.noiseBurst = function (opts) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const dur = opts.dur || 0.25;
    const vol = opts.vol != null ? opts.vol : 0.18;
    const delay = opts.delay || 0;
    const filterFreq = opts.filterFreq || 800;
    const samples = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = opts.q || 1.2;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now + delay);
    src.stop(now + delay + dur + 0.02);
  };

  AudioManager.prototype.playSynth = function (id) {
    const key = String(id || '').toUpperCase();
    switch (key) {
      case 'CAT':
        this.tone({ type: 'triangle', freq: 900, freqEnd: 1200, dur: 0.18, vol: 0.18 });
        this.tone({ type: 'sine', freq: 1100, freqEnd: 700, dur: 0.22, vol: 0.1, delay: 0.05 });
        break;
      case 'DOG':
        this.tone({ type: 'sawtooth', freq: 280, freqEnd: 180, dur: 0.12, vol: 0.12 });
        this.tone({ type: 'sawtooth', freq: 300, freqEnd: 160, dur: 0.12, vol: 0.12, delay: 0.14 });
        break;
      case 'MOUSE':
        this.tone({ type: 'square', freq: 1800, freqEnd: 2400, dur: 0.08, vol: 0.08 });
        this.tone({ type: 'square', freq: 2000, freqEnd: 1600, dur: 0.07, vol: 0.07, delay: 0.1 });
        break;
      case 'LION':
      case 'TIGER':
        this.noiseBurst({ dur: 0.35, vol: 0.22, filterFreq: key === 'LION' ? 320 : 420 });
        this.tone({ type: 'sawtooth', freq: 120, freqEnd: 70, dur: 0.4, vol: 0.14 });
        break;
      case 'LEOPARD':
        this.noiseBurst({ dur: 0.2, vol: 0.16, filterFreq: 560, q: 2 });
        this.tone({ type: 'triangle', freq: 220, freqEnd: 140, dur: 0.22, vol: 0.12 });
        break;
      case 'WOLF':
        this.tone({ type: 'sine', freq: 420, freqEnd: 680, dur: 0.55, vol: 0.14 });
        this.tone({ type: 'triangle', freq: 430, freqEnd: 520, dur: 0.55, vol: 0.08 });
        break;
      case 'ELEPHANT':
        this.tone({ type: 'sawtooth', freq: 180, freqEnd: 90, dur: 0.55, vol: 0.16 });
        this.tone({ type: 'sine', freq: 90, freqEnd: 60, dur: 0.6, vol: 0.12 });
        break;
      case 'WHALE':
        this.tone({ type: 'sine', freq: 220, freqEnd: 80, dur: 0.7, vol: 0.16 });
        this.tone({ type: 'sine', freq: 110, freqEnd: 55, dur: 0.7, vol: 0.1, delay: 0.05 });
        break;
      case 'PHOENIX':
        this.tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.25, vol: 0.12 });
        this.tone({ type: 'triangle', freq: 880, freqEnd: 1320, dur: 0.3, vol: 0.1, delay: 0.08 });
        break;
      case 'DRAGON':
        this.noiseBurst({ dur: 0.4, vol: 0.2, filterFreq: 180, q: 0.8 });
        this.tone({ type: 'sawtooth', freq: 90, freqEnd: 50, dur: 0.45, vol: 0.14 });
        break;
      case 'FORTUNE':
        this.tone({ type: 'sine', freq: 880, dur: 0.12, vol: 0.14 });
        this.tone({ type: 'sine', freq: 1175, dur: 0.14, vol: 0.12, delay: 0.1 });
        this.tone({ type: 'sine', freq: 1568, dur: 0.18, vol: 0.1, delay: 0.2 });
        break;
      case 'FLIP':
        this.noiseBurst({ dur: 0.12, vol: 0.12, filterFreq: 2200, q: 0.7 });
        this.tone({ type: 'triangle', freq: 500, freqEnd: 300, dur: 0.12, vol: 0.1 });
        break;
      case 'MOVE':
        this.tone({ type: 'triangle', freq: 320, freqEnd: 220, dur: 0.1, vol: 0.1 });
        break;
      case 'SELECT':
        this.tone({ type: 'sine', freq: 640, dur: 0.06, vol: 0.1 });
        break;
      case 'CAPTURE':
        this.noiseBurst({ dur: 0.18, vol: 0.22, filterFreq: 700 });
        this.tone({ type: 'square', freq: 180, freqEnd: 90, dur: 0.16, vol: 0.1 });
        break;
      case 'WIN':
        this.tone({ type: 'sine', freq: 523, dur: 0.12, vol: 0.12 });
        this.tone({ type: 'sine', freq: 659, dur: 0.12, vol: 0.12, delay: 0.12 });
        this.tone({ type: 'sine', freq: 784, dur: 0.22, vol: 0.14, delay: 0.24 });
        break;
      case 'DRAW':
        this.tone({ type: 'triangle', freq: 400, freqEnd: 300, dur: 0.25, vol: 0.1 });
        this.tone({ type: 'triangle', freq: 300, freqEnd: 220, dur: 0.3, vol: 0.08, delay: 0.2 });
        break;
      default:
        this.tone({ type: 'sine', freq: 440, dur: 0.12, vol: 0.1 });
    }
  };

  global.AnimalAudio = new AudioManager();
})(window);
