import { createHushModel, animateHush } from './HushModel.js';
import { HushVoice } from '../audio/Audio.js';
import { PULSE } from '../render/Pulses.js';

const SPEED = { wander: 1.05, investigate: 1.7, hunt: 3.3, search: 0, check: 1.5, holdout: 1.25, rush: 2.6 };
const STRIDE = { wander: 1.15, investigate: 1.2, hunt: 1.55, check: 1.15, holdout: 1.15, rush: 1.4 };

export const WAYPOINTS = [
  { x: 4.2, z: 11.6, room: 'Living room' }, { x: 1.6, z: 9.6, room: 'Living room' },
  { x: 8.25, z: 10.4, room: 'Foyer' }, { x: 8.3, z: 12.6, room: 'Foyer' },
  { x: 14.6, z: 10.6, room: 'Kitchen' }, { x: 12.2, z: 12.4, room: 'Kitchen' },
  { x: 2.5, z: 6.0, room: 'Hallway' }, { x: 8.5, z: 6.0, room: 'Hallway' }, { x: 14.0, z: 6.0, room: 'Hallway' },
  { x: 3.0, z: 3.5, room: 'Diane’s bedroom' }, { x: 5.2, z: 2.6, room: 'Diane’s bedroom' },
  { x: 8.3, z: 2.6, room: 'Bathroom' },
  { x: 13.5, z: 3.2, room: 'June’s room' },
];

export class MrHush {
  constructor(game) {
    this.g = game;
    this.m = createHushModel();
    this.root = this.m.root;
    game.scene.add(this.root);
    this.voice = new HushVoice(game.audio);
    this.x = 5.2; this.z = 9.4; this.heading = Math.PI;
    this.state = 'dormant';
    this.enabled = true;
    this.path = null; this.pathI = 0; this.goal = null;
    this.timer = 0; this.stateTime = 0;
    this.phase = 0; this.speed = 0; this.stepAcc = 0;
    this.lastHeard = null;
    this.disturbances = [];
    this.hideMemory = {};
    this.heardEnter = null;
    this.searchFrom = null;
    this.awareness = 0;
    this.lookTarget = 0;
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = { x: this.x, z: this.z };
    this.lastPlayerNear = 0;
    this.holdout = null;
    this.hearMul = 1.25;
    this.visibleGlint = 0;
    this.escapes = 0;
    this.wakeable = true; // a loud enough noise wakes him from the chair
    this.menace = 0;      // rises while he's away from the player; pulls him toward them
    this.smellT = 0;      // time the player has spent silently right next to him
    this.placeDormant();
  }

  get headPos() { return { x: this.x + Math.sin(this.heading) * 0.25, y: this.state === 'dormant' ? 1.55 : 2.15, z: this.z + Math.cos(this.heading) * 0.25 }; }

  placeDormant() {
    const c = this.g.house.hushChair;
    this.x = c.x; this.z = c.z; this.heading = c.rot;
    this.state = 'dormant';
    this.m.pose.sit = 1;
    this.m.pose.speed = 0;
    this._sync();
  }

  setState(s, info = {}) {
    const prev = this.state;
    this.state = s;
    this.stateTime = 0;
    this.timer = info.timer ?? 0;
    if (s === 'hunt') this.menace = 0;
    if (s === 'hunt' && prev !== 'hunt') {
      this.g.audio.play('hush_growl', { pos: this.headPos, gain: 1.0, reverb: 0.3, ref: 2 });
      this.g.emit('hushHunt', this);
    }
    if (s === 'wander' && prev !== 'wander') this.g.emit('hushCalm', this);
    this.g.emit('hushState', { from: prev, to: s });
  }

  wake() {
    if (this.state !== 'dormant') return;
    this.m.pose.sit = 1;
    this.voice.start();
    this.voice.setLevel(0.6);
    this.setState('wander');
    this.pickWander();
  }

  // ---------------------------------------------------------------- hearing
  hear(o) {
    if (!this.enabled || o.source === 'hush' || o.source === 'world' || o.silent) return;
    if (this.state === 'dormant' && this.wakeable) {
      // asleep in the chair: he only stirs for loud noise, but noise adds up
      const f = this.g.house.field;
      const dd = f.sample(f.compute(o.x, o.z, 1), this.x, this.z);
      const k = 1 - dd / (o.radius * this.hearMul * 0.85);
      if (k > 0) {
        this.lookTarget = Math.atan2(o.x - this.x, o.z - this.z) - this.heading;
        this.sleepNoise = (this.sleepNoise || 0) + k;
        if (k > 0.45 || this.sleepNoise > 1.4) {
          this.sleepNoise = 0;
          this.voice.start();
          this.voice.cut();
          this.g.audio.play('creak_floor', { pos: { x: this.x, y: 0.6, z: this.z }, gain: 1, rate: 0.6 });
          this.g.audio.stinger('swell', 0.5);
          this.g.subtitle('Ellis', 'It heard me.', 2.4);
          this.g.emit('hushWoke', this);
          this.goTo(o.x, o.z, k > 0.6 && o.source === 'player' ? 'hunt' : 'investigate');
        }
      }
      return;
    }
    if (['dormant', 'grab', 'scripted', 'holdout', 'stunned'].includes(this.state)) {
      if (this.state === 'dormant' && o.radius > 5) {
        const d = Math.hypot(o.x - this.x, o.z - this.z);
        if (d < 7) this.lookTarget = Math.atan2(o.x - this.x, o.z - this.z) - this.heading;
      }
      return;
    }
    // after a check came up empty he gives up on this spot: quiet sounds from a hiding player don't pull him back
    if (this.leaving() && o.soft && o.source === 'player' && this.g.player.hidden) return;
    const field = this.g.house.field;
    const dist = field.sample(field.compute(o.x, o.z, 1), this.x, this.z);
    const reach = o.radius * this.hearMul;
    if (dist > reach) return;
    const intensity = 1 - dist / reach;
    if (intensity <= 0.02) return;
    const fromPlayer = o.source === 'player';
    this.lastHeard = { x: o.x, z: o.z, t: this.g.time, intensity, player: fromPlayer, kind: o.kind };
    this.voice.cut();
    // turn the head toward it
    this.lookTarget = Math.atan2(o.x - this.x, o.z - this.z) - this.heading;
    this.awareness = Math.min(1, this.awareness + intensity * 0.8);

    if (o.kind === 'hide' && fromPlayer) this.heardEnter = { spot: o.spot, t: this.g.time };

    const alert = this.state === 'hunt' || this.state === 'investigate' || this.state === 'search' || this.state === 'check';
    if (fromPlayer) {
      // soft sounds (creeping, breathing, slow doors) only make him curious unless you're right on top of him
      const huntAt = o.soft ? 0.75 : 0.42;
      if (intensity > huntAt || (alert && !o.soft && intensity > 0.12) || this.state === 'hunt') {
        this.goTo(o.x, o.z, 'hunt');
      } else {
        this.goTo(o.x, o.z, 'investigate');
      }
    } else {
      // decoys: thrown objects, the TV
      if (this.state === 'hunt' && intensity < 0.3) return;
      this.goTo(o.x, o.z, this.state === 'hunt' ? 'hunt' : 'investigate');
      this.addDisturbance(o.x, o.z);
    }
  }

  addDisturbance(x, z) {
    this.disturbances.push({ x, z, t: this.g.time, visited: false });
    if (this.disturbances.length > 12) this.disturbances.shift();
  }

  goTo(x, z, state) {
    if (state !== this.state) this.setState(state);
    const path = this.g.nav.find(this.x, this.z, x, z);
    this.path = path; this.pathI = 0; this.goal = { x, z };
    this.repathT = 0;
  }

  pickWander() {
    const g = this.g;
    const now = g.time;
    const fresh = this.disturbances.filter((d) => !d.visited && now - d.t < 120);
    let wp;
    const pr = g.house.roomAt(g.player.pos.x, g.player.pos.z);
    const unlockedJune = !g.house.doorJune.locked;
    const options = WAYPOINTS.filter((w) => w.room !== 'June’s room' || unlockedJune);
    const pl = g.player;
    if (this.leaving()) {
      // giving up: head somewhere well away from where you are hiding
      const far = options.filter((w) => Math.hypot(w.x - pl.pos.x, w.z - pl.pos.z) > 7);
      const pool = far.length ? far : options;
      wp = pool[Math.floor(Math.random() * pool.length)];
    } else if (fresh.length && Math.random() < 0.55) {
      const d = fresh[fresh.length - 1]; d.visited = true; wp = d;
    } else if (this.menace > 0.85 && pr) {
      // he has been away too long: he comes looking, close to where you are, but not exactly
      // still humming, still walking: you get a warning and a chance to move
      const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 2;
      const tgt = g.nav.nearestFree(pl.pos.x + Math.cos(a) * r, pl.pos.z + Math.sin(a) * r, 8);
      this.menace = 0.3;
      if (tgt) {
        const [cx, cz] = g.nav.center(tgt[0], tgt[1]);
        this.path = g.nav.find(this.x, this.z, cx, cz);
        this.pathI = 0; this.goal = { x: cx, z: cz };
        if (this.path) return;
      }
      wp = options[Math.floor(Math.random() * options.length)];
    } else if (pr && Math.random() < 0.3 + 0.5 * this.menace) {
      // drift toward the player's room or the rooms next to it
      const near = options.filter((w) => w.room === pr.name || Math.hypot(w.x - pl.pos.x, w.z - pl.pos.z) < 6.5);
      const pool = near.length ? near : options;
      wp = pool[Math.floor(Math.random() * pool.length)];
    } else {
      wp = options[Math.floor(Math.random() * options.length)];
    }
    this.path = g.nav.find(this.x, this.z, wp.x + (Math.random() - 0.5) * 0.6, wp.z + (Math.random() - 0.5) * 0.6);
    this.pathI = 0; this.goal = { x: wp.x, z: wp.z };
    if (!this.path) this.timer = 1;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (!this.enabled) return;
    const g = this.g;
    const P = this.m.pose;
    this.stateTime += dt;
    this.awareness = Math.max(0, this.awareness - dt * 0.08);
    const pl = g.player;
    const dP = Math.hypot(pl.pos.x - this.x, pl.pos.z - this.z);
    if (dP < 9) this.lastPlayerNear = g.time;
    if (this.state === 'dormant') this.sleepNoise = Math.max(0, (this.sleepNoise || 0) - dt * 0.12);
    const roaming = ['wander', 'investigate', 'search', 'check'].includes(this.state);
    if (roaming) {
      // menace: the longer he's away from you, the more he drifts your way
      if (dP > 8) this.menace = Math.min(1, this.menace + dt / 45);
      else if (dP < 5) this.menace = Math.max(0, this.menace - dt / 12);
      // scent: silent isn't invisible when you're right next to him
      if (dP < 2.3 && !pl.hidden && pl.mode === 'walk') this.smellT += dt;
      else this.smellT = Math.max(0, this.smellT - dt * 0.5);
      if (this.smellT > 2.5) {
        this.smellT = 0;
        g.audio.play('hush_sniff', { pos: this.headPos, gain: 1 });
        this.voice.cut();
        this.goTo(pl.pos.x, pl.pos.z, 'investigate');
      }
    } else this.smellT = 0;
    // woken mid-sit: stand up before doing anything else
    if (this.state !== 'dormant' && this.state !== 'holdout' && P.sit > 0.02) {
      P.sit = Math.max(0, P.sit - dt * 0.9);
      P.speed = 0;
      this._sync(dt);
      return;
    }

    let moveSpeed = 0;
    switch (this.state) {
      case 'dormant':
        P.sit = 1; P.speed = 0;
        this.lookTarget *= Math.exp(-dt * 0.3);
        break;
      case 'wander': {
        P.sit = Math.max(0, P.sit - dt * 0.8);
        if (P.sit > 0.02) break; // still getting up
        if (!this.voice.level && this.stateTime > 2.5) this.voice.setLevel(0.6, 1.5);
        if (this.timer > 0) { // pause and listen
          this.timer -= dt;
          P.listen = Math.min(1, P.listen + dt * 2);
          if (this.timer <= 0) this.pickWander();
          break;
        }
        P.listen = Math.max(0, P.listen - dt * 2);
        moveSpeed = SPEED.wander;
        if (this.followPath(dt, moveSpeed)) {
          this.timer = 1.5 + Math.random() * 3.5;
        }
        break;
      }
      case 'investigate': {
        P.listen = Math.max(0, P.listen - dt);
        moveSpeed = SPEED.investigate;
        if (this.followPath(dt, moveSpeed)) this.setState('search', { timer: 3.5 + Math.random() * 2 });
        break;
      }
      case 'hunt': {
        P.listen = 0;
        moveSpeed = SPEED.hunt;
        this.repathT += dt;
        // close behind you he can hear you moving (rustle, breath) and keeps tracking.
        // Freezing, creeping or hiding breaks the trail.
        if (this.canTrack(dP)) this.goal = { x: pl.pos.x, z: pl.pos.z };
        if (this.followPath(dt, moveSpeed)) {
          this.searchFrom = { x: this.x, z: this.z };
          this.setState('search', { timer: 3 + Math.random() * 1.5 });
          this.huntedRecently = true;
        }
        break;
      }
      case 'search': {
        P.listen = Math.min(1, P.listen + dt * 2);
        this.timer -= dt;
        if (this.canTrack(dP, 4.5)) { this.goTo(pl.pos.x, pl.pos.z, 'hunt'); break; }
        this.lookTarget = Math.sin(this.stateTime * 1.4) * 0.9;
        if (Math.floor(this.stateTime * 0.8) !== Math.floor((this.stateTime - dt) * 0.8)) g.audio.play('hush_sniff', { pos: this.headPos, gain: 0.7 });
        if (this.timer <= 0) {
          const spot = this.pickHideToCheck();
          if (spot) {
            this.checking = spot;
            this.goTo(spot.out.x, spot.out.z, 'check');
          } else this.giveUp();
        }
        break;
      }
      case 'check': {
        moveSpeed = SPEED.check;
        P.listen = 0.3;
        const spot = this.checking;
        if (!this.checkPhase) {
          if (this.followPath(dt, moveSpeed)) {
            this.checkPhase = 1; this.timer = 0; this.breathFail = false;
            g.audio.play('door_creak_fast', { pos: { x: spot.x, y: 1, z: spot.z }, gain: 0.9 });
            g.sound({ x: spot.out.x, z: spot.out.z, radius: 3.5, source: 'hush', color: PULSE.HUSH, strength: 0.9 });
            g.emit('hushCheck', spot);
          }
        } else {
          this.timer += dt;
          P.reach = Math.min(1, P.reach + dt * 2.5);
          // face the hiding spot
          this.turnToward(spot.x, spot.z, dt, 6);
          if (g.player.hidden === spot && this.timer > 0.5 && !g.player.breathHeld) this.breathFail = true;
          if (this.timer > 2.6) {
            P.reach = 0;
            this.checkPhase = 0;
            const caught = g.player.hidden === spot && (this.breathFail || (this.heardEnter && this.heardEnter.spot === spot && g.time - this.heardEnter.t < 25 && Math.random() < 0.5));
            this.heardEnter = null;
            if (caught) { this.startGrab(true); break; }
            // keep searching others, a little less likely each time
            const next = Math.random() < 0.45 ? this.pickHideToCheck(spot) : null;
            if (next) { this.checking = next; this.goTo(next.out.x, next.out.z, 'check'); }
            else { this.giveUp(); }
          }
        }
        break;
      }
      case 'grab':
        P.grab = Math.min(1, P.grab + dt * 5);
        moveSpeed = 0;
        this.turnToward(pl.pos.x, pl.pos.z, dt, 12);
        break;
      case 'stunned':
        P.grab = Math.max(0, P.grab - dt * 3);
        P.stagger = Math.min(1, P.stagger + dt * 4);
        this.timer -= dt;
        // stumble backwards
        this.x -= Math.sin(this.heading) * dt * 0.6 * Math.max(0, this.timer - 1.5);
        this.z -= Math.cos(this.heading) * dt * 0.6 * Math.max(0, this.timer - 1.5);
        if (this.timer <= 0) {
          P.stagger = 0;
          this.goTo(pl.pos.x, pl.pos.z, 'hunt');
        }
        break;
      case 'holdout':
        if (this.holdout) moveSpeed = this.holdout.brain(dt) || 0;
        break;
      case 'scripted':
        break;
    }

    if (this.state !== 'grab' && this.state !== 'stunned') P.grab = Math.max(0, P.grab - dt * 3);
    P.speed += (moveSpeed - P.speed) * Math.min(1, dt * 6);
    P.hunch += (((this.state === 'hunt' ? 1 : 0) + (this.nearDoorway() ? 0.9 : 0)) - P.hunch) * Math.min(1, dt * 4);
    if (this.state !== 'check') P.reach = Math.max(0, P.reach - dt * 3);
    const lt = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(this.lookTarget), Math.cos(this.lookTarget))));
    P.look += (lt - P.look) * Math.min(1, dt * 3);
    if (this.state !== 'search' && this.state !== 'dormant') this.lookTarget *= Math.exp(-dt * 1.2);

    // contact
    if (['wander', 'investigate', 'hunt', 'search', 'check'].includes(this.state) && !pl.hidden && pl.mode === 'walk') {
      if (this.state === 'hunt' && dP < 1.0) this.startGrab(false);
      else if (dP < 1.15) {
        // he bumps into something warm: stops, sniffs, then lunges
        if (!this.touchT) {
          this.touchT = 0.001;
          this.g.audio.play('hush_sniff', { pos: this.headPos, gain: 1 });
          this.lookTarget = Math.atan2(pl.pos.x - this.x, pl.pos.z - this.z) - this.heading;
        }
        this.touchT += dt;
        this.path = null;
        if (this.touchT > 0.75) { this.touchT = 0; this.startGrab(false); }
      } else if (this.touchT) {
        this.touchT = 0;
        this.goTo(pl.pos.x, pl.pos.z, 'hunt');
      } else if (dP < 1.9 && pl.speedNow > 0.6 && pl.moveState !== 'crouch' && this.state !== 'hunt') this.goTo(pl.pos.x, pl.pos.z, 'hunt');
    } else this.touchT = 0;

    // stuck detection
    if (moveSpeed > 0) {
      const moved = Math.hypot(this.x - this.lastPos.x, this.z - this.lastPos.z);
      this.stuckT = moved < moveSpeed * dt * 0.2 ? this.stuckT + dt : 0;
      if (this.stuckT > 1.5) {
        this.stuckT = 0;
        if (this.goal) this.path = this.g.nav.find(this.x, this.z, this.goal.x, this.goal.z);
        this.pathI = 0;
        if (!this.path && this.state === 'wander') this.pickWander();
      }
    }
    this.lastPos.x = this.x; this.lastPos.z = this.z;

    this.openDoors();
    this._sync(dt);
  }

  canTrack(dP, range = 7) {
    const pl = this.g.player;
    if (dP > range || pl.hidden || pl.mode !== 'walk') return false;
    if (pl.speedNow < 0.5 || pl.moveState === 'crouch') return false;
    const f = this.g.house.field;
    return f.wallsBetween(this.x, this.z, pl.pos.x, pl.pos.z) <= 1;
  }

  nearDoorway() {
    for (const d of this.g.house.doors) {
      const c = d.center();
      if (Math.hypot(c.x - this.x, c.z - this.z) < 1.0) return true;
    }
    return false;
  }

  openDoors() {
    for (const d of this.g.house.doors) {
      if (!d.isClosed || d.moving) continue;
      if (d.locked && !(d.hushOnly)) continue;
      const c = d.center();
      if (Math.hypot(c.x - this.x, c.z - this.z) < 1.1) {
        d.setTarget(true, 3.2);
        this.g.audio.play('door_creak_fast', { pos: { x: c.x, y: 1.2, z: c.z }, gain: 1 });
        this.g.audio.play('door_latch', { pos: { x: c.x, y: 1.0, z: c.z }, gain: 0.8 });
        this.g.sound({ x: c.x, z: c.z, radius: 5, source: 'hush', color: PULSE.HUSH, strength: 0.9 });
      }
    }
  }

  pickHideToCheck(exclude) {
    const spots = this.g.house.hideSpots.filter((s) => s !== exclude);
    const ref = this.searchFrom || { x: this.x, z: this.z };
    let best = null, bestScore = 0;
    for (const s of spots) {
      const d = Math.hypot(s.x - ref.x, s.z - ref.z);
      if (d > 9) continue;
      let score = (this.hideMemory[s.id] || 0) * 1.5 + 1 / (1 + d * 0.4);
      if (this.heardEnter && this.heardEnter.spot === s) score += 4;
      score *= 0.6 + Math.random() * 0.8;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (!best) return null;
    // he does not always bother
    const base = this.huntedRecently ? 0.85 : 0.35;
    const p = Math.min(0.95, base + (this.hideMemory[best.id] || 0) * 0.15 + (this.heardEnter && this.heardEnter.spot === best ? 0.5 : 0));
    return Math.random() < p ? best : null;
  }

  rememberHide(spot) { this.hideMemory[spot.id] = (this.hideMemory[spot.id] || 0) + 1; }

  startGrab(fromHide) {
    if (this.state === 'grab') return;
    this.path = null;
    this.setState('grab');
    this.voice.cut();
    this.g.emit('hushGrab', { fromHide });
  }

  // nothing found: leave the area for a while (see leaving())
  giveUp() {
    this.huntedRecently = false;
    this.leaveUntil = this.g.time + 15;
    this.menace = Math.min(this.menace, 0.2);
    this.setState('wander');
    this.timer = 0.6;
  }
  leaving() { return this.g.time < (this.leaveUntil ?? 0); }

  // after the player breaks free
  stun() {
    this.setState('stunned', { timer: 4 });
    this.m.pose.grab = 0;
  }

  turnToward(x, z, dt, rate = 5) {
    const t = Math.atan2(x - this.x, z - this.z);
    let d = Math.atan2(Math.sin(t - this.heading), Math.cos(t - this.heading));
    this.heading += d * Math.min(1, dt * rate);
  }

  // returns true when the path is complete
  followPath(dt, speed) {
    if (this.state === 'hunt' && this.repathT > 0.6 && this.goal) {
      this.repathT = 0;
      const np = this.g.nav.find(this.x, this.z, this.goal.x, this.goal.z);
      if (np) { this.path = np; this.pathI = 0; }
    }
    if (!this.path || this.pathI >= this.path.length) return true;
    const [tx, tz] = this.path[this.pathI];
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    this.turnToward(tx, tz, dt, this.state === 'hunt' ? 9 : 5);
    // slow down while turning sharply
    const ang = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - this.heading), Math.cos(Math.atan2(dx, dz) - this.heading)));
    const k = ang > 1.2 ? 0.35 : 1;
    if (d <= step * k + 0.05) {
      this.x = tx; this.z = tz; this.pathI++;
      return this.pathI >= this.path.length;
    }
    this.x += (dx / d) * step * k;
    this.z += (dz / d) * step * k;
    this.advanceSteps(step * k, speed);
    return false;
  }

  advanceSteps(dist, speed) {
    const stride = STRIDE[this.state] || 1.2;
    const prev = this.phase;
    this.phase += (dist / stride) * Math.PI;
    if (Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) {
      const hunting = this.state === 'hunt' || this.state === 'rush';
      const radius = hunting ? 6.5 : this.state === 'investigate' ? 5 : 4.2;
      const surf = this.g.house.surfaceAt(this.x, this.z);
      const mul = surf === 'carpet' || surf === 'rug' ? 0.85 : surf === 'tile' ? 1.15 : 1;
      this.g.sound({ x: this.x, z: this.z, radius: radius * mul, source: 'hush', color: PULSE.HUSH, strength: hunting ? 1.0 : 0.8, speed: 9 });
      this.g.audio.play('hush_step', { pos: { x: this.x, y: 0.2, z: this.z }, gain: hunting ? 1.0 : 0.75, jitter: 0.1, ref: 2.2, rolloff: 1.0 });
      if (Math.random() < 0.15) this.g.audio.play('hush_wet', { pos: { x: this.x, y: 1.2, z: this.z }, gain: 0.35 });
    }
  }

  _sync(dt = 0) {
    const r = this.root;
    r.position.set(this.x, 0, this.z);
    r.rotation.y = this.heading;
    animateHush(this.m, dt, this.g.time, this.phase);
    const hp = this.headPos;
    this.voice.setPos(hp.x, hp.y, hp.z);
    // faint glints in the dark when close
    const pl = this.g.player;
    const d = pl ? Math.hypot(pl.pos.x - this.x, pl.pos.z - this.z) : 99;
    const flick = Math.random() < 0.08 ? Math.random() : this.visibleGlint * 0.92;
    this.visibleGlint = flick;
    const gi = d < 6 && this.state !== 'dormant' ? 0.05 * flick * (1 - d / 6) : 0;
    for (const gl of this.m.glints) gl.material.uniforms.uIntensity.value = gi;
  }

  teleport(x, z, heading) {
    this.x = x; this.z = z; if (heading !== undefined) this.heading = heading;
    this.path = null;
    this._sync();
  }

  reset() {
    this.voice.stop();
    this.disturbances = [];
    this.hideMemory = {};
    this.heardEnter = null;
    this.checkPhase = 0;
    this.awareness = 0;
    this.m.pose.grab = 0; this.m.pose.stagger = 0; this.m.pose.jaw = 0; this.m.pose.reach = 0;
    this.placeDormant();
  }
}
