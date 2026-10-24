// Tiny offline DSP toolkit used to synthesise sound effects into AudioBuffers.

export const SR = 44100;

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
}

export function buf(seconds) { return new Float32Array(Math.max(1, Math.floor(seconds * SR))); }

export function white(n, r = Math.random) { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
export function pink(n, r = Math.random) {
  const o = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}
export function brown(n, r = Math.random) {
  const o = new Float32Array(n); let last = 0;
  for (let i = 0; i < n; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; o[i] = last * 3.5; }
  return o;
}

// RBJ biquad (in place). type: lp | hp | bp | peak
export function biquad(x, type, freq, q = 0.707, gainDb = 0) {
  const w0 = 2 * Math.PI * Math.min(freq, SR * 0.45) / SR;
  const cs = Math.cos(w0), sn = Math.sin(w0);
  const alpha = sn / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
  else if (type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
  else { b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

// time-varying one-pole lowpass with cutoff function f(t) in Hz
export function sweepLP(x, f) {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const c = f(i / SR);
    const a = 1 - Math.exp(-2 * Math.PI * c / SR);
    y += (x[i] - y) * a;
    x[i] = y;
  }
  return x;
}

export function env(x, attack, decay, curve = 1) {
  const a = Math.max(1, attack * SR);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let g = i < a ? i / a : Math.exp(-(t - attack) / Math.max(1e-4, decay));
    x[i] *= Math.pow(g, curve);
  }
  return x;
}
export function fadeOut(x, sec) {
  const n = Math.min(x.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}
export function fadeIn(x, sec) {
  const n = Math.min(x.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) x[i] *= i / n;
  return x;
}
export function gain(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
export function mix(dst, src, g = 1, offset = 0) {
  const o = Math.floor(offset * SR);
  for (let i = 0; i < src.length && i + o < dst.length; i++) if (i + o >= 0) dst[i + o] += src[i] * g;
  return dst;
}
export function normalize(x, peak = 0.9) {
  let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) gain(x, peak / m);
  return x;
}
export function softclip(x, drive = 1) { for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive); return x; }

// sine with pitch function f(t) Hz and amplitude function a(t)
export function osc(seconds, f, a = () => 1, shape = 'sine', phase0 = 0) {
  const x = buf(seconds);
  let ph = phase0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += f(t) / SR;
    const p = ph - Math.floor(ph);
    let v;
    if (shape === 'sine') v = Math.sin(p * 2 * Math.PI);
    else if (shape === 'saw') v = 2 * p - 1;
    else if (shape === 'tri') v = 1 - 4 * Math.abs(p - 0.5);
    else v = p < 0.5 ? 1 : -1;
    x[i] = v * a(t);
  }
  return x;
}

// Resonator bank applied to an excitation (modal synthesis)
export function modal(exc, modes, seconds) {
  const out = buf(seconds);
  for (const [f, decay, amp] of modes) {
    const w = 2 * Math.PI * f / SR;
    const r = Math.exp(-1 / (decay * SR));
    const c = 2 * r * Math.cos(w);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i++) {
      const xi = i < exc.length ? exc[i] : 0;
      const y = xi * amp + c * y1 - r * r * y2;
      y2 = y1; y1 = y;
      out[i] += y;
    }
  }
  return out;
}

// stick-slip friction excitation (creaks)
export function stickSlip(seconds, rateFn, r = Math.random, jitter = 0.25) {
  const x = buf(seconds);
  let next = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    if (i >= next) {
      const amp = 0.6 + r() * 0.4;
      x[i] = amp;
      if (i + 1 < x.length) x[i + 1] = -amp * 0.6;
      const rate = Math.max(8, rateFn(t));
      next = i + Math.floor((SR / rate) * (1 + (r() - 0.5) * jitter));
    }
  }
  return x;
}

export function toBuffer(ctx, data, channels = 1) {
  const b = ctx.createBuffer(channels, data.length, SR);
  for (let c = 0; c < channels; c++) b.copyToChannel(data, c);
  return b;
}
export function toStereo(ctx, L, R) {
  const n = Math.max(L.length, R.length);
  const b = ctx.createBuffer(2, n, SR);
  b.copyToChannel(L, 0); b.copyToChannel(R, 1);
  return b;
}

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
