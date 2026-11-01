import * as THREE from 'three';
import { PULSE } from '../render/Pulses.js';
import { Thimble } from '../entities/Thimble.js';

const NODES = {
  LIVING: { x: 4.3, z: 11.0 },
  FOYER: { x: 8.25, z: 11.2 },
  KITCHEN: { x: 13.6, z: 11.0 },
  HALL_W: { x: 2.4, z: 6.0 },
  HALL_M: { x: 8.5, z: 6.0 },
  HALL_E: { x: 13.8, z: 6.0 },
  DOOR: { x: 11.7, z: 6.3, face: Math.PI },   // 1.3 m back: his arm, not his head, goes through the gap
  BACKDOOR: { x: 16.1, z: 12.25 },
  YARD: { x: 18.3, z: 8.0 },
  WINDOW: { x: 18.3, z: 2.4, face: -Math.PI / 2 }, // 1.3 m out from the glass (his reaching arm lines up with the opening)
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
// per hour (3, 4, 5 AM). delay: warning at the door before he starts opening it.
// fight: door push speed (gap/s) and pushes needed. react: seconds to get the shutters shut.
// rise: Thimble's agitation per second.
const PARAMS = [
  { interval: 6.5, aggr: 0.45, delay: 6.2, push: 0.23, need: 7, react: 2.5, rise: 0.0105 },
  { interval: 5.0, aggr: 0.6, delay: 5.0, push: 0.265, need: 8, react: 2.1, rise: 0.0135 },
  { interval: 4.0, aggr: 0.76, delay: 4.0, push: 0.30, need: 9, react: 1.75, rise: 0.017 },
];
const FIGHT_KEYS = ['forward', 'left', 'back', 'right']; // W A S D by default (rebindable)
const PUSH_BACK = 0.07, WRONG_KEY = 0.05, WINDOW_HOLD = 2.4;
const SONG_COOL = 10;                 // shared wait after the lure lullaby or the music box
const LURE_COST = 15, MUSIC_COST = 6; // monitor battery (%) per lure lullaby / per wind of the music box
const WIN_GLASS = { x: 17.0, y: 1.45, z: 2.5 }; // June's window (east wall)
const BANG_REST = 0.28, BANG_HIT = 0.1; // arm reach hitting the door or the shutters: measured so the claws stop at the surface
const FIRST_WINDOW_REACT = 4; // seconds to get the shutters shut on his first window visit each night

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
    const rk = game.house.rocker.position;
    this.dollYaw = Math.atan2(-(rk.x - seat.x), -(rk.z - seat.z)); // behind you, just out of sight
    this.shadowYaw = Math.atan2(-(15.6 - seat.x), -(4.9 - seat.z)); // his shadow, on the wall behind the monitor
    this.thimble = new Thimble(game, game.house.rocker);
    this.echoes = [];
    // a sound of yours that reaches the window lights the glass, and whatever is outside it
    game.on('sound', (o) => this.onSound(o));
  }

  begin() {
    const g = this.g;
    this.active = true;
    this.time = 0;
    this.hour = 0;
    this.battery = 100;
    this.monitorUp = false;
    this.channel = 0;
    this.songCool = 0;
    this.lure = null;
    this.echoes = [];
    this.shutterLatch = false;
    this.shutterJolt = 0;
    this.flatNotified = false;
    this.static = 0;
    this.holding = null;
    this.fight = null;
    this.drawn = 0;
    this.windowSeen = false;
    this.sunrise = false;
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
    // door on the right (-), window on the left (+). Thimble's rocker is behind you, past the window
    // side, just beyond how far you can turn; you watch his shadow on the wall instead.
    pl.lookLimits = { yawCenter: center, yawMin: -1.42, yawMax: 1.45, pitchMin: -1.1, pitchMax: 0.7 };
    pl.forcedLook = null;
    this.thimble.reset();
    this.thimble.begin(this.seat.x, this.seat.z);

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
    g.ui.doorFight(false);
    this.fight = null;
    this.thimble.end();
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
    if (this.songCool > 0) this.songCool -= dt;
    this.updateEchoes(dt);
    const hour = Math.floor(this.time / HOUR_SEC);
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.hour = hour;
      if (hour > 0 && hour < 3) g.clockChime(3 + hour);
    }
    const mins = Math.floor((this.time % HOUR_SEC) / HOUR_SEC * 60);
    // dawn waits for a death already under way
    if (hour >= 3 && !['breach', 'caughtWait', 'thimble'].includes(this.mode)) { this.beginDawn(); return; }
    g.ui.clock(true, 3 + hour, mins);
    g.ui.holdoutStatus(this.battery, this.songCool);

    // ---- Thimble: restless unless sung to; at full agitation he comes for you
    if (this.mode === 'thimble') { this.updateThimbleKill(dt); return; }
    if (this.thimble.update(dt, this.params.rise) && this.mode !== 'breach' && this.mode !== 'caughtWait') { this.thimbleKill(); return; }
    if (this.drawn > 0) this.drawn -= dt;

    // ---- the door fight takes over the controls
    if (this.mode === 'doorFight') { this.updateDoorFight(dt); return; }

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
      if (this.battery <= 0) this.static = 2.0; // dead: no picture at all, only static
      g.pipeline.fx.uStatic.value = this.static;
      if (this.monStatic) this.monStatic.fade(0.06 + this.static * 0.25, 0.1);
      const hh = 3 + hour;
      g.ui.monitorState({ ch: this.channel, name: cam.name, time: `0${hh}:${String(mins).padStart(2, '0')}`, battery: this.battery, lure: this.lure && this.lure.alive, dead: this.battery <= 0 });
    }

    // ---- music box for Thimble (monitor down); a knock, to light the window
    if (!this.monitorUp && input.actHit('lullaby')) this.singToThimble();
    if (!this.monitorUp && input.actHit('knock')) g.knock();

    // ---- holding the shutters (monitor must be down)
    const dYaw = (a) => Math.abs(Math.atan2(Math.sin(pl.yaw - a), Math.cos(pl.yaw - a)));
    let want = null;
    if (!this.monitorUp && input.mouseDown(0) && dYaw(this.windowYaw) < 0.55) want = 'window';
    if (want !== this.holding) {
      if (want) g.audio.play('creak_floor', { pos: { x: 16.8, y: 1.4, z: 2.5 }, gain: 0.35, rate: 1.4 });
      this.holding = want;
    }
    const sv = g.chapter.shutterV;
    // (latched shut while he knocks on them after you held them; each knock jolts them)
    this.shutterJolt = Math.max(0, this.shutterJolt - dt * 4);
    const tgt = this.holding === 'window' || this.shutterLatch ? 1 - this.shutterJolt * 0.12 : 0;
    if (Math.abs(sv - tgt) > 0.001) g.chapter.setShutters(sv + (tgt - sv) * Math.min(1, dt * (tgt ? 9 : 3)));
    // prompt
    if (!this.monitorUp) {
      if (this.holding === 'window') g.ui.setPrompt('Mouse', 'Holding the shutters');
      else if (dYaw(this.windowYaw) < 0.4) g.ui.setPrompt('Hold mouse', 'Hold the shutters closed', `<kbd>${input.label('knock')}</kbd>Knock to see out`);
      else if (dYaw(this.shadowYaw) < 0.42) g.ui.setPrompt(input.label('lullaby'), this.thimble.singing ? 'The music box is playing' : this.songCool > 0 ? 'Wait for the music box' : 'Wind Thimble’s music box', 'He will hear it');
      // (not while the opening hint already says it)
      else if (this.time > 11.5) g.ui.setPrompt(input.label('monitor'), 'Raise the baby monitor');
      else g.ui.setPrompt(null);
    } else g.ui.setPrompt(null);

    // door shake visual
    const dj = g.house.doorJune;
    if (this.doorShake > 0) {
      this.doorShake -= dt;
      dj.angle = Math.max(0, Math.sin(this.doorShake * 40) * 0.035 * this.doorShake);
      dj._apply();
    }

    // nightlight: a faint, breathing glow in the corner so the room is never totally black
    this.nightlight -= dt;
    if (this.nightlight <= 0) {
      this.nightlight = 2.4;
      // the plug-in nightlight by the door
      g.sound({ x: 13.4, z: 4.85, y: 0.3, radius: 6.5, strength: 0.42, color: PULSE.WORLD, source: 'world', speed: 4, linger: 1.8 });
    }

  }

  // ---- the window lights up when your sound reaches it (he is never lit by his own noise out there)
  onSound(o) {
    if (!this.active || this.dawn || (o.source !== 'player' && o.source !== 'object') || o.visual === false) return;
    const d = Math.hypot(o.x - WIN_GLASS.x, o.z - WIN_GLASS.z), r = o.radius || 0;
    if (d >= r) return;
    this.echoes.push({ t: d / (o.speed ?? 11), strength: 0.6 + 0.4 * (1 - d / r) });
  }
  updateEchoes(dt) {
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const e = this.echoes[i];
      e.t -= dt;
      if (e.t > 0) continue;
      this.echoes.splice(i, 1);
      this.g.sound({ x: 17.7, z: 2.5, y: 1.5, radius: 2.1, strength: e.strength, color: PULSE.PLAYER, source: 'world', euclid: true, speed: 8 });
    }
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
    if (this.battery < LURE_COST || this.songCool > 0) { g.audio.play('blip', { bus: 'ui', rate: 0.6, gain: 0.6 }); return; }
    this.battery -= LURE_COST;
    this.songCool = SONG_COOL;
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
    P.reachArm = null; // set below while he works at the door or the window
    this.bangPulse = Math.max(0, (this.bangPulse || 0) - dt * 3);
    switch (this.mode) {
      case 'idle':
        P.listen = Math.max(0, P.listen - dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          // the music box draws him: he comes straight for June's room, quicker
          const drawn = this.drawn > 0;
          this.timer = p.interval * (0.7 + Math.random() * 0.6) * (drawn ? 0.35 : 1);
          if (drawn || Math.random() < p.aggr) {
            const table = this.goal === 'DOOR' ? TO_DOOR : TO_WINDOW;
            const next = ADJ[this.node].reduce((best, m) => (table[m] < table[best] ? m : best), ADJ[this.node][0]);
            if (table[next] < table[this.node]) { this.mode = 'move'; this.moveTo(next, drawn ? 1.7 : 1.25); }
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
          else if (this.node === 'YARD' && this.goal === 'WINDOW') {
            // something brushes the glass: the only warning before the window (clearer the first time)
            const first = !this.windowSeen;
            g.audio.play('knock', { pos: { x: 17.1, y: 1.4, z: 2.5 }, gain: first ? 0.5 : 0.16, rate: 2.4 });
            if (first) g.subtitle('June?', 'Ellis… I’m at the window.', 2.4, true);
            this.mode = 'idle'; this.timer = 0.6;
          }
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
      case 'atDoor': {
        // the warning: sniffing, scratching, the handle trying. Then he starts to open it.
        this.timer -= dt;
        this.cueT -= dt;
        if (this.cueT <= 0) {
          this.cueT = 1.1 + Math.random() * 0.9;
          g.audio.play(Math.random() < 0.5 ? 'door_locked' : 'creak_floor', { pos: { x: 12.0, y: 1.0, z: 5.1 }, gain: 0.7, rate: 0.9 });
          g.sound({ x: 12.0, z: 4.7, y: 1.0, radius: 1.9, strength: 0.75, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 8 });
          this.doorShake = 0.4;
        }
        if (this.timer <= 0) this.startDoorFight();
        break;
      }
      case 'doorFight': {
        // he leans on the door; one arm goes through the gap only as far as it is open, the other
        // presses on the wall (the push itself runs in updateDoorFight)
        const th = g.house.doorJune.angle;
        P.reach = 0.6; P.hunch = 1;
        // (measured: below 0.4 rad the paw stays in the open wedge, past it the door's edge is clear)
        P.reachArm = [th < 0.4 ? 0.28 + 0.27 * (th / 0.4) : 0.55 + 0.45 * Math.min(1, (th - 0.4) / 0.12), 0.3];
        return 0;
      }
      case 'banging': {
        // repelled: the door slammed on him. He hits it a few more times (paws on the door, not through it), then goes.
        P.reach = 0.3; P.hunch = 0.6;
        P.reachArm = [BANG_REST + BANG_HIT * this.bangPulse, BANG_REST + BANG_HIT * this.bangPulse];
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.bangs > 0) {
            this.bangs--;
            this.timer = 0.55 + Math.random() * 0.35;
            this.bangPulse = 1;
            g.audio.play('door_slam', { pos: { x: 12, y: 1.2, z: 5.0 }, gain: 0.85, rate: 0.65 + Math.random() * 0.15 });
            g.audio.play('boom', { pos: { x: 12, y: 1.2, z: 5.2 }, gain: 0.35 });
            g.sound({ x: 12.0, z: 4.6, y: 1.2, radius: 3.2, strength: 0.9, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 9 });
            this.doorShake = 0.6;
            g.player.shake = Math.max(g.player.shake, 0.45);
            this.thimble.bump(0.03); // the noise doesn't help Thimble
          } else this.retreat(true);
        }
        break;
      }
      case 'atWindow': {
        // short reaction: get the shutters shut, then keep them shut while he tries them
        this.timer -= dt;
        this.cueT -= dt;
        const pushing = this.windowPhase === 'push';
        if (this.cueT <= 0) {
          if (pushing) {
            // the shutters are shut: he tries them (you feel it; the light is on your side)
            this.cueT = 0.3 + Math.random() * 0.15;
            g.audio.play('creak_floor', { pos: { x: 17.1, y: 1.4, z: 2.5 }, gain: 0.6, rate: 1.6 });
            g.sound({ x: 16.9, z: 2.5, y: 1.45, radius: 1.6, strength: 0.7, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 8 });
            g.player.shake = Math.max(g.player.shake, 0.15);
          } else {
            // a fingernail on the glass, barely there (no light: he stays dark)
            this.cueT = 0.8 + Math.random() * 0.6;
            g.audio.play('knock', { pos: { x: 17.1, y: 1.6, z: 2.5 }, gain: 0.12, rate: 2.9 });
          }
        }
        if (!pushing) {
          if (this.timer <= 0) {
            if (this.holding === 'window') { this.windowPhase = 'push'; this.timer = WINDOW_HOLD; this.cueT = 0; }
            else this.breach(false);
          }
        } else if (this.holding !== 'window') this.breach(false);
        else if (this.timer <= 0) this.repelled(false);
        break;
      }
      case 'knocking': {
        // the shutters held: he knocks on them, trying to get in, then goes
        P.reach = 0.3; P.hunch = 0.6;
        P.reachArm = [BANG_REST + BANG_HIT * this.bangPulse, BANG_REST + BANG_HIT * this.bangPulse];
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.knocks > 0) {
            this.knocks--;
            this.timer = 0.55 + Math.random() * 0.45;
            this.bangPulse = 1;
            this.shutterJolt = 1;
            g.audio.play('knock', { pos: { x: 17.1, y: 1.5, z: 2.5 }, gain: 1, rate: 0.7 + Math.random() * 0.12 });
            g.audio.play('boom', { pos: { x: 17.1, y: 1.5, z: 2.5 }, gain: 0.18 });
            g.sound({ x: 16.9, z: 2.5, y: 1.5, radius: 2.4, strength: 0.85, color: PULSE.HUSH, source: 'hush', euclid: true, speed: 9 });
            g.player.shake = Math.max(g.player.shake, 0.3);
          } else { this.shutterLatch = false; this.retreat(false); }
        }
        break;
      }
      case 'breach': {
        // coming in for you
        const pl = g.player;
        if (this.breachKind === 'door' && (!h.path || h.pathI >= h.path.length)) { h.path = [[pl.pos.x, pl.pos.z]]; h.pathI = 0; }
        if (this.breachKind === 'door') h.followPath(dt, 2.4);
        if (this.breachKind === 'window') { P.reach = 0.6; P.hunch = 0.2; P.reachArm = [0.3, 0.9]; } // one arm in through the broken pane
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
    this.windowPhase = 'react';
    // short on purpose, except the first visit of the night (you're still learning the room)
    this.timer = this.windowSeen ? this.params.react : Math.max(FIRST_WINDOW_REACT, this.params.react);
    this.windowSeen = true;
    this.cueT = 0.5;
    h.voice.cut();
    h.heading = -Math.PI / 2;
    // he is not lit out there: the only cue is something soft at the glass. Knock (or any sound of
    // yours) to light the window and see him.
    g.audio.play('hush_sniff', { pos: { x: 17.3, y: 1.7, z: 2.5 }, gain: 0.3, rate: 0.85 });
  }

  // ------------------------------------------------------------ the door fight
  startDoorFight() {
    const g = this.g, h = g.hush, p = this.params;
    if (this.monitorUp) this.toggleMonitor();
    this.holding = null;
    this.mode = 'doorFight';
    // the whole sequence is shown up front, in order, so you can read ahead
    const seq = [];
    for (let i = 0; i < p.need; i++) {
      const opts = FIGHT_KEYS.filter((k) => k !== seq[i - 1]);
      seq.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    this.fight = { o: 0.14, prog: 0, need: p.need, push: p.push, seq, i: 0, key: seq[0], id: this.time, cueT: 0, wrong: 0 };
    g.player.forcedLook = { x: 12.0, y: 1.15, z: 5.0, speed: 7 };
    g.audio.play('door_creak_fast', { pos: { x: 12, y: 1.1, z: 5.0 }, gain: 0.9, rate: 0.7 });
    g.audio.play('hush_growl', { pos: h.headPos, gain: 0.8 });
    g.player.shake = 0.6;
    g.ui.setPrompt(null);
  }

  updateDoorFight(dt) {
    const g = this.g, input = g.input, F = this.fight;
    F.o += F.push * dt;
    for (const act of FIGHT_KEYS) {
      if (!input.actHit(act)) continue;
      if (act === F.key) {
        F.o = Math.max(0, F.o - PUSH_BACK);
        F.i++;
        F.prog = F.i / F.need;
        F.key = F.seq[F.i];
        g.audio.play('block_hit', { pos: { x: 12, y: 1.1, z: 5.0 }, gain: 0.5, rate: 0.6 + Math.random() * 0.2 });
        g.player.shake = Math.max(g.player.shake, 0.25);
      } else {
        F.o += WRONG_KEY;
        F.wrong = 0.35;
        g.audio.play('door_locked', { pos: { x: 12, y: 1.1, z: 5.0 }, gain: 0.5, rate: 0.8 });
      }
    }
    F.wrong = Math.max(0, F.wrong - dt);
    // the door: cracked open by his weight, shivering
    const dj = g.house.doorJune;
    dj.angle = Math.min(1, F.o) * 0.62 + Math.sin(this.time * 47) * 0.012;
    dj._apply();
    g.house.field.setDoorClosed(dj.id, F.o < 0.04);
    // through the gap: scraping, breathing, red pulses
    F.cueT -= dt;
    if (F.cueT <= 0) {
      F.cueT = 0.45 + Math.random() * 0.2;
      g.audio.play('creak_floor', { pos: { x: 12, y: 1.0, z: 5.1 }, gain: 0.5, rate: 0.7 + F.o * 0.4 });
      g.sound({ x: 12.0, z: 5.3, y: 1.2, radius: 1.6 + F.o * 2.2, strength: 0.6 + F.o * 0.5, color: PULSE.HUSH, source: 'hush', speed: 8 });
    }
    g.ui.doorFight(true, { id: F.id, keys: F.seq.map((a) => g.input.label(a)), i: F.i, gap: Math.min(1, F.o), wrong: F.wrong > 0 });
    if (F.prog >= 1) this.winDoorFight();
    else if (F.o >= 1) this.loseDoorFight();
  }

  winDoorFight() {
    const g = this.g, dj = g.house.doorJune;
    this.fight = null;
    g.ui.doorFight(false);
    g.player.forcedLook = null;
    dj.angle = 0; dj.target = 0; dj._apply();
    g.house.field.setDoorClosed(dj.id, true);
    this.stopBreath();
    g.audio.play('door_slam', { pos: { x: 12, y: 1.2, z: 5.0 }, gain: 1 });
    g.sound({ x: 12.0, z: 4.6, y: 1.0, radius: 3.8, strength: 1, color: PULSE.HUSH, source: 'hush', euclid: true });
    g.player.shake = 0.8;
    this.doorShake = 0.8;
    g.stats.repelled++;
    this.mode = 'banging';
    this.bangs = 3 + Math.min(2, this.hour);
    this.timer = 0.7;
  }

  loseDoorFight() {
    const g = this.g;
    g.deathCause = 'door_fight';
    this.fight = null;
    g.ui.doorFight(false);
    this.breach(true);
  }

  // ------------------------------------------------------------ Thimble
  singToThimble() {
    const g = this.g;
    if (this.songCool > 0 || this.battery < MUSIC_COST || this.thimble.singing) { g.audio.play('blip', { bus: 'ui', rate: 0.6, gain: 0.6 }); return; }
    if (!this.thimble.sing()) return;
    this.battery -= MUSIC_COST;
    this.songCool = SONG_COOL;
    const p = this.thimble.worldPos;
    g.sound({ x: p.x, z: p.z, y: 1, radius: 3.5, strength: 0.5, color: PULSE.WORLD, source: 'object' });
    // it's his song too: it brings him to June's room
    this.drawn = 16;
    if (['idle', 'linger'].includes(this.mode)) { this.mode = 'idle'; this.timer = 0.4; this.lureLinger = false; }
    if (!['atDoor', 'atWindow', 'doorFight', 'banging', 'breach'].includes(this.mode)) {
      this.goal = Math.random() < 0.5 ? 'DOOR' : 'WINDOW'; // either way into June's room
    }
    if (!this.sungOnce) { this.sungOnce = true; this.g.subtitle('Ellis', 'Shh. Shh. Not too loud…', 2.4); }
  }

  thimbleKill() {
    const g = this.g;
    this.mode = 'thimble';
    this.killT = 0;
    if (this.monitorUp) this.toggleMonitor();
    if (this.fight) { this.fight = null; g.ui.doorFight(false); }
    this.holding = null;
    g.ui.setPrompt(null);
    const p = this.thimble.worldPos;
    g.player.forcedLook = { x: p.x, y: p.y, z: p.z, speed: 9 };
    g.audio.play('riser', { pos: p, gain: 0.8 });
    // he is behind you: light him as you turn
    g.sound({ x: p.x, z: p.z + 0.4, y: 1.0, radius: 2.6, strength: 1, color: PULSE.HUSH, source: 'world', euclid: true, speed: 8, hold: 2, tail: 1 });
  }

  updateThimbleKill(dt) {
    const g = this.g;
    this.killT += dt;
    this.thimble.lunge(Math.min(1, this.killT / 0.9));
    if (this.killT > 0.75 && !this.killScare) {
      this.killScare = true;
      g.audio.play('jumpscare', { gain: 1.0, reverb: 0.2 });
      g.redFlash = 1;
      g.player.shake = 1.4;
    }
    if (this.killT > 1.5) { this.killScare = false; this.mode = 'dead'; g.die(true, 'thimble'); }
  }

  stopBreath() { if (this.breathLoop) { this.breathLoop.stop(0.3); this.breathLoop = null; } }

  // the shutters held
  repelled(atDoor) {
    const g = this.g;
    this.stopBreath();
    g.audio.play('door_slam', { pos: { x: 16.9, y: 1.4, z: 2.5 }, gain: 0.8, rate: 1.3 });
    g.sound({ x: 17.2, z: 2.5, y: 1.4, radius: 3.0, strength: 1, color: PULSE.HUSH, source: 'hush', euclid: true });
    g.player.shake = 0.7;
    g.stats.repelled++;
    // then he knocks on them a few times (they stay latched; you can let go)
    this.mode = 'knocking';
    this.knocks = 3 + Math.min(2, this.hour);
    this.timer = 0.8;
    this.shutterLatch = true;
  }

  retreat(atDoor) {
    const g = this.g, h = g.hush;
    g.audio.play('hush_growl', { pos: h.headPos, gain: 0.7 });
    h.voice.setLevel(0.55, 1.5);
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
    if (!atDoor) g.deathCause = 'window';
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
      // he stays outside; his arms come in through the broken window (the grab that follows brings him to you)
      this.timer = 0.6;
    }
    g.audio.play('hush_growl', { pos: h.headPos, gain: 1 });
    this.mode = 'breach';
  }

  // in the holdout there is no second chance: if he gets in, you die
  caught() {
    this.mode = 'caughtWait';
    this.g.holdoutCaught();
  }

  // ------------------------------------------------------------ dawn
  beginDawn() {
    const g = this.g, h = g.hush;
    this.dawn = true;
    this.dawnT = 0;
    this.holding = null;
    this.shutterLatch = false; this.echoes = [];
    if (this.fight) { this.fight = null; g.ui.doorFight(false); g.player.forcedLook = null; }
    const dj0 = g.house.doorJune;
    dj0.angle = 0; dj0.target = 0; dj0._apply();
    this.thimble.end();
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
    this.thimble.update(dt, 0); // he settles with the light
    // a real sunrise: cold grey-blue warming to soft daylight, finished before you stand up (8 s),
    // because this update stops then. Plus a slow wash of light from June's window.
    const u = Math.min(1, this.dawnT / 7), k = u * u * (3 - 2 * u);
    const a = g.shared.uAmbient.value;
    a.set(0.55 + 0.43 * k, 0.62 + 0.24 * k, 0.82 - 0.1 * k, 0.72 * k);
    if (this.dawnT > 1.2 && !this.sunrise) {
      this.sunrise = true;
      g.sound({ x: 17.4, z: 2.5, y: 1.5, radius: 10, strength: 0.38, color: PULSE.WORLD, source: 'world', speed: 2.5, hold: 30, tail: 6, euclid: true });
    }
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
