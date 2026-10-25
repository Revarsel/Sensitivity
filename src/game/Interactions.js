import * as THREE from 'three';
import { cloneReveal, setHighlight } from '../render/RevealMaterial.js';
import { PULSE } from '../render/Pulses.js';

// Give an object its own material copies so it can be highlighted alone.
export function ownMaterials(obj) {
  const mats = [];
  obj.traverse((o) => {
    if (o.isMesh && o.material && o.material.userData.isReveal) {
      o.material = cloneReveal(o.material);
      mats.push(o.material);
    }
  });
  obj.userData.mats = mats;
  return mats;
}

export class Interactions {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.3;
    this.current = null;
    this.holdT = 0;
    this.doorHold = null;
    this.tmp = new THREE.Vector3();
    this.center = new THREE.Vector2(0, 0);
  }

  add(it) {
    it.range = it.range ?? 2.2;
    it.enabled = it.enabled ?? (() => true);
    if (it.highlight && it.obj && !it.obj.userData.mats) ownMaterials(it.obj);
    it.obj.updateMatrixWorld(true);
    this.list.push(it);
    return it;
  }
  remove(it) {
    const i = this.list.indexOf(it);
    if (i >= 0) this.list.splice(i, 1);
    if (it.obj && it.obj.userData.mats) for (const m of it.obj.userData.mats) setHighlight(m, 0);
    if (this.current === it) this.current = null;
  }
  find(id) { return this.list.find((i) => i.id === id); }

  update(dt) {
    const g = this.g;
    const input = g.input;
    const cam = g.camera;
    const pl = g.player;
    // proximity glow for lore + key items
    for (const it of this.list) {
      if (!it.highlight || !it.obj.userData.mats) continue;
      const p = it.obj.getWorldPosition(this.tmp);
      const d = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z);
      const on = it.enabled() && it.obj.visible;
      const target = !on ? 0 : it === this.current ? 1 : d < 4.2 ? 0.28 * (1 - d / 4.2) + 0.06 : 0;
      it._hl = (it._hl ?? 0) + (target - (it._hl ?? 0)) * Math.min(1, dt * 6);
      for (const m of it.obj.userData.mats) setHighlight(m, it._hl);
    }

    if (pl.mode !== 'walk' && pl.mode !== 'hide') { this.setCurrent(null); return; }
    if (pl.mode === 'hide') {
      // only the "leave" interaction while hiding
      const it = this.list.find((i) => i.id === 'hide:' + pl.hidden.id);
      this.setCurrent(it || null);
    } else {
      cam.updateMatrixWorld();
      this.ray.setFromCamera(this.center, cam);
      const objs = [];
      for (const it of this.list) if (it.enabled() && it.obj.visible !== false) objs.push(it.obj);
      const hits = this.ray.intersectObjects(objs, true);
      let found = null, foundDist = 0;
      for (const h of hits) {
        let o = h.object;
        while (o && !this.list.some((it) => it.obj === o)) o = o.parent;
        const it = this.list.find((x) => x.obj === o);
        if (!it || h.distance > it.range) continue;
        // walls between?
        // walls between? Stop 0.35 m short of the hit so the wall an item hangs on doesn't count.
        const e = pl.eye;
        const hx = h.point.x - e.x, hz = h.point.z - e.z, hl = Math.hypot(hx, hz);
        if (!it.door && hl > 0.4) {
          const k = (hl - 0.35) / hl;
          if (g.house.field.wallsBetween(e.x, e.z, e.x + hx * k, e.z + hz * k) > 0) continue;
        }
        // big low-priority triggers (hiding spots) never hide an item lying on them
        if (it.lowPriority && !found) { found = it; foundDist = h.distance; continue; }
        if (found && found.lowPriority) { if (!it.lowPriority && h.distance - foundDist < 0.8) found = it; break; }
        found = it;
        break;
      }
      this.setCurrent(found);
    }

    const it = this.current;
    if (!it) { g.ui.setPrompt(null); this.holdT = 0; this.endDoorHold(); return; }
    const pr = it.prompt();
    if (!pr) { g.ui.setPrompt(null); return; }
    g.ui.setPrompt(pr[0] || 'E', pr[1], pr[2]);

    // ---- doors: tap = fast & loud, hold = slow & quiet
    if (it.door) {
      const d = it.door;
      // a locked door reacts to the press itself (tap or hold): try it, or unlock it with a key
      if (d.locked) {
        if (input.actHit('interact')) {
          this.doorPressed = false;
          this.holdT = 0;
          it.onLocked ? it.onLocked() : this.locked(d);
        }
        return;
      }
      if (input.actHit('interact')) { this.holdT = 0; this.doorPressed = true; }
      if (this.doorPressed && input.act('interact')) {
        this.holdT += dt;
        if (this.holdT > 0.22 && !this.doorHold && !d.locked) {
          this.doorHold = { door: d, open: d.isClosed || d.target < d.maxOpen * 0.5, t: 0 };
          d.setTarget(this.doorHold.open, 0.55, pl.pos.x, pl.pos.z);
          g.audio.play('door_creak_slow', { pos: { x: d.hinge.x, y: 1.2, z: d.hinge.y }, gain: 0.35 });
          g.sound({ x: d.center().x, z: d.center().z, y: 1, soft: true, radius: 2.3, strength: 0.7, source: 'player', kind: 'door' });
        }
        if (this.doorHold) {
          this.doorHold.t += dt;
          if (this.doorHold.t > 1.4) {
            this.doorHold.t = 0;
            g.audio.play('door_creak_slow', { pos: { x: d.hinge.x, y: 1.2, z: d.hinge.y }, gain: 0.3 });
            g.sound({ x: d.center().x, z: d.center().z, y: 1, soft: true, radius: 2.3, strength: 0.6, source: 'player', kind: 'door' });
          }
        }
        g.ui.setHold(Math.min(1, this.holdT / 0.22));
      }
      if (this.doorPressed && input.actUp('interact')) {
        this.doorPressed = false;
        g.ui.setHold(0);
        if (this.doorHold) { this.endDoorHold(); }
        else if (this.holdT <= 0.22) {
          if (d.locked) { it.onLocked ? it.onLocked() : this.locked(d); }
          else this.fastToggle(d);
        }
        this.holdT = 0;
      }
      return;
    }

    // ---- hold-to-use items (drawers)
    if (it.hold) {
      if (input.act('interact')) {
        if (input.actHit('interact') && it.onHoldStart) it.onHoldStart();
        this.holdT += dt;
        g.ui.setHold(this.holdT / it.hold);
        if (this.holdT >= it.hold) { this.holdT = 0; g.ui.setHold(0); it.use(); }
      } else if (this.holdT > 0) { this.holdT = 0; g.ui.setHold(0); }
      return;
    }
    if (input.actHit('interact')) it.use();
  }

  setCurrent(it) {
    if (this.current !== it) { this.holdT = 0; this.g.ui.setHold(0); }
    this.current = it;
  }

  endDoorHold() {
    if (!this.doorHold) return;
    const d = this.doorHold.door;
    d.target = d.angle;
    d.moving = false;
    this.doorHold = null;
  }

  fastToggle(d) {
    const g = this.g;
    const opening = d.isClosed || d.target < d.maxOpen * 0.5;
    d.setTarget(opening, opening ? 3.0 : 4.2, g.player.pos.x, g.player.pos.z);
    const c = d.center();
    g.audio.play('door_creak_fast', { pos: { x: c.x, y: 1.2, z: c.z }, gain: 0.9 });
    if (!opening) {
      setTimeout(() => {
        g.audio.play('door_slam', { pos: { x: c.x, y: 1.2, z: c.z }, gain: 0.9 });
        g.sound({ x: c.x, z: c.z, y: 1, radius: 8.5, strength: 1, source: 'player', kind: 'door' });
      }, 330);
    } else {
      g.sound({ x: c.x, z: c.z, y: 1, radius: 6.5, strength: 1, source: 'player', kind: 'door' });
    }
    g.chapter?.onDoorToggled?.(d, opening);
  }

  locked(d) {
    const g = this.g;
    const c = d.center();
    g.audio.play('door_locked', { pos: { x: c.x, y: 1.0, z: c.z }, gain: 0.8 });
    g.sound({ x: c.x, z: c.z, y: 1, radius: 3.6, strength: 0.8, source: 'player', kind: 'door' });
    g.ui.message(d.lockedText);
  }
}

export { PULSE };
