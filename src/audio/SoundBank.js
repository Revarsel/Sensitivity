import * as D from './dsp.js';

const { SR } = D;

// Build all sound-effect buffers. Everything is synthesised; nothing is loaded.
export function buildBank(ctx) {
  const B = {};
  const put = (name, data) => { (B[name] ||= []).push(D.toBuffer(ctx, data)); };
  let seed = 11;
  const R = () => D.rng(seed++);

  const click = (r, len = 0.004) => D.env(D.white(Math.floor(len * SR), r), 0.0005, len * 0.4);

  // ---------------------------------------------------------------- footsteps
  for (let v = 0; v < 4; v++) {
    const r = R();
    // carpet
    {
      const x = D.biquad(D.env(D.brown(Math.floor(0.14 * SR), r), 0.006, 0.04), 'lp', 380 + r() * 80);
      const sw = D.env(D.biquad(D.pink(Math.floor(0.12 * SR), r), 'bp', 1400 + r() * 400, 0.8), 0.01, 0.04);
      D.mix(x, sw, 0.2);
      put('step_carpet', D.normalize(x, 0.5));
    }
    // rug (softer, fuzzier)
    {
      const x = D.biquad(D.env(D.brown(Math.floor(0.12 * SR), r), 0.008, 0.035), 'lp', 300);
      put('step_rug', D.normalize(x, 0.38));
    }
    // wood
    {
      const exc = D.biquad(click(r, 0.006), 'lp', 2500);
      const k = 0.9 + r() * 0.2;
      const x = D.modal(exc, [[92 * k, 0.07, 1], [176 * k, 0.05, 0.6], [410 * k, 0.03, 0.4], [1150 * k, 0.012, 0.25]], 0.25);
      D.mix(x, D.env(D.biquad(D.white(Math.floor(0.03 * SR), r), 'bp', 2400, 1), 0.001, 0.008), 0.25);
      put('step_wood', D.normalize(D.fadeOut(x, 0.05), 0.75));
    }
    // tile: heel + toe
    {
      const hit = (amp) => {
        const exc = click(r, 0.003);
        const m = D.modal(exc, [[1750 + r() * 200, 0.018, 0.6], [3100 + r() * 300, 0.01, 0.4], [640, 0.03, 0.5], [230, 0.04, 0.5]], 0.12);
        return D.gain(m, amp);
      };
      const x = D.buf(0.2);
      D.mix(x, hit(1), 1, 0);
      D.mix(x, hit(0.5), 1, 0.04 + r() * 0.02);
      D.mix(x, D.env(D.biquad(D.white(Math.floor(0.02 * SR), r), 'hp', 3000), 0.0005, 0.004), 0.3);
      put('step_tile', D.normalize(D.fadeOut(x, 0.04), 0.8));
    }
    // glass crunch
    {
      const x = D.buf(0.25);
      for (let i = 0; i < 26; i++) {
        const f = 3000 + r() * 7000;
        const ping = D.osc(0.03, () => f, (t) => Math.exp(-t / (0.004 + r() * 0.01)));
        D.mix(x, ping, 0.25 + r() * 0.3, r() * 0.14);
      }
      D.mix(x, D.env(D.biquad(D.white(Math.floor(0.15 * SR), r), 'hp', 2500), 0.002, 0.05), 0.4);
      put('step_glass', D.normalize(x, 0.85));
    }
    // grass / outside
    {
      const x = D.env(D.biquad(D.pink(Math.floor(0.18 * SR), r), 'bp', 2200, 0.6), 0.01, 0.06);
      put('step_grass', D.normalize(x, 0.4));
    }
  }

  // ---------------------------------------------------------------- creaks
  const creak = (sec, rateFn, modes, r, peak = 0.75) => {
    const exc = D.stickSlip(sec, rateFn, r, 0.35);
    const x = D.modal(exc, modes, sec + 0.1);
    const n = x.length;
    for (let i = 0; i < n; i++) { const t = i / n; x[i] *= Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.6); }
    D.biquad(x, 'hp', 150);
    return D.normalize(x, peak);
  };
  for (let v = 0; v < 3; v++) {
    const r = R();
    const base = 0.9 + r() * 0.3;
    put('creak_floor', creak(0.55 + r() * 0.35, (t) => 70 + 70 * Math.sin(t * (4 + r() * 3)) + t * 60, [[470 * base, 0.05, 1], [900 * base, 0.04, 0.7], [1650 * base, 0.03, 0.45], [2700 * base, 0.02, 0.2]], r, 0.7));
  }
  {
    const r = R();
    put('door_creak_slow', creak(1.9, (t) => 30 + 70 * Math.sin(t * 1.6) ** 2 + 20 * Math.sin(t * 9), [[360, 0.06, 1], [740, 0.05, 0.6], [1210, 0.03, 0.45], [2050, 0.02, 0.25]], r, 0.6));
    put('door_creak_slow', creak(1.6, (t) => 45 + 90 * Math.sin(t * 2.1 + 1) ** 2, [[410, 0.06, 1], [830, 0.05, 0.6], [1390, 0.03, 0.4]], r, 0.6));
    put('door_creak_fast', creak(0.55, (t) => 160 - t * 160, [[390, 0.05, 1], [780, 0.04, 0.6], [1300, 0.03, 0.4]], r, 0.75));
  }
  // door slam
  {
    const r = R();
    const exc = D.biquad(D.env(D.white(Math.floor(0.02 * SR), r), 0.001, 0.006), 'lp', 1500);
    const x = D.modal(exc, [[68, 0.18, 1], [128, 0.12, 0.7], [262, 0.06, 0.4], [880, 0.02, 0.3], [1900, 0.01, 0.15]], 0.9);
    const latch = D.modal(click(r), [[2600, 0.02, 0.5], [4100, 0.012, 0.4]], 0.1);
    D.mix(x, latch, 0.6, 0.02);
    // rattle
    for (let i = 0; i < 5; i++) D.mix(x, D.modal(click(r), [[3000 + r() * 1500, 0.01, 0.3]], 0.05), 0.4, 0.06 + i * 0.03 + r() * 0.01);
    put('door_slam', D.normalize(D.fadeOut(x, 0.2), 1.0));
  }
  {
    const r = R();
    const x = D.buf(0.2);
    D.mix(x, D.modal(click(r), [[2400, 0.02, 0.5], [3900, 0.012, 0.4], [800, 0.02, 0.3]], 0.1), 1, 0);
    D.mix(x, D.modal(click(r), [[2200, 0.02, 0.5], [3500, 0.012, 0.4]], 0.1), 0.7, 0.07);
    put('door_latch', D.normalize(x, 0.5));
    const y = D.buf(0.6);
    for (let i = 0; i < 6; i++) D.mix(y, D.modal(click(r), [[2200 + r() * 800, 0.02, 0.5], [3600 + r() * 600, 0.012, 0.4], [600, 0.03, 0.4]], 0.1), 0.8, i * 0.075 + r() * 0.02);
    put('door_locked', D.normalize(y, 0.6));
  }
  // knock
  for (let v = 0; v < 2; v++) {
    const r = R();
    const x = D.buf(0.5);
    const k = () => D.modal(D.biquad(click(r, 0.005), 'lp', 2000), [[175 + r() * 20, 0.08, 1], [390, 0.05, 0.6], [820, 0.03, 0.35], [1500, 0.015, 0.2]], 0.2);
    D.mix(x, k(), 1, 0);
    D.mix(x, k(), 0.85, 0.15 + r() * 0.03);
    put('knock', D.normalize(x, 0.85));
  }

  // ---------------------------------------------------------------- objects
  {
    const r = R();
    put('bottle_clink', D.normalize(D.modal(click(r, 0.002), [[2050, 0.35, 0.6], [3420, 0.22, 0.4], [5600, 0.14, 0.3], [820, 0.18, 0.2]], 0.6), 0.7));
    const x = D.buf(1.3);
    D.mix(x, D.env(D.biquad(D.white(Math.floor(0.4 * SR), r), 'hp', 1800), 0.001, 0.09), 0.9);
    D.mix(x, D.modal(D.biquad(click(r, 0.01), 'lp', 900), [[90, 0.08, 1], [210, 0.05, 0.5]], 0.3), 0.5);
    for (let i = 0; i < 55; i++) {
      const f = 2200 + r() * 8000;
      const d = 0.01 + r() * 0.12;
      D.mix(x, D.osc(0.3, () => f, (t) => Math.exp(-t / d)), 0.08 + r() * 0.18, r() * r() * 0.7);
    }
    put('bottle_shatter', D.normalize(x, 1.0));
  }
  for (let v = 0; v < 2; v++) {
    const r = R();
    put('block_hit', D.normalize(D.modal(click(r, 0.002), [[650 + r() * 120, 0.04, 1], [1420 + r() * 200, 0.03, 0.6], [2900, 0.015, 0.3]], 0.15), 0.7));
  }
  {
    const r = R();
    const x = D.osc(0.42, (t) => 950 + 650 * Math.sin(Math.PI * Math.min(1, t / 0.38)) + 40 * Math.sin(t * 190), (t) => Math.sin(Math.PI * Math.min(1, t / 0.4)) ** 0.7, 'saw');
    D.biquad(x, 'bp', 1500, 1.4);
    D.biquad(x, 'lp', 4000);
    D.mix(x, D.env(D.biquad(D.white(Math.floor(0.4 * SR), r), 'bp', 2500, 2), 0.05, 0.2), 0.1);
    put('squeak', D.normalize(x, 0.85));
  }
  {
    const r = R();
    const x = D.biquad(D.white(Math.floor(0.45 * SR), r), 'bp', 700, 2.5);
    for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= (0.5 + 0.5 * Math.sin(t * 90 + Math.sin(t * 13) * 3)) * Math.sin(Math.PI * t / 0.45); }
    D.mix(x, D.modal(click(r), [[160, 0.06, 1], [480, 0.03, 0.5]], 0.15), 0.6, 0.4);
    put('drawer', D.normalize(x, 0.6));
  }
  {
    const r = R();
    const x = D.buf(0.4);
    for (let i = 0; i < 28; i++) D.mix(x, D.env(D.biquad(D.white(Math.floor(0.03 * SR), r), 'hp', 1800 + r() * 3000), 0.001, 0.006), 0.3 + r() * 0.5, r() * 0.34);
    put('paper', D.normalize(x, 0.45));
  }
  {
    const r = R();
    const x = D.buf(0.5);
    for (let i = 0; i < 9; i++) {
      const f = 3000 + r() * 3500;
      D.mix(x, D.osc(0.15, () => f, (t) => Math.exp(-t / 0.03)), 0.3, r() * 0.35);
    }
    put('keys', D.normalize(x, 0.5));
  }
  {
    const r = R();
    const x = D.buf(0.3);
    D.mix(x, D.modal(click(r), [[2600, 0.015, 0.6], [5200, 0.008, 0.4]], 0.08), 1, 0);
    D.mix(x, D.modal(click(r), [[2300, 0.015, 0.6], [4800, 0.008, 0.4]], 0.08), 0.8, 0.12);
    put('click_small', D.normalize(x, 0.5));
  }
  {
    const r = R();
    const x = D.env(D.biquad(D.brown(Math.floor(0.2 * SR), r), 'lp', 600), 0.01, 0.05);
    D.mix(x, D.modal(click(r), [[1800, 0.01, 0.3]], 0.05), 0.4, 0.02);
    put('pickup', D.normalize(x, 0.5));
  }

  // ---------------------------------------------------------------- body
  {
    put('heart_lub', D.normalize(D.biquad(D.osc(0.22, (t) => 62 - t * 90, (t) => Math.exp(-t / 0.055) * Math.min(1, t / 0.004)), 'lp', 180), 0.9));
    put('heart_dub', D.normalize(D.biquad(D.osc(0.18, (t) => 52 - t * 70, (t) => Math.exp(-t / 0.045) * Math.min(1, t / 0.004)), 'lp', 160), 0.6));
  }
  for (let v = 0; v < 3; v++) {
    const r = R();
    const inh = D.biquad(D.pink(Math.floor(0.7 * SR), r), 'bp', 1100 + r() * 300, 0.9);
    for (let i = 0; i < inh.length; i++) { const t = i / inh.length; inh[i] *= Math.sin(Math.PI * t) * (0.3 + t); }
    put('breath_in', D.normalize(inh, 0.35));
    const ex = D.biquad(D.pink(Math.floor(0.9 * SR), r), 'bp', 650 + r() * 200, 0.7);
    for (let i = 0; i < ex.length; i++) { const t = i / ex.length; ex[i] *= Math.sin(Math.PI * Math.min(1, t * 1.3)) ** 0.8 * (1 - t * 0.5); }
    put('breath_out', D.normalize(ex, 0.32));
  }
  {
    const r = R();
    const g = D.biquad(D.pink(Math.floor(0.35 * SR), r), 'bp', 1500, 1.2);
    for (let i = 0; i < g.length; i++) { const t = i / g.length; g[i] *= Math.sin(Math.PI * Math.min(1, t * 1.6)) ** 0.5 * (1 - t); }
    put('gasp', D.normalize(g, 0.6));
  }

  // ---------------------------------------------------------------- Mr Hush
  for (let v = 0; v < 3; v++) {
    const r = R();
    const exc = D.biquad(D.env(D.brown(Math.floor(0.03 * SR), r), 0.002, 0.01), 'lp', 500);
    const x = D.modal(exc, [[44 + r() * 6, 0.2, 1], [79, 0.12, 0.7], [158, 0.06, 0.3]], 0.6);
    const sq = D.biquad(D.white(Math.floor(0.2 * SR), r), 'bp', 500, 4);
    D.sweepLP(sq, (t) => 300 + 2500 * t);
    D.env(sq, 0.01, 0.06);
    D.mix(x, sq, 0.35, 0.03);
    const drag = D.env(D.biquad(D.pink(Math.floor(0.35 * SR), r), 'bp', 900, 0.8), 0.05, 0.12);
    D.mix(x, drag, 0.2, 0.05);
    put('hush_step', D.normalize(D.fadeOut(x, 0.15), 0.95));
  }
  {
    const r = R();
    const sec = 1.7;
    const x = D.osc(sec, (t) => 52 + 8 * Math.sin(t * 3), (t) => (0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 17)) * Math.sin(Math.PI * Math.min(1, t / sec)) ** 0.5, 'saw');
    D.biquad(x, 'lp', 520, 0.9);
    const n = D.biquad(D.brown(x.length, r), 'bp', 320, 1.5);
    D.mix(x, n, 0.6);
    D.softclip(x, 2.5);
    D.biquad(x, 'peak', 280, 1.2, 8);
    put('hush_growl', D.normalize(x, 0.85));
  }
  {
    const r = R();
    const x = D.buf(0.9);
    for (let i = 0; i < 9; i++) {
      const s = D.biquad(D.white(Math.floor(0.12 * SR), r), 'bp', 300 + r() * 900, 5);
      D.env(s, 0.005, 0.03);
      D.mix(x, s, 0.5, r() * 0.75);
    }
    D.mix(x, D.env(D.biquad(D.white(Math.floor(0.8 * SR), r), 'bp', 2000, 1), 0.2, 0.25), 0.15);
    put('hush_wet', D.normalize(x, 0.7));
  }
  {
    const r = R();
    const x = D.buf(0.7);
    for (let i = 0; i < 3; i++) D.mix(x, D.env(D.biquad(D.white(Math.floor(0.12 * SR), r), 'bp', 2200 + r() * 600, 1.5), 0.04, 0.03), 0.6, i * 0.18);
    put('hush_sniff', D.normalize(x, 0.5));
  }
  {
    // the jump scare
    const r = R();
    const sec = 2.2;
    const x = D.buf(sec);
    for (const f0 of [311, 466, 622, 933, 1245, 1661]) {
      const o = D.osc(sec, (t) => f0 * (1 - 0.32 * t / sec) * (1 + 0.04 * Math.sin(t * 2 * Math.PI * 23)), (t) => Math.exp(-t / 0.9) * Math.min(1, t / 0.008), 'saw');
      D.mix(x, o, 0.22);
    }
    D.mix(x, D.env(D.biquad(D.white(x.length, r), 'hp', 900), 0.002, 0.45), 0.7);
    const boom = D.modal(D.env(D.brown(Math.floor(0.05 * SR), r), 0.001, 0.02), [[38, 0.9, 1], [57, 0.6, 0.6]], sec);
    D.mix(x, boom, 1.4);
    D.softclip(x, 3.2);
    put('jumpscare', D.normalize(x, 1.0));
  }

  // ---------------------------------------------------------------- house + ambience
  for (let v = 0; v < 2; v++) {
    const r = R();
    const sec = 6 + v;
    const x = D.biquad(D.brown(Math.floor(sec * SR), r), 'lp', 900);
    const crack = D.env(D.biquad(D.white(Math.floor(0.6 * SR), r), 'hp', 600), 0.002, 0.12);
    for (let i = 0; i < x.length; i++) {
      const t = i / SR;
      const sw = Math.exp(-t / 2.2) * (0.6 + 0.4 * Math.sin(t * 2.3 + v)) + 0.3 * Math.exp(-((t - 1.6) ** 2) * 2);
      x[i] *= sw * Math.min(1, t / 0.08);
    }
    D.mix(x, crack, 0.5);
    D.sweepLP(x, (t) => 1400 * Math.exp(-t * 0.7) + 120);
    put('thunder', D.normalize(D.fadeOut(x, 1.2), 1.0));
  }
  {
    const loopify = (x, xf = 0.5) => {
      const n = Math.floor(xf * SR);
      const out = x.slice(0, x.length - n);
      for (let i = 0; i < n; i++) { const t = i / n; out[i] = out[i] * t + x[x.length - n + i] * (1 - t); }
      return out;
    };
    const r = R();
    const rain = D.biquad(D.biquad(D.pink(Math.floor(7 * SR), r), 'lp', 2600), 'hp', 300);
    for (let i = 0; i < 260; i++) {
      const f = 2000 + r() * 4000;
      D.mix(rain, D.osc(0.02, () => f, (t) => Math.exp(-t / 0.004)), 0.05 + r() * 0.08, r() * 6.9);
    }
    put('rain', D.normalize(loopify(rain), 0.6));
    const wind = D.biquad(D.brown(Math.floor(9 * SR), r), 'bp', 380, 0.6);
    for (let i = 0; i < wind.length; i++) { const t = i / SR; wind[i] *= 0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.31 + 1); }
    put('wind', D.normalize(loopify(wind, 1.0), 0.5));
    const st = D.biquad(D.white(Math.floor(2.5 * SR), r), 'hp', 700);
    for (let i = 0; i < st.length; i += Math.floor(SR * (0.002 + r() * 0.03))) st[i] += (r() - 0.5) * 3;
    D.mix(st, D.osc(2.5, () => 15734, () => 0.04), 1);
    put('static', D.normalize(loopify(st, 0.3), 0.5));
    const hiss = D.biquad(D.pink(Math.floor(3 * SR), r), 'hp', 2500);
    put('tape_hiss', D.normalize(loopify(hiss, 0.4), 0.3));
    const drone = D.buf(10);
    D.mix(drone, D.osc(10, () => 41.2, () => 0.5), 1);
    D.mix(drone, D.osc(10, () => 41.7, () => 0.4), 1);
    D.mix(drone, D.osc(10, () => 61.7, () => 0.18, 'tri'), 1);
    D.mix(drone, D.biquad(D.brown(drone.length, r), 'lp', 200), 0.4);
    put('drone', D.normalize(loopify(drone, 1.0), 0.6));
  }
  for (let v = 0; v < 2; v++) {
    const r = R();
    put('groan', creak(2.4 + r(), (t) => 14 + 16 * Math.sin(t * 1.3 + v), [[118, 0.1, 1], [236, 0.08, 0.6], [405, 0.05, 0.4], [690, 0.03, 0.2]], r, 0.6));
  }
  {
    const r = R();
    put('tick', D.normalize(D.modal(click(r, 0.002), [[3200, 0.01, 1], [5100, 0.006, 0.5], [900, 0.02, 0.4]], 0.08), 0.4));
    put('tock', D.normalize(D.modal(click(r, 0.002), [[1500, 0.012, 1], [2600, 0.008, 0.5], [600, 0.025, 0.4]], 0.08), 0.4));
    const f = 196;
    const bell = D.modal(D.biquad(click(r, 0.004), 'lp', 3000), [[f, 3.2, 1], [f * 2, 2.0, 0.5], [f * 2.4, 1.6, 0.35], [f * 3.0, 1.2, 0.3], [f * 4.2, 0.8, 0.2], [f * 5.4, 0.5, 0.12]], 4.5);
    put('chime', D.normalize(D.fadeOut(bell, 0.6), 0.8));
    const drip = D.osc(0.14, (t) => 700 + 1500 * Math.min(1, t / 0.018), (t) => Math.exp(-t / 0.035) * Math.min(1, t / 0.001));
    D.mix(drip, D.env(D.biquad(D.white(Math.floor(0.05 * SR), r), 'bp', 3000, 2), 0.001, 0.01), 0.15);
    put('drip', D.normalize(drip, 0.4));
  }

  // ---------------------------------------------------------------- tape + ui + music
  {
    const r = R();
    const t = D.buf(0.25);
    D.mix(t, D.modal(click(r), [[1200, 0.02, 1], [2900, 0.01, 0.5], [300, 0.04, 0.5]], 0.15), 1, 0);
    D.mix(t, D.modal(click(r), [[900, 0.02, 1], [2500, 0.01, 0.5]], 0.15), 0.7, 0.06);
    put('tape_click', D.normalize(t, 0.6));
    put('ui_hover', D.normalize(D.modal(click(r, 0.001), [[2300, 0.012, 1], [4700, 0.006, 0.4]], 0.05), 0.18));
    const sel = D.buf(0.3);
    D.mix(sel, D.modal(click(r), [[170, 0.06, 1], [1100, 0.012, 0.5]], 0.2), 1, 0);
    D.mix(sel, D.modal(click(r), [[2400, 0.01, 1]], 0.05), 0.5, 0.03);
    put('ui_select', D.normalize(sel, 0.4));
    put('ui_back', D.normalize(D.modal(click(r), [[260, 0.05, 1], [700, 0.02, 0.4]], 0.2), 0.32));
    put('blip', D.normalize(D.osc(0.05, () => 1100, (t) => (t < 0.045 ? 1 : 0), 'square'), 0.15));
  }
  {
    const r = R();
    const f = 523.25;
    const exc = D.biquad(click(r, 0.002), 'hp', 1500);
    const tine = D.modal(exc, [[f, 1.9, 1], [f * 2.0, 0.9, 0.08], [f * 5.95, 0.22, 0.14], [f * 11.8, 0.08, 0.06]], 2.4);
    put('tine', D.normalize(D.fadeOut(tine, 0.3), 0.6));
  }
  {
    const r = R();
    const kick = D.osc(0.35, (t) => 45 + 110 * Math.exp(-t / 0.04), (t) => Math.exp(-t / 0.12));
    put('kick', D.normalize(kick, 0.9));
    const boom = D.modal(D.env(D.brown(Math.floor(0.08 * SR), r), 0.001, 0.03), [[36, 1.8, 1], [54, 1.2, 0.6], [81, 0.6, 0.3]], 4);
    D.mix(boom, D.env(D.biquad(D.white(Math.floor(1.0 * SR), r), 'lp', 400), 0.01, 0.4), 0.2);
    put('boom', D.normalize(D.fadeOut(boom, 0.8), 1.0));
    const riser = D.biquad(D.white(Math.floor(3 * SR), r), 'bp', 600, 1);
    D.sweepLP(riser, (t) => 300 + t * 1800);
    for (let i = 0; i < riser.length; i++) { const t = i / riser.length; riser[i] *= t * t; }
    put('riser', D.normalize(riser, 0.6));
    // dissonant string swell (stinger)
    const sw = D.buf(3.5);
    for (const fr of [110, 116.5, 164.8, 233.1, 246.9]) {
      D.mix(sw, D.osc(3.5, (t) => fr * (1 + 0.003 * Math.sin(t * 5.5 + fr)), (t) => Math.sin(Math.PI * Math.min(1, t / 3.5)) ** 1.5, 'saw'), 0.2);
    }
    D.biquad(sw, 'lp', 1400);
    put('swell', D.normalize(sw, 0.6));
  }
  return B;
}
