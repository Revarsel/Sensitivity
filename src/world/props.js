import * as THREE from 'three';

// Procedural furniture. Local space: origin on the floor at the prop's centre,
// the "front" faces +Z. Every function registers colliders on the builder.

export function sofa(b, M, w = 2.0, mat = M.fabricRed) {
  const d = 0.92, h = 0.42;
  b.rbox(mat, 0, 0.24, 0, w, 0.26, d, 0.05);
  b.rbox(mat, 0, 0.6, -d / 2 + 0.12, w - 0.1, 0.62, 0.24, 0.08, 3);
  for (const s of [-1, 1]) b.rbox(mat, s * (w / 2 - 0.1), 0.42, 0, 0.2, 0.42, d, 0.07, 3);
  const n = w > 1.5 ? 3 : 2;
  const cw = (w - 0.4) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.2 + cw * (i + 0.5);
    b.rbox(mat, x, h + 0.04, 0.06, cw - 0.03, 0.14, d - 0.3, 0.06, 3);
    b.rbox(mat, x, 0.72, -d / 2 + 0.3, cw - 0.06, 0.4, 0.16, 0.07, 3);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.darkWood, sx * (w / 2 - 0.08), 0.05, sz * (d / 2 - 0.08), 0.025, 0.02, 0.1, 8);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 0.9);
}

// opts.sx / opts.sz: stretch it wider / deeper (heights stay), e.g. the chair he has outgrown
export function armchair(b, M, mat = M.fabricGreen, opts = {}) {
  if (opts.sx || opts.sz) {
    b.with(new THREE.Matrix4().makeScale(opts.sx || 1, 1, opts.sz || 1), () => armchair(b, M, mat));
    return;
  }
  const w = 0.95, d = 0.9;
  b.rbox(mat, 0, 0.26, 0.02, w, 0.24, d, 0.05);
  b.rbox(mat, 0, 0.42, 0.08, w - 0.3, 0.12, d - 0.25, 0.05, 3);
  b.rbox(mat, 0, 0.78, -d / 2 + 0.1, w, 0.95, 0.2, 0.08, 3);
  // wings
  for (const s of [-1, 1]) {
    b.rbox(mat, s * (w / 2 - 0.08), 0.5, 0.0, 0.16, 0.42, d - 0.1, 0.06, 3);
    b.rbox(mat, s * (w / 2 - 0.08), 0.95, -d / 2 + 0.25, 0.14, 0.5, 0.32, 0.06, 3);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.darkWood, sx * (w / 2 - 0.07), 0.06, sz * (d / 2 - 0.07), 0.025, 0.018, 0.12, 8);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 1.2);
}

export function coffeeTable(b, M) {
  const w = 1.1, d = 0.6, h = 0.42;
  b.rbox(M.wood, 0, h, 0, w, 0.05, d, 0.015);
  b.box(M.wood, -w / 2 + 0.06, 0.1, -d / 2 + 0.06, w / 2 - 0.06, 0.12, d / 2 - 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.wood, sx * (w / 2 - 0.06), h / 2, sz * (d / 2 - 0.06), 0.022, 0.016, h, 8);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 0.45);
}

// returns local screen centre
export function crtOnStand(b, M) {
  // stand
  b.rbox(M.darkWood, 0, 0.3, 0, 1.0, 0.6, 0.45, 0.02);
  b.box(M.black, -0.46, 0.08, 0.2, 0.46, 0.5, 0.23);
  b.box(M.darkWood, -0.47, 0.29, 0.2, 0.47, 0.31, 0.235);
  // VCR
  b.rbox(M.plasticDark, 0, 0.18, 0.05, 0.42, 0.08, 0.3, 0.01);
  // television body
  b.rbox(M.plastic, 0, 0.6 + 0.28, -0.02, 0.72, 0.56, 0.5, 0.05, 3);
  b.rbox(M.plastic, 0, 0.6 + 0.28, -0.22, 0.56, 0.42, 0.3, 0.06, 3);
  // bezel and screen recess
  b.box(M.plasticDark, -0.3, 0.66, 0.225, 0.22, 1.08, 0.235);
  // knobs
  for (let i = 0; i < 3; i++) b.cyl(M.plasticDark, 0.29, 0.98 - i * 0.1, 0.235, 0.022, 0.022, 0.03, 10, Math.PI / 2);
  // antenna
  b.tube(M.metal, [[0, 1.16, -0.1], [-0.12, 1.4, -0.12], [-0.25, 1.62, -0.13]], 0.004, 8, 4);
  b.tube(M.metal, [[0, 1.16, -0.1], [0.14, 1.38, -0.12], [0.3, 1.55, -0.14]], 0.004, 8, 4);
  b.sphere(M.plasticDark, 0, 1.16, -0.1, 0.05, 1.3, 0.6, 1, 10);
  b.collider(-0.5, -0.25, 0.5, 0.25, 1.2);
  return { x: -0.04, y: 0.87, z: 0.24, w: 0.46, h: 0.38 };
}

export function bookshelf(b, M, w = 1.4, h = 2.0, d = 0.34) {
  const t = 0.03;
  b.box(M.darkWood, -w / 2, 0, -d / 2, -w / 2 + t, h, d / 2);
  b.box(M.darkWood, w / 2 - t, 0, -d / 2, w / 2, h, d / 2);
  b.box(M.darkWood, -w / 2, 0, -d / 2, w / 2, h, -d / 2 + 0.015);
  b.box(M.darkWood, -w / 2, h - t, -d / 2, w / 2, h, d / 2);
  const shelves = 5;
  for (let i = 0; i < shelves; i++) {
    const y = 0.06 + i * ((h - 0.1) / shelves);
    b.box(M.darkWood, -w / 2 + t, y, -d / 2, w / 2 - t, y + t, d / 2);
    if (i < shelves) {
      const mat = i % 2 ? M.spines : M.spines2;
      const bh = 0.26 + (i % 3) * 0.02;
      // books block with spine texture on the front
      b.box(mat, -w / 2 + t + 0.01, y + t, -d / 2 + 0.03, w / 2 - t - (i === 2 ? 0.45 : 0.08), y + t + bh, d / 2 - 0.05);
      if (i === 2) {
        // leaning books
        for (let k = 0; k < 3; k++) b.boxC(M.fabricRed, w / 2 - 0.36 + k * 0.05, y + t + 0.12, 0, 0.035, 0.24, d - 0.1, 0, 0, -0.35);
      }
    }
  }
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h);
}

export function fireplace(b, M) {
  // chimney breast (local: against wall at z=-0.3, faces +z)
  const w = 1.7, d = 0.5;
  b.box(M.brick, -w / 2, 0, -d / 2, w / 2, 2.7, d / 2);
  // hearth
  b.box(M.brick, -w / 2 - 0.1, 0, d / 2, w / 2 + 0.1, 0.06, d / 2 + 0.45);
  // firebox (dark recess faked with black inset)
  b.box(M.black, -0.42, 0.06, d / 2 - 0.02, 0.42, 0.78, d / 2 + 0.005);
  // grate
  for (let i = 0; i < 6; i++) b.cyl(M.darkMetal, -0.25 + i * 0.1, 0.18, d / 2 + 0.06, 0.008, 0.008, 0.18, 6);
  b.box(M.darkMetal, -0.3, 0.08, d / 2 + 0.03, 0.3, 0.1, d / 2 + 0.2);
  // mantel
  b.rbox(M.paintedWood, 0, 1.18, d / 2 + 0.06, w + 0.2, 0.08, 0.26, 0.015);
  b.box(M.paintedWood, -w / 2, 0.06, d / 2, -w / 2 + 0.16, 1.14, d / 2 + 0.06);
  b.box(M.paintedWood, w / 2 - 0.16, 0.06, d / 2, w / 2, 1.14, d / 2 + 0.06);
  b.box(M.paintedWood, -w / 2, 0.92, d / 2, w / 2, 1.14, d / 2 + 0.05);
  // mantel items: candlesticks, clock
  b.lathe(M.brass, [[0, 0], [0.04, 0], [0.02, 0.02], [0.012, 0.15], [0.03, 0.17], [0, 0.17]], -0.6, 1.22, d / 2 + 0.06, 12);
  b.lathe(M.brass, [[0, 0], [0.04, 0], [0.02, 0.02], [0.012, 0.15], [0.03, 0.17], [0, 0.17]], 0.6, 1.22, d / 2 + 0.06, 12);
  b.rbox(M.darkWood, 0.1, 1.33, d / 2 + 0.06, 0.24, 0.22, 0.1, 0.02);
  b.collider(-w / 2 - 0.1, -d / 2, w / 2 + 0.1, d / 2 + 0.45, 2.7);
}

export function floorLamp(b, M) {
  b.cyl(M.brass, 0, 0.015, 0, 0.16, 0.18, 0.03, 16);
  b.cyl(M.brass, 0, 0.8, 0, 0.012, 0.012, 1.55, 8);
  b.lathe(M.linen, [[0.12, 0], [0.2, -0.28], [0.205, -0.29]], 0, 1.75, 0, 18);
  b.collider(-0.18, -0.18, 0.18, 0.18, 1.8);
}

export function bed(b, M, w = 1.5, l = 2.05, opts = {}) {
  const frame = opts.frame || M.darkWood;
  const blanket = opts.blanket || M.fabric;
  const h = opts.h ?? 0.5;
  // rails (leave under-bed gap)
  b.box(frame, -w / 2, 0.22, -l / 2, w / 2, 0.32, l / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(frame, sx * w / 2 - (sx > 0 ? 0.06 : 0), 0, sz * l / 2 - (sz > 0 ? 0.06 : 0), sx * w / 2 + (sx > 0 ? 0 : 0.06), 0.32, sz * l / 2 + (sz > 0 ? 0 : 0.06));
  // headboard (at -z)
  b.rbox(frame, 0, 0.55 + (opts.headH ?? 0.5) / 2, -l / 2 + 0.03, w + 0.06, opts.headH ?? 1.0, 0.06, 0.02);
  b.box(frame, -w / 2, 0, -l / 2, -w / 2 + 0.07, 1.1, -l / 2 + 0.07);
  b.box(frame, w / 2 - 0.07, 0, -l / 2, w / 2, 1.1, -l / 2 + 0.07);
  // footboard
  b.rbox(frame, 0, 0.42, l / 2 - 0.03, w + 0.04, 0.36, 0.05, 0.015);
  // mattress
  b.rbox(M.linen, 0, 0.42, 0, w - 0.06, 0.2, l - 0.1, 0.06, 3);
  // blanket draped over the lower 2/3 with folds
  b.rbox(blanket, 0, 0.53, 0.18, w + 0.02, 0.05, l - 0.45, 0.025, 2);
  for (const s of [-1, 1]) b.box(blanket, s * (w / 2 + 0.005) - 0.005, 0.25, -l / 2 + 0.45, s * (w / 2 + 0.015), 0.55, l / 2 - 0.06);
  for (let i = 0; i < 4; i++) b.cyl(blanket, -w / 2 + 0.2 + i * (w - 0.4) / 3, 0.565, 0.3, 0.02, 0.02, l * 0.5, 6, Math.PI / 2);
  // pillows
  const np = w > 1.2 ? 2 : 1;
  for (let i = 0; i < np; i++) {
    const px = np === 1 ? 0 : (i - 0.5) * (w * 0.48);
    b.sphere(M.linen, px, 0.58, -l / 2 + 0.3, 0.3, (w / np) * 1.4, 0.38, 0.65, 14);
  }
  b.collider(-w / 2 - 0.03, -l / 2, w / 2 + 0.03, l / 2, 0.6, 'bed');
}

// opts.noTopDrawer: leave the top drawer front out (Chapter1 adds a movable one)
export function nightstand(b, M, opts = {}) {
  b.rbox(M.wood, 0, 0.3, 0, 0.48, 0.6, 0.42, 0.015);
  if (!opts.noTopDrawer) b.box(M.darkWood, -0.2, 0.36, 0.21, 0.2, 0.52, 0.215);
  b.box(M.darkWood, -0.2, 0.08, 0.21, 0.2, 0.32, 0.215);
  b.cyl(M.brass, 0, 0.2, 0.225, 0.012, 0.012, 0.02, 8, Math.PI / 2);
  // lamp
  b.lathe(M.porcelain, [[0, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.18], [0.02, 0.22], [0, 0.22]], -0.08, 0.6, -0.04, 14);
  b.lathe(M.linen, [[0.06, 0], [0.13, -0.17], [0.135, -0.18]], -0.08, 1.0, -0.04, 16);
  b.collider(-0.24, -0.21, 0.24, 0.21, 0.9);
}

export function wardrobe(b, M) {
  const w = 1.1, d = 0.6, h = 2.05;
  b.box(M.darkWood, -w / 2, 0.08, -d / 2, w / 2, h, d / 2 - 0.04);
  b.box(M.darkWood, -w / 2 - 0.02, h, -d / 2 - 0.02, w / 2 + 0.02, h + 0.08, d / 2 + 0.02);
  b.box(M.darkWood, -w / 2, 0, -d / 2 + 0.02, w / 2, 0.1, d / 2);
  // slatted doors
  for (const s of [-1, 1]) {
    const cx = s * w / 4;
    b.box(M.wood, cx - w / 4 + 0.01, 0.12, d / 2 - 0.04, cx + w / 4 - 0.01, 0.2, d / 2);
    b.box(M.wood, cx - w / 4 + 0.01, h - 0.08, d / 2 - 0.04, cx + w / 4 - 0.01, h, d / 2);
    b.box(M.wood, cx - w / 4 + 0.01, 0.12, d / 2 - 0.04, cx - w / 4 + 0.07, h, d / 2);
    b.box(M.wood, cx + w / 4 - 0.07, 0.12, d / 2 - 0.04, cx + w / 4 - 0.01, h, d / 2);
    for (let i = 0; i < 22; i++) {
      const y = 0.26 + i * 0.078;
      b.boxC(M.wood, cx, y, d / 2 - 0.02, w / 2 - 0.14, 0.05, 0.012, -0.6, 0, 0);
    }
    b.cyl(M.brass, s * 0.04, 1.05, d / 2 + 0.01, 0.012, 0.012, 0.03, 8, Math.PI / 2);
  }
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h, 'hide');
}

export function dresser(b, M, w = 1.3) {
  const d = 0.48, h = 0.86;
  b.rbox(M.wood, 0, h / 2, 0, w, h, d, 0.015);
  b.box(M.wood, -w / 2 - 0.02, h, -d / 2 - 0.02, w / 2 + 0.02, h + 0.03, d / 2 + 0.02);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const x0 = -w / 2 + 0.04 + c * (w / 2), y0 = 0.08 + r * 0.26;
    b.box(M.darkWood, x0, y0, d / 2, x0 + w / 2 - 0.08, y0 + 0.22, d / 2 + 0.012);
    b.cyl(M.brass, x0 + (w / 2 - 0.08) / 2, y0 + 0.11, d / 2 + 0.02, 0.015, 0.015, 0.02, 8, Math.PI / 2);
  }
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h);
}

export function mirror(b, M, w = 0.6, h = 0.9) {
  b.box(M.darkWood, -w / 2, 0, 0, w / 2, h, 0.03);
  b.box(M.glass, -w / 2 + 0.04, 0.04, 0.03, w / 2 - 0.04, h - 0.04, 0.035);
}

export function sewingTable(b, M) {
  b.rbox(M.wood, 0, 0.74, 0, 1.0, 0.04, 0.5, 0.01);
  for (const s of [-1, 1]) {
    b.box(M.darkMetal, s * 0.45 - 0.02, 0, -0.2, s * 0.45 + 0.02, 0.72, 0.2);
    b.box(M.darkMetal, s * 0.45 - 0.02, 0.05, -0.22, s * 0.45 + 0.02, 0.1, 0.22);
  }
  // treadle
  b.box(M.darkMetal, -0.25, 0.08, -0.1, 0.25, 0.1, 0.12);
  // sewing machine
  b.rbox(M.black, 0.05, 0.84, -0.03, 0.4, 0.16, 0.18, 0.03);
  b.rbox(M.black, -0.12, 0.96, -0.03, 0.08, 0.22, 0.14, 0.03);
  b.rbox(M.black, 0.08, 1.07, -0.03, 0.42, 0.08, 0.13, 0.03);
  b.cyl(M.black, 0.26, 0.98, -0.03, 0.05, 0.05, 0.05, 14, 0, Math.PI / 2);
  // spools
  for (let i = 0; i < 5; i++) b.cyl(i % 2 ? M.fabricRed : M.linen, -0.38 + i * 0.06, 0.79, 0.15, 0.018, 0.018, 0.05, 8);
  // stuffing pile and a half-sewn plush arm
  b.sphere(M.stuffing, -0.3, 0.8, -0.1, 0.09, 1.3, 0.55, 1, 10);
  b.sphere(M.stuffing, -0.22, 0.79, -0.04, 0.06, 1.2, 0.5, 1.1, 8);
  b.cyl(M.plushSmall, 0.32, 0.79, 0.12, 0.035, 0.03, 0.28, 10, 0, Math.PI / 2.3);
  b.collider(-0.5, -0.25, 0.5, 0.25, 1.1);
}

export function dressForm(b, M) {
  b.cyl(M.darkWood, 0, 0.02, 0, 0.18, 0.2, 0.04, 14);
  b.cyl(M.darkMetal, 0, 0.6, 0, 0.015, 0.015, 1.1, 8);
  b.lathe(M.plushSmall, [[0, 0], [0.16, 0.02], [0.17, 0.12], [0.13, 0.3], [0.16, 0.45], [0.18, 0.55], [0.12, 0.62], [0.05, 0.66], [0, 0.66]], 0, 1.0, 0, 18);
  // crude stitches down the front
  for (let i = 0; i < 9; i++) b.boxC(M.black, 0, 1.08 + i * 0.055, 0.158 + (i > 3 && i < 7 ? 0.01 : 0), 0.06, 0.006, 0.006, 0, 0, i % 2 ? 0.4 : -0.4);
  b.collider(-0.2, -0.2, 0.2, 0.2, 1.7);
}

export function toilet(b, M) {
  b.lathe(M.porcelain, [[0, 0], [0.13, 0], [0.12, 0.2], [0.19, 0.38], [0.2, 0.4], [0, 0.4]], 0, 0, 0.08, 18);
  b.rbox(M.porcelain, 0, 0.42, 0.1, 0.4, 0.04, 0.46, 0.08, 3);
  b.rbox(M.porcelain, 0, 0.65, -0.2, 0.46, 0.4, 0.18, 0.03);
  b.rbox(M.porcelain, 0, 0.87, -0.2, 0.5, 0.04, 0.2, 0.015);
  b.collider(-0.24, -0.3, 0.24, 0.34, 0.9);
}

export function bathtub(b, M) {
  const w = 1.7, d = 0.78, h = 0.55;
  b.rbox(M.porcelain, 0, h / 2 + 0.08, 0, w, h, d, 0.08, 3);
  // inner basin darker (filled with stuffing + blood)
  b.rbox(M.stuffing, 0, h + 0.02, 0, w - 0.16, 0.12, d - 0.16, 0.05, 2);
  for (let i = 0; i < 9; i++) b.sphere(M.stuffing, -0.6 + i * 0.15, h + 0.08 + (i % 3) * 0.02, -0.12 + (i % 2) * 0.22, 0.13, 1, 0.55, 1, 9);
  b.box(M.blood, -0.5, h + 0.1, -0.2, 0.3, h + 0.11, 0.18);
  // claw feet
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.sphere(M.brass, sx * (w / 2 - 0.15), 0.05, sz * (d / 2 - 0.1), 0.06, 1, 0.9, 1, 8);
  // tap
  b.tube(M.metal, [[w / 2 - 0.1, h + 0.06, 0], [w / 2 - 0.05, h + 0.3, 0], [w / 2 - 0.22, h + 0.32, 0]], 0.015, 8, 6);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 0.7);
}

export function bathSink(b, M) {
  b.cyl(M.porcelain, 0, 0.42, 0, 0.07, 0.11, 0.84, 14);
  b.rbox(M.porcelain, 0, 0.86, 0.02, 0.56, 0.12, 0.42, 0.05, 3);
  b.cyl(M.metal, 0, 0.98, -0.14, 0.012, 0.012, 0.14, 8);
  b.tube(M.metal, [[0, 1.05, -0.14], [0, 1.08, -0.08], [0, 1.0, -0.02]], 0.01, 8, 6);
  b.collider(-0.28, -0.22, 0.28, 0.24, 1.0);
}

// opts.skipDrawers: drawer indices (west to east in local space) left out for movable ones
export function counter(b, M, len = 2.0, opts = {}) {
  const d = 0.62, h = 0.9;
  b.box(M.paintedWood, -len / 2, 0.1, -d / 2, len / 2, h - 0.04, d / 2 - 0.03);
  b.box(M.black, -len / 2, 0, -d / 2, len / 2, 0.1, d / 2 - 0.08);
  b.rbox(opts.top || M.porcelain, 0, h - 0.02, 0.01, len + 0.02, 0.04, d + 0.03, 0.01);
  const n = Math.max(1, Math.round(len / 0.6));
  const cw = len / n;
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * cw;
    // drawer + door
    const skip = opts.skipDrawers && opts.skipDrawers.includes(i);
    if (!skip) b.box(M.paintedWood, x0 + 0.02, h - 0.2, d / 2 - 0.03, x0 + cw - 0.02, h - 0.06, d / 2 - 0.01);
    b.box(M.paintedWood, x0 + 0.02, 0.14, d / 2 - 0.03, x0 + cw - 0.02, h - 0.24, d / 2 - 0.01);
    b.box(M.trim, x0 + 0.06, 0.18, d / 2 - 0.012, x0 + cw - 0.06, h - 0.28, d / 2 - 0.004);
    if (!skip) b.cyl(M.metal, x0 + cw / 2, h - 0.13, d / 2 + 0.005, 0.01, 0.01, 0.1, 6, 0, Math.PI / 2);
    b.cyl(M.metal, x0 + cw - 0.08, h - 0.42, d / 2 + 0.005, 0.01, 0.01, 0.1, 6);
  }
  if (opts.sink) {
    const sx = opts.sink;
    b.box(M.metal, sx - 0.3, h - 0.03, -0.2, sx + 0.3, h - 0.01, 0.2);
    b.box(M.darkMetal, sx - 0.26, h - 0.025, -0.17, sx + 0.26, h - 0.005, 0.17);
    b.cyl(M.metal, sx, h + 0.1, -0.25, 0.015, 0.02, 0.2, 8);
    b.tube(M.metal, [[sx, h + 0.2, -0.25], [sx, h + 0.3, -0.15], [sx, h + 0.22, -0.06]], 0.013, 10, 6);
    b.cyl(M.metal, sx - 0.12, h + 0.04, -0.25, 0.025, 0.025, 0.06, 8);
    b.cyl(M.metal, sx + 0.12, h + 0.04, -0.25, 0.025, 0.025, 0.06, 8);
  }
  b.collider(-len / 2, -d / 2, len / 2, d / 2, h + 0.05);
}

export function upperCabinet(b, M, len = 2.0) {
  const d = 0.34, y0 = 1.45, y1 = 2.2;
  b.box(M.paintedWood, -len / 2, y0, -d / 2, len / 2, y1, d / 2);
  const n = Math.max(1, Math.round(len / 0.5));
  const cw = len / n;
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + i * cw;
    b.box(M.paintedWood, x0 + 0.015, y0 + 0.02, d / 2, x0 + cw - 0.015, y1 - 0.02, d / 2 + 0.015);
    b.box(M.trim, x0 + 0.06, y0 + 0.07, d / 2 + 0.012, x0 + cw - 0.06, y1 - 0.07, d / 2 + 0.02);
    b.cyl(M.metal, x0 + (i % 2 ? 0.06 : cw - 0.06), y0 + 0.12, d / 2 + 0.03, 0.01, 0.01, 0.08, 6);
  }
}

export function stove(b, M) {
  const w = 0.76, d = 0.64, h = 0.9;
  b.rbox(M.porcelain, 0, h / 2, 0, w, h, d, 0.02);
  b.box(M.black, -w / 2 + 0.06, 0.12, d / 2, w / 2 - 0.06, 0.62, d / 2 + 0.01);
  b.box(M.glass, -w / 2 + 0.16, 0.3, d / 2 + 0.008, w / 2 - 0.16, 0.52, d / 2 + 0.014);
  b.cyl(M.metal, 0, 0.66, d / 2 + 0.03, 0.012, 0.012, w - 0.2, 8, 0, Math.PI / 2);
  for (const [x, z] of [[-0.18, -0.14], [0.18, -0.14], [-0.18, 0.14], [0.18, 0.14]]) {
    b.cyl(M.darkMetal, x, h + 0.01, z, 0.1, 0.1, 0.012, 16);
    b.cyl(M.black, x, h + 0.018, z, 0.04, 0.04, 0.008, 10);
  }
  b.box(M.porcelain, -w / 2, h, -d / 2, w / 2, h + 0.18, -d / 2 + 0.06);
  for (let i = 0; i < 4; i++) b.cyl(M.black, -0.24 + i * 0.16, h + 0.1, -d / 2 + 0.08, 0.022, 0.022, 0.03, 10, Math.PI / 2);
  // kettle
  b.lathe(M.metal, [[0, 0], [0.1, 0], [0.11, 0.06], [0.09, 0.14], [0.03, 0.17], [0, 0.18]], -0.18, h + 0.02, -0.14, 14);
  b.tube(M.black, [[-0.26, h + 0.12, -0.14], [-0.18, h + 0.26, -0.14], [-0.1, h + 0.12, -0.14]], 0.008, 10, 5);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h + 0.2);
}

export function fridge(b, M) {
  const w = 0.78, d = 0.7, h = 1.78;
  b.rbox(M.porcelain, 0, h / 2, 0, w, h, d, 0.06, 3);
  b.box(M.darkMetal, -w / 2 + 0.01, 1.18, d / 2 - 0.01, w / 2 - 0.01, 1.19, d / 2 + 0.005);
  b.rbox(M.metal, w / 2 - 0.08, 1.45, d / 2 + 0.03, 0.03, 0.4, 0.04, 0.012);
  b.rbox(M.metal, w / 2 - 0.08, 0.8, d / 2 + 0.03, 0.03, 0.5, 0.04, 0.012);
  // magnets
  b.cyl(M.toyRed, -0.2, 1.62, d / 2 + 0.01, 0.02, 0.02, 0.012, 8, Math.PI / 2);
  b.cyl(M.toyYellow, 0.1, 1.5, d / 2 + 0.01, 0.018, 0.018, 0.012, 8, Math.PI / 2);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h);
}

export function diningTable(b, M) {
  const w = 1.6, d = 0.95, h = 0.76;
  b.rbox(M.wood, 0, h, 0, w, 0.05, d, 0.015);
  b.box(M.wood, -w / 2 + 0.08, h - 0.12, -d / 2 + 0.08, w / 2 - 0.08, h - 0.025, d / 2 - 0.08);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.lathe(M.wood, [[0, 0], [0.03, 0], [0.025, 0.1], [0.04, 0.2], [0.025, 0.3], [0.03, 0.66], [0.035, h - 0.02], [0, h - 0.02]], sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), 10);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, h + 0.05);
}

export function chair(b, M, tipped = false) {
  const s = 0.44;
  const build = () => {
    b.rbox(M.wood, 0, 0.46, 0, s, 0.04, s, 0.01);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.wood, sx * (s / 2 - 0.03) - 0.018, 0, sz * (s / 2 - 0.03) - 0.018, sx * (s / 2 - 0.03) + 0.018, 0.45, sz * (s / 2 - 0.03) + 0.018);
    for (const sx of [-1, 1]) b.box(M.wood, sx * (s / 2 - 0.03) - 0.018, 0.47, -s / 2 + 0.012, sx * (s / 2 - 0.03) + 0.018, 0.98, -s / 2 + 0.048);
    for (let i = 0; i < 3; i++) b.box(M.wood, -s / 2 + 0.05, 0.6 + i * 0.12, -s / 2 + 0.02, s / 2 - 0.05, 0.64 + i * 0.12, -s / 2 + 0.04);
  };
  if (tipped) {
    b.with(new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.24, 0.5), build);
    b.collider(-0.25, -0.1, 0.25, 0.9, 0.5);
  } else {
    build();
    b.collider(-s / 2, -s / 2, s / 2, s / 2, 1.0);
  }
}

export function grandfatherClock(b, M) {
  const w = 0.5, d = 0.32;
  b.box(M.darkWood, -w / 2, 0, -d / 2, w / 2, 0.35, d / 2);
  b.box(M.darkWood, -w / 2 + 0.05, 0.35, -d / 2 + 0.03, w / 2 - 0.05, 1.5, d / 2 - 0.03);
  b.box(M.windowGlass, -w / 2 + 0.1, 0.5, d / 2 - 0.035, w / 2 - 0.1, 1.38, d / 2 - 0.025);
  b.box(M.darkWood, -w / 2, 1.5, -d / 2, w / 2, 2.05, d / 2);
  b.box(M.darkWood, -w / 2 - 0.03, 2.05, -d / 2 - 0.02, w / 2 + 0.03, 2.12, d / 2 + 0.02);
  b.lathe(M.darkWood, [[0, 0], [0.22, 0], [0.18, 0.1], [0.05, 0.16], [0, 0.17]], 0, 2.12, 0, 4);
  // face
  b.cyl(M.clockFace, 0, 1.77, d / 2 + 0.002, 0.19, 0.19, 0.01, 32, Math.PI / 2);
  b.cyl(M.brass, 0, 1.77, d / 2 + 0.006, 0.205, 0.205, 0.006, 32, Math.PI / 2, 0, true);
  // hands (stuck at 3:00)
  b.boxC(M.black, 0.06, 1.77, d / 2 + 0.012, 0.12, 0.012, 0.004);
  b.boxC(M.black, 0, 1.84, d / 2 + 0.012, 0.012, 0.15, 0.004);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 2.2);
}

export function pendulum(b, M) {
  // origin at pivot
  b.cyl(M.brass, 0, -0.35, 0, 0.006, 0.006, 0.7, 6);
  b.cyl(M.brass, 0, -0.72, 0, 0.07, 0.07, 0.015, 20, Math.PI / 2);
}

export function sideTable(b, M, w = 0.55, d = 0.38) {
  b.rbox(M.wood, 0, 0.74, 0, w, 0.03, d, 0.01);
  b.box(M.wood, -w / 2 + 0.03, 0.62, -d / 2 + 0.03, w / 2 - 0.03, 0.72, d / 2 - 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.wood, sx * (w / 2 - 0.04), 0.37, sz * (d / 2 - 0.04), 0.014, 0.01, 0.74, 6);
  b.collider(-w / 2, -d / 2, w / 2, d / 2, 0.8);
}

export function rotaryPhone(b, M) {
  b.rbox(M.black, 0, 0.05, 0, 0.2, 0.09, 0.22, 0.04, 3);
  b.cyl(M.porcelain, 0, 0.1, 0.03, 0.06, 0.06, 0.01, 18);
  b.rbox(M.black, 0, 0.13, -0.03, 0.24, 0.04, 0.06, 0.02, 2);
  b.sphere(M.black, -0.11, 0.135, -0.03, 0.035, 1, 1, 1.2, 10);
  b.sphere(M.black, 0.11, 0.135, -0.03, 0.035, 1, 1, 1.2, 10);
  b.tube(M.black, [[-0.1, 0.05, 0.08], [-0.15, 0.0, 0.2], [-0.05, 0.0, 0.35], [-0.2, -0.3, 0.3]], 0.006, 16, 4);
}

export function coatRack(b, M) {
  b.cyl(M.darkWood, 0, 0.02, 0, 0.22, 0.24, 0.04, 14);
  b.cyl(M.darkWood, 0, 0.9, 0, 0.02, 0.025, 1.8, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.tube(M.darkWood, [[0, 1.72, 0], [Math.cos(a) * 0.12, 1.76, Math.sin(a) * 0.12], [Math.cos(a) * 0.17, 1.84, Math.sin(a) * 0.17]], 0.01, 6, 5);
  }
  // hanging coat
  b.lathe(M.fabric, [[0.06, 0], [0.22, -0.2], [0.24, -0.7], [0.27, -1.05], [0.0, -1.06]], 0.06, 1.74, 0.05, 14);
  b.collider(-0.25, -0.25, 0.25, 0.25, 1.9);
}

export function frame(b, M, w, h, mat) {
  b.box(M.darkWood, -w / 2, -h / 2, 0, w / 2, h / 2, 0.025);
  b.box(mat, -w / 2 + 0.03, -h / 2 + 0.03, 0.025, w / 2 - 0.03, h / 2 - 0.03, 0.027);
}

export function childBed(b, M) {
  bed(b, M, 0.95, 1.8, { frame: M.paintedWood, blanket: M.fabricPink, headH: 0.75 });
}

export function toyChest(b, M) {
  b.rbox(M.paintedWood, 0, 0.25, 0, 0.8, 0.5, 0.45, 0.02);
  b.rbox(M.paintedWood, 0, 0.52, 0, 0.84, 0.05, 0.49, 0.02);
  b.box(M.toyBlue, -0.36, 0.1, 0.225, 0.36, 0.14, 0.235);
  b.box(M.toyRed, -0.36, 0.38, 0.225, 0.36, 0.42, 0.235);
  b.collider(-0.42, -0.25, 0.42, 0.25, 0.6);
}

export function rockingChair(b, M) {
  // origin at the rocker contact point
  for (const s of [-1, 1]) {
    b.tube(M.wood, [[s * 0.24, 0.06, -0.45], [s * 0.24, 0.0, -0.1], [s * 0.24, 0.0, 0.15], [s * 0.24, 0.08, 0.42]], 0.018, 14, 5);
    b.box(M.wood, s * 0.24 - 0.02, 0.02, 0.15, s * 0.24 + 0.02, 0.45, 0.19);
    b.box(M.wood, s * 0.24 - 0.02, 0.02, -0.22, s * 0.24 + 0.02, 1.05, -0.18);
    b.box(M.wood, s * 0.24 - 0.02, 0.62, -0.2, s * 0.24 + 0.02, 0.65, 0.2);
  }
  b.rbox(M.wood, 0, 0.45, -0.02, 0.5, 0.04, 0.45, 0.01);
  for (let i = 0; i < 6; i++) b.box(M.wood, -0.18 + i * 0.072, 0.48, -0.21, -0.16 + i * 0.072, 1.0, -0.19);
  b.box(M.wood, -0.26, 0.98, -0.22, 0.26, 1.06, -0.17);
  // (Thimble, the porcelain doll, sits in it: see entities/Thimble.js)
}

export function block(b, mat, s = 0.08) {
  b.rbox(mat, 0, s / 2, 0, s, s, s, 0.008, 1);
}

export function ceilingLamp(b, M, y = 2.7) {
  b.cyl(M.brass, 0, y - 0.02, 0, 0.08, 0.08, 0.03, 14);
  b.lathe(M.glass, [[0.0, 0], [0.18, 0.01], [0.2, 0.06], [0.16, 0.12], [0.0, 0.13]], 0, y - 0.16, 0, 18);
}

export function radiator(b, M, len = 0.9) {
  const n = Math.round(len / 0.06);
  for (let i = 0; i < n; i++) b.rbox(M.metal, -len / 2 + i * 0.06 + 0.03, 0.42, 0, 0.045, 0.62, 0.12, 0.02, 1);
  b.cyl(M.metal, -len / 2, 0.12, 0, 0.02, 0.02, 0.12, 8);
  b.cyl(M.metal, len / 2, 0.12, 0, 0.02, 0.02, 0.12, 8);
  b.collider(-len / 2, -0.08, len / 2, 0.08, 0.8);
}

export function switchPlate(b, M) {
  b.box(M.porcelain, -0.04, -0.06, 0, 0.04, 0.06, 0.008);
  b.box(M.porcelain, -0.008, -0.015, 0.008, 0.008, 0.015, 0.02);
}

export function windowFrame(b, M, w, h, opts = {}) {
  // local: centred at window centre, wall plane at z=0, faces +z (interior)
  const t = 0.06, depth = opts.depth ?? 0.2;
  b.box(M.trim, -w / 2 - 0.08, -h / 2 - 0.04, 0.0, w / 2 + 0.08, -h / 2, 0.12);  // sill
  b.box(M.trim, -w / 2 - 0.08, -h / 2 - 0.12, 0, w / 2 + 0.08, -h / 2 - 0.04, 0.03);
  b.box(M.trim, -w / 2 - 0.08, h / 2, 0, w / 2 + 0.08, h / 2 + 0.08, 0.03);
  b.box(M.trim, -w / 2 - 0.08, -h / 2, 0, -w / 2, h / 2, 0.03);
  b.box(M.trim, w / 2, -h / 2, 0, w / 2 + 0.08, h / 2, 0.03);
  // sash frame inside the opening
  b.box(M.paintedWood, -w / 2, -h / 2, -depth / 2 - 0.02, w / 2, -h / 2 + t, -depth / 2 + 0.04);
  b.box(M.paintedWood, -w / 2, h / 2 - t, -depth / 2 - 0.02, w / 2, h / 2, -depth / 2 + 0.04);
  b.box(M.paintedWood, -w / 2, -h / 2, -depth / 2 - 0.02, -w / 2 + t, h / 2, -depth / 2 + 0.04);
  b.box(M.paintedWood, w / 2 - t, -h / 2, -depth / 2 - 0.02, w / 2, h / 2, -depth / 2 + 0.04);
  b.box(M.paintedWood, -w / 2, -0.025, -depth / 2 - 0.02, w / 2, 0.025, -depth / 2 + 0.04);
  b.box(M.paintedWood, -0.015, -h / 2, -depth / 2 - 0.01, 0.015, h / 2, -depth / 2 + 0.03);
  b.box(M.windowGlass, -w / 2 + t, -h / 2 + t, -depth / 2, w / 2 - t, h / 2 - t, -depth / 2 + 0.006);
  if (opts.curtains) {
    const cm = opts.curtains;
    b.cyl(M.brass, 0, h / 2 + 0.16, 0.12, 0.012, 0.012, w + 0.5, 8, 0, Math.PI / 2);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        b.cyl(cm, s * (w / 2 + 0.05 - i * 0.07), (h / 2 + 0.16) - (h + 0.4) / 2, 0.11 + (i % 2) * 0.02, 0.04, 0.05, h + 0.4, 8);
      }
    }
  }
}

export function tree(b, M) {
  b.tube(M.bark, [[0, 0, 0], [0.1, 1.5, 0.05], [-0.1, 3.0, 0.1], [0.2, 4.4, 0]], 0.18, 12, 8);
  const branch = (pts, r) => b.tube(M.bark, pts, r, 10, 5);
  branch([[0.05, 2.0, 0.05], [0.9, 2.7, 0.3], [1.6, 3.0, 0.8], [2.0, 3.6, 0.9]], 0.06);
  branch([[-0.05, 2.6, 0.08], [-0.8, 3.2, -0.3], [-1.5, 3.4, -0.6], [-1.9, 4.0, -0.5]], 0.05);
  branch([[0.1, 3.4, 0.05], [0.6, 4.0, -0.5], [0.8, 4.6, -1.0]], 0.04);
  branch([[0.9, 2.7, 0.3], [1.1, 2.4, 1.0], [1.3, 2.1, 1.5]], 0.03);
  // swing hanging from the low branch
  b.tube(M.linen, [[1.2, 2.85, 0.5], [1.2, 1.2, 0.5], [1.2, 0.55, 0.5]], 0.008, 4, 3);
  b.tube(M.linen, [[1.6, 2.95, 0.75], [1.6, 1.3, 0.75], [1.6, 0.55, 0.75]], 0.008, 4, 3);
  b.boxC(M.wood, 1.4, 0.53, 0.62, 0.55, 0.035, 0.2, 0, -0.55, 0);
}

export function fencePost(b, M, len) {
  for (let x = 0; x <= len; x += 0.3) b.box(M.paintedWood, x - 0.04, 0, -0.02, x + 0.04, 1.1 + (Math.round(x / 0.3) % 2) * 0.04, 0.02);
  b.box(M.paintedWood, 0, 0.3, -0.04, len, 0.38, -0.02);
  b.box(M.paintedWood, 0, 0.85, -0.04, len, 0.93, -0.02);
}
