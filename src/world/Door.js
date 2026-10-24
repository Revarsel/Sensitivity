import * as THREE from 'three';
import { buildGroup } from './Builder.js';

// A hinged door. Built in local space with the hinge at the origin and the
// closed panel running along +X.
export class Door {
  constructor(M, o) {
    this.id = o.id;
    this.name = o.name;
    this.width = o.width ?? 0.92;
    this.height = o.height ?? 2.04;
    this.thick = 0.045;
    this.hinge = new THREE.Vector2(o.hx, o.hz);
    this.baseRot = o.baseRot;          // rotation that points local +X along the closed panel
    this.openSign = o.openSign ?? 1;   // which way it swings
    this.maxOpen = o.maxOpen ?? 1.75;
    this.angle = o.angle ?? 0;
    this.target = this.angle;
    this.speed = 0;
    this.locked = !!o.locked;
    this.lockedText = o.lockedText || 'Locked.';
    this.hushCanOpen = o.hushCanOpen ?? true;
    this.exterior = !!o.exterior;
    this.opening = o.opening; // [x0,z0,x1,z1]
    this.group = buildGroup((b) => this._build(b, M, o));
    this.group.position.set(o.hx, 0, o.hz);
    this.mesh = this.group;
    this.group.userData.door = this;
    this.obb = { cx: 0, cz: 0, hx: this.width / 2, hz: this.thick / 2 + 0.01, rot: 0 };
    this.lastCreak = 0;
    this.moving = false;
    this._apply();
  }

  _build(b, M, o) {
    const w = this.width, h = this.height, t = this.thick;
    const mat = o.exterior ? M.darkWood : M.paintedWood;
    // stiles and rails
    b.box(mat, 0, 0, -t / 2, 0.11, h, t / 2);
    b.box(mat, w - 0.11, 0, -t / 2, w, h, t / 2);
    b.box(mat, 0.11, h - 0.12, -t / 2, w - 0.11, h, t / 2);
    b.box(mat, 0.11, 0, -t / 2, w - 0.11, 0.2, t / 2);
    b.box(mat, 0.11, 1.0, -t / 2, w - 0.11, 1.12, t / 2);
    b.box(mat, w / 2 - 0.04, 0.2, -t / 2, w / 2 + 0.04, o.window ? 1.12 : h - 0.12, t / 2);
    // recessed panels
    const pz = t / 2 - 0.012;
    for (const [x0, x1] of [[0.11, w / 2 - 0.04], [w / 2 + 0.04, w - 0.11]]) {
      b.box(mat, x0, 0.2, -pz, x1, 1.0, pz);
      if (!o.window) b.box(mat, x0, 1.12, -pz, x1, h - 0.12, pz);
    }
    if (o.window) b.box(M.windowGlass, 0.15, 1.2, -0.004, w - 0.15, h - 0.18, 0.004);
    // knobs both sides
    for (const s of [-1, 1]) {
      b.cyl(M.brass, w - 0.08, 1.0, s * (t / 2 + 0.03), 0.012, 0.012, 0.05, 8, Math.PI / 2);
      b.sphere(M.brass, w - 0.08, 1.0, s * (t / 2 + 0.06), 0.03, 1, 1, 0.8, 12);
      b.box(M.brass, w - 0.1, 0.92, s * (t / 2 + 0.002) - 0.002, w - 0.06, 1.08, s * (t / 2 + 0.002) + 0.002);
    }
    // hinges
    for (const y of [0.25, h - 0.3]) b.box(M.brass, -0.012, y, -t / 2 - 0.004, 0.02, y + 0.1, t / 2 + 0.004);
    if (o.note) {
      b.boxC(M.notePaper, w / 2, 1.45, t / 2 + 0.003, 0.2, 0.26, 0.004, 0, 0, 0.04);
    }
  }

  get rotation() { return this.baseRot + this.openSign * this.angle; }
  get isClosed() { return Math.abs(this.angle) < 0.12; }

  // Player position decides which way to open (always away from them)
  openAway(px, pz) {
    const rot = this.baseRot;
    const dx = Math.cos(rot), dz = -Math.sin(rot);
    // normal of the closed panel
    const nx = -dz, nz = dx;
    const rx = px - this.hinge.x, rz = pz - this.hinge.y;
    const side = rx * nx + rz * nz;
    // rotating by +angle moves the panel tip toward -normal... compute both and pick
    const tip = (sign) => {
      const r = rot + sign * 0.6;
      return { x: this.hinge.x + Math.cos(r) * this.width, z: this.hinge.y - Math.sin(r) * this.width };
    };
    const a = tip(1), b = tip(-1);
    const da = (a.x - px) ** 2 + (a.z - pz) ** 2;
    const db = (b.x - px) ** 2 + (b.z - pz) ** 2;
    if (this.fixedSign) return this.openSign;
    return da > db ? 1 : -1;
  }

  setTarget(open, speed, px, pz) {
    if (open && this.isClosed && px !== undefined && !this.fixedSign) this.openSign = this.openAway(px, pz);
    this.target = open ? this.maxOpen : 0;
    this.speed = speed;
    this.moving = true;
  }

  update(dt) {
    if (!this.moving) return false;
    const d = this.target - this.angle;
    const step = this.speed * dt;
    if (Math.abs(d) <= step) { this.angle = this.target; this.moving = false; }
    else this.angle += Math.sign(d) * step;
    this._apply();
    return true;
  }

  _apply() {
    const r = this.rotation;
    this.group.rotation.y = r;
    const dx = Math.cos(r), dz = -Math.sin(r);
    this.obb.cx = this.hinge.x + dx * this.width / 2;
    this.obb.cz = this.hinge.y + dz * this.width / 2;
    this.obb.rot = r;
  }

  tipPosition() {
    const r = this.rotation;
    return { x: this.hinge.x + Math.cos(r) * this.width * 0.8, z: this.hinge.y - Math.sin(r) * this.width * 0.8 };
  }
  center() {
    return { x: (this.opening[0] + this.opening[2]) / 2, z: (this.opening[1] + this.opening[3]) / 2 };
  }
}
