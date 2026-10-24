import * as THREE from 'three';
import { revealMaterial, PAT, glowMaterial } from '../render/RevealMaterial.js';

// Procedural Mr Hush: a 2.3 m sagging plush bear, eyes and mouth sewn shut,
// a split belly seam, arms too long, sewing needles where claws should be.

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), u), L(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), u), v),
    L(L(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), u), L(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), u), v),
    w,
  );
}

// displace along normals by noise for a lumpy, overstuffed look
function lumpy(geo, amt = 0.03, freq = 4, seed = 0) {
  const p = geo.attributes.position;
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (noise3(x * freq + seed, y * freq, z * freq) - 0.5) * 2 + (noise3(x * freq * 2.7, y * freq * 2.7 + seed, z * freq * 2.7) - 0.5) * 0.6;
    p.setXYZ(i, x + n.getX(i) * k * amt, y + n.getY(i) * k * amt, z + n.getZ(i) * k * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

function lathe(points, seg = 24) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

export function createHushModel() {
  const tint = 0xff8f86;
  const mats = {
    fur: revealMaterial({ color: 0xb09682, pattern: PAT.FUR, tint }),
    furDark: revealMaterial({ color: 0x7a6656, pattern: PAT.FUR, tint }),
    patch: revealMaterial({ color: 0x9a8a78, pattern: PAT.FABRIC, tint }),
    stuffing: revealMaterial({ color: 0xc9c2b2, pattern: PAT.STUFFING, tint }),
    wet: revealMaterial({ color: 0x6a0e0a, pattern: PAT.BLOOD, tint: 0xffb0a8, scale: 2 }),
    button: revealMaterial({ color: 0x34302c, pattern: PAT.PLAIN, tint }),
    thread: revealMaterial({ color: 0x1e1c1a, pattern: PAT.PLAIN, tint }),
    needle: revealMaterial({ color: 0xb8bcc0, pattern: PAT.METAL, tint: 0xffd0c8 }),
    teeth: revealMaterial({ color: 0xcbc3b0, pattern: PAT.PLAIN, tint: 0xffd8d0 }),
    gum: revealMaterial({ color: 0x5a0a0a, pattern: PAT.BLOOD, tint: 0xffb0a8 }),
  };
  const M = (g, m) => { const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh; };

  const root = new THREE.Group();
  root.name = 'hush';
  const hips = new THREE.Group(); hips.position.y = 0.78; root.add(hips);

  // ---------------- legs
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.24, 0, 0); hips.add(leg);
    const thigh = M(lumpy(lathe([[0.0, -0.78], [0.13, -0.76], [0.17, -0.6], [0.2, -0.3], [0.21, -0.05], [0.0, 0.05]], 16), 0.02, 6, s), mats.fur);
    leg.add(thigh);
    const foot = M(lumpy(new THREE.SphereGeometry(0.17, 16, 10), 0.015, 6, s * 3), mats.fur);
    foot.scale.set(1, 0.55, 1.45); foot.position.set(0, -0.72, 0.08); leg.add(foot);
    const pad = M(new THREE.CircleGeometry(0.1, 16), mats.furDark);
    pad.rotation.x = Math.PI / 2 + 0.25; pad.position.set(0, -0.79, 0.14); leg.add(pad);
    legs.push(leg);
  }

  // ---------------- torso
  const torso = new THREE.Group(); hips.add(torso);
  const bodyGeo = lumpy(lathe([[0.0, -0.12], [0.4, -0.06], [0.57, 0.14], [0.6, 0.34], [0.52, 0.66], [0.44, 0.9], [0.33, 1.08], [0.15, 1.18], [0.0, 1.2]], 30), 0.085, 2.6, 1);
  bodyGeo.scale(1, 1, 0.8);
  // sag: pull the lower belly down and forward, drop the left shoulder
  {
    const pa = bodyGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      if (y < 0.5 && z > 0) { const k = (0.5 - y) * z; y -= k * 0.35; z += k * 0.25; }
      if (x < 0 && y > 0.8) y -= (y - 0.8) * (-x) * 0.5;
      pa.setXYZ(i, x, y, z);
    }
    bodyGeo.computeVertexNormals();
  }
  const body = M(bodyGeo, mats.fur); torso.add(body);

  // belly tear: dark wet slit with stuffing bulging out
  const tear = M(new THREE.SphereGeometry(0.2, 16, 12), mats.wet);
  tear.scale.set(0.55, 1.35, 0.25); tear.position.set(0.04, 0.42, 0.43); torso.add(tear);
  const tufts = [];
  for (let i = 0; i < 9; i++) {
    const g = lumpy(new THREE.IcosahedronGeometry(0.05 + (i % 3) * 0.02, 1), 0.02, 12, i);
    const t = M(g, mats.stuffing);
    const a = (i / 9) * Math.PI * 2;
    t.position.set(0.04 + Math.cos(a) * 0.06, 0.42 + Math.sin(a) * 0.2, 0.46 + (i % 2) * 0.02);
    torso.add(t);
    tufts.push(t);
  }
  // inner lumps glimpsed in the tear
  for (let i = 0; i < 3; i++) {
    const g = lumpy(new THREE.SphereGeometry(0.05, 10, 8), 0.02, 9, i + 9);
    const t = M(g, mats.wet); t.position.set(0.02 + (i - 1) * 0.04, 0.36 + i * 0.07, 0.44); torso.add(t);
  }
  // seam stitches up the chest
  const stitchGeo = new THREE.BoxGeometry(0.07, 0.008, 0.008);
  for (let i = 0; i < 12; i++) {
    const s = M(stitchGeo, mats.thread);
    const y = 0.68 + i * 0.035;
    const r = 0.47 - Math.max(0, (y - 0.75)) * 0.6;
    s.position.set(0, y, r * 0.82 + 0.02);
    s.rotation.z = i % 2 ? 0.5 : -0.5;
    torso.add(s);
  }

  // side seams running down the body
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, y = 1.05 - t * 1.05;
      const r = 0.36 + Math.sin(t * Math.PI) * 0.22;
      pts.push(new THREE.Vector3(sx * r * 0.98, y, -0.02 + Math.sin(t * 5) * 0.02));
    }
    const seam = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 5), mats.thread);
    torso.add(seam);
  }
  // sewn-on patches with cross stitches
  const patches = [[0.3, 0.75, 0.33, 0.6, 0.16, 0.13], [-0.36, 0.3, 0.38, -0.7, 0.14, 0.18], [0.0, 0.85, -0.42, 3.14, 0.22, 0.16]];
  for (const [px, py, pz, ry, w, h] of patches) {
    const pg = new THREE.Group(); pg.position.set(px, py, pz); pg.rotation.y = ry; torso.add(pg);
    pg.add(M(new THREE.BoxGeometry(w, h, 0.025), mats.patch));
    for (let k = 0; k < 8; k++) {
      const st = M(new THREE.BoxGeometry(0.035, 0.006, 0.006), mats.thread);
      const a = (k / 8) * Math.PI * 2;
      st.position.set(Math.cos(a) * w * 0.5, Math.sin(a) * h * 0.5, 0.016);
      st.rotation.z = a + 0.6;
      pg.add(st);
    }
  }
  // matted clumps on the shoulders and back
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const c = M(lumpy(new THREE.SphereGeometry(0.07 + (i % 3) * 0.02, 8, 6), 0.03, 10, i + 20), mats.fur);
    c.position.set(Math.cos(a) * 0.4, 0.92 + Math.sin(i * 1.7) * 0.12, Math.sin(a) * 0.32);
    torso.add(c);
  }
  // stuffing hanging out of the tear in strands
  for (let i = 0; i < 4; i++) {
    const pts = [new THREE.Vector3(0.02 + i * 0.03, 0.3, 0.47), new THREE.Vector3(0.05 + i * 0.04, 0.18, 0.52), new THREE.Vector3(0.03 + i * 0.05, 0.02 - i * 0.04, 0.5)];
    torso.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018 - i * 0.002, 5), i % 2 ? mats.wet : mats.stuffing));
  }

  // ---------------- arms (too long)
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 0.46, 0.98, 0.0); torso.add(shoulder);
    const upper = M(lumpy(lathe([[0.0, 0.05], [0.14, 0.0], [0.15, -0.3], [0.12, -0.62], [0.0, -0.7]], 14), 0.02, 6, s * 5), mats.fur);
    shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = s < 0 ? -0.74 : -0.64; shoulder.add(elbow);
    const fore = M(lumpy(lathe([[0.0, 0.03], [0.12, 0.0], [0.115, -0.35], [0.1, -0.66], [0.0, -0.72]], 14), 0.02, 6, s * 7), mats.fur);
    elbow.add(fore);
    const paw = new THREE.Group(); paw.position.y = -0.7; elbow.add(paw);
    const pawM = M(lumpy(new THREE.SphereGeometry(0.15, 14, 10), 0.02, 7, s * 9), mats.fur);
    pawM.scale.set(1, 1.15, 0.7); paw.add(pawM);
    // sewing needles for claws
    for (let k = 0; k < 4; k++) {
      const nd = M(new THREE.CylinderGeometry(0.004, 0.0015, 0.17, 5), mats.needle);
      nd.position.set((k - 1.5) * 0.06, -0.2, 0.04);
      nd.rotation.x = 0.25 + k * 0.05;
      paw.add(nd);
    }
    arms.push({ shoulder, elbow, paw });
  }

  // ---------------- head
  const neck = new THREE.Group(); neck.position.set(0, 1.12, 0.06); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.28, 0.04); neck.add(head);
  // the head was sewn back on
  const ring = M(new THREE.TorusGeometry(0.2, 0.018, 6, 28), mats.thread);
  ring.rotation.x = Math.PI / 2 + 0.2; ring.position.set(0, 0.02, 0.02); neck.add(ring);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const st = M(new THREE.BoxGeometry(0.008, 0.07, 0.008), mats.thread);
    st.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2 + 0.02);
    st.rotation.y = -a; st.rotation.z = 0.4;
    neck.add(st);
  }
  const skull = M(lumpy(new THREE.SphereGeometry(0.34, 28, 20), 0.06, 3.0, 4), mats.fur);
  skull.scale.set(1.05, 0.95, 0.95); head.add(skull);
  const muzzle = M(lumpy(new THREE.SphereGeometry(0.16, 18, 12), 0.015, 6, 6), mats.furDark);
  muzzle.scale.set(1.1, 0.75, 1.0); muzzle.position.set(0, -0.08, 0.28); head.add(muzzle);
  const nose = M(new THREE.SphereGeometry(0.045, 12, 8), mats.button);
  nose.scale.set(1.3, 0.8, 0.8); nose.position.set(0, -0.03, 0.43); head.add(nose);
  // jaw (opens in the jump scare)
  const jaw = new THREE.Group(); jaw.position.set(0, -0.12, 0.22); head.add(jaw);
  const jawM = M(lumpy(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0.01, 7, 8), mats.furDark);
  jawM.scale.set(1.05, 0.6, 1.0); jawM.position.set(0, 0.0, 0.06); jaw.add(jawM);
  const gum = M(new THREE.CircleGeometry(0.11, 16), mats.gum);
  gum.rotation.x = -Math.PI / 2; gum.position.set(0, 0.002, 0.07); jaw.add(gum);
  const teeth = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 13) * Math.PI - Math.PI / 2;
    const t = M(new THREE.ConeGeometry(0.012, 0.05 + (i % 3) * 0.015, 5), mats.teeth);
    t.position.set(Math.sin(a) * 0.09, 0.025, 0.07 + Math.cos(a) * 0.08);
    jaw.add(t); teeth.push(t);
    const tu = M(new THREE.ConeGeometry(0.011, 0.045, 5), mats.teeth);
    tu.rotation.x = Math.PI;
    tu.position.set(Math.sin(a) * 0.085, -0.075, 0.29 + Math.cos(a) * 0.075);
    head.add(tu); teeth.push(tu);
  }
  // sewn mouth line (stitches across)
  const mouthStitches = [];
  for (let i = 0; i < 5; i++) {
    const s = M(new THREE.BoxGeometry(0.008, 0.07, 0.008), mats.thread);
    s.position.set(-0.11 + i * 0.03, -0.13, 0.4 - Math.abs(i - 3) * 0.012);
    s.rotation.z = 0.15;
    head.add(s); mouthStitches.push(s);
  }
  // torn corner: loose threads and a dark gap
  const gap = M(new THREE.SphereGeometry(0.05, 10, 6), mats.gum);
  gap.scale.set(1.2, 0.35, 0.4); gap.position.set(0.07, -0.14, 0.4); head.add(gap);
  for (let i = 0; i < 3; i++) {
    const t = M(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4), mats.thread);
    t.position.set(0.05 + i * 0.03, -0.18, 0.41); t.rotation.z = 0.4 + i * 0.3;
    head.add(t);
  }
  // button eyes, X-stitched shut
  const eyes = [];
  for (const s of [-1, 1]) {
    const b = M(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 18), mats.button);
    b.rotation.x = Math.PI / 2 + 0.25; b.rotation.z = s * 0.25;
    b.position.set(s * 0.14, 0.07, 0.3);
    head.add(b);
    for (const r of [0.78, -0.78]) {
      const x = M(new THREE.BoxGeometry(0.13, 0.012, 0.012), mats.thread);
      x.position.set(s * 0.14, 0.07, 0.315); x.rotation.set(0.25, s * 0.25, r);
      head.add(x);
    }
    eyes.push(b);
  }
  // ears: one torn and hanging by a thread
  const earL = M(lumpy(new THREE.SphereGeometry(0.12, 14, 10), 0.015, 6, 11), mats.fur);
  earL.scale.set(1, 1, 0.45); earL.position.set(-0.24, 0.28, -0.02); head.add(earL);
  const earR = new THREE.Group(); earR.position.set(0.27, 0.12, 0.0); head.add(earR);
  const earRM = M(lumpy(new THREE.SphereGeometry(0.12, 14, 10), 0.015, 6, 12), mats.fur);
  earRM.scale.set(1, 1, 0.45); earRM.position.set(0.04, -0.14, 0); earRM.rotation.z = -0.5; earR.add(earRM);
  const torn = M(lumpy(new THREE.IcosahedronGeometry(0.05, 1), 0.02, 12, 3), mats.stuffing);
  torn.position.set(0.22, 0.2, -0.02); head.add(torn);

  // faint glints on the buttons, visible in total darkness when close
  const glints = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), glowMaterial(0xff6b5a, 0.0));
    g.position.set(s * 0.13, 0.09, 0.322);
    g.renderOrder = 20;
    head.add(g); glints.push(g);
  }

  root.traverse((o) => { o.frustumCulled = false; });

  return {
    root, hips, torso, neck, head, jaw, legs, arms, eyes, glints, earR, tufts, mats,
    pose: { walk: 0, speed: 0, listen: 0, hunch: 0, sit: 0, grab: 0, jaw: 0, stagger: 0, look: 0, reach: 0 },
  };
}

// Animate the rig. `p` holds blend weights; `phase` is the walk cycle.
export function animateHush(m, dt, time, phase) {
  const p = m.pose;
  const sp = Math.min(1.6, p.speed);
  const walkAmt = Math.min(1, sp / 1.2);
  const s = Math.sin(phase), c = Math.cos(phase);

  // hips bob + sway
  const sit = p.sit;
  m.hips.position.y = 0.78 + Math.abs(s) * 0.05 * walkAmt - p.hunch * 0.06 - sit * 0.3;
  m.hips.position.z = -sit * 0.15;
  m.hips.rotation.z = c * 0.06 * walkAmt;
  m.hips.rotation.y = s * 0.05 * walkAmt;

  // legs
  m.legs[0].rotation.x = s * 0.55 * walkAmt - sit * 1.35;
  m.legs[1].rotation.x = -s * 0.55 * walkAmt - sit * 1.35;
  m.legs[0].rotation.z = -sit * 0.15; m.legs[1].rotation.z = sit * 0.15;

  // torso lean: hunched forward when hunting, slumped when sitting
  const breathe = Math.sin(time * 1.3) * 0.015;
  m.torso.rotation.x = 0.12 + p.hunch * 0.35 + walkAmt * 0.08 - sit * 0.25 + breathe - p.stagger * 0.4 + p.grab * 0.15;
  m.torso.rotation.z = -c * 0.05 * walkAmt + sit * 0.12 + p.stagger * Math.sin(time * 9) * 0.1;

  // arms drag and swing loosely
  for (let i = 0; i < 2; i++) {
    const a = m.arms[i];
    const side = i === 0 ? -1 : 1;
    const swing = (i === 0 ? -s : s) * 0.4 * walkAmt;
    const lag = Math.sin(phase - 0.6) * 0.15 * walkAmt;
    const reach = Math.max(p.grab, p.reach);
    a.shoulder.rotation.x = swing - p.hunch * 0.3 - reach * 1.55 - sit * 0.2;
    a.shoulder.rotation.z = side * (0.12 + sit * 0.35 + reach * 0.1);
    a.elbow.rotation.x = -0.25 - lag - reach * 0.2 - p.hunch * 0.2 + sit * 0.3;
    a.paw.rotation.x = 0.2 + Math.sin(time * 2 + i) * 0.05 + reach * 0.5;
  }

  // head: bobbing, listening tilt, slumped when dormant
  m.neck.rotation.x = -p.hunch * 0.35 + sit * 0.45 - p.grab * 0.25 + Math.sin(phase * 2) * 0.03 * walkAmt;
  m.head.rotation.z = 0.16 + p.listen * 0.42 + sit * 0.3 + Math.sin(time * 0.7) * 0.03;
  m.head.rotation.y = p.look;
  m.head.rotation.x = p.listen * 0.12;
  m.earR.rotation.z = Math.sin(time * 1.7 + phase) * 0.25 - 0.2;
  m.jaw.rotation.x = p.jaw * 0.85;
}
