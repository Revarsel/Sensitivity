import * as THREE from 'three';
import { buildGroup } from '../world/Builder.js';
import { revealMaterial, PAT } from '../render/RevealMaterial.js';
import { PULSE } from '../render/Pulses.js';

// Thimble: Cradle & Co.'s porcelain "rocking companion", sitting in June's rocking chair.
// In the holdout he grows restless when nobody sings to him (agitation 0..1). You can watch it on
// the wall: his shadow grows and stretches, and a slow heartbeat thud speeds up, each beat throwing
// a faint red pulse that lights the wall. At 1 he comes for you. The music box calms him, but it is
// Mr. Hush's song too, and it brings him to the door (handled by Holdout).

const SONG_SECONDS = 6.5;   // how long one wind of the music box plays
const CALM_RATE = 0.12;     // agitation removed per second while it plays
const SHADOW_X = 16.25;     // centre of his shadow on the north wall

export class Thimble {
  constructor(game, rocker) {
    this.g = game;
    this.a = 0;              // agitation
    this.active = false;
    this.songT = 0;
    this.beatT = 0;
    this.shown = 0;          // smoothed agitation used for visuals
    this.warned = false;
    const M = game.M;

    // ---- the doll, seated in the rocker (rocker local space; seat top at y 0.47)
    this.eyeMat = revealMaterial({ color: 0x111014, pattern: PAT.PLAIN, emissiveColor: 0xff2414, emissive: 0 });
    this.doll = buildGroup((b) => {
      // sailor romper and collar
      b.cyl(M.toyBlue, 0, 0.12, 0, 0.085, 0.105, 0.22, 12);
      b.cyl(M.linen, 0, 0.225, 0, 0.1, 0.1, 0.025, 12);
      // legs over the seat edge, too thin
      for (const s of [-1, 1]) {
        b.tube(M.toyBlue, [[s * 0.045, 0.03, 0.0], [s * 0.05, 0.03, 0.16], [s * 0.055, -0.15, 0.22]], 0.032, 8, 6);
        b.sphere(M.black, s * 0.055, -0.17, 0.24, 0.035, 1, 0.8, 1.4, 8);
        // arms: long, hanging past the seat
        b.tube(M.porcelain, [[s * 0.1, 0.2, -0.01], [s * 0.13, 0.06, 0.03], [s * 0.14, -0.1, 0.07]], 0.022, 8, 6);
        b.sphere(M.porcelain, s * 0.14, -0.13, 0.08, 0.03, 0.8, 1.3, 0.6, 8);
      }
      // porcelain head, painted hair, a crack across the face
      b.sphere(M.porcelain, 0, 0.33, 0.0, 0.09, 1, 1.05, 0.95, 16);
      b.sphere(M.darkWood, 0, 0.36, -0.012, 0.088, 1.02, 0.75, 0.96, 14);
      b.box(M.black, -0.06, 0.335, 0.083, 0.035, 0.338, 0.087);
      b.box(M.toyRed, -0.018, 0.29, 0.085, 0.018, 0.294, 0.088);
    });
    // glass eyes (own material so they can glow)
    const eyeGeo = new THREE.SphereGeometry(0.016, 10, 8);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, this.eyeMat);
      e.position.set(s * 0.032, 0.34, 0.078);
      this.doll.add(e);
    }
    this.doll.position.set(0, 0.47, -0.04);
    rocker.add(this.doll);
    this.rocker = rocker;
    this.restYaw = rocker.rotation.y; // facing the corner, as Diane left him

    // ---- his shadow on the north wall behind his chair (right of the poster; clear of the shutters)
    const tex = new THREE.CanvasTexture(shadowCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    this.shadowMat = revealMaterial({ color: 0x040303, pattern: PAT.PLAIN, map: tex, cutout: true, emissiveColor: 0x4a0505, emissive: 0 });
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // origin at the bottom edge
    this.shadow = new THREE.Mesh(geo, this.shadowMat);
    // plane faces +Z, into the room; the wall's inner face is at z = 0.08
    this.shadow.position.set(SHADOW_X, 0.32, 0.087);
    game.scene.add(this.shadow);
    this.applyVisuals(0, 0);
  }

  get worldPos() {
    const p = this.doll.getWorldPosition(new THREE.Vector3());
    return { x: p.x, y: p.y + 0.3, z: p.z };
  }
  get singing() { return this.songT > 0; }

  // holdout start / end
  // at 3:00 AM his chair has turned to face you (the holdout seat)
  begin(faceX, faceZ) {
    this.active = true; this.a = 0.2; this.songT = 0; this.beatT = 1.5; this.warned = false;
    if (faceX !== undefined) this.rocker.rotation.y = Math.atan2(faceX - this.rocker.position.x, faceZ - this.rocker.position.z);
  }
  end() {
    this.active = false;
    this.songT = 0;
    if (this.song) { this.song.stop(0.6); this.song = null; }
  }
  bump(v) { if (this.active) this.a = Math.min(1, this.a + v); }
  // back to a still doll in an empty chair (every checkpoint start)
  reset() {
    this.end();
    this.a = 0; this.shown = 0; this.pulse = 0; this.rockPhase = 0;
    this.doll.position.set(0, 0.47, -0.04);
    this.rocker.rotation.x = 0;
    this.rocker.rotation.y = this.restYaw;
    this.applyVisuals(0, 0);
  }
  // the kill: he swells and leans out of the chair at you (k 0..1)
  lunge(k) {
    this.doll.position.z = -0.04 + k * 0.35;
    this.doll.position.y = 0.47 + k * 0.1;
    this.applyVisuals(1 + k * 0.9, 1);
  }

  // wind June's music box beside him. Returns false if it is already playing.
  sing() {
    if (this.songT > 0) return false;
    const g = this.g, p = this.worldPos;
    this.songT = SONG_SECONDS;
    if (this.song) this.song.stop(0.1);
    this.song = g.audio.musicBox({ pos: p, bus: 'sfx', gain: 0.55, loops: 1, tempo: 64, wobble: 1.4 });
    g.audio.play('click_small', { pos: p, gain: 0.6, rate: 0.7 });
    return true;
  }

  // returns true when he has had enough (agitation reached 1)
  update(dt, riseRate) {
    const g = this.g;
    if (this.songT > 0) {
      this.songT -= dt;
      this.a = Math.max(0, this.a - CALM_RATE * dt);
      if (this.songT <= 0 && this.song) { this.song.stop(0.8); this.song = null; }
    } else if (this.active) {
      this.a = Math.min(1, this.a + riseRate * dt);
    } else {
      this.a = Math.max(0, this.a - dt * 0.2); // after dawn he settles
    }
    this.shown += (this.a - this.shown) * Math.min(1, dt * 2.5);
    const a = this.shown;

    // heartbeat thud from the chair, faster and louder as he grows; each beat lights the wall
    if (this.active && this.a > 0.05) {
      this.beatT -= dt;
      if (this.beatT <= 0) {
        this.beatT = 2.6 - 2.05 * Math.pow(this.a, 1.1);
        const p = this.worldPos;
        g.audio.play('heart_lub', { pos: p, gain: 0.25 + 0.75 * this.a, rate: 0.48, ref: 1.6 });
        g.audio.play('heart_dub', { pos: p, gain: 0.18 + 0.5 * this.a, rate: 0.5, ref: 1.6, delay: 0.2 });
        g.sound({ x: p.x - 0.1, z: p.z - 0.25, y: 1.0, radius: 2.0 + 2.4 * this.a, strength: 0.25 + 0.55 * this.a, color: PULSE.HUSH, source: 'world', euclid: true, speed: 7, linger: 0.6 });
        this.pulse = 1;
      }
    }
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 2.5);
    if (this.active && !this.warned && this.a > 0.6) {
      this.warned = true;
      g.subtitle('Ellis', 'His shadow… it’s bigger. Sing to him.', 3.0);
    }

    // rocking: faster and harder the more restless he is
    if (this.active || a > 0.01) {
      this.rockPhase = (this.rockPhase || 0) + dt * (2.2 + a * 4.5);
      this.rocker.rotation.x = Math.sin(this.rockPhase) * (0.03 + a * 0.12);
    }
    this.applyVisuals(a, this.pulse);
    return this.active && this.a >= 1;
  }

  applyVisuals(a, pulse) {
    // the doll swells a little; the shadow grows and stretches a lot
    this.doll.scale.setScalar(1 + a * 0.55);
    const sway = Math.sin(this.rockPhase || 0) * (0.03 + a * 0.1);
    this.shadow.scale.set(0.45 + a * 1.1, 0.8 + a * 1.7, 1); // at full size it reaches the ceiling
    this.shadow.position.x = SHADOW_X + sway;
    this.shadow.rotation.z = sway * 0.6;
    this.shadow.visible = this.active || a > 0.02;
    // in the dark, the eyes and the shadow's edge glow faintly red on each beat once he's restless
    const glow = Math.max(0, a - 0.35) * (0.4 + 0.6 * pulse);
    this.eyeMat.uniforms.uParams.value.z = glow * 0.9;
    this.shadowMat.uniforms.uParams.value.z = glow * 0.18;
  }
}

// Soft silhouette of the rocker's back with him in it: big head, long arms, long fingers.
function shadowCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  x.filter = 'blur(5px)';
  x.fillStyle = '#000';
  // chair back posts and rail
  x.fillRect(48, 120, 14, 330); x.fillRect(194, 120, 14, 330); x.fillRect(48, 112, 160, 16);
  // body
  x.beginPath(); x.ellipse(128, 300, 58, 86, 0, 0, Math.PI * 2); x.fill();
  // head (too big)
  x.beginPath(); x.ellipse(128, 168, 62, 66, 0, 0, Math.PI * 2); x.fill();
  // arms hanging down past the seat, fingers spread
  for (const s of [-1, 1]) {
    x.beginPath();
    x.moveTo(128 + s * 50, 250); x.quadraticCurveTo(128 + s * 92, 340, 128 + s * 84, 450);
    x.lineTo(128 + s * 70, 450); x.quadraticCurveTo(128 + s * 76, 340, 128 + s * 36, 268);
    x.fill();
    for (let f = 0; f < 4; f++) x.fillRect(128 + s * (66 + f * 6) - 2, 448, 4, 34 + (f % 2) * 10);
  }
  // seat
  x.fillRect(40, 380, 176, 18);
  return c;
}
