import * as THREE from 'three';
import { MAX_PULSES } from './Pulses.js';

export const PAT = {
  PLAIN: 0, FLOORBOARD: 1, WALLPAPER: 2, TILE: 3, CARPET: 4, FABRIC: 5, WOOD: 6, METAL: 7,
  FUR: 8, PAPER: 9, GLASS: 10, BLOOD: 11, STUFFING: 12, BRICK: 13, PLASTER: 14, WALLTILE: 15,
};

const COMMON_GLSL = /* glsl */`
precision highp float;
precision highp int;
#define MAXP ${MAX_PULSES}
uniform sampler2D uField;
uniform vec4 uGrid;
uniform float uGridH;
uniform vec4 uPulseA[MAXP];
uniform vec4 uPulseB[MAXP];
uniform vec3 uPalette[4];
uniform vec4 uAmbient;
uniform vec4 uFlash;
uniform vec4 uPlayer;
uniform float uTime;
uniform float uGain;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash13(i), b = hash13(i + vec3(1,0,0)), c = hash13(i + vec3(0,1,0)), d = hash13(i + vec3(1,1,0));
  float e = hash13(i + vec3(0,0,1)), f1 = hash13(i + vec3(1,0,1)), g = hash13(i + vec3(0,1,1)), h = hash13(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,f1,f.x), mix(g,h,f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

float fieldDist(int i, vec2 xz) {
  vec2 g = (xz - uGrid.xy) / uGrid.z;
  g.x = clamp(g.x, 0.5, uGrid.w - 0.5);
  g.y = clamp(g.y, 0.5, uGridH - 0.5);
  vec2 uv = vec2(g.x / uGrid.w, (float(i) * uGridH + g.y) / (uGridH * float(MAXP)));
  return texture(uField, uv).r;
}

// Accumulate the reveal light arriving at world point p with normal n.
vec3 gatherReveal(vec3 p, vec3 n, out float ringOut) {
  vec3 sp = p + n * 0.17;
  vec3 col = vec3(0.0);
  ringOut = 0.0;
  for (int i = 0; i < MAXP; i++) {
    vec4 B = uPulseB[i];
    if (B.x <= 0.0) continue;
    vec4 A = uPulseA[i];
    float eu = distance(sp.xz, A.xz);
    if (eu > B.z) continue; // geodesic distance is never shorter than straight-line
    float geo = B.w >= 3.5 ? eu : fieldDist(i, sp.xz);
    if (geo > 900.0) continue;
    float dy = p.y - A.y;
    float d = sqrt(geo * geo + dy * dy * 0.55);
    float front = A.w;
    float maxR = B.z;
    float inside = 1.0 - smoothstep(front - 1.1, front + 0.04, d);
    float fall = 1.0 - smoothstep(maxR * 0.45, maxR, d);
    fall *= fall;
    float ringFade = 1.0 - smoothstep(maxR * 0.5, maxR * 1.05, front);
    float x = (d - front) / 0.2;
    float ring = exp(-x * x) * ringFade;
    vec3 L = A.xyz - p;
    float ll = length(L);
    float lam = 0.42 + 0.58 * clamp(dot(n, L / max(ll, 1e-3)) * 0.5 + 0.5, 0.0, 1.0);
    float glow = B.x * (inside * B.y * fall * lam * 0.28 + ring * 0.85 * fall);
    int ci = int(mod(B.w, 4.0));
    col += uPalette[ci] * glow;
    ringOut += ring * fall * B.x;
  }
  // near-field: barely make out what is right in front of you
  float pd = distance(p, uPlayer.xyz);
  float near = uPlayer.w * pow(1.0 - smoothstep(0.0, 1.9, pd), 2.0);
  col += uPalette[0] * near * (0.6 + 0.4 * clamp(dot(n, normalize(uPlayer.xyz - p)), 0.0, 1.0));
  // ambient (night vision, dawn)
  float hemi = 0.65 + 0.35 * n.y;
  col += uAmbient.rgb * uAmbient.w * hemi;
  // lightning
  col += uFlash.rgb * uFlash.w * (0.55 + 0.45 * abs(n.x));
  return col * uGain;
}
`;

const VERT = /* glsl */`
precision highp float;
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vViewNormal;
out float vViewZ;
out vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  mat3 nm = transpose(inverse(mat3(modelMatrix)));
  vNormal = normalize(nm * normal);
  vViewNormal = normalize(mat3(viewMatrix) * vNormal);
  vec4 mv = viewMatrix * wp;
  vViewZ = -mv.z;
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
${COMMON_GLSL}
uniform vec3 uBase;
uniform vec4 uParams;   // x: pattern id, y: pattern scale, z: emissive, w: highlight
uniform vec3 uTint;
uniform vec3 uEmissiveColor;
#ifdef USE_MAP
uniform sampler2D uMap;
#endif
in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vViewNormal;
in float vViewZ;
in vec2 vUv;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gReveal;

float seam(float v, float w) { float f = fract(v); return smoothstep(0.0, w, f) * smoothstep(1.0, 1.0 - w, f); }

float pattern(int id, vec3 p, vec3 n, float sc) {
  vec3 an = abs(n);
  // in-plane coordinate along a wall
  float u = an.x > an.z ? p.z : p.x;
  if (id == 1) { // floorboards along x
    float w = 0.145;
    float row = floor(p.z / w);
    float r = hash11(row * 1.37 + 3.1);
    float joint = seam((p.x + r * 2.3) / 2.1, 0.008);
    float s = seam(p.z / w, 0.05);
    float grain = fbm(vec3(p.x * 1.2, p.z * 28.0, row));
    return mix(0.5, 1.0, s * joint) * (0.72 + 0.4 * grain) * (0.8 + 0.35 * r);
  }
  if (id == 2) { // wallpaper with wainscot
    if (p.y < 0.92) {
      float b = seam(u / 0.11, 0.06);
      return (0.55 + 0.25 * b) * (0.8 + 0.25 * fbm(vec3(u * 2.0, p.y * 9.0, 1.0)));
    }
    float stripe = 0.82 + 0.18 * step(0.5, fract(u / 0.19));
    vec2 m = vec2(u, p.y) * 28.0;
    float motif = 0.5 + 0.5 * sin(m.x) * sin(m.y + sin(m.x * 0.5) * 1.5);
    float stain = smoothstep(0.35, 0.75, fbm(vec3(u * 0.6, p.y * 0.9, 3.3)));
    float peel = smoothstep(0.62, 0.66, fbm(vec3(u * 1.7, p.y * 1.7, 9.0)));
    return stripe * (0.86 + 0.14 * motif) * (1.0 - 0.38 * stain) * (1.0 - 0.45 * peel);
  }
  if (id == 3 || id == 15) { // tile
    vec2 q = an.y > 0.5 ? p.xz : vec2(u, p.y);
    float ts = id == 3 ? 0.3 : 0.15;
    vec2 g = q / ts;
    float row = floor(g.y);
    if (id == 15) g.x += mod(row, 2.0) * 0.5;
    float gr = seam(g.x, 0.04) * seam(g.y, 0.04);
    float t = hash13(vec3(floor(g), 7.0));
    float check = id == 3 ? (mod(floor(g.x) + floor(g.y), 2.0) * 0.35 + 0.65) : 1.0;
    float dirt = fbm(vec3(q * 1.5, 2.0));
    return mix(0.3, 1.0, gr) * check * (0.85 + 0.15 * t) * (0.8 + 0.3 * dirt);
  }
  if (id == 4) { // carpet
    return (0.62 + 0.3 * vnoise(p * 55.0)) * (0.72 + 0.4 * fbm(p * 1.8));
  }
  if (id == 5) { // fabric weave
    vec3 q = p * 140.0;
    float w = 0.5 + 0.25 * (sin(q.x + q.y) * sin(q.z - q.y));
    return (0.75 + 0.2 * w) * (0.75 + 0.35 * fbm(p * 3.0));
  }
  if (id == 6) { // wood grain on furniture
    float along = an.y > 0.5 ? p.x : p.y;
    float g = fbm(vec3(along * 1.5, u * 30.0, p.y * 4.0));
    float rings = 0.5 + 0.5 * sin((u + g * 0.3) * 90.0);
    return (0.66 + 0.24 * g + 0.1 * rings) * sc;
  }
  if (id == 7) {
    return 0.8 + 0.2 * vnoise(vec3(p.x * 3.0, p.y * 90.0, p.z * 3.0));
  }
  if (id == 8) { // plush fur, clumped
    float f = vnoise(p * 70.0) * 0.5 + vnoise(p * 21.0) * 0.5;
    float matt = fbm(p * 4.0);
    return (0.48 + 0.55 * f) * (0.6 + 0.6 * matt);
  }
  if (id == 9) { return 0.95 + 0.05 * vnoise(p * 30.0); }
  if (id == 10) { return 0.5; }
  if (id == 11) { // blood
    float m = fbm(p * 5.0 * sc);
    return 0.45 + 0.75 * m;
  }
  if (id == 12) { // stuffing
    return 0.75 + 0.35 * fbm(p * 22.0);
  }
  if (id == 13) { // brick
    vec2 q = an.y > 0.5 ? p.xz : vec2(u, p.y);
    vec2 g = q / vec2(0.22, 0.075);
    g.x += mod(floor(g.y), 2.0) * 0.5;
    float m = seam(g.x, 0.06) * seam(g.y, 0.12);
    return mix(0.3, 1.0, m) * (0.75 + 0.35 * hash13(vec3(floor(g), 1.0)));
  }
  if (id == 14) { // plaster ceiling
    float c = fbm(p * 1.4);
    float crack = smoothstep(0.015, 0.0, abs(fbm(p * 0.9 + 4.0) - 0.5));
    return (0.8 + 0.25 * c) * (1.0 - 0.55 * crack);
  }
  return 0.82 + 0.18 * fbm(p * 3.0 * sc);
}

void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 p = vWorldPos;
  int pid = int(uParams.x + 0.5);
  float ring;
  vec3 light = gatherReveal(p, n, ring);
  float alb = pattern(pid, p, n, uParams.y);
  vec3 base = uBase * alb;
#ifdef USE_MAP
  vec4 tx = texture(uMap, vUv);
  #ifdef MAP_CUTOUT
  if (tx.a < hash13(vec3(gl_FragCoord.xy, 3.0)) * 0.8 + 0.1) discard;
  #endif
  base = uBase * mix(vec3(alb), tx.rgb, 0.85);
#endif
  vec3 surf = base * light;
  if (pid == 10 || pid == 11) {
    // wet / glassy sheen
    vec3 V = normalize(cameraPosition - p);
    float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
    surf += light * (pid == 10 ? 0.55 : 0.3) * (0.2 + fres);
  }
  surf += uEmissiveColor * uParams.z;
  vec3 tinted = light * uTint;
  gColor = vec4(surf * uTint, 1.0);
  vec3 vn = normalize(vViewNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  gNormal = vec4(vn * 0.5 + 0.5, vViewZ);
  gReveal = vec4(tinted + ring * 0.0, uParams.w);
}
`;

let SHARED = null;
export function setSharedUniforms(u) { SHARED = u; }

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
};

/**
 * Create a reveal material.
 * @param {object} o { color, pattern, scale, tint, emissive, emissiveColor, side }
 */
export function revealMaterial(o = {}) {
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG.replace('void main() {', 'uniform vec3 cameraPosition;\nvoid main() {'),
    uniforms: {
      ...SHARED,
      uBase: { value: new THREE.Color(o.color ?? 0xb8b2a8) },
      uParams: { value: new THREE.Vector4(o.pattern ?? 0, o.scale ?? 1, o.emissive ?? 0, 0) },
      uTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
      uEmissiveColor: { value: new THREE.Color(o.emissiveColor ?? 0x000000) },
      ...(o.map ? { uMap: { value: o.map } } : {}),
    },
    defines: {
      ...(o.map ? { USE_MAP: 1 } : {}),
      ...(o.cutout ? { MAP_CUTOUT: 1 } : {}),
    },
    side: o.side ?? THREE.FrontSide,
    transparent: false,
  });
  mat.userData.isReveal = true;
  return mat;
}

export function setHighlight(mat, v) {
  if (mat && mat.uniforms && mat.uniforms.uParams) mat.uniforms.uParams.value.w = v;
}

// Additive points (dust motes, sparks) that only show where sound has passed.
const POINT_VERT = /* glsl */`
${COMMON_GLSL}
in vec3 position;
in float aSeed;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uSize;
uniform float uPixelRatio;
out vec3 vCol;
out float vAlpha;
void main() {
  vec3 p = position;
  float t = uTime * 0.05 + aSeed * 40.0;
  p += vec3(sin(t * 1.3 + aSeed * 7.0), sin(t * 0.7 + aSeed * 3.0) * 0.6, cos(t * 1.1 + aSeed * 5.0)) * 0.25;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  float ring;
  vec3 c = gatherReveal(wp.xyz, vec3(0.0, 1.0, 0.0), ring);
  vCol = c;
  vAlpha = 0.2 + 0.5 * fract(aSeed * 13.7);
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed) / max(0.3, -mv.z);
}
`;
const POINT_FRAG = /* glsl */`
precision highp float;
in vec3 vCol;
in float vAlpha;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gReveal;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = 1.0 - smoothstep(0.1, 0.5, length(c));
  gColor = vec4(vCol * d * vAlpha * 1.6, 0.0);
  gNormal = vec4(0.0);
  gReveal = vec4(0.0);
}
`;

export function dustMaterial(size = 16) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: { ...SHARED, uSize: { value: size }, uPixelRatio: { value: 1 } },
    ...ADDITIVE,
  });
}

// Simple additive glow (eye glints, held-item rim) independent of pulses.
const GLOW_FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gReveal;
void main() {
  gColor = vec4(uColor * uIntensity, 0.0);
  gNormal = vec4(0.0);
  gReveal = vec4(0.0);
}
`;
const GLOW_VERT = /* glsl */`
precision highp float;
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export function glowMaterial(color = 0xffffff, intensity = 1) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
    ...ADDITIVE,
  });
}

// Per-object copy of a reveal material that still shares the global pulse uniforms.
export function cloneReveal(mat) {
  const u = mat.uniforms;
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: mat.vertexShader,
    fragmentShader: mat.fragmentShader,
    uniforms: {
      ...SHARED,
      uBase: { value: u.uBase.value.clone() },
      uParams: { value: u.uParams.value.clone() },
      uTint: { value: u.uTint.value.clone() },
      uEmissiveColor: { value: u.uEmissiveColor.value.clone() },
      ...(u.uMap ? { uMap: { value: u.uMap.value } } : {}),
    },
    defines: { ...mat.defines },
    side: mat.side,
  });
  m.userData.isReveal = true;
  return m;
}

// See-through glass: never writes depth, only adds a faint sheen where sound passes.
const GLASS_FRAG = /* glsl */`
${COMMON_GLSL}
uniform vec3 cameraPosition;
in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vViewNormal;
in float vViewZ;
in vec2 vUv;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gReveal;
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float ring;
  vec3 light = gatherReveal(vWorldPos, n, ring);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 2.0);
  // rain running down the pane
  float streak = smoothstep(0.82, 1.0, fract(vWorldPos.y * 3.0 + uTime * 0.6 + floor((vWorldPos.x + vWorldPos.z) * 22.0) * 0.37));
  streak *= step(0.6, fract(sin(floor((vWorldPos.x + vWorldPos.z) * 22.0) * 91.3) * 43758.5));
  gColor = vec4(light * (0.05 + 0.25 * fres + 0.35 * streak) + uFlash.rgb * uFlash.w * 0.15, 0.0);
  gNormal = vec4(0.0);
  gReveal = vec4(0.0);
}
`;
export function glassMaterial() {
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: { ...SHARED },
    side: THREE.DoubleSide,
    ...ADDITIVE,
  });
  return m;
}
