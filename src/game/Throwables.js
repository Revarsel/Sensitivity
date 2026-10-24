import * as THREE from 'three';
import { buildGroup } from '../world/Builder.js';
import { ownMaterials } from './Interactions.js';
import { PULSE } from '../render/Pulses.js';
import { SURF } from '../world/House.js';

// Bottles and toy blocks: pick up, throw, they make noise where they land.
export class Throwables {
  constructor(game) {
    this.g = game;
    this.items = [];
    this.flying = [];
    this.held = null;
    this.shards = [];
    this.viewAnchor = new THREE.Group();
    this.viewAnchor.position.set(0.24, -0.22, -0.46);
    game.camera.add(this.viewAnchor);
    this.charge = 0;
  }

  makeMesh(kind) {
    const M = this.g.M;
    return buildGroup((b) => {
      if (kind === 'bottle') {
        b.lathe(M.bottleGlass, [[0, 0], [0.036, 0], [0.038, 0.02], [0.038, 0.17], [0.03, 0.2], [0.013, 0.24], [0.013, 0.29], [0.016, 0.3], [0, 0.3]], 0, 0, 0, 14);
        b.box(M.paper, -0.03, 0.06, 0.034, 0.03, 0.13, 0.04);
      } else if (kind === 'block') {
        b.rbox(M.toyRed, 0, 0.04, 0, 0.08, 0.08, 0.08, 0.008, 1);
      } else if (kind === 'blockB') {
        b.rbox(M.toyBlue, 0, 0.04, 0, 0.08, 0.08, 0.08, 0.008, 1);
      } else if (kind === 'blockY') {
        b.rbox(M.toyYellow, 0, 0.04, 0, 0.08, 0.08, 0.08, 0.008, 1);
      }
    });
  }

  spawn(kind, x, y, z, rot = 0) {
    const mesh = this.makeMesh(kind);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rot;
    this.g.scene.add(mesh);
    const item = { kind, mesh, home: { x, y, z, rot }, state: 'rest' };
    ownMaterials(mesh);
    item.inter = this.g.interactions.add({
      id: 'throw:' + this.items.length,
      obj: mesh,
      highlight: true,
      range: 2.2,
      enabled: () => item.state === 'rest',
      prompt: () => (this.held ? null : ['E', kind === 'bottle' ? 'Take the bottle' : 'Take the block']),
      use: () => this.pickUp(item),
    });
    this.items.push(item);
    return item;
  }

  pickUp(item) {
    if (this.held) { this.g.ui.message('Your hands are full.'); return; }
    item.state = 'held';
    this.held = item;
    this.g.scene.remove(item.mesh);
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(item.kind === 'bottle' ? -0.4 : 0.3, 0.6, item.kind === 'bottle' ? 0.25 : 0.2);
    this.viewAnchor.add(item.mesh);
    this.g.audio.play(item.kind === 'bottle' ? 'bottle_clink' : 'block_hit', { gain: 0.25 });
    this.g.audio.play('pickup', { gain: 0.5 });
    this.g.chapter?.onPickupThrowable?.(item);
  }

  throw() {
    const item = this.held;
    if (!item) return;
    const g = this.g;
    this.held = null;
    this.viewAnchor.remove(item.mesh);
    g.scene.add(item.mesh);
    const f = g.player.forward();
    const e = g.player.eye;
    const speed = 7.5 + this.charge * 5;
    item.mesh.position.set(e.x + f.x * 0.4, e.y - 0.1 + f.y * 0.4, e.z + f.z * 0.4);
    item.vel = new THREE.Vector3(f.x * speed, f.y * speed + 1.6, f.z * speed);
    item.spin = new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14);
    item.state = 'flying';
    item.bounces = 0;
    item.vel.x += g.player.vel.x * 0.5; item.vel.z += g.player.vel.y * 0.5;
    this.flying.push(item);
    g.audio.play('breath_out', { gain: 0.25, rate: 1.4 });
    g.stats.thrown++;
    this.charge = 0;
  }

  dropHeld() {
    if (!this.held) return;
    const it = this.held;
    this.viewAnchor.remove(it.mesh);
    this.held = null;
    this.resetItem(it);
  }

  resetItem(it) {
    if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
    this.g.scene.add(it.mesh);
    it.mesh.position.set(it.home.x, it.home.y, it.home.z);
    it.mesh.rotation.set(0, it.home.rot, 0);
    it.mesh.visible = true;
    it.state = 'rest';
    it.mesh.updateMatrixWorld(true);
  }

  resetAll() {
    this.dropHeld();
    for (const it of this.items) this.resetItem(it);
    this.flying.length = 0;
    for (const s of this.shards) { this.g.scene.remove(s.mesh); }
    for (const s of this.shards) { const i = this.g.house.zones.indexOf(s.zone); if (i >= 0) this.g.house.zones.splice(i, 1); }
    this.shards.length = 0;
  }

  update(dt, input) {
    const g = this.g;
    if (this.held && g.player.mode === 'walk') {
      if (input.mouseDown(0)) this.charge = Math.min(1, this.charge + dt * 1.5);
      if (input.mouseUp(0)) this.throw();
      // idle sway
      const t = g.time;
      this.viewAnchor.position.set(0.24 + Math.sin(t * 1.3) * 0.004 - this.charge * 0.05, -0.22 + Math.sin(t * 2.1) * 0.004 + this.charge * 0.04, -0.46 + this.charge * 0.1);
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const it = this.flying[i];
      const steps = 4;
      for (let s = 0; s < steps && it.state === 'flying'; s++) this.step(it, dt / steps);
      if (it.state !== 'flying') this.flying.splice(i, 1);
    }
  }

  step(it, dt) {
    const g = this.g;
    const p = it.mesh.position;
    const v = it.vel;
    v.y -= 9.8 * dt;
    const nx = p.x + v.x * dt, ny = p.y + v.y * dt, nz = p.z + v.z * dt;
    const f = g.house.field;
    const blocked = (x, z) => {
      const i = f.index(x, z);
      return f.wall[i] === 1 || (f.door[i] >= 0 && f.doorClosed[f.door[i]]);
    };
    let hit = false, hard = 0;
    // walls
    if (blocked(nx, nz)) {
      if (!blocked(p.x, nz)) { v.x *= -0.4; } else if (!blocked(nx, p.z)) { v.z *= -0.4; } else { v.x *= -0.4; v.z *= -0.4; }
      hard = Math.hypot(v.x, v.z) * 2.5; hit = true;
    } else {
      // furniture tops / sides
      let col = null;
      for (const c of g.house.colliders) {
        if (nx > c.minX && nx < c.maxX && nz > c.minZ && nz < c.maxZ && ny < c.maxY) { col = c; break; }
      }
      if (col) {
        if (p.y >= col.maxY - 0.02) { p.y = col.maxY; hard = Math.abs(v.y); v.y = -v.y * 0.3; v.x *= 0.6; v.z *= 0.6; }
        else { v.x *= -0.35; v.z *= -0.35; hard = Math.hypot(v.x, v.z) * 2.5; }
        hit = true;
      } else {
        p.set(nx, ny, nz);
      }
    }
    // floor & ceiling
    if (p.y < 0.03) {
      p.y = 0.03;
      hard = Math.max(hard, Math.abs(v.y));
      v.y = -v.y * 0.32; v.x *= 0.62; v.z *= 0.62;
      hit = true;
    }
    if (p.y > 2.62) { p.y = 2.62; v.y = -Math.abs(v.y) * 0.3; hit = true; hard = Math.max(hard, 2); }
    it.mesh.rotation.x += it.spin.x * dt; it.mesh.rotation.y += it.spin.y * dt; it.mesh.rotation.z += it.spin.z * dt;
    if (hit && hard > 0.9) this.impact(it, hard);
    if (it.state === 'flying' && p.y <= 0.035 && v.length() < 0.5) this.settle(it);
  }

  impact(it, hard) {
    const g = this.g;
    const p = it.mesh.position;
    if (it.kind === 'bottle') {
      g.audio.play('bottle_shatter', { pos: { x: p.x, y: p.y, z: p.z }, gain: 1.0, ref: 2 });
      g.sound({ x: p.x, y: Math.max(0.05, p.y), z: p.z, radius: 13, strength: 1.0, color: PULSE.WORLD, source: 'object', kind: 'impact' });
      this.shatter(it);
      return;
    }
    it.bounces++;
    const r = Math.min(7.5, 2.2 + hard * 1.0) / it.bounces;
    g.audio.play('block_hit', { pos: { x: p.x, y: p.y, z: p.z }, gain: Math.min(1, 0.3 + hard * 0.12), jitter: 0.2 });
    if (r > 1.2) g.sound({ x: p.x, y: Math.max(0.05, p.y), z: p.z, radius: r, strength: 0.9, color: PULSE.WORLD, source: 'object', kind: 'impact' });
    it.spin.multiplyScalar(0.6);
  }

  settle(it) {
    it.state = 'rest';
    it.vel.set(0, 0, 0);
    const p = it.mesh.position;
    p.y = 0;
    it.mesh.rotation.set(0, it.mesh.rotation.y, 0);
    it.mesh.updateMatrixWorld(true);
    g_hush_disturb(this.g, p.x, p.z);
  }

  shatter(it) {
    const g = this.g;
    const p = it.mesh.position.clone();
    it.state = 'broken';
    it.mesh.visible = false;
    if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
    // shards on the floor: memory of the noise. That spot is loud now.
    const shards = buildGroup((b) => {
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 0.45;
        b.boxC(g.M.bottleGlass, Math.cos(a) * d, 0.006, Math.sin(a) * d, 0.02 + Math.random() * 0.05, 0.008, 0.015 + Math.random() * 0.04, 0, Math.random() * 3, 0);
      }
    });
    shards.position.set(p.x, 0, p.z);
    g.scene.add(shards);
    const zone = { x0: p.x - 0.55, z0: p.z - 0.55, x1: p.x + 0.55, z1: p.z + 0.55, surface: SURF.GLASS, pri: 3 };
    g.house.zones.push(zone);
    this.shards.push({ mesh: shards, zone });
    g_hush_disturb(g, p.x, p.z);
  }
}

function g_hush_disturb(g, x, z) {
  if (g.hush) g.hush.addDisturbance(x, z);
}
