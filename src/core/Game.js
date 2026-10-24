import * as THREE from 'three';
import { Pipeline } from '../render/Pipeline.js';
import { createSharedUniforms, PulseSystem, PULSE } from '../render/Pulses.js';
import { setSharedUniforms } from '../render/RevealMaterial.js';
import { createMaterials } from '../world/Materials.js';
import { House } from '../world/House.js';
import { Player, MOVE, SURF_MUL } from '../entities/Player.js';
import { Input } from './Input.js';
import { AudioEngine } from '../audio/Audio.js';
import { NavGrid } from '../ai/Nav.js';
import { MrHush } from '../entities/MrHush.js';
import { UI } from '../ui/UI.js';
import { Interactions } from '../game/Interactions.js';
import { Throwables } from '../game/Throwables.js';
import { Chapter1 } from '../game/Chapter1.js';
import { Holdout } from '../game/Holdout.js';
import { TAPES, LORE_ORDER, OBJECTIVES, CHECKPOINTS } from '../game/Lore.js';
import { loadSettings, saveSettings, loadSave, writeSave, QUALITY, VOLUME_SCALE } from './Settings.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.time = 0;
    this.listeners = {};
    const params = new URLSearchParams(location.search);
    this.dev = params.has('dev');
    this.manual = params.has('manual');
    this.state = 'boot';
    this.paused = false;
    this.docOpen = false;
    this.sheet = null;
    this.settings = loadSettings();
    const save = loadSave();
    this.save = save || { cp: null, lore: [] };
    this.lore = new Set(this.save.lore || []);
    this.stats = { start: 0, heard: 0, thrown: 0, hid: 0, repelled: 0, survived: false };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: this.dev });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    this.renderer = renderer;

    this.shared = createSharedUniforms();
    setSharedUniforms(this.shared);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.04, 80);
    this.scene.add(this.camera);
    this.pipeline = new Pipeline(renderer);

    this.M = createMaterials();
    this.house = new House(this.M);
    this.scene.add(this.house.root);
    this.pulses = new PulseSystem(this.house.field, this.shared);

    this.audio = new AudioEngine();
    this.audio.occlusion = (x, z) => {
      const l = this.audio.listenerPos;
      const w = this.house.field.wallsBetween(l.x, l.z, x, z);
      return Math.min(1, w * 0.45);
    };
    this.nav = new NavGrid(this.house.field, this.house.colliders);
    for (const d of this.house.doors) if (d.locked) this.nav.setDoorBlocked(d.id, true);

    this.player = new Player(this.camera, this.house);
    this.player.onStep = (p, state) => this.onFootstep(p, state);
    this.hush = new MrHush(this);
    this.on('sound', (o) => this.hush.hear(o));
    this.on('hushGrab', (e) => this.onHushGrab(e));
    this.on('hushHunt', () => { this.stats.heard++; this.audio.stinger('swell', 0.35); });

    this.input = new Input(canvas);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    if (this.dev) this.input.allowUnlockedLook = true;

    this.ui = new UI(uiRoot, this);
    this.interactions = new Interactions(this);
    this.throwables = new Throwables(this);
    this.chapter = new Chapter1(this);
    this.holdout = new Holdout(this);

    this.fear = 0;
    this.beatPhase = 0;
    this.noiseLevel = 0;
    this.tape = null;
    this.subTimer = 0;
    this.flash = 0;
    this.redFlash = 0;
    this.white = 0;
    this.fadeV = 0;
    this.fadeTarget = 0;
    this.menuCamT = 0;
    this.lastMenuPulse = 0;
    this.exhaustT = 0;

    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    // safety net: ask before closing the tab mid-game (e.g. Ctrl+W)
    window.addEventListener('beforeunload', (e) => {
      if (!this.dev && ['play', 'holdout', 'cutscene'].includes(this.state)) { e.preventDefault(); e.returnValue = ''; }
    });
    window.addEventListener('mousemove', (e) => this.onMenuMouse(e));
    window.addEventListener('wheel', (e) => { if (this.docOpen) this.ui.scrollDoc(e.deltaY); }, { passive: true });
    this.timer = new THREE.Timer();
    this.setupMenuWorld();
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, data) { for (const fn of this.listeners[evt] || []) fn(data); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // cap the number of shaded pixels: the reveal shader is per-pixel heavy
    const maxPixels = 2.4e6;
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * pr * pr > maxPixels) pr = Math.sqrt(maxPixels / (w * h));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const c of this.holdout?.cams || []) { c.cam.aspect = w / h; c.cam.updateProjectionMatrix(); }
    this.pipeline.setSize(w, h, pr);
    if (this.house.dustMat) this.house.dustMat.uniforms.uPixelRatio.value = pr * this.pipeline.scale;
  }

  applySettings() {
    const s = this.settings;
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.pipeline.fx.uBrightness.value = s.brightness;
    this.pipeline.fx.uGrain.value = s.grain ? 0.065 : 0.0;
    this.player.headBob = s.headBob;
    const V = VOLUME_SCALE;
    Object.assign(this.audio.vol, { master: s.master * V.master, music: s.music * V.music, sfx: s.sfx * V.sfx, amb: s.amb * V.amb });
    this.input.binds = { ...s.keybinds };
    this.ui.refreshKeys(this.input);
    this.audio.applyVolumes();
    const sc = QUALITY[s.quality] ?? 1;
    if (sc !== this.pipeline.scale) { this.pipeline.scale = sc; this.resize(); }
  }

  // ================================================================ boot & menu
  bootClick() {
    if (this.state !== 'boot') return;
    this.state = 'loading';
    this.ui.bootLoading('Tuning the house…');
    setTimeout(() => {
      this.audio.init();
      this.applySettings();
      this.toMenu(true);
    }, 60);
  }

  setupMenuWorld() {
    this.chapter.start('start');
    this.chapter.timeline = [];
    this.house.doorFront.angle = 0; this.house.doorFront._apply();
    this.ui.setMenuState(this.menuInfo());
  }

  menuInfo() {
    const cp = this.save.cp;
    return { continueLabel: cp ? CHECKPOINTS[cp] : null, loreCount: LORE_ORDER.filter((k) => this.lore.has(k)).length, loreTotal: LORE_ORDER.length };
  }

  toMenu(first = false) {
    this.state = 'menu';
    this.paused = false;
    this.docOpen = false;
    this.struggle = null;
    this.input.exitLock();
    this.ui.hideAllScreens();
    this.ui.hud(false);
    this.ui.monitor(false);
    this.ui.clock(false);
    this.ui.tape(false);
    this.ui.struggle(false);
    this.ui.subs(null);
    this.ui.setPrompt(null);
    this.stopTape();
    this.holdout.end();
    this.pipeline.fx.uMonitor.value = 0;
    this.shared.uAmbient.value.w = 0;
    this.audio.setChase(0);
    this.audio.setHeart(60, 0);
    this.audio.setBreath(0);
    this.setupMenuWorld();
    this.ui.setMenuState(this.menuInfo());
    this.ui.show('menu', true);
    this.fadeTarget = 0;
    if (!this.menuMusic || !this.menuMusic.alive) this.menuMusic = this.audio.musicBox({ gain: 0.32, tempo: 58, wobble: 1.6 });
    if (first) this.audio.play('boom', { gain: 0.35, bus: 'music' });
  }

  menuAction(act) {
    if (act === 'new') { this.save.cp = null; this.persist(); this.startPrologue(); }
    else if (act === 'continue') { if (this.save.cp) this.beginPlay(this.save.cp); }
    else if (act === 'settings') this.openSheet('settings');
    else if (act === 'evidence') this.openSheet('evidence');
  }

  onMenuHover() {
    // the menu is sensitive: a soft ripple in the room behind it
    if (this.state !== 'menu') return;
    const c = this.house.hushChair;
    this.sound({ x: c.x - 1.2 + Math.random() * 2.4, z: c.z - 0.6 + Math.random() * 1.6, y: 0.4, radius: 2.2, strength: 0.5, source: 'world', color: PULSE.PLAYER, speed: 6 });
  }

  onMenuMouse(e) {
    if (this.state !== 'menu' || this.sheet) return;
    const now = performance.now();
    if (now - this.lastMenuPulse < 420) return;
    if (Math.abs(e.movementX) + Math.abs(e.movementY) < 6) return;
    this.lastMenuPulse = now;
    // ripple where the cursor points into the room
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const t = (0.02 - ray.ray.origin.y) / ray.ray.direction.y;
    const p = t > 0 && t < 12 ? ray.ray.at(t, new THREE.Vector3()) : ray.ray.at(4, new THREE.Vector3());
    p.x = Math.max(0.3, Math.min(6.3, p.x)); p.z = Math.max(7.2, Math.min(13.8, p.z));
    this.sound({ x: p.x, y: 0.05, z: p.z, radius: 1.6 + Math.random(), strength: 0.45, source: 'world', speed: 5, color: PULSE.PLAYER });
  }

  // ================================================================ sheets
  openSheet(name) {
    this.sheet = name;
    if (this.paused) this.ui.show('pause', false);
    if (this.state === 'menu') this.ui.show('menu', false);
    if (this.state === 'end') this.ui.show('end', false);
    if (name === 'settings') this.ui.renderSettings(this.settings, (k, v) => { this.settings[k] = v; saveSettings(this.settings); this.applySettings(); }, this.input);
    if (name === 'evidence') this.ui.renderEvidence(this.lore, (id) => this.playTape(id));
    this.ui.show(name, true);
  }
  closeSheet() {
    if (!this.sheet) return;
    this.ui.show(this.sheet, false);
    this.sheet = null;
    if (this.state === 'menu') { this.ui.setMenuState(this.menuInfo()); this.ui.show('menu', true); }
    if (this.state === 'end') this.ui.show('end', true);
    if (this.paused) this.ui.show('pause', true);
  }

  // ================================================================ prologue
  startPrologue() {
    this.state = 'prologue';
    this.ui.hideAllScreens();
    this.ui.prologueClear();
    this.ui.show('prologue', true);
    if (this.menuMusic) { this.menuMusic.stop(1.5); this.menuMusic = null; }
    this.proT = 0;
    this.proSkip = 0;
    this.proWait = false;
    this.proTapeDone = false;
    this.proEvents = [
      [1.2, () => this.ui.prologueLine('October, 2011.', true)],
      [4.2, () => this.ui.prologueLine('Fifteen years after my sister disappeared, a cassette came in the mail.')],
      [8.6, () => this.ui.prologueLine('No return address. Just my name, in handwriting I hadn’t seen since I was eight.')],
      [13.4, () => { this.ui.prologueClear(); this.ui.tapeOnly(true); this.playTape('tape_june', () => { this.proTapeDone = true; }, { collect: false }); }],
    ];
  }

  updatePrologue(dt) {
    this.proT += dt;
    while (this.proEvents.length && this.proT >= this.proEvents[0][0]) this.proEvents.shift()[1]();
    if (this.proWait) return;
    if (this.input.act('breath')) this.proSkip += dt; else this.proSkip = Math.max(0, this.proSkip - dt * 2);
    this.ui.skipProgress(this.proSkip / 1.2);
    if (this.proSkip > 1.2 || this.proTapeDone) {
      this.proWait = true;
      this.stopTape();
      this.ui.tapeOnly(false);
      this.ui.prologueClear();
      this.ui.skipProgress(0);
      this.ui.prologueLine('I drove back to Harrow Falls that night.', true);
      setTimeout(() => { if (this.state === 'prologue') this.ui.prologueLine('Click to go inside.'); }, 1800);
      this.proEvents = [];
    }
  }

  prologueClick() {
    if (this.state === 'prologue' && this.proWait && this.proT > 0.5) {
      this.proWait = false;
      this.beginPlay('start');
    }
  }

  // ================================================================ play
  beginPlay(cp) {
    this.ui.hideAllScreens();
    this.ui.tapeOnly(false);
    this.stopTape();
    if (this.menuMusic) { this.menuMusic.stop(1.0); this.menuMusic = null; }
    this.fadeV = 1; this.fadeTarget = 0;
    this.stats = { start: this.time, heard: 0, thrown: 0, hid: 0, repelled: 0, survived: false };
    this.escapes = 1;
    this.state = 'play';
    this.paused = false;
    this.ui.hud(true);
    this.chapter.start(cp);
    if (cp !== 'holdout') this.checkpoint(cp, true);
    this.input.requestLock();
  }

  checkpoint(cp, silent = false) {
    this.save.cp = cp;
    this.persist();
    this.escapes = 1;
    if (!silent && cp !== 'start') setTimeout(() => this.ui.message('Checkpoint', 1800), 2600);
  }
  persist() {
    this.save.lore = [...this.lore];
    writeSave(this.save);
  }

  onLockChange(locked) {
    if (!locked && (this.state === 'play' || this.state === 'holdout') && !this.paused && !this.docOpen && !this.dev) this.pause(true);
  }

  onKey(e) {
    if (this.state === 'boot') return;
    const k = e.code;
    if (k === 'Escape') {
      if (this.docOpen) { this.closeDoc(); return; }
      if (this.sheet) { this.audio.play('ui_back', { bus: 'ui' }); this.closeSheet(); return; }
      if ((this.state === 'play' || this.state === 'holdout') && this.dev) this.pause(!this.paused);
      return;
    }
    if (this.docOpen) {
      if (this.input.is('interact', k)) { this.closeDoc(); return; }
      if (this.input.is('transcript', k)) { this.ui.toggleTranscript(); this.audio.play('paper', { gain: 0.4, bus: 'ui' }); }
      return;
    }
    if (this.state === 'play' && !this.paused && this.input.is('evidence', k) && this.player.mode === 'walk') {
      e.preventDefault();
      this.pause(true);
      this.openSheet('evidence');
    }
  }

  pause(on) {
    if (on === this.paused) return;
    this.paused = on;
    if (on) {
      this.ui.setPauseInfo({
        objective: OBJECTIVES[this.chapter.objective],
        room: this.house.roomAt(this.player.pos.x, this.player.pos.z)?.name,
        lore: `${LORE_ORDER.filter((k) => this.lore.has(k)).length} of ${LORE_ORDER.length} recovered`,
      });
      this.ui.show('pause', true);
      this.audio.play('ui_back', { bus: 'ui' });
      this.input.exitLock();
    } else {
      this.closeSheet();
      this.ui.show('pause', false);
      this.input.requestLock();
    }
  }

  pauseAction(act) {
    if (act === 'resume') this.pause(false);
    else if (act === 'settings') this.openSheet('settings');
    else if (act === 'evidence') this.openSheet('evidence');
    else if (act === 'restart') { this.ui.show('pause', false); this.paused = false; this.restartCheckpoint(); }
    else if (act === 'quit') { this.ui.show('pause', false); this.paused = false; this.toMenu(); }
  }

  restartCheckpoint() {
    const cp = this.save.cp || 'start';
    this.ui.hideAllScreens();
    this.ui.struggle(false);
    this.struggle = null;
    this.holdout.end();
    this.stopTape();
    this.fadeV = 1; this.fadeTarget = 0;
    this.state = 'play';
    this.ui.hud(true);
    this.chapter.start(cp);
    this.escapes = 1;
    this.input.requestLock();
  }

  deathAction(act) {
    if (act === 'retry') this.restartCheckpoint();
    else this.toMenu();
  }
  endAction(act) {
    if (act === 'evidence') this.openSheet('evidence');
    else this.toMenu();
  }

  // ================================================================ sound & noise
  sound(o) {
    if (o.visual !== false) {
      this.pulses.emit({
        x: o.x, y: o.y ?? 0.05, z: o.z,
        radius: o.radius, strength: o.strength ?? 1, speed: o.speed ?? 11,
        color: o.color ?? PULSE.PLAYER, linger: o.linger, euclid: o.euclid,
      });
    }
    if (o.source === 'player') this.noiseLevel = Math.max(this.noiseLevel, Math.min(1, o.radius / 9));
    this.emit('sound', o);
  }

  onFootstep(p, state) {
    const surf = p.surface();
    const mul = SURF_MUL[surf] ?? 1;
    const radius = MOVE[state].noise * mul;
    this.sound({ x: p.pos.x, y: 0.05, z: p.pos.z, radius: Math.max(0.9, radius), strength: 0.85, kind: 'step', source: 'player' });
    const name = { carpet: 'step_carpet', rug: 'step_rug', wood: 'step_wood', tile: 'step_tile', glass: 'step_glass', grass: 'step_grass' }[surf] || 'step_wood';
    const g = (state === 'sprint' ? 1.0 : state === 'crouch' ? 0.35 : 0.7) * Math.min(1.2, mul + 0.2);
    this.audio.play(name, { gain: g, jitter: 0.12, reverb: 0.18 });
    if (surf === 'glass' && state !== 'crouch') this.audio.play('step_glass', { gain: 0.5, delay: 0.05 });
    if (this.house.isCreaky(p.pos.x, p.pos.z)) {
      const soft = state === 'crouch';
      const x = p.pos.x, z = p.pos.z;
      setTimeout(() => {
        if (this.state !== 'play') return;
        this.audio.play('creak_floor', { pos: { x, y: 0.05, z }, gain: soft ? 0.3 : 0.9 });
        this.sound({ x, y: 0.05, z, radius: soft ? 2.0 : 7.2, strength: 0.9, kind: 'creak', source: 'player' });
      }, 260 + Math.random() * 120);
    }
  }

  knock() {
    if (this.knockCool > 0) return;
    this.knockCool = 0.6;
    const pl = this.player;
    const f = pl.forward();
    const e = pl.eye;
    // knock on whatever is in front, else on your thigh
    const ray = new THREE.Raycaster(e.clone(), f.clone().normalize(), 0.05, 1.4);
    const hits = ray.intersectObjects(this.house.meshes, false);
    const p = hits.length ? hits[0].point : new THREE.Vector3(pl.pos.x, 0.8, pl.pos.z);
    this.audio.play('knock', { pos: { x: p.x, y: p.y, z: p.z }, gain: hits.length ? 0.9 : 0.5, jitter: 0.1 });
    this.sound({ x: p.x, y: p.y, z: p.z, radius: hits.length ? 6 : 4.2, strength: 1, source: 'player', kind: 'knock' });
  }

  // ================================================================ docs & tapes
  collectLore(id) {
    if (this.lore.has(id)) return false;
    this.lore.add(id);
    this.persist();
    return true;
  }
  collectNotice(text) { this.ui.message(text, 2200); }

  openDoc(id) {
    const isNew = this.collectLore(id);
    this.docOpen = true;
    this.ui.openDoc(id);
    this.ui.setPrompt(null);
    this.audio.play('paper', { gain: 0.7, bus: 'ui' });
    if (isNew) this.newEvidence = true;
  }
  closeDoc() {
    this.docOpen = false;
    this.ui.closeDoc();
    this.audio.play('paper', { gain: 0.45, bus: 'ui' });
    if (this.newEvidence) { this.newEvidence = false; this.ui.message('Added to evidence · ' + this.input.label('evidence'), 2400); }
  }

  playTape(id, onEnd, opts = {}) {
    const t = TAPES[id];
    if (!t) return;
    this.stopTape();
    if (opts.collect !== false && this.collectLore(id)) this.ui.message('Added to evidence · ' + this.input.label('evidence'), 2400);
    this.tape = { id, info: t, line: -1, t: 0, next: t.tv ? 0.4 : 1.6, onEnd };
    if (!t.tv) {
      this.audio.play('tape_click', { gain: 0.7, bus: 'ui' });
      this.tapeHiss = this.audio.loop('tape_hiss', { gain: 0.16, bus: 'ui', fadeIn: 0.4 });
    } else {
      this.tapeJingle = this.audio.musicBox({ gain: 0.22, tempo: 96, loops: 1, radio: true, pos: this.house.tvScreen, bus: 'sfx' });
    }
    this.ui.tape(true, t);
    // replaying from the evidence screen: keep the tape visible above menus
    this.ui.tapeFloat(this.state === 'menu' || this.state === 'end' || this.paused);
  }
  stopTape() {
    if (!this.tape) return;
    this.tape = null;
    if (this.tapeHiss) { this.tapeHiss.stop(0.2); this.tapeHiss = null; }
    if (this.tapeJingle) { this.tapeJingle.stop(0.3); this.tapeJingle = null; }
    this.ui.tape(false);
    this.ui.subs(null);
    this.ui.tapeFloat(false);
  }
  updateTape(dt) {
    const tp = this.tape;
    if (!tp) return;
    tp.t += dt;
    this.ui.tapeTime(tp.t);
    if (tp.t >= tp.next) {
      tp.line++;
      if (tp.line >= tp.info.lines.length) {
        if (!tp.info.tv) this.audio.play('tape_click', { gain: 0.6, bus: 'ui' });
        const cb = tp.onEnd;
        this.stopTape();
        if (cb) cb();
        return;
      }
      const [who, line, dur] = tp.info.lines[tp.line];
      this.ui.subs(who, line);
      tp.next = tp.t + dur;
    }
  }
  subtitle(who, line, dur = 3, small = false) {
    if (this.tape) return; // tapes take priority
    this.ui.subs(who, line, small);
    this.subTimer = dur;
  }

  // ================================================================ hiding
  enterHide(spot) {
    const pl = this.player;
    this.throwables.dropHeld();
    pl.hidden = spot;
    pl.mode = 'hide';
    pl.breath = 1;
    pl.breathHeld = false;
    this.hush.rememberHide(spot);
    this.stats.hid++;
    pl.pos.set(spot.x, 0, spot.z);
    // look through the slats of one door, not at the stile between them
    if (spot.id === 'wardrobe') pl.pos.z += 0.26;
    if (spot.id === 'linen') pl.pos.z -= 0.26;
    if (spot.under) { pl.pos.set(3.0, 0, 1.55); pl.fixedEyeY = 0.2; }
    else pl.fixedEyeY = spot.eyeY;
    const faceYaw = spot.face === Math.PI / 2 ? -Math.PI / 2 : spot.face === -Math.PI / 2 ? Math.PI / 2 : Math.PI;
    pl.yaw = faceYaw; pl.pitch = spot.under ? 0.05 : -0.05;
    pl.lookLimits = { yawCenter: faceYaw, yawMin: -0.65, yawMax: 0.65, pitchMin: -0.4, pitchMax: 0.35 };
    this.audio.play(spot.under ? 'pickup' : 'door_creak_fast', { pos: { x: spot.x, y: 1, z: spot.z }, gain: 0.45, rate: 1.3 });
    this.sound({ x: spot.out.x, z: spot.out.z, y: 0.5, radius: 3.0, strength: 0.6, source: 'player', kind: 'hide', spot });
  }
  leaveHide() {
    const pl = this.player;
    const spot = pl.hidden;
    if (!spot) return;
    pl.hidden = null;
    pl.mode = 'walk';
    pl.lookLimits = null;
    pl.fixedEyeY = null;
    pl.breathHeld = false;
    pl.teleport(spot.out.x, spot.out.z, pl.yaw, 0);
    this.audio.play(spot.under ? 'pickup' : 'door_creak_fast', { pos: { x: spot.x, y: 1, z: spot.z }, gain: 0.4, rate: 1.2 });
    this.sound({ x: spot.out.x, z: spot.out.z, y: 0.5, radius: 2.6, strength: 0.6, source: 'player', kind: 'hide' });
  }

  // ================================================================ grabbed
  onHushGrab() {
    const pl = this.player;
    if (pl.hidden) {
      const s = pl.hidden;
      pl.hidden = null; pl.lookLimits = null; pl.fixedEyeY = null;
      pl.teleport(s.out.x, s.out.z, pl.yaw, 0);
    }
    this.throwables.dropHeld();
    pl.mode = 'grabbed';
    const h = this.hush;
    this.audio.play('jumpscare', { gain: 1.0, reverb: 0.2 });
    this.audio.play('hush_wet', { gain: 0.8 });
    this.redFlash = 1;
    pl.shake = 1.4;
    this.fear = 1;
    // he is right in your face
    const dx = pl.pos.x - h.x, dz = pl.pos.z - h.z, dd = Math.hypot(dx, dz) || 1;
    if (dd > 0.9) { h.x = pl.pos.x - (dx / dd) * 0.9; h.z = pl.pos.z - (dz / dd) * 0.9; }
    h.heading = Math.atan2(pl.pos.x - h.x, pl.pos.z - h.z);
    h._sync();
    pl.forcedLook = { x: h.x, y: 1.95, z: h.z, speed: 14 };
    h.m.pose.jaw = 1;
    this.ui.clearHint();
    this.ui.setPrompt(null);
    const canEscape = this.escapes > 0;
    this.startStruggle(canEscape, () => {
      this.escapes--;
      h.m.pose.jaw = 0;
      h.stun();
      pl.forcedLook = null;
      pl.mode = 'walk';
      pl.stamina = 1;
      const dx = pl.pos.x - h.x, dz = pl.pos.z - h.z, d = Math.hypot(dx, dz) || 1;
      pl.vel.set((dx / d) * 5, (dz / d) * 5);
      this.audio.play('gasp', { gain: 0.9 });
      this.ui.hint('Run.', 2200, true);
    }, () => this.die());
  }

  holdoutCaught(canEscape) {
    const pl = this.player, h = this.hush;
    this.audio.play('jumpscare', { gain: 1.0, reverb: 0.2 });
    this.redFlash = 1;
    pl.shake = 1.4;
    pl.forcedLook = { x: h.x, y: 1.9, z: h.z, speed: 14 };
    h.m.pose.jaw = 1; h.m.pose.grab = 1;
    if (this.holdout.monitorUp) this.holdout.toggleMonitor();
    this.startStruggle(canEscape, () => {
      pl.forcedLook = null;
      h.m.pose.jaw = 0; h.m.pose.grab = 0;
      this.audio.play('gasp', { gain: 0.9 });
      this.subtitle('', 'You scramble under the bed. He loses you in the dark.', 3.4, true);
      this.holdout.afterEscape();
      pl.yaw = this.holdout.centerYaw();
    }, () => this.die(true));
  }

  startStruggle(canEscape, onWin, onLose) {
    this.struggle = { t: 0, p: 0, next: 'A', canEscape, onWin, onLose, dur: canEscape ? 3.4 : 1.2 };
  }

  updateStruggle(dt) {
    const s = this.struggle;
    s.t += dt;
    if (s.t > 0.55 && s.canEscape) {
      this.ui.struggle(true, s.p, s.next);
      if (this.input.actHit(s.next === 'A' ? 'left' : 'right')) {
        s.p += 0.085;
        s.next = s.next === 'A' ? 'D' : 'A';
        this.player.shake = 0.5;
        this.audio.play('hush_wet', { gain: 0.25, rate: 1.4 });
      }
      s.p = Math.max(0, s.p - dt * 0.2);
    }
    this.hush.m.pose.jaw = 0.8 + Math.sin(this.time * 30) * 0.2;
    if (s.canEscape && s.p >= 1) {
      this.struggle = null;
      this.ui.struggle(false);
      this.redFlash = 0.4;
      s.onWin();
    } else if (s.t > s.dur) {
      this.struggle = null;
      this.ui.struggle(false);
      s.onLose();
    }
  }

  die(holdout = false) {
    const pl = this.player;
    this.state = 'dead';
    pl.mode = 'locked';
    this.redFlash = 1;
    this.audio.play('jumpscare', { gain: 1, rate: 0.85 });
    this.audio.setChase(0);
    this.holdout.end();
    this.stopTape();
    this.ui.setPrompt(null);
    this.ui.hud(false);
    setTimeout(() => {
      this.fadeTarget = 1;
      this.input.exitLock();
      const pool = holdout
        ? [['Not until morning.', 'The door was never strong enough. Neither were you.']]
        : [['He heard you.', 'The humming starts again, somewhere in the house.'], ['It found you.', 'Mr. Hush is sewn shut. He never needed to see you.'], ['Too loud.', 'In this house, every sound is a confession.']];
      const [t, s] = pool[Math.floor(Math.random() * pool.length)];
      this.ui.death(CHECKPOINTS[this.save.cp || 'start'], t, s);
    }, 900);
  }

  // ================================================================ holdout
  beginHoldoutSequence() {
    const pl = this.player;
    this.state = 'cutscene';
    pl.mode = 'locked';
    this.ui.setPrompt(null);
    this.audio.play('static', { gain: 0.3 });
    const H = this.house;
    this.cutT = 0;
    this.cutEvents = [
      [0.6, () => this.ui.subs('Baby monitor', '[static]')],
      [2.0, () => { this.ui.subs('June', 'Ellis…?'); this.audio.play('breath_in', { gain: 0.4, rate: 1.4 }); }],
      [4.0, () => this.ui.subs('June', 'He’s coming up the hall.')],
      [6.4, () => this.ui.subs('June', 'Don’t let him in. Don’t let him hear you.')],
      [8.6, () => {
        this.ui.subs(null);
        const d = H.doorJune;
        if (!d.isClosed) d.setTarget(false, 6);
        this.audio.play('door_slam', { pos: { x: 12, y: 1.2, z: 5 }, gain: 1 });
        this.sound({ x: 12, z: 4.5, y: 1, radius: 7, strength: 1, source: 'world' });
        pl.shake = 0.8;
      }],
      [10.0, () => this.clockChime(3)],
      [13.5, () => { this.fadeTarget = 1; }],
      [15.0, () => { this.startHoldout(); this.fadeTarget = 0; }],
    ];
  }

  startHoldout() {
    this.state = 'holdout';
    this.ui.hud(true);
    this.chapter.flags.holdout = true;
    this.save.cp = 'holdout'; this.persist();
    this.escapes = 1;
    this.holdout.begin();
    this.ui.card('3:00 AM', 'Until dawn', 3800);
    setTimeout(() => { if (this.state === 'holdout') this.ui.hint('<span><kbd>Space</kbd>Baby monitor</span><span><kbd>1 2 3</kbd>Rooms</span><span><kbd>L</kbd>Lullaby lure</span><span><kbd>Hold mouse</kbd>Hold the door or shutters</span>', 9000); }, 4200);
  }

  clockChime(n) {
    for (let i = 0; i < n; i++) this.audio.play('chime', { pos: this.house.clockPos, gain: 0.8, delay: i * 2.1, reverb: 0.5, ref: 2, rolloff: 0.8 });
  }

  birdsong() {
    const a = this.audio;
    if (!a.ready) return;
    const ctx = a.ctx;
    for (let i = 0; i < 14; i++) {
      const t0 = ctx.currentTime + 0.5 + Math.random() * 9;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = 2800 + Math.random() * 1800;
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * (1.2 + Math.random() * 0.5), t0 + 0.08);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + 0.16);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.025, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      const p = a._panner({ x: 18 + Math.random() * 3, y: 3, z: Math.random() * 6 }, 3, 1);
      o.connect(g).connect(p).connect(a.bus.amb);
      o.start(t0); o.stop(t0 + 0.25);
    }
  }

  chapterComplete() {
    this.state = 'end';
    this.player.mode = 'locked';
    this.save.cp = null;
    this.save.completed = true;
    this.persist();
    this.input.exitLock();
    this.ui.hud(false);
    this.fadeTarget = 1;
    const mins = Math.max(1, Math.round((this.time - this.stats.start) / 60));
    setTimeout(() => {
      this.fadeTarget = 0;
      this.ui.end([
        [`${mins} min`, 'In the house'],
        [`${LORE_ORDER.filter((k) => this.lore.has(k)).length}/${LORE_ORDER.length}`, 'Evidence'],
        [`${this.stats.heard}`, 'Times heard'],
        [`${this.stats.repelled}`, 'Times kept out'],
      ]);
      this.audio.musicBox({ gain: 0.3, tempo: 54, loops: 2 });
    }, 2200);
  }

  // ================================================================ lightning
  lightning(strength = 0.7, scripted = false) {
    const seq = [[0, strength], [0.07, 0.05], [0.16, strength * 0.7], [0.3, 0.0], [0.42, strength * 0.35]];
    for (const [t, v] of seq) setTimeout(() => { this.flash = Math.max(this.flash, v); }, t * 1000);
    const delay = scripted ? 0.5 : 0.8 + Math.random() * 1.8;
    this.audio.play('thunder', { gain: 0.55 + strength * 0.4, delay, bus: 'amb', reverb: 0.3 });
  }

  // ================================================================ loop
  start() {
    if (this.manual) return;
    const loop = (t) => {
      requestAnimationFrame(loop);
      this.timer.update(t);
      const dt = Math.min(0.05, this.timer.getDelta());
      this.update(dt);
      this.render(dt);
      this.input.endFrame();
    };
    requestAnimationFrame(loop);
    this.canvas.addEventListener('click', () => {
      if ((this.state === 'play' || this.state === 'holdout') && !this.paused && !this.docOpen) this.input.requestLock();
    });
    window.addEventListener('click', () => this.prologueClick());
  }

  simulate(seconds, dt = 1 / 30) {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) { this.update(dt); this.input.endFrame(); }
  }
  renderFrame() {
    this.render(1 / 30);
    return this.canvas.toDataURL('image/png');
  }

  update(dt) {
    this.time += dt;
    this.shared.uTime.value = this.time;
    this.knockCool = (this.knockCool || 0) - dt;
    const m = this.input.consumeMouse();
    this.updateTape(dt);
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0 && !this.tape) this.ui.subs(null); }

    const st = this.state;
    if (st === 'prologue') this.updatePrologue(dt);

    const sim = !this.paused && !this.docOpen && ['play', 'holdout', 'cutscene', 'dead', 'menu'].includes(st);
    if (sim) {
      if (st === 'play' || st === 'holdout' || st === 'cutscene') {
        if (this.player.mode !== 'grabbed' && this.player.mode !== 'locked') this.player.look(m.dx, m.dy, this.settings.sensitivity, this.settings.invertY);
        this.player.update(dt, this.input, this.house.colliders, this.house.doors);
        this.pushFromHush();
        if (st === 'play') this.updatePlayActions(dt);
        if (st === 'holdout') this.holdout.update(dt);
        if (st === 'play') this.interactions.update(dt);
        if (st === 'cutscene') this.ui.setPrompt(null);
      } else if (st === 'menu') {
        this.updateMenuCamera(dt);
      }
      if (st === 'cutscene' && this.cutEvents) {
        this.cutT += dt;
        while (this.cutEvents.length && this.cutT >= this.cutEvents[0][0]) this.cutEvents.shift()[1]();
      }
      this.throwables.update(dt, this.input);
      this.hush.update(dt);
      this.chapter.update(dt);
      for (const d of this.house.doors) if (d.update(dt)) this.house.field.setDoorClosed(d.id, d.isClosed);
      if (this.struggle) this.updateStruggle(dt);
      this.updateFear(dt);
    }
    this.updateFX(dt);
    this.pulses.update(dt);
    this.ui.hudDim(this.paused || this.docOpen || !!this.sheet);

    if (this.audio.ready) {
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
      this.audio.setListener(this.camera.position, f);
      this.audio.updateBody();
      this.audio.updateMusic();
      this.occT = (this.occT || 0) - dt;
      if (this.occT <= 0) { this.occT = 0.2; this.audio.updateOcclusion(); }
    }

    if (this.state === 'play' || this.state === 'holdout') {
      this.noiseLevel *= Math.exp(-dt * 3.2);
      const h = this.hush;
      const label = h.state === 'hunt' ? 'Heard' : h.state === 'investigate' || h.state === 'search' || h.state === 'check' ? 'Listening' : this.noiseLevel > 0.55 ? 'Loud' : this.noiseLevel > 0.18 ? 'Audible' : 'Quiet';
      this.ui.noise(this.noiseLevel, label);
      this.ui.stamina(this.player.stamina);
    }
  }

  updatePlayActions(dt) {
    const pl = this.player, input = this.input;
    if (pl.mode === 'walk' && input.actHit('knock')) this.knock();
    if (pl.mode === 'hide') {
      const holding = input.act('breath') && pl.breath > 0;
      if (holding && !pl.breathHeld) this.audio.play('breath_in', { gain: 0.35, rate: 1.2 });
      if (!holding && pl.breathHeld) {
        this.audio.play('breath_out', { gain: pl.breath <= 0.02 ? 0.8 : 0.35, rate: 1.1 });
        if (pl.breath <= 0.02) {
          this.audio.play('gasp', { gain: 0.8 });
          this.sound({ x: pl.pos.x, z: pl.pos.z, y: 1, radius: 4.5, strength: 0.7, source: 'player', kind: 'gasp' });
        }
      }
      pl.breathHeld = holding;
      pl.breath = holding ? Math.max(0, pl.breath - dt / 6.5) : Math.min(1, pl.breath + dt / 3.5);
      this.ui.breath(true, pl.breath, holding);
    } else this.ui.breath(false);
    if (pl.mode === 'walk' && pl.stamina < 0.25) {
      this.exhaustT -= dt;
      if (this.exhaustT <= 0) {
        this.exhaustT = 1.5;
        this.sound({ x: pl.pos.x, z: pl.pos.z, y: 1.4, radius: 2.6, strength: 0.4, source: 'player', kind: 'breath', visual: false });
      }
    }
  }

  pushFromHush() {
    const pl = this.player, h = this.hush;
    if (pl.mode !== 'walk' || h.state === 'dormant') return;
    const dx = pl.pos.x - h.x, dz = pl.pos.z - h.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-4) { pl.pos.x = h.x + (dx / d) * 0.75; pl.pos.z = h.z + (dz / d) * 0.75; }
  }

  updateFear(dt) {
    const h = this.hush, pl = this.player;
    const d = Math.hypot(h.x - pl.pos.x, h.z - pl.pos.z);
    let target = 0;
    const s = h.state;
    if (s === 'hunt') target = 0.55 + 0.45 * (1 - Math.min(1, d / 12));
    else if (s === 'investigate' || s === 'search' || s === 'check') target = 0.3 + 0.5 * (1 - Math.min(1, d / 8));
    else if (s === 'wander') target = 0.55 * (1 - Math.min(1, d / 7));
    else if (s === 'dormant') target = d < 3.2 ? 0.25 : 0;
    else if (s === 'holdout') {
      const mode = this.holdout.mode;
      target = mode === 'atDoor' || mode === 'atWindow' ? 0.85 : mode === 'breach' ? 1 : 0.5 * (1 - Math.min(1, d / 9)) + 0.12;
    } else if (s === 'grab') target = 1;
    if (this.state === 'menu' || this.state === 'dead' || this.holdout.dawn) target = 0;
    const k = target > this.fear ? 1.6 : 0.22;
    this.fear += (target - this.fear) * Math.min(1, dt * k);
    pl.fear = this.fear;
    const bpm = 60 + this.fear * 88;
    this.beatPhase = (this.beatPhase + dt * bpm / 60) % 1;
    this.audio.setHeart(bpm, smooth(0.18, 0.9, this.fear) * 0.85);
    this.audio.setBreath(Math.max(this.fear * 0.35, (1 - pl.stamina) * 0.55) * (pl.breathHeld ? 0 : 1), 1 + this.fear * 0.8 + (1 - pl.stamina));
    this.audio.setChase(s === 'hunt' && d < 16 && this.state === 'play' ? 1 : 0);
  }

  updateMenuCamera(dt) {
    this.menuCamT += dt;
    const t = this.menuCamT;
    const cam = this.camera;
    cam.position.set(7.35 + Math.sin(t * 0.07) * 0.15, 1.5 + Math.sin(t * 0.11) * 0.04, 11.6 + Math.sin(t * 0.05) * 0.1);
    cam.lookAt(3.2 + Math.sin(t * 0.09) * 0.1, 1.0, 10.15);
    this.player.eye.copy(cam.position);
  }

  updateFX(dt) {
    const fx = this.pipeline.fx;
    this.fadeV += (this.fadeTarget - this.fadeV) * Math.min(1, dt * 1.6);
    fx.uFade.value = this.fadeV;
    this.flash *= Math.exp(-dt * 7);
    this.shared.uFlash.value.set(0.62, 0.72, 1.0, this.flash);
    this.redFlash *= Math.exp(-dt * 2.2);
    fx.uRed.value = this.redFlash * 0.45;
    fx.uFear.value = this.fear;
    fx.uBeat.value = Math.exp(-this.beatPhase * 7);
    fx.uCA.value = 0.0028 + this.fear * 0.002 + this.redFlash * 0.01;
    fx.uVignette.value = 0.85 + this.fear * 0.15;
    if (this.player.mode === 'grabbed' || this.state === 'dead') this.player.shake = Math.max(this.player.shake, 0.4);
    const e = this.player.eye;
    const nearOn = this.state === 'menu' ? 0.0 : 0.05;
    this.shared.uPlayer.value.set(e.x, e.y - 0.3, e.z, nearOn);
  }

  render(dt) {
    const ho = this.holdout;
    if (ho.active && ho.monitorUp) {
      const amb = this.shared.uAmbient.value;
      const saved = amb.clone();
      const savedP = this.shared.uPlayer.value.w;
      amb.set(0.82, 1.0, 0.86, ho.battery > 0 ? 0.24 : 0.0);
      this.shared.uPlayer.value.w = 0;
      this.throwables.viewAnchor.visible = false;
      this.pipeline.render(this.scene, ho.feedCamera(), this.time, dt);
      amb.copy(saved);
      this.shared.uPlayer.value.w = savedP;
      this.throwables.viewAnchor.visible = true;
      return;
    }
    this.pipeline.render(this.scene, this.camera, this.time, dt);
  }
}
