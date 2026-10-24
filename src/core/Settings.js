const KEY = 'sensitivity.settings.v1';
const SAVE = 'sensitivity.save.v1';

export const DEFAULTS = {
  sensitivity: 1.0,
  invertY: false,
  fov: 72,
  brightness: 1.0,
  master: 0.9,
  music: 0.8,
  sfx: 1.0,
  amb: 0.85,
  headBob: true,
  grain: true,
  subtitles: true,
  quality: 'high',
};

export const QUALITY = { low: 0.6, medium: 0.8, high: 1.0 };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable */ }
  return { ...DEFAULTS };
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
