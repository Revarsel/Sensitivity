import { buildBank } from './SoundBank.js';
import { midiHz, SR, rng } from './dsp.js';

// The lullaby: D minor, 3/4. [midi, beats]
export const LULLABY = [
  [62, 1], [65, 1], [69, 1], [69, 2], [67, 1], [65, 1], [64, 1], [62, 1], [64, 3],
  [62, 1], [65, 1], [69, 1], [72, 2], [70, 1], [69, 1], [67, 1], [64, 1], [62, 3],
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.vol = { master: 0.9, sfx: 1, music: 0.8, amb: 0.85, voice: 1 };
    this.loops = new Set();
    this.occlusion = null; // fn(x,z) -> 0..1
    this.listenerPos = { x: 0, y: 1.6, z: 0 };
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive', sampleRate: SR });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.bus = {};
    for (const k of ['sfx', 'music', 'amb', 'voice', 'ui']) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.bus[k] = g;
    }
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(1.7, 2.6);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);
    this.bank = buildBank(ctx);
    this.applyVolumes();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  }

  _impulse(sec, decay) {
    const n = Math.floor(sec * SR);
    const b = this.ctx.createBuffer(2, n, SR);
    const r = rng(77);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += ((r() * 2 - 1) - lp) * (0.5 - t * 0.4);
        d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return b;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.bus.music.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(this.vol.amb, t, 0.05);
    this.bus.voice.gain.setTargetAtTime(this.vol.voice, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(Math.min(1, this.vol.sfx + 0.2), t, 0.05);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  _panner(pos, ref = 1.2, rolloff = 1.2) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 60;
    p.rolloffFactor = rolloff;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y ?? 1, pos.z);
    return p;
  }

  _occl(pos) {
    if (!this.occlusion || !pos) return 0;
    return this.occlusion(pos.x, pos.z);
  }

  /**
   * Play a one-shot.
   * opts: { pos, gain, rate, bus, reverb, detune, delay, ref, rolloff, variant, lowpass }
   */
  play(name, opts = {}) {
    if (!this.ready) return null;
    const list = this.bank[name];
    if (!list) return null;
    const ctx = this.ctx;
    const buffer = list[opts.variant ?? Math.floor(Math.random() * list.length)];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = (opts.rate ?? 1) * (opts.jitter ? 1 + (Math.random() - 0.5) * opts.jitter : 1);
    src.playbackRate.value = rate;
    if (opts.detune) src.detune.value = opts.detune;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    let node = src;
    const occ = opts.pos ? this._occl(opts.pos) : 0;
    const lp = opts.lowpass ?? (occ > 0 ? 18000 * Math.pow(0.11, occ) + 350 : 0);
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5;
      node.connect(f); node = f;
      g.gain.value *= 1 - occ * 0.45;
    }
    node.connect(g);
    let out = g;
    if (opts.pos) {
      const p = this._panner(opts.pos, opts.ref ?? 1.2, opts.rolloff ?? 1.2);
      g.connect(p); out = p;
    }
    out.connect(this.bus[opts.bus || 'sfx']);
    const rv = opts.reverb ?? (opts.pos ? 0.25 : 0.1);
    if (rv > 0) {
      const s = ctx.createGain(); s.gain.value = rv;
      out.connect(s).connect(this.reverb);
    }
    const when = ctx.currentTime + (opts.delay ?? 0);
    src.start(when);
    src.onended = () => { try { out.disconnect(); } catch (e) { /* noop */ } };
    return { src, gain: g };
  }

  // Persistent positional / flat loop
  loop(name, opts = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.bank[name][0];
    src.loop = true;
    src.playbackRate.value = opts.rate ?? 1;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = opts.lowpass ?? 18000;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filter).connect(g);
    let out = g, panner = null;
    if (opts.pos) { panner = this._panner(opts.pos, opts.ref ?? 1.5, opts.rolloff ?? 1.0); g.connect(panner); out = panner; }
    out.connect(this.bus[opts.bus || 'amb']);
    if (opts.reverb) { const s = ctx.createGain(); s.gain.value = opts.reverb; out.connect(s).connect(this.reverb); }
    src.start(ctx.currentTime + Math.random() * 0.01, Math.random() * src.buffer.duration * 0.9);
    const h = {
      src, gain: g, filter, panner, pos: opts.pos, baseGain: opts.gain ?? 1, occlude: !!opts.occlude, alive: true,
      fade: (v, tc = 0.4) => g.gain.setTargetAtTime(v, ctx.currentTime, tc),
      stop: (tc = 0.3) => {
        if (!h.alive) return; h.alive = false;
        g.gain.setTargetAtTime(0, ctx.currentTime, tc);
        setTimeout(() => { try { src.stop(); out.disconnect(); } catch (e) { /* noop */ } }, tc * 6000 + 100);
        this.loops.delete(h);
      },
      setPos: (x, y, z) => {
        if (!panner) return;
        h.pos = { x, y, z };
        const t = ctx.currentTime;
        if (panner.positionX) { panner.positionX.setTargetAtTime(x, t, 0.05); panner.positionY.setTargetAtTime(y, t, 0.05); panner.positionZ.setTargetAtTime(z, t, 0.05); }
        else panner.setPosition(x, y, z);
      },
    };
    h.fade(h.baseGain, opts.fadeIn ?? 0.5);
    this.loops.add(h);
    return h;
  }

  // called a few times per second: occlusion for positional loops
  updateOcclusion() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const h of this.loops) {
      if (!h.occlude || !h.pos) continue;
      const o = this._occl(h.pos);
      h.filter.frequency.setTargetAtTime(18000 * Math.pow(0.08, o) + 300, t, 0.15);
      h.gain.gain.setTargetAtTime(h.baseGain * (1 - o * 0.5), t, 0.2);
    }
    if (this.hum) this.hum.updateOcclusion();
  }

  // ----------------------------------------------------------- music box
  // Plays the lullaby on the music box. Returns a stop handle.
  musicBox({ gain = 0.5, pos = null, bus = 'music', tempo = 62, transpose = 12, loops = Infinity, wobble = 1, radio = false } = {}) {
    if (!this.ready) return { stop() {} };
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = gain;
    let dest = out;
    if (radio) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
      out.connect(bp); dest = bp;
    }
    let final = dest;
    if (pos) { const p = this._panner(pos, 1.0, 1.4); dest.connect(p); final = p; }
    final.connect(this.bus[bus]);
    const rv = ctx.createGain(); rv.gain.value = 0.35; final.connect(rv).connect(this.reverb);
    const beat = 60 / tempo;
    let t = ctx.currentTime + 0.1;
    let i = 0, count = 0, alive = true;
    const base = 523.25;
    const sched = () => {
      if (!alive) return;
      while (t < ctx.currentTime + 0.6) {
        const [m, d] = LULLABY[i];
        const src = ctx.createBufferSource();
        src.buffer = this.bank.tine[0];
        const wow = 1 + 0.006 * wobble * Math.sin(t * 2.1) + 0.004 * wobble * Math.sin(t * 0.37);
        src.playbackRate.value = (midiHz(m + transpose) / base) * wow;
        const g = ctx.createGain(); g.gain.value = 0.8 + Math.random() * 0.2;
        src.connect(g).connect(out);
        src.start(t);
        // harmony on the downbeat
        if (i % 3 === 0 || d >= 2) {
          const s2 = ctx.createBufferSource(); s2.buffer = this.bank.tine[0];
          s2.playbackRate.value = (midiHz(m + transpose - 12) / base) * wow;
          const g2 = ctx.createGain(); g2.gain.value = 0.35;
          s2.connect(g2).connect(out); s2.start(t);
        }
        t += d * beat * (1 + (wobble > 1 ? (Math.random() - 0.5) * 0.08 : 0));
        i++;
        if (i >= LULLABY.length) { i = 0; count++; t += beat; if (count >= loops) { alive = false; break; } }
      }
    };
    sched();
    const iv = setInterval(sched, 150);
    return {
      stop: (tc = 0.5) => { alive = false; clearInterval(iv); out.gain.setTargetAtTime(0, ctx.currentTime, tc); setTimeout(() => { try { final.disconnect(); } catch (e) { /* */ } }, 4000); },
      setGain: (v) => out.gain.setTargetAtTime(v, ctx.currentTime, 0.3),
      get alive() { return alive; },
    };
  }

  // ----------------------------------------------------------- heartbeat / breath
  startBody() {
    if (!this.ready || this.body) return;
    this.body = { rate: 62, level: 0, next: this.ctx.currentTime + 0.5, breathNext: this.ctx.currentTime + 2, breathLevel: 0 };
  }
  setHeart(bpm, level) { if (this.body) { this.body.rate = bpm; this.body.level = level; } }
  setBreath(level, rate = 1) { if (this.body) { this.body.breathLevel = level; this.body.breathRate = rate; } }
  updateBody() {
    const b = this.body;
    if (!b || !this.ready) return;
    const now = this.ctx.currentTime;
    if (b.level > 0.02) {
      while (b.next < now + 0.2) {
        const interval = 60 / b.rate;
        this.play('heart_lub', { gain: b.level, bus: 'sfx', reverb: 0, delay: Math.max(0, b.next - now) });
        this.play('heart_dub', { gain: b.level * 0.8, bus: 'sfx', reverb: 0, delay: Math.max(0, b.next - now + interval * 0.32) });
        b.next += interval;
      }
    } else b.next = now + 0.3;
    if (b.breathLevel > 0.02) {
      if (b.breathNext < now) {
        const r = b.breathRate || 1;
        this.play('breath_in', { gain: b.breathLevel, bus: 'sfx', reverb: 0.05, rate: 0.95 + r * 0.1 });
        this.play('breath_out', { gain: b.breathLevel * 0.9, bus: 'sfx', reverb: 0.05, delay: 0.75 / r, rate: 0.95 + r * 0.1 });
        b.breathNext = now + 2.4 / r;
      }
    } else b.breathNext = Math.max(b.breathNext, now + 0.5);
  }

  // ----------------------------------------------------------- music
  startDrone() {
    if (!this.ready || this.drone) return;
    this.drone = this.loop('drone', { bus: 'music', gain: 0.28, fadeIn: 3 });
  }
  setChase(level) {
    if (!this.ready) return;
    const ctx = this.ctx;
    if (level > 0 && !this.chase) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.bus.music);
      const oscs = [];
      for (const [f, type, v] of [[55, 'sawtooth', 0.12], [58.27, 'sawtooth', 0.1], [110, 'square', 0.03], [146.8, 'sawtooth', 0.05]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6; const lg = ctx.createGain(); lg.gain.value = 260;
        lfo.connect(lg).connect(lp.frequency); lfo.start();
        const og = ctx.createGain(); og.gain.value = v;
        o.connect(lp).connect(og).connect(g); o.start();
        oscs.push(o, lfo);
      }
      this.chase = { g, oscs, level: 0, next: ctx.currentTime + 0.1, step: 0 };
    }
    if (!this.chase) return;
    this.chase.level = level;
    this.chase.g.gain.setTargetAtTime(level * 0.9, ctx.currentTime, level > this.chase.g.gain.value ? 0.15 : 1.2);
    if (level <= 0.001 && this.chase.g.gain.value < 0.01) {
      for (const o of this.chase.oscs) try { o.stop(); } catch (e) { /* */ }
      this.chase = null;
    }
  }
  updateMusic() {
    const c = this.chase;
    if (!c || !this.ready) return;
    const now = this.ctx.currentTime;
    const beat = 60 / 142 / 2;
    while (c.next < now + 0.2) {
      if (c.level > 0.05) {
        const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
        if (pat[c.step % 16]) this.play('kick', { gain: 0.7 * c.level, bus: 'music', reverb: 0.15, delay: Math.max(0, c.next - now) });
        if (c.step % 4 === 2) this.play('tick', { gain: 0.25 * c.level, bus: 'music', rate: 0.7, delay: Math.max(0, c.next - now) });
      }
      c.next += beat;
      c.step++;
    }
  }

  // stingers
  stinger(kind = 'swell', gain = 0.6) { this.play(kind, { gain, bus: 'music', reverb: 0.4 }); }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}

// Mr Hush's humming voice: a hoarse, detuned, drifting lullaby.
export class HushVoice {
  constructor(audio) {
    this.a = audio;
    this.active = false;
    this.pos = { x: 0, y: 2, z: 0 };
  }
  start() {
    const a = this.a; if (!a.ready || this.active) return;
    const ctx = a.ctx;
    this.active = true;
    const out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 280; f1.Q.value = 2; f1.gain.value = 9;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2400; f2.Q.value = 3; f2.gain.value = 4;
    const occl = ctx.createBiquadFilter(); occl.type = 'lowpass'; occl.frequency.value = 18000;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vibG = ctx.createGain(); vibG.gain.value = 3.2;
    vib.connect(vibG);
    const voices = [];
    for (const [type, det, g] of [['sawtooth', -7, 0.32], ['sawtooth', 8, 0.28], ['triangle', 0, 0.5], ['sine', -1200, 0.35]]) {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
      vibG.connect(o.frequency);
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(lp);
      voices.push(o);
    }
    // breath noise
    const nb = ctx.createBufferSource(); nb.buffer = a.bank.breath_out[0]; nb.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    nb.connect(nf).connect(ng).connect(lp);
    lp.connect(f1).connect(f2).connect(occl).connect(out);
    const pan = a._panner(this.pos, 1.6, 1.15);
    out.connect(pan).connect(a.bus.sfx);
    const rv = ctx.createGain(); rv.gain.value = 0.4; pan.connect(rv).connect(a.reverb);
    for (const o of voices) o.start();
    vib.start(); nb.start();
    this.n = { out, lp, occl, voices, vib, nb, pan, ng };
    this.idx = 0;
    this.next = ctx.currentTime + 0.2;
    this.level = 0;
    this.setLevel(0.55);
    this.iv = setInterval(() => this._sched(), 120);
  }
  _sched() {
    if (!this.active) return;
    const ctx = this.a.ctx;
    const beat = 60 / 52;
    while (this.next < ctx.currentTime + 0.5) {
      const [m, d] = LULLABY[this.idx];
      const drift = Math.sin(this.next * 0.3) * 18 + (Math.random() - 0.5) * 22; // cents, wrong-sounding
      const hz = midiHz(m - 12) * Math.pow(2, drift / 1200);
      for (const o of this.n.voices) o.frequency.setTargetAtTime(hz, this.next, 0.045);
      // syllable envelope: hum swells per note
      const g = this.n.ng.gain;
      g.setTargetAtTime(0.35, this.next, 0.02);
      g.setTargetAtTime(0.12, this.next + 0.15, 0.2);
      this.next += d * beat;
      this.idx = (this.idx + 1) % LULLABY.length;
      if (this.idx === 0) this.next += beat * 1.5;
    }
  }
  setLevel(v, tc = 0.25) {
    if (!this.active) return;
    this.level = v;
    this.n.out.gain.setTargetAtTime(v * 0.36, this.a.ctx.currentTime, tc);
  }
  // sudden stop when he hears something
  cut() { if (this.active) this.n.out.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.03); this.level = 0; }
  setPos(x, y, z) {
    this.pos = { x, y, z };
    if (!this.active) return;
    const p = this.n.pan; const t = this.a.ctx.currentTime;
    if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.05); p.positionY.setTargetAtTime(y, t, 0.05); p.positionZ.setTargetAtTime(z, t, 0.05); }
    else p.setPosition(x, y, z);
  }
  updateOcclusion() {
    if (!this.active) return;
    const o = this.a._occl(this.pos);
    this.n.occl.frequency.setTargetAtTime(18000 * Math.pow(0.07, o) + 250, this.a.ctx.currentTime, 0.2);
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.iv);
    const n = this.n; const ctx = this.a.ctx;
    n.out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => { try { for (const o of n.voices) o.stop(); n.vib.stop(); n.nb.stop(); n.pan.disconnect(); } catch (e) { /* */ } }, 1500);
  }
}
