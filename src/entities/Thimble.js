import * as THREE from 'three';
import { buildGroup } from '../world/Builder.js';
import { revealMaterial, PAT } from '../render/RevealMaterial.js';

// Thimble: Cradle & Co.'s porcelain "rocking companion", sitting in June's rocking chair in front of
// her north window. In the holdout his chair is behind you, just past where you can turn, and he grows
// restless when nobody sings to him (agitation 0..1). You watch it on the wall in front of you: the
// moonlight from the window behind him throws his shadow onto the wall behind the baby monitor, and it
// grows with him (up to the ceiling) while a heartbeat thud speeds up and makes the moonlight throb
// red. At 1 he comes for you. The music box calms him, but it is Mr. Hush's song too, and it brings
// him to June's door or window (handled by Holdout).

const SONG_SECONDS = 6.5;   // how long one wind of the music box plays
const CALM_RATE = 0.12;     // agitation removed per second while it plays
// the moonlit patch on the south wall, behind the baby monitor on the dresser (room face z 4.92)
const PATCH = { x: 15.55, y: 1.55, z: 4.914, w: 2.6, h: 2.2 };
const SHADOW_X = 15.65, SHADOW_Y = 0.55; // bottom centre of his shadow (behind the monitor; the dresser hides the chair)
const MOON = new THREE.Color(0.55, 0.62, 0.8), BEAT_RED = new THREE.Color(0.95, 0.12, 0.08);
const MOON_GLOW = 0.3; // patch brightness (additive)

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

    // ---- moonlight on the wall behind the monitor, with his shadow in it. Additive light (so it shows
    // without any sound), darkened where his silhouette falls; the dresser in front occludes it.
    this.moon = 0;
    this.shadowMat = moonShadowMaterial(new THREE.CanvasTexture(patchCanvas()), new THREE.CanvasTexture(shadowCanvas()));
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(PATCH.w, PATCH.h), this.shadowMat);
    this.shadow.rotation.y = Math.PI; // faces north, into the room
    this.shadow.position.set(PATCH.x, PATCH.y, PATCH.z);
    this.shadow.renderOrder = 5;
    game.scene.add(this.shadow);
    this.applyVisuals(0, 0, 0);
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
    this.moon = 0;
    this.applyVisuals(0, 0, 0);
  }
  // the kill: he swells and leans out of the chair at you (k 0..1)
  lunge(k) {
    this.doll.position.z = -0.04 + k * 0.35;
    this.doll.position.y = 0.47 + k * 0.1;
    this.applyVisuals(1 + k * 0.9, 1, 0);
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
        this.pulse = 1; // the moonlight on the wall throbs red (applyVisuals)
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
    this.moon += ((this.active ? 1 : 0) - this.moon) * Math.min(1, dt * (this.active ? 1.5 : 0.6));
    this.applyVisuals(a, this.pulse, this.moon);
    return this.active && this.a >= 1;
  }

  applyVisuals(a, pulse, moon) {
    // the doll swells a little; the shadow grows and stretches a lot
    this.doll.scale.setScalar(1 + a * 0.55);
    const sway = Math.sin(this.rockPhase || 0) * (0.03 + a * 0.1);
    const sw = 0.5 + a * 1.1, sh = 0.85 + a * 1.75; // metres; at full size it reaches the ceiling
    // patch uv (the plane faces north, so uv.x runs from +x to -x)
    const u = this.shadowMat.uniforms;
    u.uShadowRect.value.set(0.5 - (SHADOW_X + sway - PATCH.x) / PATCH.w, (SHADOW_Y - (PATCH.y - PATCH.h / 2)) / PATCH.h, sw / PATCH.w, sh / PATCH.h);
    // heartbeat: the moonlight throbs, redder and brighter the more restless he is
    const beat = pulse * Math.min(1, a * 1.3);
    u.uColor.value.copy(MOON).lerp(BEAT_RED, beat * 0.75);
    u.uIntensity.value = MOON_GLOW * moon * (1 + beat * 1.2);
    this.shadow.visible = moon > 0.01;
    // the eyes glow faintly red on each beat once he's restless (for the kill, when you turn round)
    const glow = Math.max(0, a - 0.35) * (0.4 + 0.6 * pulse);
    this.eyeMat.uniforms.uParams.value.z = glow * 0.9;
  }
}

// Additive moonlight patch (r channel of uPatch) with his silhouette (alpha of uShadow) cut out of it,
// placed by uShadowRect (bottom-centre x, y and size, in patch uv). Writes only colour, like glowMaterial.
function moonShadowMaterial(patch, shadow) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `precision highp float;
in vec3 position; in vec2 uv;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float;
uniform sampler2D uPatch; uniform sampler2D uShadow;
uniform vec3 uColor; uniform float uIntensity; uniform vec4 uShadowRect;
in vec2 vUv;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gReveal;
void main() {
  float light = texture(uPatch, vUv).r;
  vec2 s = (vUv - uShadowRect.xy) / uShadowRect.zw + vec2(0.5, 0.0);
  float sh = (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0) ? texture(uShadow, s).a : 0.0;
  gColor = vec4(uColor * uIntensity * light * (1.0 - 0.96 * sh), 0.0);
  gNormal = vec4(0.0);
  gReveal = vec4(0.0);
}`,
    uniforms: {
      uPatch: { value: patch }, uShadow: { value: shadow },
      uColor: { value: MOON.clone() }, uIntensity: { value: 0 },
      uShadowRect: { value: new THREE.Vector4(0.5, 0, 0.3, 0.4) },
    },
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
  });
}

// The north window's moonlight thrown across the room: a soft, skewed rectangle split by the mullions.
function patchCanvas() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  x.filter = 'blur(14px)';
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(40, 30); x.lineTo(222, 46); x.lineTo(230, 226); x.lineTo(30, 214); x.closePath(); x.fill();
  x.filter = 'blur(6px)';
  x.fillStyle = '#000';
  x.fillRect(122, 20, 12, 220); // mullion
  x.fillRect(20, 118, 220, 10); // transom
  return c;
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
