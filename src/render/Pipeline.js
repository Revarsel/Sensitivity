import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Edge detection + composite: turns the G-buffer into glowing outlines.
const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tReveal;
uniform vec2 uTexel;
uniform float uEdgeWidth;
uniform float uEdgeGain;
uniform float uTime;
uniform vec3 uHighlightColor;
varying vec2 vUv;

vec4 nd(vec2 uv) {
  vec4 v = texture2D(tNormal, uv);
  if (v.a <= 0.0) return vec4(0.0, 0.0, 1.0, 4000.0);
  return vec4(normalize(v.rgb * 2.0 - 1.0), v.a);
}

void main() {
  vec2 o = uTexel * uEdgeWidth;
  vec4 c = texture2D(tColor, vUv);
  vec4 n0 = nd(vUv);
  vec4 nl = nd(vUv - vec2(o.x, 0.0));
  vec4 nr = nd(vUv + vec2(o.x, 0.0));
  vec4 nu = nd(vUv + vec2(0.0, o.y));
  vec4 ndn = nd(vUv - vec2(0.0, o.y));
  vec4 a1 = nd(vUv + o);
  vec4 a2 = nd(vUv - o);
  vec4 a3 = nd(vUv + vec2(o.x, -o.y));
  vec4 a4 = nd(vUv + vec2(-o.x, o.y));

  float d0 = n0.a;
  float dx = abs(nl.a + nr.a - 2.0 * d0);
  float dy = abs(nu.a + ndn.a - 2.0 * d0);
  float dd1 = abs(a1.a + a2.a - 2.0 * d0);
  float dd2 = abs(a3.a + a4.a - 2.0 * d0);
  float dz = max(max(dx, dy), max(dd1, dd2) * 0.7) / max(d0, 0.2);
  float eD = smoothstep(0.012, 0.045, dz);

  float nE = 0.0;
  nE = max(nE, 1.0 - dot(n0.xyz, nl.xyz));
  nE = max(nE, 1.0 - dot(n0.xyz, nr.xyz));
  nE = max(nE, 1.0 - dot(n0.xyz, nu.xyz));
  nE = max(nE, 1.0 - dot(n0.xyz, ndn.xyz));
  float eN = smoothstep(0.06, 0.3, nE);
  float edge = max(eD, eN);
  // fade edges with distance so far geometry is calmer
  edge *= 1.0 - smoothstep(14.0, 30.0, d0) * 0.6;

  vec4 r0 = texture2D(tReveal, vUv);
  vec4 r1 = texture2D(tReveal, vUv - vec2(o.x, 0.0));
  vec4 r2 = texture2D(tReveal, vUv + vec2(o.x, 0.0));
  vec4 r3 = texture2D(tReveal, vUv + vec2(0.0, o.y));
  vec4 r4 = texture2D(tReveal, vUv - vec2(0.0, o.y));
  vec4 rm = max(max(max(r0, r1), max(r2, r3)), r4);

  vec3 col = c.rgb;
  col += edge * rm.rgb * uEdgeGain;
  // interactable highlight: soft amber outline that breathes
  float hl = rm.a;
  float breathe = 0.55 + 0.45 * sin(uTime * 2.6);
  col += edge * hl * uHighlightColor * breathe;
  col += c.rgb * 0.0;
  gl_FragColor = vec4(col + rm.a * uHighlightColor * 0.012 * breathe, 1.0);
}
`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime;
uniform float uFear;
uniform float uBeat;
uniform float uFade;
uniform float uRed;
uniform float uWhite;
uniform float uCA;
uniform float uGrain;
uniform float uVignette;
uniform float uBrightness;
uniform float uMonitor;
uniform float uStatic;
uniform float uDistort;
varying vec2 vUv;

float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float aspect = uRes.x / uRes.y;
  // subtle lens distortion, stronger on the monitor
  float k = mix(0.025 + uDistort, 0.22, uMonitor);
  uv = 0.5 + cc * (1.0 - k * 0.25 + k * dot(cc, cc));
  if (uMonitor > 0.5) {
    // tracking wobble
    float wob = sin(uv.y * 40.0 + uTime * 3.0) * 0.0007 + (h12(vec2(floor(uv.y * 160.0), floor(uTime * 24.0))) - 0.5) * 0.0025 * uStatic;
    uv.x += wob;
  }
  vec2 dir = uv - 0.5;
  float ca = uCA * (0.4 + 2.2 * dot(dir, dir)) + uFear * 0.004 * uBeat;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir * ca).b;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);

  col *= uBrightness;
  col = aces(col * 1.1);

  float vig = smoothstep(1.05, 0.25, length(cc * vec2(aspect * 0.78, 1.0)));

  if (uMonitor > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    l = pow(l, 0.85) * 1.15;
    vec3 ph = vec3(0.62, 0.86, 0.72) * l + vec3(0.012, 0.022, 0.016);
    float scan = 0.82 + 0.18 * sin(vUv.y * uRes.y * 1.3);
    float bar = smoothstep(0.0, 0.08, abs(fract(vUv.y * 0.6 - uTime * 0.11) - 0.5)) * 0.12 + 0.88;
    float n = h12(vUv * uRes + fract(uTime * 37.0) * 400.0);
    ph = ph * scan * bar + (n - 0.5) * (0.09 + uStatic * 0.5);
    ph = mix(ph, vec3(n) * 0.6, clamp(uStatic - 0.6, 0.0, 1.0));
    col = ph * smoothstep(1.0, 0.35, length(cc * vec2(aspect * 0.7, 1.0)));
  } else {
    col *= mix(1.0, vig, uVignette);
    // fear: red bleeding in from the edges with the heartbeat
    col += vec3(0.32, 0.0, 0.015) * (1.0 - vig) * uFear * (0.35 + 0.65 * uBeat);
    col = mix(col, col * vec3(1.05, 0.85, 0.85), uFear * 0.4);
  }
  // void lift (never pure black - feels like ink, not a dead screen)
  col += vec3(0.010, 0.011, 0.014) * (0.6 + 0.4 * vig);

  col += vec3(0.75, 0.02, 0.0) * uRed;
  col = mix(col, vec3(1.0, 0.97, 0.93), uWhite);

  float g = h12(vUv * uRes + fract(uTime * 13.0) * 1000.0) - 0.5;
  col += g * uGrain * (0.6 + 0.4 * (1.0 - dot(col, vec3(0.33))));
  col *= 1.0 - uFade;
  // dither to fight banding in the dark
  col += (h12(vUv * uRes * 1.37 + 3.1) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class Pipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.scale = 1;
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, count: 3 };
    this.gbuf = new THREE.WebGLRenderTarget(4, 4, opts);
    for (const t of this.gbuf.textures) { t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    this.gbuf.textures[0].minFilter = THREE.LinearFilter;
    this.gbuf.textures[0].magFilter = THREE.LinearFilter;
    this.hdr = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.edgeRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.fxaaMat = new THREE.ShaderMaterial({
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      depthTest: false, depthWrite: false,
    });
    this.fxaaMat.uniforms.tDiffuse.value = this.edgeRT.texture;
    this.fxaaQuad = new FullScreenQuad(this.fxaaMat);

    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tColor: { value: this.gbuf.textures[0] },
        tNormal: { value: this.gbuf.textures[1] },
        tReveal: { value: this.gbuf.textures[2] },
        uTexel: { value: new THREE.Vector2() },
        uEdgeWidth: { value: 1.0 },
        uEdgeGain: { value: 2.8 },
        uTime: { value: 0 },
        uHighlightColor: { value: new THREE.Color(1.0, 0.66, 0.32) },
      },
      depthTest: false, depthWrite: false,
    });
    this.compositeQuad = new FullScreenQuad(this.compositeMat);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.35, 0.3);

    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tDiffuse: { value: this.hdr.texture },
        uRes: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uFear: { value: 0 },
        uBeat: { value: 0 },
        uFade: { value: 0 },
        uRed: { value: 0 },
        uWhite: { value: 0 },
        uCA: { value: 0.0035 },
        uGrain: { value: 0.06 },
        uVignette: { value: 0.9 },
        uBrightness: { value: 1.0 },
        uMonitor: { value: 0 },
        uStatic: { value: 0 },
        uDistort: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });
    this.finalQuad = new FullScreenQuad(this.finalMat);
    this.fx = this.finalMat.uniforms;
  }

  setSize(w, h, pixelRatio) {
    const pw = Math.max(2, Math.floor(w * pixelRatio * this.scale));
    const ph = Math.max(2, Math.floor(h * pixelRatio * this.scale));
    this.gbuf.setSize(pw, ph);
    this.hdr.setSize(pw, ph);
    this.edgeRT.setSize(pw, ph);
    this.fxaaMat.uniforms.resolution.value.set(1 / pw, 1 / ph);
    this.bloom.setSize(pw, ph);
    this.compositeMat.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    this.compositeMat.uniforms.uEdgeWidth.value = Math.max(1.0, ph / 900);
    this.fx.uRes.value.set(pw, ph);
    this.width = pw; this.height = ph;
  }

  render(scene, camera, time, dt) {
    const r = this.renderer;
    r.setRenderTarget(this.gbuf);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);

    this.compositeMat.uniforms.uTime.value = time;
    r.setRenderTarget(this.edgeRT);
    this.compositeQuad.render(r);
    r.setRenderTarget(this.hdr);
    this.fxaaQuad.render(r);

    // bloom renders additively back into hdr
    this.bloom.render(r, null, this.hdr, dt, false);

    this.fx.uTime.value = time;
    r.setRenderTarget(null);
    this.finalQuad.render(r);
  }
}
