import * as THREE from 'three';
import { PULSE } from '../render/Pulses.js';

const NODES = {
  LIVING: { x: 4.3, z: 11.0 },
  FOYER: { x: 8.25, z: 11.2 },
  KITCHEN: { x: 13.6, z: 11.0 },
  HALL_W: { x: 2.4, z: 6.0 },
  HALL_M: { x: 8.5, z: 6.0 },
  HALL_E: { x: 13.8, z: 6.0 },
  DOOR: { x: 12.0, z: 5.75, face: Math.PI },
  BACKDOOR: { x: 16.1, z: 12.25 },
  YARD: { x: 18.3, z: 8.0 },
  WINDOW: { x: 17.72, z: 2.5, face: -Math.PI / 2 },
};
const EDGES = [
  ['LIVING', 'FOYER'], ['LIVING', 'HALL_W'], ['FOYER', 'HALL_M'], ['FOYER', 'KITCHEN'], ['KITCHEN', 'HALL_E'],
  ['KITCHEN', 'BACKDOOR'], ['BACKDOOR', 'YARD'], ['YARD', 'WINDOW'], ['HALL_W', 'HALL_M'], ['HALL_M', 'HALL_E'], ['HALL_E', 'DOOR'],
];
const ADJ = {};
for (const [a, b] of EDGES) { (ADJ[a] ||= []).push(b); (ADJ[b] ||= []).push(a); }
function bfs(goal) {
  const d = { [goal]: 0 }; const q = [goal];
  while (q.length) { const n = q.shift(); for (const m of ADJ[n]) if (d[m] === undefined) { d[m] = d[n] + 1; q.push(m); } }
  return d;
}
const TO_DOOR = bfs('DOOR'), TO_WINDOW = bfs('WINDOW');

const CAMS = [
  { name: 'HALLWAY', pos: [0.75, 2.35, 6.0], look: [10, 0.6, 6.0], node: 'HALL_M', room: { x: 8.5, z: 6.0 } },
  { name: 'LIVING RM', pos: [6.15, 2.4, 13.65], look: [2.6, 0.5, 9.4], node: 'LIVING', room: { x: 3.2, z: 10.8 } },
  { name: 'KITCHEN', pos: [10.4, 2.4, 7.4], look: [15.8, 0.6, 12.4], node: 'KITCHEN', room: { x: 13.6, z: 11.0 } },
];

const HOUR_SEC = 80;
const PARAMS = [
  { interval: 6.5, aggr: 0.45, delay: 6.2 },
  { interval: 5.0, aggr: 0.6, delay: 5.0 },
  { interval: 4.0, aggr: 0.76, delay: 4.0 },
];

export class Holdout {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.cams = CAMS.map((c) => {
      const cam = new THREE.PerspectiveCamera(80, 1.45, 0.05, 40);
      cam.position.set(...c.pos);
      cam.lookAt(...c.look);
      return { ...c, cam };
    });
    const seat = game.house.holdoutSeat;
    this.seat = seat;
    this.doorYaw = Math.atan2(-(12.0 - seat.x), -(5.0 - seat.z));
    this.windowYaw = Math.atan2(-(16.9 - seat.x), -(2.5 - seat.z));
  }

  begin() {
    const g = this.g;
    this.active = true;
    this.time = 0;
    this.hour = 0;
    this.battery = 100;
    this.monitorUp = false;
    this.channel = 0;
    this.lureCool = 0;
    this.lure = null;
    this.static = 0;
    this.escapes = 1;
    this.holding = null;
    this.doorShake = 0;
    this.dawn = false;
    this.lastHour = -1;
    this.nightlight = 0;

    const pl = g.player;
    g.throwables.dropHeld();
    pl.hidden = null;
    pl.teleport(this.seat.x, this.seat.z, (this.doorYaw + this.windowYaw) / 2 + Math.PI, -0.1);
    pl.mode = 'seated';
    pl.fixedEyeY = this.seat.y;
    const center = this.centerYaw();
    pl.yaw = center;
    pl.lookLimits = { yawCenter: center, yawMin: -1.42, yawMax: 1.42, pitchMin: -1.1, pitchMax: 0.7 };

    // Mr Hush is driven by the holdout brain
    const h = g.hush;
    h.reset();
    h.m.pose.sit = 0;
    h.voice.start();
    h.voice.setLevel(0.55);
    h.holdout = this;
    h.setState('holdout');
    this.node = 'LIVING';
    h.teleport(NODES.LIVING.x, NODES.LIVING.z, 0);
    this.mode = 'idle';      // idle | move | linger | atDoor | atWindow | breach | retreat | leaving
    this.timer = 8;
    this.goal = Math.random() < 0.6 ? 'DOOR' : 'WINDOW';

    g.house.doorBack.hushOnly = true;
    g.nav.setDoorBlocked(g.house.doorBack.id, false);
    const dj = g.house.doorJune;
    dj.angle = 0; dj.target = 0; dj._apply(); g.house.field.setDoorClosed(dj.id, true);
    dj.locked = true; // only he can open it now
    dj.hushOnly = true;
    g.nav.setDoorBlocked(dj.id, false);

    g.ui.clock(true, 3, 0);
    g.chapter.setObjective('survive');
  }

  centerYaw() {
    // middle of the arc between the door (left) and the window (right), passing through "south"
    const a = this.doorYaw, b = this.windowYaw;
    const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); // shortest arc (through the south)
    return a + d / 2;
  }

  end() {
    this.active = false;
    const g = this.g;
    g.ui.clock(false);
    g.ui.monitor(false);
    this.monitorUp = false;
    g.pipeline.fx.uMonitor.value = 0;
    if (this.lure) { this.lure.stop(); this.lure = null; }
    if (this.breathLoop) { this.breathLoop.stop(); this.breathLoop = null; }
    if (this.monStatic) { this.monStatic.stop(0.1); this.monStatic = null; }
  }

  get params() { return PARAMS[Math.min(2, this.hour)]; }

  feedCamera() { return this.cams[this.channel].cam; }

  update(dt) {
    if (!this.active) return;
    const g = this.g, input = g.input, pl = g.player;
    if (this.dawn) return this.updateDawn(dt);
    if (g.state !== 'holdout') return;

    this.time += dt;
    const hour = Math.floor(this.time / HOUR_SEC);
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.hour = hour;
      if (hour > 0 && hour < 3) g.clockChime(3 + hour);
    }
    const mins = Math.floor((this.time % HOUR_SEC) / HOUR_SEC * 60);
    if (hour >= 3) { this.beginDawn(); return; }
    g.ui.clock(true, 3 + hour, mins);

    // ---- monitor
    if (input.actHit('monitor')) this.toggleMonitor();
    if (this.monitorUp) {
      for (let i = 0; i < 3; i++) if (input.hit('Digit' + (i + 1))) this.setChannel(i);
      if (input.actHit('left')) this.setChannel((this.channel + 2) % 3);
      if (input.actHit('right')) this.setChannel((this.channel + 1) % 3);
      if (input.actHit('lullaby')) this.playLullaby();
      this.battery = Math.max(0, this.battery - dt * 0.5);
      if (this.battery <= 0 && !this.flatNotified) { this.flatNotified = true; g.audio.play('blip', { bus: 'ui', rate: 0.5 }); }
      // interference when he is close to the camera
      const cam = this.cams[this.channel];
      const dh = Math.hypot(g.hush.x - cam.pos[0], g.hush.z - cam.pos[2]);
      const near = Math.max(0, 1 - dh / 4.2);
      this.static = Math.max(this.static - dt * 2.2, near * 0.75 + (this.battery < 10 ? 0.25 : 0));
      if (this.battery <= 0) this.static = 1.4;
      g.pipeline.fx.uStatic.value = this.static;
      if (this.monStatic) this.monStatic.fade(0.06 + this.static * 0.25, 0.1);
      const hh = 3 + hour;
      g.ui.monitorState({ ch: this.channel, name: cam.name, time: `0${hh}:${String(mins).padStart(2, '0')}`, battery: this.battery, lure: this.lure && this.lure.alive, dead: this.battery <= 0 });
    }

    // ---- holding the door / shutters (monitor must be down)
    let want = null;
    if (!this.monitorUp && input.mouseDown(0)) {
      const dYaw = (a) => Math.abs(Math.atan2(Math.sin(pl.yaw - a), Math.cos(pl.yaw - a)));
      if (dYaw(this.doorYaw) < 0.55) want = 'door';
      else if (dYaw(this.windowYaw) < 0.55) want = 'window';
    }
    if (want !== this.holding) {
      if (want) g.audio.play(want === 'door' ? 'door_creak_fast' : 'creak_floor', { pos: want === 'door' ? { x: 12, y: 1.1, z: 4.95 } : { x: 16.8, y: 1.4, z: 2.5 }, gain: 0.35, rate: 1.4 });
      this.holding = want;
    }
    const sv = g.chapter.shutterV;
    const tgt = this.holding === 'window' ? 1 : 0;
    if (Math.abs(sv - tgt) > 0.001) g.chapter.setShutters(sv + (tgt - sv) * Math.min(1, dt * (tgt ? 9 : 3)));
    // prompt
    if (!this.monitorUp) {
      const dYaw = (a) => Math.abs(Math.atan2(Math.sin(pl.yaw - a), Math.cos(pl.yaw - a)));
      if (this.holding === 'door') g.ui.setPrompt('Mouse', 'Holding the door');
      else if (this.holding === 'window') g.ui.setPrompt('Mouse', 'Holding the shutters');
      else if (dYaw(this.doorYaw) < 0.55) g.ui.setPrompt('Hold mouse', 'Hold the door shut');
      else if (dYaw(this.windowYaw) < 0.55) g.ui.setPrompt('Hold mouse', 'Hold the shutters closed');
      else g.ui.setPrompt(input.label('monitor'), 'Raise the baby monitor');
    } else g.ui.setPrompt(null);

    // door shake visual
    const dj = g.house.doorJune;
    if (this.doorShake > 0) {
      this.doorShake -= dt;
      dj.angle = Math.max(0, Math.sin(this.doorShake * 40) * 0.035 * this.doorShake * (this.holding === 'door' ? 0.4 : 1));
      dj._apply();
    }

    // nightlight: a faint, breathing glow in the corner so the room is never totally black
    this.nightlight -= dt;
    if (this.nightlight <= 0) {
      this.nightlight = 2.4;
      // the plug-in nightlight by the door
      g.sound({ x: 13.4, z: 4.85, y: 0.3, radius: 6.5, strength: 0.42, color: PULSE.WORLD, source: 'world', speed: 4, linger: 1.8 });
    }

    if (this.lureCool > 0) this.lureCool -= dt;
  }

  toggleMonitor() {
    const g = this.g;
    this.monitorUp = !this.monitorUp;
    g.audio.play('click_small', { gain: 0.6 });
    g.ui.monitor(this.monitorUp);
    g.pipeline.fx.uMonitor.value = this.monitorUp ? 1 : 0;
    this.static = 0.6;
    if (this.monitorUp) {
      this.holding = null;
      this.monStatic = g.audio.loop('static', { gain: 0.12, bus: 'ui', fadeIn: 0.05, lowpass: 5000 });
    } else if (this.monStatic) { this.monStatic.stop(0.08); this.monStatic = null; }
  }

  setChannel(i) {
    if (i === this.channel) return;
    this.channel = i;
    this.static = 0.9;
    this.g.audio.play('blip', { bus: 'ui', gain: 0.5 });
  }

  playLullaby() {
    const g = this.g;
    if (this.battery < 15 || this.lureCool > 0) { g.audio.play('blip', { bus: 'ui', rate: 0.6, gain: 0.6 }); return; }
    this.battery -= 15;
    this.lureCool = 11;
    const cam = this.cams[this.channel];
    if (this.lure) this.lure.stop(0.1);
    this.lure = g.audio.musicBox({ pos: { x: cam.room.x, y: 1.0, z: cam.room.z }, bus: 'sfx', gain: 0.55, loops: 1, wobble: 2.5, radio: true, tempo: 70 });
    g.sound({ x: cam.room.x, z: cam.room.z, y: 1, radius: 4, strength: 0.6, color: PULSE.WORLD, source: 'object' });
    // he follows the song unless he is already at a threshold
    if (['idle', 'move', 'linger'].includes(this.mode)) {
      this.lureNode = cam.node;
      this.mode = 'move';
      this.moveTo(cam.node, 1.5);
      this.lureLinger = true;
    }
  }

  // ------------------------------------------------------------ AI
  moveTo(node, speed = 1.25) {
    const g = this.g, h = g.hush, n = NODES[node];
    h.path = g.nav.find(h.x, h.z, n.x, n.z);
    h.pathI = 0;
    this.targetNode = node;
    this.moveSpeed = speed;
    if (!h.path) { this.node = node; h.teleport(n.x, n.z); }
  }

  update_speed() { return this.moveSpeed || 1.25; }

  brain(dt) {
    const g = this.g, h = g.hush, P = h.m.pose;
    const p = this.params;
    switch (this.mode) {
      case 'idle':
        P.listen = Math.max(0, P.listen - dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = p.interval * (0.7 + Math.random() * 0.6);
          if (Math.random() < p.aggr) {
            const table = this.goal === 'DOOR' ? TO_DOOR : TO_WINDOW;
            const next = ADJ[this.node].reduce((best, m) => (table[m] < table[best] ? m : best), ADJ[this.node][0]);
            if (table[next] < table[this.node]) { this.mode = 'move'; this.moveTo(next); }
          } else if (Math.random() < 0.5) {
            const opts = ADJ[this.node].filter((m) => m !== 'DOOR' && m !== 'WINDOW');
            const next = opts[Math.floor(Math.random() * opts.length)];
            this.mode = 'move'; this.moveTo(next);
          }
        }
        break;
      case 'move': {
        const done = h.followPath(dt, this.moveSpeed);
        if (done) {
          this.node = this.targetNode;
          if (this.node === 'DOOR') this.arriveDoor();
          else if (this.node === 'WINDOW') this.arriveWindow();
          else if (this.lureLinger && this.node === this.lureNode) { this.mode = 'linger'; this.timer = 9 + Math.random() * 3; this.lureLinger = false; }
          else { this.mode = 'idle'; this.timer = 0.6; }
        }
        return this.moveSpeed;
      }
      case 'linger':
        P.listen = Math.min(1, P.listen + dt * 2);
        h.lookTarget = Math.sin(this.timer * 0.8) * 0.6;
        this.timer -= dt;
        if (this.timer <= 0) { this.mode = 'idle'; this.timer = 1.5; }
        break;
      case 'atDoor':
      case 'atWindow': {
        this.timer -= dt;
        this.cueT -= dt;
        const atDoor = this.mode === 'atDoor';
        if (this.cueT <= 0) {
          this.cueT = 1.1 + Math.random() * 0.9;
          if (atDoor) {
            g.audio.play(Math.random() < 0.5 ? 'door_locked' : 'creak_floor', { pos: { x: 12.0, y: 1.0, z: 5.1 }, gain: 0.7, rate: 0.9 });
            g.sound({ x: 12.0, z: 4.7, y: 1.0, radius: 1.9, strength: 0.75, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 8 });
            this.doorShake = 0.4;
          } else {
            g.audio.play('knock', { pos: { x: 17.1, y: 1.4, z: 2.5 }, gain: 0.35, rate: 1.9 });
            g.sound({ x: 17.35, z: 2.5, y: 1.45, radius: 2.1, strength: 0.8, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 8 });
            if (!this.whispered || Math.random() < 0.25) {
              this.whispered = true;
              const lines = ['Ellis. It’s cold out here.', 'Let me in, Ellis.', 'I can hear you breathing.', 'Ellis, open the window.'];
              g.subtitle('June?', lines[Math.floor(Math.random() * lines.length)], 2.6, true);
            }
          }
        }
        if (this.timer <= 0) {
          const held = this.holding === (atDoor ? 'door' : 'window');
          if (held) this.repelled(atDoor);
          else this.breach(atDoor);
        }
        break;
      }
      case 'breach': {
        // coming in for you
        const pl = g.player;
        if (this.breachKind === 'door' && (!h.path || h.pathI >= h.path.length)) { h.path = [[pl.pos.x, pl.pos.z]]; h.pathI = 0; }
        if (this.breachKind === 'door') h.followPath(dt, 2.4);
        const d = Math.hypot(pl.pos.x - h.x, pl.pos.z - h.z);
        if (d < 1.15 || (this.breachKind === 'window' && this.timer < 0)) this.caught();
        this.timer -= dt;
        return 2.4;
      }
      case 'retreat': {
        const done = h.followPath(dt, 2.6);
        if (done) { this.node = this.targetNode; this.mode = 'idle'; this.timer = 2.5; h.voice.setLevel(0.55, 1.5); }
        return 2.6;
      }
      case 'leaving': {
        const done = h.followPath(dt, 1.0);
        if (done) { this.mode = 'gone'; h.placeDormant(); h.voice.stop(); h.wakeable = false; }
        return 1.0;
      }
    }
    return 0;
  }

  arriveDoor() {
    const g = this.g, h = g.hush;
    this.mode = 'atDoor';
    this.timer = this.params.delay;
    this.cueT = 0.2;
    h.voice.cut();
    h.heading = Math.PI;
    this.breathLoop = g.audio.loop('wind', { pos: { x: 12.0, y: 1.8, z: 5.4 }, gain: 0.0, rate: 2.2, ref: 0.8, rolloff: 1.5, bus: 'sfx' });
    this.breathLoop?.fade(0.45, 0.5);
    g.audio.play('hush_sniff', { pos: { x: 12, y: 1.9, z: 5.3 }, gain: 0.9 });
    g.hush.m.pose.sniff = 1;
  }
  arriveWindow() {
    const g = this.g, h = g.hush;
    this.mode = 'atWindow';
    this.timer = this.params.delay + 0.5;
    this.cueT = 0.3;
    this.whispered = false;
    h.voice.cut();
    h.heading = -Math.PI / 2;
  }

  stopBreath() { if (this.breathLoop) { this.breathLoop.stop(0.3); this.breathLoop = null; } }

  repelled(atDoor) {
    const g = this.g, h = g.hush;
    this.stopBreath();
    if (atDoor) {
      g.audio.play('door_slam', { pos: { x: 12, y: 1.2, z: 5.0 }, gain: 1 });
      g.sound({ x: 12.0, z: 4.6, y: 1.0, radius: 3.8, strength: 1, color: PULSE.HUSH, source: 'hush', euclid: true });
      this.doorShake = 0.8;
    } else {
      g.audio.play('door_slam', { pos: { x: 16.9, y: 1.4, z: 2.5 }, gain: 0.8, rate: 1.3 });
      g.sound({ x: 17.2, z: 2.5, y: 1.4, radius: 3.0, strength: 1, color: PULSE.HUSH, source: 'hush', euclid: true });
    }
    g.player.shake = 0.7;
    g.audio.play('hush_growl', { pos: h.headPos, gain: 0.7 });
    g.stats.repelled++;
    // retreat to somewhere far
    const far = atDoor ? (Math.random() < 0.5 ? 'LIVING' : 'KITCHEN') : 'KITCHEN';
    this.mode = 'retreat';
    this.moveTo(far, 2.6);
    this.goal = Math.random() < 0.55 ? 'DOOR' : 'WINDOW';
  }

  breach(atDoor) {
    const g = this.g, h = g.hush;
    this.stopBreath();
    this.breachKind = atDoor ? 'door' : 'window';
    if (atDoor) {
      const d = g.house.doorJune;
      d.setTarget(true, 4.5);
      g.audio.play('door_slam', { pos: { x: 12, y: 1.2, z: 5.0 }, gain: 1, rate: 0.8 });
      g.sound({ x: 12.0, z: 4.4, y: 1.0, radius: 7, strength: 1.1, color: PULSE.HUSH, source: 'hush' });
      this.timer = 6;
      h.path = g.nav.find(h.x, h.z, g.player.pos.x, g.player.pos.z); h.pathI = 0;
    } else {
      g.audio.play('bottle_shatter', { pos: { x: 17, y: 1.4, z: 2.5 }, gain: 1 });
      g.sound({ x: 16.6, z: 2.5, y: 1.4, radius: 7, strength: 1.1, color: PULSE.HUSH, source: 'hush', euclid: true });
      // he reaches through: teleport him to the sill
      h.teleport(17.2, 2.5, -Math.PI / 2);
      this.timer = 0.6;
    }
    g.audio.play('hush_growl', { pos: h.headPos, gain: 1 });
    this.mode = 'breach';
  }

  caught() {
    const g = this.g;
    this.mode = 'caughtWait';
    g.holdoutCaught(this.escapes > 0);
  }

  // after the player escapes a breach: they scramble under the bed, he loses them
  afterEscape() {
    const g = this.g, h = g.hush;
    this.escapes--;
    g.ui.subs(null);
    const d = g.house.doorJune;
    d.setTarget(false, 2.5);
    this.mode = 'retreat';
    this.moveTo(Math.random() < 0.5 ? 'LIVING' : 'KITCHEN', 2.6);
    if (this.breachKind === 'window') h.teleport(18.3, 2.5);
    h.setState('holdout');
    h.voice.setLevel(0.5, 2);
  }

  // ------------------------------------------------------------ dawn
  beginDawn() {
    const g = this.g, h = g.hush;
    this.dawn = true;
    this.dawnT = 0;
    this.holding = null;
    if (this.monitorUp) this.toggleMonitor();
    g.ui.setPrompt(null);
    g.ui.clock(true, 6, 0);
    this.stopBreath();
    g.clockChime(6);
    // he leaves; daylight makes him slow and quiet
    this.mode = 'leaving';
    const c = g.house.hushChair;
    h.path = g.nav.find(h.x, h.z, c.x, c.z); h.pathI = 0;
    h.voice.setLevel(0.25, 3);
    const d = g.house.doorJune;
    d.locked = false; d.hushOnly = false;
    g.stats.survived = true;
  }

  updateDawn(dt) {
    const g = this.g;
    this.dawnT += dt;
    const k = Math.min(1, this.dawnT / 12);
    const a = g.shared.uAmbient.value;
    a.set(0.78 + 0.1 * k, 0.72 + 0.06 * k, 0.7, 0.42 * k * k);
    if (this.dawnT > 1 && !this.birds) { this.birds = true; g.birdsong(); }
    if (this.dawnT > 4 && !this.dawnMsg) {
      this.dawnMsg = true;
      g.ui.clock(false);
      g.subtitle('Ellis', 'Morning. It’s actually morning.', 3.2);
    }
    if (this.dawnT > 8 && !this.standUp) {
      this.standUp = true;
      const pl = g.player;
      pl.mode = 'walk'; pl.lookLimits = null; pl.fixedEyeY = null;
      g.chapter.flags.dawn = true;
      g.chapter.monitorInter.enabled = () => !g.chapter.flags.tapeFound;
      g.chapter.setObjective('tape');
      g.state = 'play';
      this.active = false;
      g.ui.clock(false);
    }
  }
}
