import { defaultBinds } from './Keybinds.js';

const KEY = 'sensitivity.settings.v2';
const SAVE = 'sensitivity.save.v1';

export const DEFAULTS = {
  sensitivity: 1.0,
  invertY: false,
  fov: 72,
  brightness: 1.0,
  master: 1.0,
  music: 1.0,
  sfx: 1.0,
  amb: 1.0,
  headBob: true,
  grain: true,
  subtitles: true,
  quality: 'high',
  keybinds: defaultBinds(),
};

// What 100% on each slider actually means (keeps the original mix at 100%).
export const VOLUME_SCALE = { master: 0.9, music: 0.8, sfx: 1.0, amb: 0.85 };

export const QUALITY = { low: 0.6, medium: 0.8, high: 1.0 };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); return { ...DEFAULTS, ...s, keybinds: { ...defaultBinds(), ...(s.keybinds || {}) } }; }
  } catch (e) { /* storage unavailable */ }
  return { ...DEFAULTS, keybinds: defaultBinds() };
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}
export function writeSave(data) {
  try { localStorage.setItem(SAVE, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
}
