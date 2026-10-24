import * as THREE from 'three';

// Procedural canvas textures: drawings, writing, stains, labels.
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { srgb = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function crayon(ctx, pts, color, width, r) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = width * (0.7 + r() * 0.5);
    ctx.globalAlpha = 0.55 + r() * 0.3;
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (r() - 0.5) * width * 0.6, jy = y + (r() - 0.5) * width * 0.6;
      if (i === 0) ctx.moveTo(jx, jy); else ctx.lineTo(jx, jy);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function ellipsePts(cx, cy, rx, ry, n = 28, wob = 0.06, r = Math.random) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * wob;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

// June's drawing: a tall bear over a small girl and a smaller stick figure
export function drawingTexture(kind = 'bigger') {
  const [c, x] = canvas(512, 384);
  const r = rng(kind === 'bigger' ? 7 : 19);
  x.fillStyle = '#e9e2d0';
  x.fillRect(0, 0, 512, 384);
  // paper grain
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(80,60,40,${r() * 0.05})`; x.fillRect(r() * 512, r() * 384, 2, 2); }
  if (kind === 'bigger') {
    // house line
    crayon(x, [[20, 330], [492, 334]], '#4a6b3a', 6, r);
    // the bear: huge
    crayon(x, ellipsePts(330, 150, 70, 60, 30, 0.1, r), '#5b3b26', 7, r);
    crayon(x, ellipsePts(330, 260, 95, 80, 30, 0.1, r), '#5b3b26', 7, r);
    crayon(x, ellipsePts(280, 98, 18, 18, 16, 0.2, r), '#5b3b26', 6, r);
    crayon(x, ellipsePts(380, 98, 18, 18, 16, 0.2, r), '#5b3b26', 6, r);
    // X eyes
    for (const ex of [305, 355]) {
      crayon(x, [[ex - 10, 135], [ex + 10, 155]], '#111', 5, r);
      crayon(x, [[ex + 10, 135], [ex - 10, 155]], '#111', 5, r);
    }
    // stitched mouth
    crayon(x, [[300, 185], [360, 185]], '#111', 4, r);
    for (let i = 0; i < 6; i++) crayon(x, [[304 + i * 10, 178], [304 + i * 10, 192]], '#111', 3, r);
    // long arms reaching down
    crayon(x, [[240, 240], [200, 300], [190, 330]], '#5b3b26', 7, r);
    crayon(x, [[420, 240], [450, 300], [455, 330]], '#5b3b26', 7, r);
    // little girl
    crayon(x, ellipsePts(110, 255, 16, 16, 14, 0.2, r), '#d08a5a', 5, r);
    crayon(x, [[110, 272], [110, 310]], '#c03b3b', 6, r);
    crayon(x, [[110, 310], [98, 332]], '#333', 4, r);
    crayon(x, [[110, 310], [122, 332]], '#333', 4, r);
    crayon(x, [[95, 285], [125, 285]], '#333', 4, r);
    // height lines
    for (let i = 0; i < 4; i++) crayon(x, [[30, 320 - i * 70], [60, 320 - i * 70]], '#888', 3, r);
    x.font = '44px "Reenie Beanie"';
    x.fillStyle = '#2a2a6a';
    x.save(); x.translate(26, 58); x.rotate(-0.04);
    x.fillText('MR HUSH IS BIGGER NOW', 0, 0);
    x.restore();
  } else if (kind === 'listens') {
    crayon(x, [[20, 340], [492, 336]], '#4a6b3a', 6, r);
    // two children in beds, bear between them leaning toward one
    crayon(x, [[40, 300], [170, 300], [170, 330], [40, 330], [40, 300]], '#4a5f9a', 6, r);
    crayon(x, [[340, 300], [470, 300], [470, 330], [340, 330], [340, 300]], '#b05a8a', 6, r);
    crayon(x, ellipsePts(80, 290, 14, 14, 12, 0.2, r), '#d08a5a', 5, r);
    crayon(x, ellipsePts(430, 290, 14, 14, 12, 0.2, r), '#d08a5a', 5, r);
    // bear bent toward the boy's bed (Ellis)
    crayon(x, ellipsePts(200, 180, 45, 40, 24, 0.1, r), '#5b3b26', 6, r);
    crayon(x, ellipsePts(240, 245, 60, 55, 24, 0.1, r), '#5b3b26', 6, r);
    crayon(x, [[160, 195], [110, 260], [90, 280]], '#5b3b26', 6, r);
    // ear lines drawn from bear to the boy
    for (let i = 0; i < 4; i++) crayon(x, [[175, 170 + i * 8], [100 + i * 4, 275 - i * 2]], '#7a7a7a', 2, r);
    x.font = '40px "Reenie Beanie"';
    x.fillStyle = '#2a2a6a';
    x.fillText('he listens to ellis', 140, 64);
    x.fillText('not me', 300, 110);
    x.font = '26px "Reenie Beanie"';
    x.fillText('ellis', 55, 360);
    x.fillText('me', 420, 360);
  }
  return tex(c);
}

// Pencil height chart on the door frame: June's marks stop, Mr Hush's keep going.
export function heightChartTexture() {
  const [c, x] = canvas(128, 1024);
  x.clearRect(0, 0, 128, 1024);
  const mark = (h, label, col, font = '30px "Reenie Beanie"') => {
    const y = 1024 - h * (1024 / 2.3);
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 3;
    x.beginPath(); x.moveTo(6, y); x.lineTo(56, y + 1); x.stroke();
    x.font = font;
    x.fillText(label, 60, y + 8);
  };
  mark(0.98, 'J 4', 'rgba(40,40,60,0.9)');
  mark(1.06, 'J 5', 'rgba(40,40,60,0.9)');
  mark(1.14, 'J 6', 'rgba(40,40,60,0.9)');
  mark(0.62, 'H', 'rgba(110,20,20,0.95)');
  mark(1.3, 'H', 'rgba(110,20,20,0.95)');
  mark(1.72, 'H', 'rgba(110,20,20,0.95)');
  mark(2.2, 'H', 'rgba(110,20,20,0.95)');
  return tex(c);
}

// Blood splatter / smear decal (alpha cutout)
export function bloodTexture(seed = 1, kind = 'splat') {
  const [c, x] = canvas(256, 256);
  const r = rng(seed);
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = '#ffffff';
  if (kind === 'splat') {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * r() * 100;
      const s = 6 + r() * 36 * (1 - d / 120);
      x.beginPath(); x.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, s, s * (0.6 + r() * 0.5), a, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, d = 60 + r() * 70;
      x.beginPath(); x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 1 + r() * 4, 0, Math.PI * 2); x.fill();
    }
  } else if (kind === 'smear') {
    for (let i = 0; i < 5; i++) {
      x.globalAlpha = 0.5 + r() * 0.5;
      x.lineWidth = 18 + r() * 16; x.lineCap = 'round'; x.strokeStyle = '#fff';
      x.beginPath(); x.moveTo(20, 60 + i * 30 + r() * 10);
      x.bezierCurveTo(90, 50 + i * 30, 160, 80 + i * 25, 240, 70 + i * 32 + r() * 20);
      x.stroke();
    }
    x.globalAlpha = 1;
    // drips
    for (let i = 0; i < 9; i++) {
      const sx = 30 + r() * 200, len = 30 + r() * 120;
      x.fillRect(sx, 120, 3 + r() * 4, len);
      x.beginPath(); x.arc(sx + 3, 120 + len, 5, 0, Math.PI * 2); x.fill();
    }
  } else if (kind === 'hand') {
    const hand = (cx, cy, rot) => {
      x.save(); x.translate(cx, cy); x.rotate(rot);
      x.beginPath(); x.ellipse(0, 0, 22, 26, 0, 0, Math.PI * 2); x.fill();
      for (let f = 0; f < 4; f++) { x.beginPath(); x.ellipse(-15 + f * 10, -36, 4.5, 14, (f - 1.5) * 0.12, 0, Math.PI * 2); x.fill(); }
      x.beginPath(); x.ellipse(24, -6, 5, 12, 0.9, 0, Math.PI * 2); x.fill();
      x.restore();
    };
    hand(80, 150, -0.2); hand(170, 110, 0.15);
  } else if (kind === 'trail') {
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      x.beginPath();
      x.arc(10 + t * 236 + (r() - 0.5) * 10, 128 + Math.sin(t * 7) * 30 + (r() - 0.5) * 16, 2 + r() * 9, 0, Math.PI * 2);
      x.fill();
    }
  }
  return tex(c);
}

// "BE QUIET" written on the mirror
export function writingTexture(text, { font = '120px "Homemade Apple"', w = 1024, h = 512, color = '#fff', rot = -0.05, drip = true, seed = 3 } = {}) {
  const [c, x] = canvas(w, h);
  const r = rng(seed);
  x.clearRect(0, 0, w, h);
  x.fillStyle = color;
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.save(); x.translate(w / 2, h / 2); x.rotate(rot); x.fillText(text, 0, 0); x.restore();
  if (drip) {
    for (let i = 0; i < 14; i++) {
      const sx = w * 0.1 + r() * w * 0.8, sy = h * 0.5 + (r() - 0.3) * 40, len = 20 + r() * h * 0.4;
      x.fillRect(sx, sy, 3 + r() * 4, len);
      x.beginPath(); x.arc(sx + 3, sy + len, 4, 0, Math.PI * 2); x.fill();
    }
  }
  return tex(c);
}

// Family photo: silhouettes; one face scratched out.
export function photoTexture(kind = 0) {
  const [c, x] = canvas(256, 320);
  const r = rng(30 + kind);
  const g = x.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, '#8a8478'); g.addColorStop(1, '#4a463e');
  x.fillStyle = '#e4dccb'; x.fillRect(0, 0, 256, 320);
  x.fillStyle = g; x.fillRect(16, 16, 224, 288);
  x.fillStyle = '#2a2722';
  const person = (px, py, s) => {
    x.beginPath(); x.arc(px, py, 18 * s, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(px, py + 70 * s, 30 * s, 50 * s, 0, 0, Math.PI * 2); x.fill();
  };
  if (kind === 0) { person(80, 120, 1.2); person(160, 160, 0.8); person(200, 175, 0.7); }
  if (kind === 1) { person(128, 140, 1.0); }
  if (kind === 2) { person(100, 150, 0.8); person(165, 150, 0.8); }
  // scratch out
  x.strokeStyle = 'rgba(230,225,215,0.9)';
  x.lineWidth = 3;
  const sx = kind === 0 ? 200 : kind === 1 ? 128 : 165;
  const sy = kind === 0 ? 175 : 150;
  for (let i = 0; i < 26; i++) {
    x.beginPath();
    x.moveTo(sx - 26 + r() * 10, sy - 26 + r() * 52);
    x.lineTo(sx + 16 + r() * 10, sy - 26 + r() * 52);
    x.stroke();
  }
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.06})`; x.fillRect(r() * 256, r() * 320, 1, 1); }
  return tex(c);
}

export function clockFaceTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#d8cfb8'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#2a241c'; x.lineWidth = 4; x.beginPath(); x.arc(128, 128, 116, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#2a241c';
  x.font = '30px "IM Fell English"';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  nums.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    x.fillText(n, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
  });
  return tex(c);
}

// generic labelled box art / poster
export function hushabyPosterTexture() {
  const [c, x] = canvas(512, 700);
  x.fillStyle = '#d9cdb0'; x.fillRect(0, 0, 512, 700);
  x.fillStyle = '#7a3a3a'; x.fillRect(24, 24, 464, 90);
  x.fillStyle = '#efe6d2';
  x.font = '64px "IM Fell English SC"';
  x.textAlign = 'center';
  x.fillText('Hushaby', 256, 92);
  x.fillStyle = '#4a3a2a';
  x.font = 'italic 30px "IM Fell English"';
  x.fillText('The toy that’s sensitive', 256, 160);
  x.fillText('to your child.', 256, 196);
  // bear silhouette
  x.fillStyle = '#6a5040';
  x.beginPath(); x.arc(256, 330, 80, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(190, 268, 30, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(322, 268, 30, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(256, 500, 110, 120, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1a1410';
  x.beginPath(); x.arc(226, 320, 9, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(286, 320, 9, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#4a3a2a';
  x.font = '22px "IBM Plex Mono"';
  x.fillText('CRADLE & CO. · 1995', 256, 664);
  return tex(c);
}

export function spinesTexture(seed = 5) {
  const [c, x] = canvas(512, 128);
  const r = rng(seed);
  let px = 0;
  while (px < 512) {
    const w = 10 + r() * 26;
    const v = 70 + r() * 110;
    x.fillStyle = `rgb(${v},${v * (0.8 + r() * 0.2)},${v * (0.7 + r() * 0.2)})`;
    x.fillRect(px, 128 - (90 + r() * 38), w - 1.5, 128);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(px + w * 0.2, 40 + r() * 30, w * 0.6, 3);
    px += w;
  }
  return tex(c);
}

export function paperTexture(lines = 14, seed = 9) {
  const [c, x] = canvas(256, 340);
  const r = rng(seed);
  x.fillStyle = '#e8e0cc'; x.fillRect(0, 0, 256, 340);
  x.fillStyle = 'rgba(40,40,60,0.7)';
  for (let i = 0; i < lines; i++) {
    const w = 120 + r() * 100;
    x.fillRect(24, 40 + i * 20, w, 3);
  }
  return tex(c);
}

export function staticTexture() {
  const [c, x] = canvas(128, 96);
  const img = x.createImageData(128, 96);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  const t = tex(c);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
  t.userData.refresh = () => {
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
    x.putImageData(img, 0, 0); t.needsUpdate = true;
  };
  return t;
}
