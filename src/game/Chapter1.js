import * as THREE from 'three';
import { buildGroup } from '../world/Builder.js';
import { ownMaterials } from './Interactions.js';
import { PULSE } from '../render/Pulses.js';
import { OBJECTIVES } from './Lore.js';
import { revealMaterial, PAT } from '../render/RevealMaterial.js';

const K = (k, t) => `<span><kbd>${k}</kbd>${t}</span>`;

export class Chapter1 {
  constructor(game) {
    this.g = game;
    this.flags = {};
    this.inv = new Set();
    this.timeline = [];
    this.t = 0;
    this.amb = {};
    this.objective = null;
    this.build();
  }

  // ------------------------------------------------------------------ world items
  build() {
    const g = this.g, M = g.M, H = g.house;
    const I = g.interactions;
    const add = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; g.scene.add(obj); obj.updateMatrixWorld(true); return obj; };

    const paper = (w = 0.21, d = 0.28, mat = M.notePaper) => buildGroup((b) => b.box(mat, -w / 2, 0, -d / 2, w / 2, 0.004, d / 2));
    const notebook = () => buildGroup((b) => { b.rbox(M.fabricRed, 0, 0.008, 0, 0.17, 0.016, 0.23, 0.004, 1); b.box(M.paper, -0.08, 0.016, -0.11, 0.08, 0.019, 0.11); });
    const cassette = () => buildGroup((b) => {
      b.rbox(M.plasticDark, 0, 0.007, 0, 0.1, 0.014, 0.064, 0.003, 1);
      b.box(M.paper, -0.042, 0.014, -0.024, 0.042, 0.0155, 0.012);
      b.cyl(M.black, -0.022, 0.0145, 0.014, 0.008, 0.008, 0.002, 10);
      b.cyl(M.black, 0.022, 0.0145, 0.014, 0.008, 0.008, 0.002, 10);
    });
    const wallSheet = (mat, w, h) => buildGroup((b) => b.box(mat, -w / 2, -h / 2, 0, w / 2, h / 2, 0.004));
    const hotspot = (x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial());
      m.position.set(x, y, z); m.updateMatrixWorld(true);
      return m;
    };

    // ---- lore documents
    const doc = (id, obj, prompt = 'Read') => I.add({ id: 'lore:' + id, obj, highlight: true, prompt: () => ['E', prompt], use: () => g.openDoc(id) });
    const tape = (id, obj) => I.add({ id: 'lore:' + id, obj, highlight: true, prompt: () => ['E', 'Play the tape'], use: () => g.playTape(id) });

    doc('police_report', add(paper(), 9.55, 0.757, 12.3, 0.3));
    doc('recall_notice', add(paper(0.22, 0.11, M.paper), 8.92, 0.032, 13.25, 0.6), 'Read the letter');
    doc('hushaby_card', add(paper(0.12, 0.17, M.paper), 2.35, 0.447, 11.78, -0.4), 'Read the card');
    tape('tape_orientation', add(cassette(), 4.75, 0.0, 8.15, 0.5));
    doc('diane_3', add(notebook(), 3.25, 0.57, 1.45, 0.25), 'Read the journal');
    doc('clipping', add(paper(0.18, 0.24, M.paper), 1.35, 0.893, 4.62, -0.2), 'Read the clipping');
    tape('tape_diane', add(cassette(), 9.58, 0.925, 3.12, 1.2));
    doc('diane_2', add(notebook(), 7.95, 0.0, 1.55, 2.2), 'Read the journal');
    doc('diane_1', add(notebook(), 12.05, 0.785, 9.95, -0.3), 'Read the journal');
    doc('june_1', add(wallSheet(M.drawingBigger, 0.6, 0.44), 12.4, 1.45, 0.087, 0), 'Look at the drawing');
    doc('june_2', add(wallSheet(M.drawingListens, 0.34, 0.26), 16.093, 1.35, 7.5, -Math.PI / 2), 'Look at the drawing');
    // notes taped to doors (hotspots in front of the door's paper)
    this.noteJune = I.add({ id: 'lore:note_june', obj: hotspot(12.0, 1.45, 5.09, 0.24, 0.3, 0.04), prompt: () => ['E', 'Read the note'], enabled: () => H.doorJune.isClosed, use: () => { g.openDoc('note_june'); this.onReadJuneNote(); } });
    I.add({ id: 'lore:note_basement', obj: hotspot(16.9, 1.45, 8.5, 0.04, 0.3, 0.24), prompt: () => ['E', 'Read the note'], use: () => g.openDoc('note_basement') });

    // ---- doors
    for (const d of H.doors) {
      I.add({
        id: 'door:' + d.id, obj: d.group, door: d, range: 2.0,
        prompt: () => {
          if (d === H.doorJune && d.locked && this.inv.has('key')) return ['E', 'Unlock June’s door'];
          if (d.locked) return ['E', d.name === 'Door' ? 'Try the door' : 'Try ' + d.name.toLowerCase()];
          return ['E', d.isClosed ? 'Open' : 'Close', '<kbd>Hold</kbd>Slowly, quietly'];
        },
        onLocked: () => {
          if (d === H.doorJune && this.inv.has('key')) return this.unlockJune();
          g.interactions.locked(d);
          if (d === H.doorJune) this.onJuneLocked();
          if (d === H.doorFront) g.ui.message('It locked behind me. It won’t move.');
        },
      });
    }

    // ---- key: Diane's nightstand drawer
    this.keyDrawer = I.add({
      id: 'key', obj: hotspot(4.05, 0.44, 0.52, 0.42, 0.18, 0.06), hold: 0.9,
      enabled: () => !this.flags.keyFound,
      prompt: () => ['E', 'Search the nightstand', '<kbd>Hold</kbd>'],
      onHoldStart: () => g.audio.play('drawer', { pos: { x: 4.05, y: 0.4, z: 0.5 }, gain: 0.5 }),
      use: () => this.takeKey(),
    });
    // ---- batteries: kitchen drawer
    this.battDrawer = I.add({
      id: 'batteries', obj: hotspot(14.6, 0.78, 13.29, 0.5, 0.16, 0.06), hold: 1.1,
      enabled: () => this.flags.monitorDead && !this.inv.has('batteries'),
      prompt: () => ['E', 'Search the junk drawer', '<kbd>Hold</kbd>'],
      onHoldStart: () => {
        g.audio.play('drawer', { pos: { x: 14.6, y: 0.8, z: 13.3 }, gain: 0.8 });
        g.sound({ x: 14.6, z: 13.2, y: 0.8, radius: 3.6, strength: 0.8, source: 'player', kind: 'drawer' });
      },
      use: () => this.takeBatteries(),
    });
    I.add({
      id: 'drawer-empty', obj: hotspot(12.6, 0.78, 13.29, 1.6, 0.16, 0.06), hold: 0.8,
      enabled: () => this.flags.monitorDead && !this.inv.has('batteries'),
      prompt: () => ['E', 'Search the drawers', '<kbd>Hold</kbd>'],
      onHoldStart: () => { g.audio.play('drawer', { pos: { x: 12.6, y: 0.8, z: 13.3 }, gain: 0.7 }); g.sound({ x: 12.6, z: 13.2, y: 0.8, radius: 3.4, strength: 0.8, source: 'player', kind: 'drawer' }); },
      use: () => g.ui.message('Cutlery. Candles. A cassette with the tape pulled out.'),
    });

    // ---- the baby monitor receiver on June's dresser
    this.monitor = add(buildGroup((b) => {
      b.rbox(M.plastic, 0, 0.07, 0, 0.13, 0.14, 0.07, 0.02, 2);
      b.box(M.plasticDark, -0.045, 0.06, 0.035, 0.045, 0.12, 0.037);
      for (let i = 0; i < 4; i++) b.box(M.black, -0.04, 0.03 + i * 0.008, 0.035, 0.04, 0.034 + i * 0.008, 0.038);
      b.cyl(M.plasticDark, 0.045, 0.2, -0.015, 0.006, 0.006, 0.14, 6);
      b.sphere(M.toyRed, -0.045, 0.125, 0.036, 0.006, 1, 1, 1, 6);
    }), 15.65, 0.893, 4.58, Math.PI + 0.25);
    this.monitorInter = I.add({
      id: 'monitor', obj: this.monitor, highlight: true,
      enabled: () => !g.holdout?.active && !this.flags.tapeFound,
      prompt: () => {
        if (this.flags.dawn) return ['E', 'Open the battery compartment'];
        if (this.inv.has('batteries')) return ['E', 'Put the batteries in'];
        return ['E', 'Pick up the baby monitor'];
      },
      use: () => this.useMonitor(),
    });

    // ---- the TV
    const s = H.tvScreen;
    this.tvMat = revealMaterial({ color: 0xaab4bc, pattern: PAT.PLAIN, map: M.staticTex });
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), this.tvMat);
    tv.position.set(s.x, s.y, s.z + 0.01);
    add(tv, s.x, s.y, s.z + 0.012, 0);
    this.tv = tv;
    I.add({
      id: 'tv', obj: tv, range: 2.4,
      prompt: () => ['E', this.tvOn ? 'Switch off the television' : 'Switch on the television'],
      use: () => this.setTV(!this.tvOn, true),
    });

    // ---- hiding spots
    for (const spot of H.hideSpots) {
      const box = spot.id === 'bed' ? hotspot(3.0, 0.35, 1.12, 1.56, 0.7, 2.05)
        : spot.id === 'wardrobe' ? hotspot(0.38, 1.0, 2.6, 0.62, 2.0, 1.1) : hotspot(16.6, 1.0, 6.0, 0.62, 2.0, 1.1);
      I.add({
        id: 'hide:' + spot.id, obj: box, range: 2.0,
        prompt: () => (g.player.hidden === spot ? ['E', 'Leave'] : ['E', spot.id === 'bed' ? 'Hide under the bed' : 'Hide in the ' + spot.name.toLowerCase()]),
        use: () => (g.player.hidden === spot ? g.leaveHide() : g.enterHide(spot)),
      });
    }

    // ---- squeaky toys (hazards)
    this.toys = [];
    const duck = () => buildGroup((b) => {
      b.sphere(M.toyYellow, 0, 0.045, 0, 0.05, 1.25, 0.85, 1, 12);
      b.sphere(M.toyYellow, 0.04, 0.095, 0, 0.032, 1, 1, 1, 10);
      b.sphere(M.toyRed, 0.075, 0.09, 0, 0.014, 1.6, 0.5, 1, 8);
    });
    for (const [x, z, r] of [[12.85, 5.95, 0.4], [11.9, 4.15, 2.2], [4.3, 10.45, -0.8], [8.6, 6.55, 1.3]]) {
      const m = add(duck(), x, 0, z, r);
      this.toys.push({ mesh: m, x, z, cool: 0 });
    }

    // ---- throwables
    const T = g.throwables;
    T.spawn('bottle', 11.15, 0.92, 13.5, 0.2);
    T.spawn('bottle', 11.42, 0.92, 13.46, 1.0);
    T.spawn('bottle', 12.85, 0.785, 10.35, 0.4);
    T.spawn('bottle', 3.85, 0.0, 12.75, 0.0);
    T.spawn('block', 13.05, 0.0, 3.6, 0.3);
    T.spawn('blockB', 13.35, 0.0, 3.85, 1.1);
    T.spawn('blockY', 10.9, 0.0, 6.55, 0.7);

    // ---- window shutters in June's room (used in the holdout)
    this.shutters = [];
    for (const s2 of [-1, 1]) {
      const sh = buildGroup((b) => {
        b.box(M.paintedWood, 0, -0.62, -0.015, 0.74, 0.62, 0.015);
        for (let i = 0; i < 12; i++) b.boxC(M.paintedWood, 0.37, -0.55 + i * 0.1, 0, 0.64, 0.05, 0.012, -0.5, 0, 0);
      });
      // hinge on the wall face at z = 1.75 (s2=-1) or 3.25 (s2=1)
      sh.position.set(16.86, 1.425, s2 < 0 ? 1.75 : 3.25);
      sh.userData.side = s2;
      g.scene.add(sh);
      this.shutters.push(sh);
    }
    this.setShutters(0);
  }

  setShutters(v) {
    // v: 0 = folded open against the wall, 1 = closed over the glass
    for (const sh of this.shutters) {
      const s = sh.userData.side;
      const open = s < 0 ? Math.PI / 2 + 0.15 : -Math.PI / 2 - 0.15;
      const closed = s < 0 ? Math.PI * 1.5 : -Math.PI * 1.5;
      // panel runs along local +x; rotate about y so it lies along the wall when open
      sh.rotation.y = open + (closed - open) * v;
    }
    this.shutterV = v;
  }

  // ------------------------------------------------------------------ state
  setObjective(key, show = true) {
    this.objective = key;
    if (show) this.g.ui.objective(OBJECTIVES[key]);
  }

  setTV(on, byPlayer = false) {
    const g = this.g;
    if (this.tvOn === on) return;
    this.tvOn = on;
    const s = g.house.tvScreen;
    g.audio.play('click_small', { pos: { x: s.x, y: s.y, z: s.z }, gain: 0.8 });
    if (on) {
      this.amb.tv = g.audio.loop('static', { pos: { x: s.x, y: s.y, z: s.z }, gain: 0.32, occlude: true, ref: 1.2, rolloff: 1.4, bus: 'sfx' });
      if (byPlayer) {
        g.sound({ x: s.x, z: s.z + 0.3, y: 0.9, radius: 6, strength: 0.9, source: 'object', kind: 'tv', color: PULSE.LIGHT });
        if (!g.lore.has('tv_ad')) setTimeout(() => this.tvOn && g.playTape('tv_ad'), 900);
      }
    } else {
      if (this.amb.tv) { this.amb.tv.stop(0.05); this.amb.tv = null; }
      if (g.tape && g.tape.id === 'tv_ad') g.stopTape();
    }
    this.tvMat.uniforms.uParams.value.z = 0;
  }

  // ------------------------------------------------------------------ checkpoints
  start(cp) {
    const g = this.g, H = g.house;
    this.cp = cp;
    this.t = 0;
    this.timeline = [];
    this.flags = {};
    this.inv = new Set();
    g.throwables.resetAll();
    g.pulses.clear();
    g.hush.reset();
    g.hush.enabled = true;
    g.hush.hearMul = 1.25;
    this.setShutters(0);
    for (const toy of this.toys) toy.cool = 0;

    // doors to defaults
    const setDoor = (d, angle, locked) => { d.angle = angle; d.target = angle; d.moving = false; d._apply(); d.locked = locked; H.field.setDoorClosed(d.id, d.isClosed); g.nav.setDoorBlocked(d.id, locked && !d.hushOnly); };
    setDoor(H.doorFront, 0, true);
    setDoor(H.doorLiving, 1.2, false);
    setDoor(H.doorKitchen, 1.5, false);
    setDoor(H.doorMom, 0, false);
    setDoor(H.doorBath, 0.5, false);
    setDoor(H.doorJune, 0, true);
    setDoor(H.doorBasement, 0, true);
    setDoor(H.doorBack, 0, true);
    H.doorBack.hushOnly = false;

    this.tvOn = undefined;
    this.setTV(true);
    this.startAmbience();

    const pl = g.player;
    pl.mode = 'walk'; pl.hidden = null; pl.forcedLook = null; pl.lookLimits = null; pl.stamina = 1; pl.breath = 1;
    if (cp === 'start') {
      setDoor(H.doorFront, 1.4, false);
      pl.teleport(8.25, 13.25, 0, -0.04);
      this.setObjective('find_room', false);
      this.at(0.9, () => this.slamFront());
      this.at(1.2, () => g.ui.card('Chapter One', 'The House', 4600));
      this.at(6.4, () => g.ui.hint('Every sound you make shows you the world.', 4800, true));
      this.at(11.5, () => g.ui.hint(K('W A S D', 'Move') + K('Shift', 'Run') + K('Ctrl', 'Creep'), 6500));
      this.at(12.5, () => { if (!this.flags.juneLocked && !this.flags.keyFound) this.setObjective('find_room'); });
      this.at(19, () => g.ui.hint(K('Q', 'Knock: make a sound on purpose'), 5500));
    } else if (cp === 'awake') {
      this.flags = { seenHush: true, juneNote: true, keyFound: true, awake: true, doorHint: true, knockHint: true };
      this.inv.add('key');
      pl.teleport(4.45, 1.6, Math.PI, 0);
      g.hush.voice.start();
      g.hush.teleport(4.4, 11.2, 0);
      g.hush.m.pose.sit = 0;
      g.hush.setState('wander');
      g.hush.timer = 4;
      this.setObjective('get_room');
    } else if (cp === 'batteries') {
      this.flags = { seenHush: true, juneNote: true, keyFound: true, awake: true, monitorDead: true, doorHint: true, knockHint: true, juneOpen: true };
      this.inv.add('batteries');
      setDoor(H.doorJune, 0, false);
      pl.teleport(14.6, 12.55, 0, 0);
      g.hush.voice.start();
      g.hush.teleport(3.0, 3.6, 0);
      g.hush.m.pose.sit = 0;
      g.hush.setState('wander');
      g.hush.timer = 6;
      this.setObjective('return_room');
    } else if (cp === 'holdout') {
      this.flags = { seenHush: true, juneNote: true, keyFound: true, awake: true, monitorDead: true, juneOpen: true, doorHint: true, knockHint: true };
      setDoor(H.doorJune, 0, false);
      g.startHoldout();
    }
  }

  at(t, fn) { this.timeline.push({ t: this.t + t, fn }); }

  startAmbience() {
    const g = this.g, a = g.audio;
    if (this.amb.started || !a.ready) return;
    this.amb.started = true;
    this.amb.rain = [];
    for (const [x, z] of [[5.4, -0.3], [13.75, -0.3], [4.75, 14.3], [13.1, 14.3], [17.3, 2.5], [9.1, -0.3]]) {
      this.amb.rain.push(a.loop('rain', { pos: { x, y: 1.5, z }, gain: 0.5, occlude: true, ref: 1.2, rolloff: 1.1, fadeIn: 3 }));
    }
    this.amb.wind = a.loop('wind', { gain: 0.18, fadeIn: 4 });
    this.amb.fridge = a.loop('drone', { pos: { x: 16.4, y: 1.0, z: 7.5 }, gain: 0.35, rate: 2.9, occlude: true, ref: 0.8, rolloff: 1.6 });
    a.startDrone();
    a.startBody();
    this.nextTick = 0; this.nextDrip = 1; this.nextRock = 5; this.nextLightning = 24 + Math.random() * 20; this.nextGroan = 12; this.tvPulse = 0; this.tvHear = 2;
  }

  // ------------------------------------------------------------------ events
  slamFront() {
    const g = this.g, d = g.house.doorFront;
    d.setTarget(false, 6);
    const c = d.center();
    g.audio.play('door_slam', { pos: { x: c.x, y: 1.2, z: c.z }, gain: 1 });
    setTimeout(() => g.audio.play('door_latch', { pos: { x: c.x, y: 1, z: c.z }, gain: 0.9 }), 300);
    g.sound({ x: c.x, z: c.z - 0.3, y: 1, radius: 14, strength: 1.1, source: 'world', speed: 10, linger: 2.2 });
    setTimeout(() => { d.locked = true; g.nav.setDoorBlocked(d.id, true); }, 400);
    g.player.shake = 0.6;
  }

  onJuneLocked() {
    if (!this.flags.juneLocked) {
      this.flags.juneLocked = true;
      if (!this.flags.keyFound) this.at(1.2, () => this.setObjective('find_key'));
    }
  }
  onReadJuneNote() {
    if (!this.flags.juneNote) {
      this.flags.juneNote = true;
      if (!this.flags.keyFound) this.setObjective('find_key');
    }
  }

  takeKey() {
    const g = this.g;
    this.flags.keyFound = true;
    this.inv.add('key');
    g.audio.play('keys', { gain: 0.7 });
    g.subtitle('Ellis', 'Her key. Mom kept it next to her, all these years.', 3.5);
    g.collectNotice('June’s key');
    // the house wakes up
    this.at(2.6, () => g.lightning(1.0, true));
    this.at(3.4, () => {
      const c = g.house.hushChair;
      g.audio.play('creak_floor', { pos: { x: c.x, y: 0.6, z: c.z }, gain: 1, rate: 0.6 });
      g.audio.play('hush_step', { pos: { x: c.x, y: 0.2, z: c.z }, gain: 1 });
      g.audio.stinger('swell', 0.5);
      g.hush.wake();
      g.hush.hearMul = 0.8;
      g.hush.timer = 3;
    });
    this.at(5.8, () => g.subtitle('Ellis', 'Something just got up.', 2.6));
    this.at(8.5, () => g.ui.hint('When the humming stops, he has heard you.', 5500, true));
    this.at(9.5, () => { this.setObjective('get_room'); g.checkpoint('awake'); });
    this.at(22, () => { g.hush.hearMul = 1.25; });
  }

  unlockJune() {
    const g = this.g, d = g.house.doorJune;
    d.locked = false;
    g.nav.setDoorBlocked(d.id, false);
    this.inv.delete('key');
    const c = d.center();
    g.audio.play('keys', { pos: { x: c.x, y: 1, z: c.z }, gain: 0.6 });
    g.audio.play('door_latch', { pos: { x: c.x, y: 1, z: c.z }, gain: 0.8, delay: 0.25 });
    g.sound({ x: c.x, z: c.z, y: 1, radius: 2.4, strength: 0.7, source: 'player', kind: 'door' });
    g.ui.message('Unlocked.');
    this.flags.juneOpen = true;
  }

  useMonitor() {
    const g = this.g;
    if (this.flags.dawn) return this.findLastTape();
    if (this.inv.has('batteries')) {
      g.audio.play('click_small', { gain: 0.8 });
      this.inv.delete('batteries');
      this.monitorInter.enabled = () => false;
      g.beginHoldoutSequence();
      return;
    }
    if (!this.flags.monitorDead) {
      this.flags.monitorDead = true;
      g.audio.play('click_small', { gain: 0.6 });
      g.subtitle('Ellis', 'Dead. Mom took the batteries out of everything. The kitchen junk drawer, maybe.', 4.6);
      this.at(4.6, () => this.setObjective('batteries'));
    } else {
      g.ui.message('It needs batteries.');
    }
  }

  takeBatteries() {
    const g = this.g;
    this.inv.add('batteries');
    g.audio.play('click_small', { gain: 0.7 });
    g.collectNotice('Batteries');
    g.subtitle('Ellis', 'Back to June’s room. Quietly.', 2.8);
    this.setObjective('return_room');
    g.checkpoint('batteries');
  }

  findLastTape() {
    const g = this.g;
    this.flags.tapeFound = true;
    g.audio.play('click_small', { gain: 0.7 });
    g.playTape('tape_ellis', () => g.chapterComplete());
  }

  onDoorToggled(d, opening) {
    if (opening && d === this.g.house.doorJune && !this.flags.enteredJune) this.flags.enteredJune = true;
  }

  onPickupThrowable() {
    if (!this.flags.throwHint) {
      this.flags.throwHint = true;
      this.g.ui.hint(K('Mouse', 'Throw. Hold to throw harder') + '<span>Where it lands, it will be heard.</span>', 6000);
    }
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    const g = this.g, H = g.house, pl = g.player;
    this.t += dt;
    for (let i = this.timeline.length - 1; i >= 0; i--) {
      if (this.t >= this.timeline[i].t) { const e = this.timeline[i]; this.timeline.splice(i, 1); e.fn(); }
    }
    this.ambient(dt);

    if (g.holdout?.active) return;

    // first sight of Mr Hush in his chair
    if (!this.flags.seenHush && g.hush.state === 'dormant') {
      const c = H.hushChair;
      const d = Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z);
      if (d < 3.6 && H.roomAt(pl.pos.x, pl.pos.z)?.name === 'Living room') {
        this.flags.seenHush = true;
        g.audio.stinger('swell', 0.4);
        this.at(1.2, () => g.subtitle('Ellis', 'June’s bear. Mr. Hush. It was never this big.', 3.8));
        this.at(5.5, () => g.subtitle('Ellis', 'Don’t wake it. Don’t make a sound.', 3.0));
      }
    }
    // the sleeping bear turns its head to follow you
    if (g.hush.state === 'dormant') {
      const c = H.hushChair;
      const d = Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z);
      if (d < 3.2) {
        const target = Math.atan2(pl.pos.x - c.x, pl.pos.z - c.z) - g.hush.heading;
        g.hush.lookTarget += (Math.atan2(Math.sin(target), Math.cos(target)) * 0.6 - g.hush.lookTarget) * Math.min(1, dt * 0.4);
      }
    }
    // door hint
    if (!this.flags.doorHint && this.t > 14) {
      const near = H.doors.some((d) => { const c = d.center(); return Math.hypot(c.x - pl.pos.x, c.z - pl.pos.z) < 1.8 && !d.locked; });
      if (near) { this.flags.doorHint = true; g.ui.hint(K('E', 'Tap: open fast and loud') + K('Hold E', 'Open slowly and quietly'), 6500); }
    }
    // hiding hint
    if (!this.flags.hideHint && this.flags.awake) {
      const near = H.hideSpots.some((s) => Math.hypot(s.x - pl.pos.x, s.z - pl.pos.z) < 2.2);
      if (near) { this.flags.hideHint = true; g.ui.hint(K('E', 'Hide') + K('Space', 'Hold your breath when he is close'), 6000); }
    }
    // entering June's room after unlocking it
    if (this.flags.juneOpen && !this.flags.inJune && H.roomAt(pl.pos.x, pl.pos.z)?.name === 'June’s room') {
      this.flags.inJune = true;
      if (!this.flags.monitorDead) {
        g.subtitle('Ellis', 'Her room. Nobody’s touched it.', 2.8);
        this.at(3.2, () => g.subtitle('Ellis', 'The baby monitor. She used to talk to me through it at night.', 4.0));
        this.at(3.4, () => { if (!this.flags.monitorDead) this.setObjective('monitor'); });
      }
    }
    if (this.inv.has('batteries') && this.objective === 'return_room' && H.roomAt(pl.pos.x, pl.pos.z)?.name === 'June’s room') this.setObjective('monitor');

    // squeaky toys
    for (const toy of this.toys) {
      toy.cool -= dt;
      const d = Math.hypot(toy.x - pl.pos.x, toy.z - pl.pos.z);
      if (d < 0.32 && pl.mode === 'walk' && toy.cool <= 0 && pl.speedNow > 0.3) {
        toy.cool = 1.4;
        const soft = pl.moveState === 'crouch';
        g.audio.play('squeak', { pos: { x: toy.x, y: 0.05, z: toy.z }, gain: soft ? 0.35 : 1, rate: soft ? 0.8 : 1 });
        g.sound({ x: toy.x, z: toy.z, y: 0.05, radius: soft ? 2.2 : 8, strength: 1, source: 'player', kind: 'squeak' });
        toy.mesh.scale.y = 0.6;
      }
      toy.mesh.scale.y += (1 - toy.mesh.scale.y) * Math.min(1, dt * 6);
    }

    // Mr Hush switches the TV off when he finds it
    if (this.tvOn && g.hush.state === 'search') {
      const s = H.tvScreen;
      if (Math.hypot(g.hush.x - s.x, g.hush.z - s.z) < 2.6 && g.hush.stateTime > 1.4) {
        this.setTV(false);
        g.audio.play('door_slam', { pos: { x: s.x, y: 0.9, z: s.z }, gain: 0.5, rate: 1.6 });
        g.sound({ x: s.x, z: s.z + 0.4, y: 0.9, radius: 3.5, strength: 0.9, source: 'hush', color: PULSE.HUSH });
      }
    }
  }

  ambient(dt) {
    const g = this.g, H = g.house;
    if (!this.amb.started) return;
    // grandfather clock
    this.nextTick -= dt;
    if (this.nextTick <= 0) {
      this.nextTick += 1;
      this.tock = !this.tock;
      g.audio.play(this.tock ? 'tock' : 'tick', { pos: H.clockPos, gain: 0.55, reverb: 0.15, ref: 1, rolloff: 1.5 });
      if (this.tock) g.sound({ x: H.clockPos.x + 0.3, z: H.clockPos.z, y: 1.2, radius: 1.5, strength: 0.4, color: PULSE.WORLD, source: 'world', speed: 6 });
    }
    // pendulum
    H.pendulum.rotation.z = Math.sin(g.time * Math.PI) * 0.12;
    // faucet
    this.nextDrip -= dt;
    if (this.nextDrip <= 0) {
      this.nextDrip = 1.8 + Math.random() * 2.2;
      g.audio.play('drip', { pos: { x: 13.0, y: 0.95, z: 13.45 }, gain: 0.5, jitter: 0.2 });
      g.sound({ x: 13.0, z: 13.3, y: 0.95, radius: 1.3, strength: 0.45, color: PULSE.WORLD, source: 'world', speed: 5 });
    }
    // the rocking chair rocks on its own
    this.nextRock -= dt;
    if (this.nextRock <= 0) {
      this.nextRock = 8 + Math.random() * 10;
      this.rockT = 3.2;
      g.audio.play('creak_floor', { pos: { x: 16.2, y: 0.5, z: 0.85 }, gain: 0.45, rate: 1.3 });
      g.sound({ x: 16.0, z: 1.0, y: 0.4, radius: 2.3, strength: 0.6, color: PULSE.WORLD, source: 'world', speed: 6 });
    }
    if (this.rockT > 0) {
      this.rockT -= dt;
      H.rocker.rotation.x = Math.sin(this.rockT * 3.6) * 0.09 * Math.min(1, this.rockT);
    }
    // TV static: flickering light, and it's loud
    if (this.tvOn) {
      this.tvPulse -= dt;
      if (this.tvPulse <= 0) {
        this.tvPulse = 0.22 + Math.random() * 0.25;
        const s = H.tvScreen;
        g.sound({ x: s.x, z: s.z + 0.25, y: s.y, radius: 2.4 + Math.random() * 1.6, strength: 0.42 + Math.random() * 0.25, color: PULSE.LIGHT, source: 'world', speed: 25, linger: 0.35, euclid: false });
        g.M.staticTex.userData.refresh();
      }
      this.tvHear -= dt;
      if (this.tvHear <= 0) {
        this.tvHear = 4.5;
        const s = H.tvScreen;
        if (g.hush.state !== 'dormant') g.hush.hear({ x: s.x, z: s.z + 0.4, radius: 6.5, source: 'object', kind: 'tv' });
      }
    }
    // lightning
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = 35 + Math.random() * 45;
      g.lightning(0.5 + Math.random() * 0.4);
    }
    // house groans
    this.nextGroan -= dt;
    if (this.nextGroan <= 0) {
      this.nextGroan = 18 + Math.random() * 26;
      const r = H.rooms[Math.floor(Math.random() * H.rooms.length)];
      g.audio.play('groan', { pos: { x: (r.x0 + r.x1) / 2, y: 2.4, z: (r.z0 + r.z1) / 2 }, gain: 0.45 });
    }
  }
}
