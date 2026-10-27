import * as THREE from 'three';
import { FIELD_INF } from './SoundField.js';

export const MAX_PULSES = 24;

// Palette indices
export const PULSE = {
  PLAYER: 0,   // cold ice-white
  HUSH: 1,     // deep red
  WORLD: 2,    // dim amber
  LIGHT: 3,    // pale lore light / tv
};

// Shared uniforms used by every reveal material.
export function createSharedUniforms() {
  const a = [], b = [];
  for (let i = 0; i < MAX_PULSES; i++) { a.push(new THREE.Vector4()); b.push(new THREE.Vector4()); }
  return {
    uField: { value: null },
    uGrid: { value: new THREE.Vector4() },
    uGridH: { value: 1 },
    uPulseA: { value: a },
    uPulseB: { value: b },
    uPulseCount: { value: 0 },
    uPalette: { value: [
      new THREE.Color(0.72, 0.84, 1.0),
      new THREE.Color(1.0, 0.13, 0.08),
      new THREE.Color(1.0, 0.62, 0.30),
      new THREE.Color(0.75, 0.80, 0.95),
    ] },
    uAmbient: { value: new THREE.Vector4(0.5, 0.6, 0.7, 0.0) },
    uFlash: { value: new THREE.Vector4(0.7, 0.8, 1.0, 0.0) },
    uPlayer: { value: new THREE.Vector4(0, 0, 0, 0.05) },
    uTime: { value: 0 },
    uGain: { value: 1 },
  };
}

export class PulseSystem {
  constructor(field, shared) {
    this.field = field;
    this.shared = shared;
    const W = field.W, H = field.H;
    this.W = W; this.H = H;
    this.data = new Uint16Array(W * H * MAX_PULSES);
    const tex = new THREE.DataTexture(this.data, W, H * MAX_PULSES, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.texture = tex;
    shared.uField.value = tex;
    shared.uGrid.value.set(field.minX, field.minZ, field.cell, W);
    shared.uGridH.value = H;
    this.slots = [];
    for (let i = 0; i < MAX_PULSES; i++) {
      this.slots.push({ active: false, x: 0, y: 0, z: 0, radius: 0, speed: 1, maxR: 1, strength: 0, age: 0, life: 1, color: 0, euclid: false, fade: 0 });
    }
    // fill with "infinite" so unused slots never reveal anything
    const inf = THREE.DataUtils.toHalfFloat(FIELD_INF);
    this.data.fill(inf);
    this.halfLUT = null;
    this.dirty = false;
  }

  /**
   * Emit a reveal pulse.
   * @param {object} o { x, y, z, radius, strength, speed, color, linger, hold, tail, euclid, reveals }
   */
  emit(o) {
    const radius = Math.max(0.3, o.radius);
    // choose slot: free first, else the one with least remaining contribution
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < MAX_PULSES; i++) {
      const s = this.slots[i];
      if (!s.active) { best = i; break; }
      const score = s.fade * s.strength * s.maxR;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    const s = this.slots[best];
    s.active = true;
    s.x = o.x; s.y = o.y ?? 0.1; s.z = o.z;
    s.radius = o.startRadius ?? 0.0;
    s.speed = o.speed ?? 11;
    s.maxR = radius;
    s.strength = o.strength ?? 1;
    s.color = o.color ?? 0;
    s.euclid = !!o.euclid;
    s.age = 0;
    s.linger = o.linger ?? 1.4;
    // the dim afterglow outlives the front: linger holds it, then it takes about as long again to fade out
    // hold: seconds the dim afterglow stays after the front (default linger*1.3);
    // tail: seconds it then takes to fade out (default linger*2.1)
    s.hold = o.hold ?? s.linger * 1.3;
    s.tail = o.tail ?? s.linger * 2.1;
    s.life = radius / s.speed + s.hold + s.tail;
    s.fade = 1;
    s.reveals = o.reveals ?? true;
    s.id = this.nextId = (this.nextId || 0) + 1;
    s.dist = null;
    if (!s.euclid) { s.dist = this.field.compute(s.x, s.z, 0, radius + 0.5); this._writeField(best, s.dist); }
    return best;
  }

  // Newest id of a (non-ambient) pulse whose wave has swept over this point inside its lit area,
  // or 0. Same distance as the shader. Evidence uses it to light up when a new sound reaches it.
  sweptOver(x, y, z) {
    let best = 0;
    for (const s of this.slots) {
      if (!s.active || !s.reveals) continue;
      const eu = Math.hypot(x - s.x, z - s.z);
      if (eu > s.maxR) continue;
      const geo = s.dist ? this.field.sample(s.dist, x, z) : eu;
      const dy = y - s.y;
      const d = Math.sqrt(geo * geo + dy * dy * 0.55);
      if (d <= s.radius && d < s.maxR * 0.85 && s.id > best) best = s.id;
    }
    return best;
  }

  _writeField(slot, dist) {
    const N = this.W * this.H;
    const off = slot * N;
    const data = this.data;
    const toHalf = THREE.DataUtils.toHalfFloat;
    // quantise with a small cache: many cells share values
    for (let i = 0; i < N; i++) data[off + i] = toHalf(dist[i]);
    this.dirty = true;
  }

  update(dt) {
    const A = this.shared.uPulseA.value, B = this.shared.uPulseB.value;
    let top = 0;
    for (let i = 0; i < MAX_PULSES; i++) {
      const s = this.slots[i];
      if (!s.active) { B[i].x = 0; continue; }
      s.age += dt;
      s.radius = Math.min(s.maxR * 1.15, s.radius + s.speed * dt);
      const travel = s.maxR / s.speed;
      // the bright stage (about 0.6 s after the wave passes each point) is timed in gatherReveal; this only fades the dim
      // afterglow: it holds while the front travels and for most of the linger, then eases out
      // (the power keeps the dim tail visible for longer: low values sit near the edge pass's threshold)
      const t0 = travel + s.hold;
      const t = Math.min(1, Math.max(0, (s.age - t0) / (s.life - t0)));
      s.fade = Math.pow(1 - t * t * (3 - 2 * t), 0.55);
      if (s.age >= s.life) { s.active = false; B[i].x = 0; continue; }
      A[i].set(s.x, s.y, s.z, s.age * s.speed);
      B[i].set(s.strength, s.fade, s.maxR, s.color + (s.euclid ? 4 : 0) + 8 * Math.max(1, Math.round(s.speed)));
      top = i + 1;
    }
    this.shared.uPulseCount.value = top;
    if (this.dirty) { this.texture.needsUpdate = true; this.dirty = false; }
  }

  clear() {
    for (const s of this.slots) s.active = false;
    for (const b of this.shared.uPulseB.value) b.x = 0;
  }
}
