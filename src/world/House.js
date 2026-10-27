import * as THREE from 'three';
import { Builder, buildGroup } from './Builder.js';
import { Door } from './Door.js';
import * as P from './props.js';
import { SoundField } from '../render/SoundField.js';
import { dustMaterial } from '../render/RevealMaterial.js';

export const CEIL = 2.7;
const T = 0.16; // wall thickness

// Surfaces for footsteps
export const SURF = { CARPET: 'carpet', WOOD: 'wood', TILE: 'tile', GLASS: 'glass', GRASS: 'grass', RUG: 'rug' };

export class House {
  constructor(M) {
    this.M = M;
    this.root = new THREE.Group();
    this.b = new Builder();
    this.field = new SoundField({ minX: -3, minZ: -3, sizeX: 23, sizeZ: 20, cell: 0.25 });
    this.doors = [];
    this.zones = [];
    this.creaky = [];
    this.squeaky = [];
    this.hideSpots = [];
    this.emitters = [];
    this.items = {};
    this.dynamic = [];
    this.rooms = [];
    this.build();
  }

  // ---------------------------------------------------------------- walls
  // Wall running along X at fixed z. matA faces -z side (north), matB faces +z (south)
  wallX(z, x0, x1, matA, matB, openings = [], opts = {}) {
    const b = this.b, M = this.M;
    const ext0 = x0 - T / 2 + 0.005, ext1 = x1 + T / 2 - 0.005;
    const ops = [...openings].sort((a, c) => a.a - c.a);
    const segs = [];
    let cur = ext0;
    for (const o of ops) { segs.push([cur, o.a, null]); segs.push([o.a, o.b, o]); cur = o.b; }
    segs.push([cur, ext1, null]);
    for (const [a, c, o] of segs) {
      if (c - a < 1e-3) continue;
      const parts = [];
      if (!o) parts.push([0, CEIL]);
      else if (o.kind === 'window') { parts.push([0, o.sill]); parts.push([o.top, CEIL]); }
      else parts.push([o.top ?? 2.1, CEIL]);
      for (const [y0, y1] of parts) {
        b.box(matA, a, y0, z - T / 2, c, y1, z);
        b.box(matB, a, y0, z, c, y1, z + T / 2);
      }
      // grid
      if (!o || o.kind === 'window') {
        this.field.addWall(a, z - T / 2, c, z + T / 2);
        this.b.colliders.push({ minX: a, maxX: c, minZ: z - T / 2, maxZ: z + T / 2, maxY: CEIL, noNav: true, wall: true });
      }
      // baseboard + crown
      if (!o || o.kind === 'window') {
        if (!opts.noTrimA) {
          b.box(M.trim, a, 0, z - T / 2 - 0.018, c, 0.13, z - T / 2);
          b.box(M.trim, a, CEIL - 0.1, z - T / 2 - 0.04, c, CEIL, z - T / 2);
        }
        if (!opts.noTrimB) {
          b.box(M.trim, a, 0, z + T / 2, c, 0.13, z + T / 2 + 0.018);
          b.box(M.trim, a, CEIL - 0.1, z + T / 2, c, CEIL, z + T / 2 + 0.04);
        }
      }
      if (o && o.kind !== 'window') {
        if (!opts.noTrimA) b.box(M.trim, a, CEIL - 0.1, z - T / 2 - 0.04, c, CEIL, z - T / 2);
        if (!opts.noTrimB) b.box(M.trim, a, CEIL - 0.1, z + T / 2, c, CEIL, z + T / 2 + 0.04);
        // door casing both sides
        const top = o.top ?? 2.1;
        for (const s of [-1, 1]) {
          if (s < 0 && opts.noTrimA) continue;
          if (s > 0 && opts.noTrimB) continue;
          const zz = z + s * (T / 2);
          const z0 = Math.min(zz, zz + s * 0.025), z1 = Math.max(zz, zz + s * 0.025);
          b.box(M.trim, a - 0.07, 0, z0, a, top + 0.07, z1);
          b.box(M.trim, c, 0, z0, c + 0.07, top + 0.07, z1);
          b.box(M.trim, a - 0.07, top, z0, c + 0.07, top + 0.08, z1);
        }
        // jambs inside opening
        b.box(M.trim, a, 0, z - T / 2, a + 0.03, top, z + T / 2);
        b.box(M.trim, c - 0.03, 0, z - T / 2, c, top, z + T / 2);
        b.box(M.trim, a, top - 0.03, z - T / 2, c, top, z + T / 2);
      }
    }
  }

  // Wall running along Z at fixed x. matA faces -x (west), matB faces +x (east)
  wallZ(x, z0, z1, matA, matB, openings = [], opts = {}) {
    const b = this.b, M = this.M;
    const ext0 = z0 - T / 2 + 0.005, ext1 = z1 + T / 2 - 0.005;
    const ops = [...openings].sort((a, c) => a.a - c.a);
    const segs = [];
    let cur = ext0;
    for (const o of ops) { segs.push([cur, o.a, null]); segs.push([o.a, o.b, o]); cur = o.b; }
    segs.push([cur, ext1, null]);
    for (const [a, c, o] of segs) {
      if (c - a < 1e-3) continue;
      const parts = [];
      if (!o) parts.push([0, CEIL]);
      else if (o.kind === 'window') { parts.push([0, o.sill]); parts.push([o.top, CEIL]); }
      else parts.push([o.top ?? 2.1, CEIL]);
      for (const [y0, y1] of parts) {
        b.box(matA, x - T / 2, y0, a, x, y1, c);
        b.box(matB, x, y0, a, x + T / 2, y1, c);
      }
      if (!o || o.kind === 'window') {
        this.field.addWall(x - T / 2, a, x + T / 2, c);
        this.b.colliders.push({ minX: x - T / 2, maxX: x + T / 2, minZ: a, maxZ: c, maxY: CEIL, noNav: true, wall: true });
      }
      if (!o || o.kind === 'window') {
        if (!opts.noTrimA) {
          b.box(M.trim, x - T / 2 - 0.018, 0, a, x - T / 2, 0.13, c);
          b.box(M.trim, x - T / 2 - 0.04, CEIL - 0.1, a, x - T / 2, CEIL, c);
        }
        if (!opts.noTrimB) {
          b.box(M.trim, x + T / 2, 0, a, x + T / 2 + 0.018, 0.13, c);
          b.box(M.trim, x + T / 2, CEIL - 0.1, a, x + T / 2 + 0.04, CEIL, c);
        }
      }
      if (o && o.kind !== 'window') {
        if (!opts.noTrimA) b.box(M.trim, x - T / 2 - 0.04, CEIL - 0.1, a, x - T / 2, CEIL, c);
        if (!opts.noTrimB) b.box(M.trim, x + T / 2, CEIL - 0.1, a, x + T / 2 + 0.04, CEIL, c);
        const top = o.top ?? 2.1;
        for (const s of [-1, 1]) {
          if (s < 0 && opts.noTrimA) continue;
          if (s > 0 && opts.noTrimB) continue;
          const xx = x + s * (T / 2);
          const x0 = Math.min(xx, xx + s * 0.025), x1 = Math.max(xx, xx + s * 0.025);
          b.box(M.trim, x0, 0, a - 0.07, x1, top + 0.07, a);
          b.box(M.trim, x0, 0, c, x1, top + 0.07, c + 0.07);
          b.box(M.trim, x0, top, a - 0.07, x1, top + 0.08, c + 0.07);
        }
        b.box(M.trim, x - T / 2, 0, a, x + T / 2, top, a + 0.03);
        b.box(M.trim, x - T / 2, 0, c - 0.03, x + T / 2, top, c);
        b.box(M.trim, x - T / 2, top - 0.03, a, x + T / 2, top, c);
      }
    }
  }

  room(name, x0, z0, x1, z1, floorMat, surface) {
    const b = this.b;
    b.box(floorMat, x0, -0.05, z0, x1, 0, z1);
    b.box(this.M.plaster, x0, CEIL, z0, x1, CEIL + 0.05, z1);
    this.zones.push({ x0, z0, x1, z1, surface, pri: 0 });
    this.rooms.push({ name, x0, z0, x1, z1 });
  }

  rug(mat, x0, z0, x1, z1) {
    this.b.rbox(mat, (x0 + x1) / 2, 0.006, (z0 + z1) / 2, x1 - x0, 0.012, z1 - z0, 0.005, 1);
    this.zones.push({ x0, z0, x1, z1, surface: SURF.RUG, pri: 1 });
  }

  // window glass etc. built inside the wall opening; `face` is the interior normal direction
  windowAt(x, z, w, h, sill, face, curtains) {
    const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
    // place frame on interior face of the wall
    const off = { s: [0, T / 2], n: [0, -T / 2], e: [T / 2, 0], w: [-T / 2, 0] }[face];
    this.b.at(x + off[0], sill + h / 2, z + off[1], rot, () => P.windowFrame(this.b, this.M, w, h, { depth: T + 0.02, curtains }));
  }

  door(o) {
    const d = new Door(this.M, { id: this.doors.length, ...o });
    this.doors.push(d);
    this.root.add(d.group);
    const [x0, z0, x1, z1] = o.opening;
    // door cells in the sound grid (thickness of wall)
    if (Math.abs(z1 - z0) < 0.01) this.field.addDoor(d.id, x0, z0 - T / 2, x1, z1 + T / 2);
    else this.field.addDoor(d.id, x0 - T / 2, z0, x1 + T / 2, z1);
    this.field.setDoorClosed(d.id, d.isClosed);
    this.field.doorClosed[d.id] = d.isClosed;
    return d;
  }

  // ---------------------------------------------------------------- build
  build() {
    const M = this.M, b = this.b;

    // ---------- rooms
    this.room('Diane’s bedroom', 0, 0, 6.5, 5, M.carpetMom, SURF.CARPET);
    this.room('Bathroom', 6.5, 0, 10, 5, M.tile, SURF.TILE);
    this.room('June’s room', 10, 0, 17, 5, M.carpetJune, SURF.CARPET);
    this.room('Hallway', 0, 5, 17, 7, M.floorWood, SURF.WOOD);
    this.room('Living room', 0, 7, 6.5, 14, M.carpet, SURF.CARPET);
    this.room('Foyer', 6.5, 7, 10, 14, M.floorWood, SURF.WOOD);
    this.room('Kitchen', 10, 7, 17, 14, M.tile, SURF.TILE);

    // ---------- exterior walls
    const W = (a, b2, kind = 'window', sill = 0.9, top = 2.1) => ({ a, b: b2, kind, sill, top });
    const D = (a, b2, top = 2.1) => ({ a, b: b2, kind: 'door', top });
    const A = (a, b2, top = 2.3) => ({ a, b: b2, kind: 'arch', top });

    // north z=0 : Diane window, bath window, June window
    this.wallX(0, 0, 17, M.siding, M.wallpaperMom, [W(4.75, 6.0), W(8.75, 9.5, 'window', 1.4, 2.05), W(13.0, 14.5)], { noTrimA: true });
    // re-skin interior faces per room for north wall: draw thin overlays
    this.skinX(0, 6.5, 10, M.wallTile, +1);
    this.skinX(0, 10, 17, M.wallpaperJune, +1, [[13.0, 14.5, 0.9, 2.1]]);
    // south z=14
    this.wallX(14, 0, 17, M.wallpaperLiving, M.siding, [W(4.0, 5.5), D(7.75, 8.75, 2.12), W(12.5, 13.75, 'window', 1.1, 2.1)], { noTrimB: true });
    this.skinX(14, 6.5, 10, M.wallpaperHall, -1, [[7.75, 8.75, 0, 2.12]]);
    this.skinX(14, 10, 17, M.wallpaperKitchen, -1, [[12.5, 13.75, 1.1, 2.1]]);
    // west x=0
    this.wallZ(0, 0, 14, M.siding, M.wallpaperMom, [], { noTrimA: true });
    this.skinZ(0, 5, 7, M.wallpaperHall, +1);
    this.skinZ(0, 7, 14, M.wallpaperLiving, +1);
    // east x=17 : June window (holdout), basement door, back door
    this.wallZ(17, 0, 14, M.wallpaperJune, M.siding, [W(1.75, 3.25, 'window', 0.8, 2.05), D(8.0, 9.0), D(11.75, 12.75)], { noTrimB: true });
    this.skinZ(17, 5, 7, M.wallpaperHall, -1);
    this.skinZ(17, 7, 14, M.wallpaperKitchen, -1, [[8.0, 9.0, 0, 2.1], [11.75, 12.75, 0, 2.1]]);

    // ---------- interior walls
    // z=5 north rooms | hallway
    this.wallX(5, 0, 6.5, M.wallpaperMom, M.wallpaperHall, [D(4.0, 5.0)]);
    this.wallX(5, 6.5, 10, M.wallTile, M.wallpaperHall, [D(7.5, 8.5)]);
    this.wallX(5, 10, 17, M.wallpaperJune, M.wallpaperHall, [D(11.5, 12.5)]);
    // z=7 hallway | south rooms
    this.wallX(7, 0, 6.5, M.wallpaperHall, M.wallpaperLiving, [D(2.5, 3.5)]);
    this.wallX(7, 6.5, 10, M.wallpaperHall, M.wallpaperHall, [A(7.0, 9.5)]);
    this.wallX(7, 10, 17, M.wallpaperHall, M.wallpaperKitchen, [D(13.5, 14.5)]);
    // x=6.5 / x=10 dividers
    this.wallZ(6.5, 0, 5, M.wallpaperMom, M.wallTile);
    this.wallZ(10, 0, 5, M.wallTile, M.wallpaperJune);
    this.wallZ(6.5, 7, 14, M.wallpaperLiving, M.wallpaperHall, [A(9.25, 11.25)]);
    this.wallZ(10, 7, 14, M.wallpaperHall, M.wallpaperKitchen, [A(9.25, 11.25)]);

    // ---------- windows (frames, glass, curtains)
    this.windowAt(5.375, 0, 1.25, 1.2, 0.9, 's', M.fabricGreen);
    this.windowAt(9.125, 0, 0.75, 0.65, 1.4, 's');
    this.windowAt(13.75, 0, 1.5, 1.2, 0.9, 's', M.fabricPink);
    this.windowAt(4.75, 14, 1.5, 1.2, 0.9, 'n', M.fabricRed);
    this.windowAt(13.125, 14, 1.25, 1.0, 1.1, 'n');
    this.windowAt(17, 2.5, 1.5, 1.25, 0.8, 'w', M.fabricPink);

    // ---------- doors
    this.doorFront = this.door({ name: 'Front door', opening: [7.75, 14, 8.75, 14], hx: 7.79, hz: 14, baseRot: 0, openSign: 1, angle: 1.4, exterior: true, height: 2.08, width: 0.92 });
    this.doorFront.fixedSign = true;
    this.doorLiving = this.door({ name: 'Door', opening: [2.5, 7, 3.5, 7], hx: 2.54, hz: 7, baseRot: 0, openSign: -1, angle: 1.2 });
    this.doorKitchen = this.door({ name: 'Door', opening: [13.5, 7, 14.5, 7], hx: 14.46, hz: 7, baseRot: Math.PI, openSign: 1, angle: 1.5 });
    this.doorMom = this.door({ name: 'Diane’s door', opening: [4.0, 5, 5.0, 5], hx: 4.96, hz: 5, baseRot: Math.PI, openSign: -1, angle: 0.35 });
    this.doorBath = this.door({ name: 'Bathroom door', opening: [7.5, 5, 8.5, 5], hx: 7.54, hz: 5, baseRot: 0, openSign: 1, angle: 0.5 });
    this.doorJune = this.door({ name: 'June’s door', opening: [11.5, 5, 12.5, 5], hx: 11.54, hz: 5, baseRot: 0, openSign: 1, angle: 0, locked: true, note: true, lockedText: 'Locked. A note is taped to the door.' });
    this.doorBasement = this.door({ name: 'Basement door', opening: [17, 8.0, 17, 9.0], hx: 17, hz: 8.04, baseRot: -Math.PI / 2, openSign: 1, angle: 0, locked: true, note: true, hushCanOpen: false, lockedText: 'Nailed shut from this side.' });
    this.doorBack = this.door({ name: 'Back door', opening: [17, 11.75, 17, 12.75], hx: 17, hz: 11.79, baseRot: -Math.PI / 2, openSign: -1, angle: 0, locked: true, exterior: true, window: true, lockedText: 'Locked. The key isn’t here.' });
    for (const d of this.doors) d.fixedSign = true;

    this.furnish();
    this.exterior();

    this.meshes = b.build(this.root);
    this.colliders = b.colliders;
    this.addDust();
  }

  // thin interior skins so walls shared by different rooms get the right paper
  skinX(z, x0, x1, mat, side, holes = []) {
    const zz = z + side * (T / 2 + 0.002);
    const z0 = Math.min(zz, zz + side * 0.004), z1 = Math.max(zz, zz + side * 0.004);
    const spans = this._spans(x0, x1, holes);
    for (const [a, c, h] of spans) {
      if (!h) this.b.box(mat, a, 0.13, z0, c, CEIL - 0.1, z1);
      else {
        if (h[2] > 0.13) this.b.box(mat, a, 0.13, z0, c, h[2], z1);
        this.b.box(mat, a, h[3], z0, c, CEIL - 0.1, z1);
      }
    }
  }
  skinZ(x, z0, z1, mat, side, holes = []) {
    const xx = x + side * (T / 2 + 0.002);
    const x0 = Math.min(xx, xx + side * 0.004), x1 = Math.max(xx, xx + side * 0.004);
    const spans = this._spans(z0, z1, holes);
    for (const [a, c, h] of spans) {
      if (!h) this.b.box(mat, x0, 0.13, a, x1, CEIL - 0.1, c);
      else {
        if (h[2] > 0.13) this.b.box(mat, x0, 0.13, a, x1, h[2], c);
        this.b.box(mat, x0, h[3], a, x1, CEIL - 0.1, c);
      }
    }
  }
  _spans(a0, a1, holes) {
    const out = [];
    let cur = a0;
    for (const h of [...holes].sort((p, q) => p[0] - q[0])) {
      if (h[0] > cur) out.push([cur, h[0], null]);
      out.push([h[0], h[1], h]);
      cur = h[1];
    }
    if (cur < a1) out.push([cur, a1, null]);
    return out;
  }

  furnish() {
    const M = this.M, b = this.b;
    const at = (x, z, r, fn) => b.at(x, 0, z, r, fn);
    const S = Math.PI, E = Math.PI / 2, Wd = -Math.PI / 2; // facing: S=north? (rot=PI faces -z)

    // ===== FOYER
    this.rug(M.rugBlue, 7.65, 12.95, 8.85, 13.75);
    at(7.0, 13.45, 0, () => P.coatRack(b, M));
    at(9.62, 12.4, Wd, () => { P.sideTable(b, M); b.at(0.08, 0.755, 0.02, 0.3, () => P.rotaryPhone(b, M)); });
    b.at(6.5 + T / 2 + 0.004, 1.55, 12.4, E, () => P.mirror(b, M, 0.55, 0.8));
    b.at(6.5 + T / 2 + 0.004, 1.6, 8.3, E, () => P.frame(b, M, 0.4, 0.5, M.photo0));
    b.at(8.25, 0, 10.5, 0, () => P.ceilingLamp(b, M));
    // mail pile by the door
    for (let i = 0; i < 9; i++) b.boxC(M.paper, 8.95 + Math.sin(i * 2.3) * 0.12, 0.004 + i * 0.003, 13.35 + Math.cos(i * 1.7) * 0.12, 0.22, 0.003, 0.11, 0, i * 0.7, 0);

    // ===== LIVING ROOM
    this.rug(M.rug, 1.2, 10.4, 4.2, 13.0);
    at(0.33, 11.0, E, () => P.fireplace(b, M));
    at(0.25, 8.3, E, () => P.bookshelf(b, M, 1.4, 2.0));
    this.tvLocal = null;
    at(5.2, 7.38, 0, () => { this.tvScreen = P.crtOnStand(b, M); });
    this.tvScreen = { x: 5.2 + this.tvScreen.x, y: this.tvScreen.y, z: 7.38 + this.tvScreen.z, w: this.tvScreen.w, h: this.tvScreen.h };
    // Mr Hush's armchair, facing the TV
    at(5.2, 9.55, S, () => P.armchair(b, M));
    this.hushChair = { x: 5.2, z: 9.4, rot: S };
    at(2.6, 13.4, S, () => P.sofa(b, M, 2.1));
    at(2.6, 11.85, 0, () => P.coffeeTable(b, M));
    at(0.45, 13.5, 0, () => P.floorLamp(b, M));
    at(4.75, 13.86, S, () => P.radiator(b, M, 1.0));
    b.at(6.5 - T / 2 - 0.004, 1.5, 12.9, Wd, () => P.frame(b, M, 0.5, 0.62, M.photo2));
    b.at(3.0, 0, 10.5, 0, () => P.ceilingLamp(b, M));
    // stuffing tufts and a dark stain around the armchair
    for (let i = 0; i < 8; i++) b.sphere(M.stuffing, 4.6 + Math.sin(i * 1.9) * 0.6, 0.03, 10.3 + Math.cos(i * 2.7) * 0.5, 0.05 + (i % 3) * 0.02, 1.2, 0.5, 1, 7);
    this.decal(M.bloodSplat2, 5.0, 0.004, 10.25, 1.1, 1.1, 'floor', 0.5);

    // ===== HALLWAY
    this.rug(M.rug, 1.1, 5.6, 15.9, 6.4);
    at(0.32, 6.0, E, () => P.grandfatherClock(b, M));
    this.clockPos = { x: 0.4, y: 1.0, z: 6.0 };
    this.pendulum = buildGroup((g) => P.pendulum(g, M));
    this.pendulum.position.set(0.32 + 0.12, 1.4, 6.0);
    this.root.add(this.pendulum);
    at(9.6, 5.27, 0, () => P.sideTable(b, M, 0.5, 0.32));
    at(16.6, 6.0, Wd, () => P.wardrobe(b, M));
    this.hideSpots.push({ id: 'linen', name: 'Linen closet', x: 16.6, z: 6.0, out: { x: 15.9, z: 6.0 }, face: Wd, eyeY: 1.5, uses: 0 });
    // photos along the hall
    const hallPhotos = [[2.0, M.photo1], [5.9, M.photo0], [10.9, M.photo2], [15.2, M.photo1]];
    hallPhotos.forEach(([x, m], i) => b.at(x, 1.55 + (i % 2) * 0.1, 5 + T / 2 + 0.004, 0.0, () => P.frame(b, M, 0.34, 0.42, m)));
    b.at(4.0, 0, 6.0, 0, () => P.ceilingLamp(b, M));
    b.at(12.0, 0, 6.0, 0, () => P.ceilingLamp(b, M));
    // Diane's scratched writing
    this.decal(M.hallWriting, 11.0, 1.35, 7 - T / 2 - 0.006, 1.4, 0.7, 'wallS');
    // creaky boards (whole width) and partial patches
    this.creaky.push({ x0: 5.0, z0: 5.0, x1: 5.5, z1: 7.0 }, { x0: 10.25, z0: 5.0, x1: 10.75, z1: 7.0 }, { x0: 14.75, z0: 5.0, x1: 15.25, z1: 7.0 });

    // ===== KITCHEN
    // drawers 1, 4, 5 are movable (Chapter1.makeDrawers): batteries + "search the drawers"
    at(13.1, 13.61, S, () => P.counter(b, M, 5.0, { sink: 0.1, skipDrawers: [1, 4, 5] }));
    at(16.12, 13.6, S, () => P.stove(b, M));
    b.at(11.45, 0, 13.75, S, () => P.upperCabinet(b, M, 1.7));
    b.at(14.7, 0, 13.75, S, () => P.upperCabinet(b, M, 1.8));
    at(16.45, 7.5, Wd, () => P.fridge(b, M));
    at(12.4, 10.2, 0, () => P.diningTable(b, M));
    at(11.4, 10.2, E, () => P.chair(b, M));
    at(13.4, 10.2, Wd, () => P.chair(b, M));
    at(12.4, 9.45, 0, () => P.chair(b, M));
    at(12.6, 11.4, 0.3, () => P.chair(b, M, true));
    b.at(12.4, 0, 10.2, 0, () => P.ceilingLamp(b, M));
    // gore: drag trail from the basement door
    this.decal(M.bloodTrail, 16.0, 0.004, 8.6, 1.8, 0.9, 'floor', 0.2);
    this.decal(M.bloodHand, 17 - T / 2 - 0.015, 0.75, 9.3, 0.6, 0.6, 'wallW');
    this.decal(M.bloodSplat, 15.0, 0.004, 9.1, 0.8, 0.8, 'floor', 1.3);

    // ===== DIANE'S BEDROOM
    at(3.0, 1.12, 0, () => P.bed(b, M, 1.5, 2.05, { blanket: M.fabricGreen }));
    at(1.95, 0.3, 0, () => P.nightstand(b, M));
    at(4.05, 0.3, 0, () => P.nightstand(b, M, { noTopDrawer: true })); // key drawer is movable
    at(0.38, 2.6, E, () => P.wardrobe(b, M));
    this.hideSpots.push({ id: 'wardrobe', name: 'Wardrobe', x: 0.38, z: 2.6, out: { x: 1.1, z: 2.6 }, face: E, eyeY: 1.5, uses: 0 });
    this.hideSpots.push({ id: 'bed', name: 'Under the bed', x: 3.0, z: 1.5, out: { x: 3.0, z: 2.6 }, face: 0, eyeY: 0.2, uses: 0, under: true });
    at(1.6, 4.68, S, () => P.dresser(b, M, 1.3));
    b.at(1.6, 1.25, 5 - T / 2 - 0.006, S, () => P.mirror(b, M, 0.7, 0.85));
    at(5.4, 0.36, 0, () => P.sewingTable(b, M));
    at(5.95, 1.55, -0.6, () => P.dressForm(b, M));
    b.at(3.0, 0, 3.4, 0, () => P.ceilingLamp(b, M));
    b.at(0.08 + T / 2, 1.6, 4.1, E, () => P.frame(b, M, 0.4, 0.5, M.photo1));
    this.decal(M.bloodSmear, 3.0, 0.555, 1.9, 1.2, 0.8, 'floor', 0.0);

    // ===== BATHROOM
    at(7.55, 0.47, 0, () => P.bathtub(b, M));
    at(9.62, 1.7, Wd, () => P.toilet(b, M));
    at(9.68, 3.3, Wd, () => P.bathSink(b, M));
    b.at(10 - T / 2 - 0.004, 1.35, 3.3, Wd, () => P.mirror(b, M, 0.6, 0.8));
    this.decal(M.mirrorWriting, 10 - T / 2 - 0.045, 1.75, 3.3, 0.62, 0.32, 'wallW');
    this.decal(M.bloodSplat, 7.6, 0.004, 1.6, 1.2, 1.2, 'floor', 0.4);
    this.decal(M.bloodSplat2, 8.8, 0.004, 3.6, 0.9, 0.9, 'floor', 2.1);
    this.decal(M.bloodHand, 6.5 + T / 2 + 0.006, 0.9, 2.4, 0.7, 0.7, 'wallE');
    this.decal(M.bloodSmear, 7.0, 1.0, 0.0 + T / 2 + 0.014, 1.2, 0.9, 'wallN');
    for (let i = 0; i < 6; i++) b.sphere(M.stuffing, 7.2 + i * 0.35, 0.04, 2.0 + Math.sin(i * 2.1) * 0.6, 0.06 + (i % 2) * 0.03, 1.3, 0.45, 1, 7);
    b.at(8.25, 0, 2.5, 0, () => P.ceilingLamp(b, M));

    // ===== JUNE'S ROOM
    this.rug(M.rugBlue, 12.6, 1.6, 15.2, 3.8);
    at(10.6, 1.0, 0, () => P.childBed(b, M));
    at(10.6, 2.4, E, () => P.toyChest(b, M));
    at(15.9, 4.68, S, () => P.dresser(b, M, 1.1));
    this.rocker = buildGroup((g) => P.rockingChair(g, M));
    this.rocker.position.set(16.2, 0, 0.85);
    this.rocker.rotation.y = -2.4;
    this.root.add(this.rocker);
    this.b.colliders.push({ minX: 15.8, maxX: 16.6, minZ: 0.4, maxZ: 1.3, maxY: 1.1 });
    b.at(15.4, 1.55, 0 + T / 2 + 0.004, 0, () => P.frame(b, M, 0.5, 0.65, M.poster));
    // height chart on the door casing (room side)
    this.decal(M.heightChart, 12.62, 1.15, 5 - T / 2 - 0.03, 0.13, 2.3, 'wallS');
    // shelf with an empty space where a plush once sat
    b.box(M.paintedWood, 10.1, 1.5, 3.0, 10.4, 1.53, 4.4);
    for (let i = 0; i < 3; i++) b.sphere(M.plushSmall, 10.26, 1.62, 3.2 + i * 0.32, 0.09, 1, 1.1, 1, 10);
    // mobile above the bed
    b.cyl(M.darkMetal, 10.6, 2.2, 1.0, 0.004, 0.004, 1.0, 4);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.cyl(M.linen, 10.6 + Math.cos(a) * 0.22, 1.85, 1.0 + Math.sin(a) * 0.22, 0.002, 0.002, 0.3, 3);
      b.sphere(i % 2 ? M.toyYellow : M.toyBlue, 10.6 + Math.cos(a) * 0.22, 1.68, 1.0 + Math.sin(a) * 0.22, 0.04, 1, 1, 1, 8);
    }
    b.at(13.5, 0, 2.5, 0, () => P.ceilingLamp(b, M));
    this.holdoutSeat = { x: 14.15, z: 2.95, y: 0.95 };

    // switches
    for (const [x, z, r] of [[3.8, 7 - T / 2, S], [5.25, 5 - T / 2, S], [12.75, 5 - T / 2, S], [7.3, 5 - T / 2, S]]) {
      b.at(x, 1.25, z - 0.004, r, () => P.switchPlate(b, M));
    }
  }

  exterior() {
    const M = this.M, b = this.b;
    b.box(M.ground, -12, -0.12, -12, 30, -0.06, 28);
    // porch
    b.box(M.floorWood, 6.6, -0.06, 14.08, 10.0, 0.0, 15.8);
    for (const x of [6.7, 9.9]) b.box(M.paintedWood, x - 0.06, 0, 15.6, x + 0.06, 2.6, 15.72);
    b.box(M.paintedWood, 6.5, 2.55, 14.08, 10.1, 2.68, 15.9);
    b.box(M.floorWood, 7.4, -0.12, 15.8, 9.2, -0.06, 16.3);
    // tree + swing outside June's window, fence
    b.at(19.4, 0, 3.6, 0.4, () => P.tree(b, M));
    b.at(-2.5, 0, -2.2, 0, () => P.fencePost(b, M, 22.0));
    b.at(19.8, 0, -2.0, -Math.PI / 2, () => P.fencePost(b, M, 17.5));
    // mailbox
    b.cyl(M.darkWood, 5.5, 0.55, 17.5, 0.04, 0.04, 1.1, 8);
    b.rbox(M.darkMetal, 5.5, 1.18, 17.5, 0.22, 0.24, 0.45, 0.1);
    // exterior wall colliders are via walls; ground colliders not needed
  }

  decal(mat, x, y, z, w, h, kind, rot = 0) {
    const g = new THREE.PlaneGeometry(w, h);
    if (kind === 'floor') { g.rotateX(-Math.PI / 2); g.rotateY(rot); }
    else if (kind === 'wallN') { /* faces +z */ }
    else if (kind === 'wallS') { g.rotateY(Math.PI); }
    else if (kind === 'wallE') { g.rotateY(Math.PI / 2); }
    else if (kind === 'wallW') { g.rotateY(-Math.PI / 2); }
    g.translate(x, y, z);
    this.b.add(mat, g);
  }

  addDust() {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 17;
      pos[i * 3 + 1] = 0.2 + Math.random() * 2.4;
      pos[i * 3 + 2] = Math.random() * 14;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = dustMaterial(5);
    const pts = new THREE.Points(g, this.dustMat);
    pts.frustumCulled = false;
    pts.renderOrder = 10;
    this.root.add(pts);
  }

  surfaceAt(x, z) {
    let best = null, pri = -1;
    for (const zn of this.zones) {
      if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1 && zn.pri > pri) { best = zn.surface; pri = zn.pri; }
    }
    if (!best) return SURF.GRASS;
    return best;
  }

  roomAt(x, z) {
    for (const r of this.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
    return null;
  }

  isCreaky(x, z) {
    return this.creaky.some((c) => x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1);
  }
}
