// Keyboard + mouse input with pointer lock and per-frame edge detection.
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, pressed: new Set(), released: new Set() };
    this.locked = false;
    this.enabled = true;
    this.onLockChange = null;
    this.allowUnlockedLook = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'KeyQ'].includes(k) && this.locked) e.preventDefault();
      if (k === 'Tab') e.preventDefault();
      this.keys.add(k);
      this.pressed.add(k);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.allowUnlockedLook) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    window.addEventListener('mousedown', (e) => {
      this.mouse.buttons |= 1 << e.button;
      this.mouse.pressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons &= ~(1 << e.button);
      this.mouse.released.add(e.button);
    });
    window.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const p = this.el.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.el.requestPointerLock(); } catch (e) { /* ignore */ } });
    } catch (e) {
      try { this.el.requestPointerLock(); } catch (e2) { /* ignore */ }
    }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  up(code) { return this.released.has(code); }
  mouseDown(b = 0) { return this.enabled && (this.mouse.buttons & (1 << b)) !== 0; }
  mouseHit(b = 0) { return this.enabled && this.mouse.pressed.has(b); }
  mouseUp(b = 0) { return this.mouse.released.has(b); }

  consumeMouse() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.pressed.clear();
    this.mouse.released.clear();
  }
}
