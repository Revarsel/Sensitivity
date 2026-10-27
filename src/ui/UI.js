import '../styles/ui.css';
import { DOCS, TAPES, LORE_ORDER } from '../game/Lore.js';
import { drawingTexture } from '../world/Textures.js';
import { ACTIONS, defaultBinds, keyLabel } from '../core/Keybinds.js';

// thin line glyphs for the inventory (stroke = currentColor)
const ICONS = {
  key: '<svg viewBox="0 0 34 16" aria-hidden="true"><circle cx="7" cy="8" r="4.6"/><circle cx="7" cy="8" r="1.4"/><path d="M11.6 8H31M25.5 8v4.2M29 8v3"/></svg>',
  battery: '<svg viewBox="0 0 34 16" aria-hidden="true"><rect x="3" y="3.5" width="24" height="9" rx="1"/><path d="M27 6.2h2.6v3.6H27M8 8h4.4M10.2 5.8v4.4M18.5 8h4"/></svg>',
};

const HEADPHONES = `<svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke="#d8d1c2" stroke-width="1.2" stroke-linecap="round"><path d="M4 19V16a13 13 0 0 1 26 0v3"/><rect x="2.5" y="18" width="6" height="10" rx="1.5"/><rect x="25.5" y="18" width="6" height="10" rx="1.5"/><path d="M12 22c1.2-1.3 1.2-3.7 0-5M22 22c-1.2-1.3-1.2-3.7 0-5" stroke-opacity=".5"/></svg>`;

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi'];

function cassetteSVG(label) {
  const reel = (cx) => `<g class="reel"><circle cx="${cx}" cy="58" r="15" fill="#151413" stroke="#3b3934" stroke-width="1.5"/>
    ${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="${cx - 1.6}" y="${58 - 13}" width="3.2" height="6" fill="#d8d1c2" opacity=".75" transform="rotate(${a} ${cx} 58)"/>`).join('')}
    <circle cx="${cx}" cy="58" r="5" fill="#0b0b0a" stroke="#6b675d"/></g>`;
  return `<svg viewBox="0 0 210 132" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2a27"/><stop offset="1" stop-color="#171615"/></linearGradient></defs>
  <rect x="1" y="1" width="208" height="130" rx="7" fill="url(#sh)" stroke="#45423b"/>
  <rect x="12" y="10" width="186" height="80" rx="3" fill="#d9cfb7"/>
  <rect x="12" y="10" width="186" height="14" fill="#8e1b16"/>
  <text x="20" y="21" font-family="IBM Plex Mono" font-size="7.5" letter-spacing="2" fill="#efe6d2">A</text>
  <text x="105" y="40" text-anchor="middle" font-family="Special Elite" font-size="10.5" fill="#2a241c" class="tlabel">${label}</text>
  <line x1="22" y1="47" x2="188" y2="47" stroke="#2a241c" stroke-opacity=".25"/>
  <rect x="58" y="44" width="94" height="28" rx="14" fill="#0e0d0c" stroke="#5a564d"/>
  ${reel(74)}${reel(136)}
  <rect x="88" y="52" width="34" height="12" fill="#3a2a20" opacity=".8"/>
  <path d="M40 131 L52 104 H158 L170 131" fill="#1f1e1c" stroke="#45423b"/>
  ${[66, 92, 118, 144].map((x) => `<circle cx="${x}" cy="118" r="3" fill="#0b0b0a"/>`).join('')}
  ${[[9, 9], [201, 9], [9, 123], [201, 123]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#0b0b0a" stroke="#55524a" stroke-width=".8"/>`).join('')}
  </svg>`;
}

// typographic quotes for text nodes (the old-style serif renders straight quotes poorly)
function smartQuotes(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    n.nodeValue = n.nodeValue
      .replace(/(^|[\s(\[\u2014])"/g, '$1\u201C').replace(/"/g, '\u201D')
      .replace(/(^|[\s(\[\u2014])'/g, '$1\u2018').replace(/'/g, '\u2019');
  }
}

export class UI {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.timers = {};
    this.build();
  }

  el(id) { return this.root.querySelector('#' + id); }

  build() {
    this.root.innerHTML = `
<section id="boot" class="screen on instant grain cursor-ring">
  <div class="wrap">
    <span class="label"><span class="dash"></span>Sensitivity &middot; Chapter One</span>
    <p class="warn">This game contains blood, body horror, the disappearance of a child, and sudden loud sounds. <em>It is meant to be played in the dark.</em></p>
    <div class="phones">${HEADPHONES}<span>Sound is the only light you have. Headphones are strongly recommended.</span></div>
    <div class="go">Click anywhere to begin</div>
  </div>
</section>

<section id="menu" class="screen grain cursor-ring">
  <div class="col">
    <span class="label chapter"><span class="dash"></span>Chapter One &middot; The House</span>
    <h1 id="title">${'Sensitivity'.split('').map((c) => `<span>${c}</span>`).join('')}</h1>
    <p class="tag">Everything is <b>listening</b>.</p>
    <ul class="menu-list" id="menu-list">
      <li><button data-act="new"><span class="num">i.</span><span class="rule"></span>Begin<span class="sub">A new night</span></button></li>
      <li><button data-act="continue" id="btn-continue"><span class="num">ii.</span><span class="rule"></span>Continue<span class="sub" id="continue-sub"></span></button></li>
      <li><button data-act="evidence"><span class="num">iii.</span><span class="rule"></span>Evidence<span class="sub" id="evidence-sub"></span></button></li>
      <li><button data-act="settings"><span class="num">iv.</span><span class="rule"></span>Settings</button></li>
    </ul>
  </div>
  <div class="foot">
    <div class="hp">${HEADPHONES.replace('width="34" height="30"', 'width="22" height="20"')}<span>Best with headphones, in the dark</span></div>
    <div class="ver">v0.1 &middot; Harrow Falls, 2011</div>
  </div>
</section>

<section id="prologue" class="screen">
  <div class="lines" id="pro-lines"></div>
  <div class="skip">Hold <kbd style="margin:0 10px" data-bind="breath">Space</kbd> to skip<i><b id="skipbar"></b></i></div>
</section>

<section id="pause" class="screen sheet grain cursor-ring">
  <div class="inner">
    <div class="left">
      <span class="label"><span class="dash"></span>Paused</span>
      <h2>Hold still.</h2>
      <ul class="menu-list" id="pause-list">
        <li><button data-act="resume"><span class="num">i.</span><span class="rule"></span>Resume</button></li>
        <li><button data-act="evidence"><span class="num">ii.</span><span class="rule"></span>Evidence</button></li>
        <li><button data-act="settings"><span class="num">iii.</span><span class="rule"></span>Settings</button></li>
        <li><button data-act="restart"><span class="num">iv.</span><span class="rule"></span>Restart checkpoint</button></li>
        <li><button data-act="quit"><span class="num">v.</span><span class="rule"></span>Quit to menu</button></li>
      </ul>
    </div>
    <div class="right">
      <span class="label">Objective</span>
      <p id="pause-obj"></p>
      <span class="label">Location</span>
      <p id="pause-room"></p>
      <span class="label">Evidence</span>
      <p class="small" id="pause-lore"></p>
      <span class="label">Controls</span>
      <div class="keyref" id="pause-keys"></div>
    </div>
  </div>
</section>

<section id="settings" class="screen sheet grain cursor-ring">
  <div class="inner">
    <span class="label"><span class="dash"></span>Settings</span>
    <h2>Adjust the dark.</h2>
    <button class="text-btn back" data-act="close">Back &middot; Esc</button>
    <div class="tabs" id="settings-tabs"><button data-tab="general" class="sel">General</button><button data-tab="controls">Controls</button></div>
    <div class="settings-grid" id="settings-grid"></div>
    <div class="controls-pane" id="controls-pane"></div>
  </div>
</section>

<section id="evidence" class="screen sheet grain cursor-ring">
  <div class="inner">
    <span class="label"><span class="dash"></span>Evidence</span>
    <h2>What the house kept.</h2>
    <div class="count" id="ev-count"></div>
    <button class="text-btn back" data-act="close">Back &middot; Esc</button>
    <div class="cols">
      <div class="list" id="ev-list"></div>
      <div class="view" id="ev-view"></div>
    </div>
  </div>
</section>

<section id="doc" class="screen">
  <div class="doc-title label" id="doc-title"></div>
  <div class="paper-wrap" id="doc-paper"></div>
  <div class="controls"><span><kbd>E</kbd>Put down</span><span id="doc-tr"><kbd>T</kbd>Transcript</span></div>
</section>

<section id="death" class="screen grain cursor-ring">
  <div class="wrap">
    <span class="label"><span class="dash"></span><span id="death-cp"></span></span>
    <h2 id="death-title">He heard you.</h2>
    <p id="death-sub">The humming starts again, somewhere in the house.</p>
    <ul class="menu-list" id="death-list">
      <li><button data-act="retry"><span class="num">i.</span><span class="rule"></span>Try again</button></li>
      <li><button data-act="quit"><span class="num">ii.</span><span class="rule"></span>Quit to menu</button></li>
    </ul>
  </div>
</section>

<section id="end" class="screen grain cursor-ring">
  <div class="wrap">
    <span class="label"><span class="dash"></span>Chapter One &middot; Complete</span>
    <h2>The House</h2>
    <div class="stats" id="end-stats"></div>
    <p>Chapter Two, <b>St. Agnes Children's Hospital</b>, is still being built. The drain under the cellar runs all the way there.</p>
    <ul class="menu-list" id="end-list">
      <li><button data-act="evidence"><span class="num">i.</span><span class="rule"></span>Evidence</button></li>
      <li><button data-act="quit"><span class="num">ii.</span><span class="rule"></span>Return to menu</button></li>
    </ul>
  </div>
</section>

<div id="hud">
  <div id="crosshair"></div>
  <div id="prompt"></div>
  <div id="objective"><span class="label"><span class="dash"></span>Objective</span><div class="text" id="obj-text"></div></div>
  <div id="hint"></div>
  <div id="message"></div>
  <div id="subs"><span class="who" id="subs-who"></span><div class="line" id="subs-line"></div></div>
  <div id="noise"><div class="label"><span>Noise</span><b id="noise-state">Quiet</b></div><canvas id="noise-cv" width="340" height="68"></canvas><div class="stam" id="stam"><i id="stam-i"></i></div></div>
  <div id="breath"><div class="label"><kbd data-bind="breath">Space</kbd>Hold your breath</div><div class="bar"><i id="breath-i"></i></div></div>
  <div id="doorfight"><div class="t">Hold the door</div><kbd id="df-key">W</kbd><div class="bar"><i id="df-gap"></i></div><div class="pips" id="df-prog"><i></i></div></div>
  <div id="struggle"><div class="t">Break free</div><div class="keys"><kbd id="k-a" data-bind="left">A</kbd><kbd id="k-d" data-bind="right">D</kbd></div><div class="bar"><i id="struggle-i"></i></div></div>
  <div id="clock"><div class="time" id="clock-t">3:00<small>AM</small></div><span class="label">Until dawn</span></div>
  <div id="inventory"><span class="label">Carrying<span class="dash"></span></span><ul id="inv-list"></ul></div>
  <div id="tape"><div id="tape-svg"></div><div class="meta"><span id="tape-title">Tape</span><b id="tape-time">00:00</b></div></div>
</div>

<div id="monitor">
  <div class="grille"></div>
  <div class="screenwin"><div class="osd">
    <div class="tl" id="mon-ch">CH1  HALLWAY</div>
    <div class="tr" id="mon-time">IR  03:00</div>
    <div class="bl">BATT<span class="batt" id="mon-batt">${'<i></i>'.repeat(8)}</span></div>
    <div class="br"><span class="lure" id="mon-lure">LULLABY</span></div>
    <div class="dead">NO SIGNAL</div>
  </div></div>
  <div class="device">
    <span class="brand">Night-Link 900</span>
    <span class="ch" data-ch="0"><i class="led"></i>1 Hall</span>
    <span class="ch" data-ch="1"><i class="led"></i>2 Living</span>
    <span class="ch" data-ch="2"><i class="led"></i>3 Kitchen</span>
    <span class="ch talk" id="mon-talk"><i class="led"></i><span data-keytext="lullaby">L</span> &middot; Lullaby</span>
    <span><span data-keytext="monitor">Space</span> &middot; Lower</span>
  </div>
</div>

<div id="card"><div><span class="label" id="card-label"></span><div class="big" id="card-big"></div></div></div>
<div id="fade"></div>
<div id="resume-veil" class="screen"><div><span class="label">Paused</span><p>Click to continue</p><small>Esc for the menu</small></div></div>
<div id="fps"></div>
`;
    this.noiseCv = this.el('noise-cv');
    this.noiseCtx = this.noiseCv.getContext('2d');
    this.noiseHist = new Float32Array(120);
    this.tapeSvgHolder = this.el('tape-svg');

    // menu interactions
    this.bindList('menu-list', (act) => this.g.menuAction(act));
    this.bindList('pause-list', (act) => this.g.pauseAction(act));
    this.bindList('death-list', (act) => this.g.deathAction(act));
    this.bindList('end-list', (act) => this.g.endAction(act));
    this.root.querySelectorAll('[data-act=close]').forEach((b) => b.addEventListener('click', () => { this.g.audio.play('ui_back', { bus: 'ui' }); this.g.closeSheet(); }));
    this.el('boot').addEventListener('click', () => this.g.bootClick());

    // title reacts to the cursor: the menu is sensitive too
    const title = this.el('title');
    const letters = [...title.querySelectorAll('span')];
    window.addEventListener('mousemove', (e) => {
      if (!this.isOn('menu')) return;
      for (const s of letters) {
        const r = s.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        const k = Math.max(0, 1 - d / 220);
        s.style.transform = `translateY(${(-k * k * 7).toFixed(2)}px)`;
        s.style.opacity = (1 - k * 0.25).toFixed(3);
      }
    });
    setInterval(() => {
      if (!this.isOn('menu') || Math.random() > 0.35) return;
      const s = letters[Math.floor(Math.random() * letters.length)];
      s.classList.remove('flick'); void s.offsetWidth; s.classList.add('flick');
    }, 2200);
  }

  bindList(id, fn) {
    const list = this.el(id);
    list.querySelectorAll('button').forEach((b) => {
      b.addEventListener('mouseenter', () => { if (!b.disabled) this.g.audio.play('ui_hover', { bus: 'ui' }); this.g.onMenuHover?.(b); });
      b.addEventListener('click', () => { if (b.disabled) return; this.g.audio.play('ui_select', { bus: 'ui' }); fn(b.dataset.act); });
    });
  }

  isOn(id) { return this.el(id).classList.contains('on'); }
  show(id, on = true) { this.el(id).classList.toggle('on', on); }
  hideAllScreens() { this.root.querySelectorAll('.screen').forEach((s) => s.classList.remove('on')); }

  // ------------------------------------------------------------ boot
  bootLoading(text) {
    const b = this.el('boot');
    b.classList.add('loading');
    b.querySelector('.go').textContent = text;
  }

  // ------------------------------------------------------------ menu
  setMenuState({ continueLabel, loreCount, loreTotal }) {
    const c = this.el('btn-continue');
    c.disabled = !continueLabel;
    this.el('continue-sub').textContent = continueLabel || '';
    this.el('evidence-sub').textContent = `${loreCount} of ${loreTotal} found`;
  }

  // ------------------------------------------------------------ pause
  setPauseInfo({ objective, room, lore, keys }) {
    this.el('pause-obj').textContent = objective || '—';
    this.el('pause-room').textContent = room || 'Somewhere in the house';
    this.el('pause-lore').textContent = lore;
    // keys: [[keyLabel, what], ...] for the current situation (current bindings)
    this.el('pause-keys').innerHTML = (keys || []).map(([k, t]) => `<span><kbd>${k}</kbd>${t}</span>`).join('');
  }

  // ------------------------------------------------------------ settings
  refreshKeys(input) {
    this.input = input;
    this.root.querySelectorAll('[data-bind]').forEach((k) => { k.textContent = input.label(k.dataset.bind); });
    this.root.querySelectorAll('[data-keytext]').forEach((k) => { k.textContent = input.label(k.dataset.keytext); });
  }

  renderControls(s, onChange) {
    const pane = this.el('controls-pane');
    const binds = s.keybinds;
    const group = (g, title) => `<section><span class="label">${title}</span>${ACTIONS.filter((a) => a.group === g).map((a) => `
      <div class="row bind"><div class="name">${a.name}</div><button class="keybtn" data-act="${a.id}">${keyLabel(binds[a.id])}</button></div>`).join('')}</section>`;
    pane.innerHTML = `${group('explore', 'Exploring')}${group('holdout', 'Holdout')}
      <section><span class="label">Fixed</span>
        <div class="row bind"><div class="name">Look<small>Mouse</small></div></div>
        <div class="row bind"><div class="name">Throw<small>Left mouse &middot; hold to throw harder</small></div></div>
        <div class="row bind"><div class="name">Hold door or shutters<small>Left mouse, during the holdout</small></div></div>
        <div class="row bind"><div class="name">Monitor rooms<small>1 2 3, or Move left / right</small></div></div>
        <div class="row bind"><div class="name">Pause<small>Esc</small></div></div>
        <div class="reset"><button class="text-btn" id="binds-reset">Reset to defaults</button></div>
      </section>`;
    pane.querySelectorAll('.keybtn').forEach((btn) => btn.addEventListener('click', () => {
      pane.querySelectorAll('.keybtn.wait').forEach((b) => { b.classList.remove('wait'); b.textContent = keyLabel(binds[b.dataset.act]); });
      btn.classList.add('wait');
      btn.textContent = 'Press a key';
      this.g.audio.play('ui_hover', { bus: 'ui' });
      this.input.capture = (code) => {
        btn.classList.remove('wait');
        if (code !== 'Escape') {
          const id = btn.dataset.act;
          const act = ACTIONS.find((a) => a.id === id);
          const next = { ...binds };
          // swap with any action in the same group that already uses this key
          const clash = ACTIONS.find((a) => a.id !== id && a.group === act.group && next[a.id] === code);
          if (clash) next[clash.id] = next[id];
          next[id] = code;
          this.g.audio.play('ui_select', { bus: 'ui' });
          onChange('keybinds', next);
        }
        this.renderControls(this.g.settings, onChange);
      };
    }));
    pane.querySelector('#binds-reset').addEventListener('click', () => {
      this.g.audio.play('ui_back', { bus: 'ui' });
      onChange('keybinds', defaultBinds());
      this.renderControls(this.g.settings, onChange);
    });
  }

  renderSettings(s, onChange, input) {
    if (input) this.input = input;
    const tabs = this.el('settings-tabs');
    const setTab = (t) => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === t));
      this.el('settings-grid').style.display = t === 'general' ? '' : 'none';
      this.el('controls-pane').style.display = t === 'controls' ? '' : 'none';
    };
    if (!tabs.dataset.bound) {
      tabs.dataset.bound = '1';
      tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.g.audio.play('ui_hover', { bus: 'ui' }); if (this.input) this.input.capture = null; setTab(b.dataset.tab); }));
    }
    setTab('general');
    this.renderControls(s, onChange);
    const grid = this.el('settings-grid');
    const slider = (key, name, min, max, step, fmt, sub = '') => `
      <div class="row"><div class="name">${name}${sub ? `<small>${sub}</small>` : ''}</div>
      <input class="slider" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-key="${key}">
      <div class="val" data-val="${key}">${fmt(s[key])}</div></div>`;
    const choice = (key, name, opts, sub = '') => `
      <div class="row"><div class="name">${name}${sub ? `<small>${sub}</small>` : ''}</div>
      <div class="choice" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div></div>`;
    const pct = (v) => Math.round(v * 100) + '%';
    grid.innerHTML = `
      <section>
        <span class="label">Controls</span>
        ${slider('sensitivity', 'Mouse sensitivity', 0.2, 3, 0.05, (v) => (+v).toFixed(2))}
        ${choice('invertY', 'Invert vertical look', [[false, 'Off'], [true, 'On']])}
        ${slider('fov', 'Field of view', 60, 95, 1, (v) => v + '°')}
        ${choice('headBob', 'Head bob', [[true, 'On'], [false, 'Off']], 'Turn off if you feel motion sick')}
        ${choice('creepMode', 'Creep', [['hold', 'Hold'], ['toggle', 'Toggle']], 'Hold the key, or press once to switch')}
        <span class="label">Sound</span>
        ${slider('master', 'Master volume', 0, 1, 0.01, pct)}
        ${slider('sfx', 'Effects', 0, 1, 0.01, pct)}
        ${slider('amb', 'Ambience', 0, 1, 0.01, pct)}
        ${slider('music', 'Music', 0, 1, 0.01, pct)}
      </section>
      <section>
        <span class="label">Display</span>
        ${slider('brightness', 'Brightness', 0.6, 1.8, 0.05, pct, 'The dark should still be dark')}
        ${choice('quality', 'Render quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], 'Low also turns off bloom')}
        ${choice('autoRes', 'Adaptive resolution', [[true, 'On'], [false, 'Off']], 'Lowers resolution when the frame rate drops')}
        ${choice('showFps', 'Show FPS', [[false, 'Off'], [true, 'On']])}
        ${choice('grain', 'Film grain', [[true, 'On'], [false, 'Off']])}
        <span class="label">Accessibility</span>
        ${choice('subtitles', 'Subtitles', [[true, 'On'], [false, 'Off']])}
        ${choice('subSize', 'Subtitle size', [['normal', 'Normal'], ['large', 'Large']])}
        ${choice('reduceFlash', 'Reduce flashing', [[false, 'Off'], [true, 'On']], 'Softer lightning, red flashes and shake')}
        <div class="reset"><button class="text-btn" id="settings-reset">Reset to defaults</button></div>

      </section>`;
    grid.querySelectorAll('input.slider').forEach((inp) => {
      const upd = () => {
        const k = inp.dataset.key;
        const v = parseFloat(inp.value);
        const pctv = ((v - inp.min) / (inp.max - inp.min)) * 100;
        inp.style.setProperty('--p', pctv + '%');
        const fmtMap = { sensitivity: (x) => x.toFixed(2), fov: (x) => x + '°' };
        grid.querySelector(`[data-val=${k}]`).textContent = fmtMap[k] ? fmtMap[k](v) : Math.round(v * 100) + '%';
        onChange(k, v);
      };
      inp.addEventListener('input', upd);
      inp.style.setProperty('--p', (((inp.value - inp.min) / (inp.max - inp.min)) * 100) + '%');
    });
    grid.querySelector('#settings-reset').addEventListener('click', () => {
      this.g.audio.play('ui_back', { bus: 'ui' });
      onChange('__reset');
    });
    grid.querySelectorAll('.choice').forEach((c) => {
      c.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        c.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        const raw = b.dataset.v;
        const v = raw === 'true' ? true : raw === 'false' ? false : raw;
        this.g.audio.play('ui_hover', { bus: 'ui' });
        onChange(c.dataset.key, v);
      }));
    });
  }

  // ------------------------------------------------------------ documents
  paperHTML(id, transcript = false) {
    const d = DOCS[id];
    if (!d) return '';
    let inner = d.body;
    if (d.style === 'drawing') {
      const src = drawingTexture(d.drawing).image.toDataURL();
      inner = `<img src="${src}" alt="">${d.body}`;
    }
    return `<div class="paper ${d.style}${transcript ? ' transcript' : ''}">${inner}</div>`;
  }
  openDoc(id) {
    const d = DOCS[id];
    this.docId = id;
    this.docTranscript = false;
    this.el('doc-title').innerHTML = `<span class="dash"></span>${d.title}`;
    this.el('doc-paper').innerHTML = this.paperHTML(id);
    smartQuotes(this.el('doc-paper'));
    this.el('doc-paper').scrollTop = 0;
    this.el('doc-tr').style.display = d.style === 'diane' || d.style === 'drawing' || d.style === 'note' ? '' : 'none';
    this.show('doc', true);
  }
  toggleTranscript() {
    if (!this.docId) return;
    this.docTranscript = !this.docTranscript;
    this.el('doc-paper').innerHTML = this.paperHTML(this.docId, this.docTranscript);
    smartQuotes(this.el('doc-paper'));
  }
  scrollDoc(dy) { this.el('doc-paper').scrollTop += dy; }
  closeDoc() { this.show('doc', false); this.docId = null; }

  // ------------------------------------------------------------ evidence
  renderEvidence(collected, onPlayTape) {
    const list = this.el('ev-list');
    const view = this.el('ev-view');
    const total = LORE_ORDER.length;
    const have = LORE_ORDER.filter((k) => collected.has(k)).length;
    this.el('ev-count').textContent = `${have} of ${total} recovered`;
    const items = LORE_ORDER.map((k, i) => {
      const isTape = !!TAPES[k];
      const info = isTape ? TAPES[k] : DOCS[k];
      const got = collected.has(k);
      return `<button class="item ${got ? '' : 'missing'}" data-k="${k}"><span class="n">${ROMAN[i]}.</span><span>${got ? info.title : 'Not yet found'}</span><span class="k">${got ? (isTape ? (info.tv ? 'Broadcast' : 'Tape') : 'Document') : (k === 'tape_ellis' ? 'After dawn' : (info.place || ''))}</span></button>`;
    }).join('');
    list.innerHTML = `<span class="label">Recovered</span>${items}`;
    view.innerHTML = '';
    const select = (k) => {
      list.querySelectorAll('.item').forEach((x) => x.classList.toggle('sel', x.dataset.k === k));
      if (TAPES[k]) {
        const t = TAPES[k];
        view.innerHTML = `<div class="paper letter" style="width:min(520px,100%)"><div class="letterhead" style="font-size:22px">${t.title}<span>${t.tv ? 'Recorded from television' : 'Cassette transcript'}</span></div>${t.lines.map(([w, l]) => `<p>${w ? `<b style="font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase">${w}</b><br>` : ''}${l}</p>`).join('')}<p style="margin-top:24px"><button class="text-btn" id="ev-play" style="color:#2a241c">Play tape</button></p></div>`;
        view.querySelector('#ev-play').addEventListener('click', () => onPlayTape(k));
      } else {
        view.innerHTML = this.paperHTML(k);
      }
      smartQuotes(view);
    };
    list.querySelectorAll('.item:not(.missing)').forEach((b) => {
      b.addEventListener('mouseenter', () => this.g.audio.play('ui_hover', { bus: 'ui' }));
      b.addEventListener('click', () => { this.g.audio.play('paper', { bus: 'ui', gain: 0.6 }); select(b.dataset.k); });
    });
    const first = LORE_ORDER.find((k) => collected.has(k));
    if (first) select(first);
    else view.innerHTML = `<p style="font-style:italic;color:var(--bone-dim);font-size:19px;margin-top:20px">Nothing yet. The house is full of things people wanted forgotten.</p>`;
  }

  // ------------------------------------------------------------ HUD
  hud(on) { this.show('hud', on); }
  // carried items, right side of the HUD; items not seen before get a short highlight
  inventory(items) {
    const box = this.el('inventory'), list = this.el('inv-list');
    const had = new Set([...list.children].map((li) => li.dataset.id));
    list.innerHTML = items.map((it) => `<li data-id="${it.id}" class="${had.has(it.id) ? '' : 'new'}"><span class="name">${it.name}</span>${ICONS[it.icon] || ''}</li>`).join('');
    box.classList.toggle('on', items.length > 0);
    clearTimeout(this.timers.inv);
    this.timers.inv = setTimeout(() => list.querySelectorAll('li.new').forEach((li) => li.classList.remove('new')), 2600);
  }
  fps(text) {
    const f = this.el('fps');
    f.classList.toggle('on', !!text);
    if (text) f.textContent = text;
  }
  hudDim(on) { this.el('hud').classList.toggle('dim', on); }
  tapeOnly(on) { this.el('hud').classList.toggle('tapeonly', on); }
  tapeFloat(on) { this.el('hud').classList.toggle('tapefloat', on); }
  setPrompt(key, text, alt) {
    if (key === 'E' && this.input) key = this.input.label('interact');
    if (alt && this.input) alt = alt.replace('<kbd>Hold</kbd>', '<kbd>Hold ' + this.input.label('interact') + '</kbd>');
    const p = this.el('prompt');
    if (!text) { p.classList.remove('on'); this.el('crosshair').classList.remove('active'); this._prompt = null; return; }
    const sig = key + text + (alt || '');
    if (this._prompt !== sig) {
      p.innerHTML = `<kbd>${key}</kbd>${text}${alt ? `<span class="alt">${alt}</span>` : ''}<span class="holdbar"><i id="holdbar-i"></i></span>`;
      this._prompt = sig;
    }
    p.classList.add('on');
    this.el('crosshair').classList.add('active');
  }
  setHold(v) {
    const i = this.root.querySelector('#holdbar-i');
    if (i) i.style.width = Math.round(v * 100) + '%';
  }
  // the objective stays on screen; a new one is shown large for a few seconds, then settles small
  objective(text, freshFor = 7000) {
    const o = this.el('objective');
    this.el('obj-text').textContent = text || '';
    o.classList.toggle('on', !!text);
    o.classList.add('fresh');
    clearTimeout(this.timers.obj);
    this.timers.obj = setTimeout(() => o.classList.remove('fresh'), freshFor);
  }
  hint(html, dur = 5000, quote = false) {
    const h = this.el('hint');
    h.innerHTML = html;
    h.classList.toggle('quote', quote);
    h.classList.add('on');
    clearTimeout(this.timers.hint);
    this.timers.hint = setTimeout(() => h.classList.remove('on'), dur);
  }
  clearHint() { this.el('hint').classList.remove('on'); }
  message(text, dur = 2400) {
    const m = this.el('message');
    m.textContent = text;
    m.classList.add('on');
    clearTimeout(this.timers.msg);
    this.timers.msg = setTimeout(() => m.classList.remove('on'), dur);
  }
  subs(who, line, small = false) {
    const s = this.el('subs');
    if (!line || !this.g.settings.subtitles) { s.classList.remove('on'); return; }
    this.el('subs-who').textContent = who || '';
    this.el('subs-line').textContent = line;
    s.classList.toggle('small', small);
    s.classList.add('on');
  }
  card(label, big, dur = 4200) {
    this.el('card-label').innerHTML = `<span class="dash"></span>${label}`;
    this.el('card-big').textContent = big;
    this.show('card', true);
    clearTimeout(this.timers.card);
    this.timers.card = setTimeout(() => this.show('card', false), dur);
  }
  fade(on) { this.show('fade', on); }

  noise(level, state) {
    const h = this.noiseHist;
    h.copyWithin(0, 1);
    h[h.length - 1] = level;
    const c = this.noiseCtx, W = this.noiseCv.width, H = this.noiseCv.height;
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(216,209,194,0.12)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
    const t = performance.now() * 0.02;
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < h.length; i++) {
      const x = (i / (h.length - 1)) * W;
      const a = Math.min(1, h[i]);
      const y = H / 2 + Math.sin(i * 1.7 + t) * (1.2 + a * H * 0.44) * (i % 2 ? 1 : -0.8);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    const peak = Math.max(...h.slice(-20));
    c.strokeStyle = peak > 0.75 ? '#b3261e' : 'rgba(216,209,194,0.85)';
    c.stroke();
    const st = this.el('noise-state');
    if (this._noiseState !== state) {
      st.textContent = state;
      st.classList.toggle('heard', state === 'Heard');
      this._noiseState = state;
    }
  }
  stamina(v) {
    const s = this.el('stam');
    s.classList.toggle('on', v < 0.98);
    this.el('stam-i').style.width = Math.round(v * 100) + '%';
  }
  breath(on, v, held) {
    const b = this.el('breath');
    b.classList.toggle('on', on);
    if (!on) return;
    b.classList.toggle('held', held);
    b.classList.toggle('low', v < 0.25);
    this.el('breath-i').style.width = Math.round(v * 100) + '%';
  }
  // holdout door fight: one key at a time pops up; the bar is how far he has the door open
  doorFight(on, st = {}) {
    const d = this.el('doorfight');
    d.classList.toggle('on', on);
    if (!on) return;
    const k = this.el('df-key');
    if (k.dataset.at !== String(st.keyAt)) {
      k.dataset.at = String(st.keyAt);
      k.textContent = st.key;
      k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); // restart the pop animation
    }
    d.classList.toggle('wrong', !!st.wrong);
    this.el('df-gap').style.width = Math.round(st.gap * 100) + '%';
    this.el('df-prog').firstChild.style.width = Math.round(Math.min(1, st.prog) * 100) + '%';
  }
  struggle(on, progress = 0, next = 'A') {
    this.el('struggle').classList.toggle('on', on);
    if (!on) return;
    this.el('struggle-i').style.width = Math.round(progress * 100) + '%';
    this.el('k-a').classList.toggle('next', next === 'A');
    this.el('k-d').classList.toggle('next', next === 'D');
  }
  clock(on, h, m) {
    this.el('clock').classList.toggle('on', on);
    if (!on) return;
    this.el('clock-t').innerHTML = `${h}:${String(m).padStart(2, '0')}<small>AM</small>`;
  }

  tape(on, info) {
    const t = this.el('tape');
    if (on && info) {
      this.tapeSvgHolder.innerHTML = cassetteSVG(info.label);
      this.el('tape-title').textContent = info.tv ? 'Television' : 'Tape';
    }
    t.classList.toggle('on', on);
  }
  tapeTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    this.el('tape-time').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------ monitor
  monitor(on) { this.show('monitor', on); this.el('hud').classList.toggle('monitoring', on); }
  monitorState({ ch, name, time, battery, lure, dead }) {
    this.el('mon-ch').textContent = `CH${ch + 1}  ${name}`;
    this.el('mon-time').textContent = `IR  ${time}`;
    const bars = Math.ceil((battery / 100) * 8);
    const batt = this.el('mon-batt');
    batt.querySelectorAll('i').forEach((i, k) => i.classList.toggle('f', k < bars));
    batt.classList.toggle('low', battery < 25);
    this.el('mon-lure').classList.toggle('on', !!lure);
    this.el('mon-talk').classList.toggle('on', !!lure);
    this.root.querySelectorAll('#monitor .ch[data-ch]').forEach((c) => c.classList.toggle('sel', +c.dataset.ch === ch));
    this.el('monitor').classList.toggle('flat', !!dead);
  }

  // ------------------------------------------------------------ death / end
  death(cpLabel, title, sub) {
    this.el('death-cp').textContent = `Checkpoint · ${cpLabel}`;
    if (title) this.el('death-title').textContent = title;
    if (sub) this.el('death-sub').textContent = sub;
    this.show('death', true);
  }
  end(stats) {
    this.el('end-stats').innerHTML = stats.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    this.show('end', true);
  }

  // ------------------------------------------------------------ prologue
  prologueLine(text, dim = false) {
    const box = this.el('pro-lines');
    const p = document.createElement('p');
    p.className = 'ln' + (dim ? ' dim' : '');
    p.textContent = text;
    box.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
  }
  prologueClear() { this.el('pro-lines').innerHTML = ''; }
  skipProgress(v) { this.el('skipbar').style.width = Math.round(v * 100) + '%'; }
}
