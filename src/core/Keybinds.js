// Rebindable actions. Codes are KeyboardEvent.code values.
// `group` decides which actions may not share a key (explore vs holdout).
export const ACTIONS = [
  { id: 'forward', name: 'Move forward', group: 'explore', def: 'KeyW' },
  { id: 'back', name: 'Move back', group: 'explore', def: 'KeyS' },
  { id: 'left', name: 'Move left', group: 'explore', def: 'KeyA' },
  { id: 'right', name: 'Move right', group: 'explore', def: 'KeyD' },
  { id: 'run', name: 'Run', group: 'explore', def: 'ShiftLeft' },
  { id: 'creep', name: 'Creep', group: 'explore', def: 'ControlLeft' },
  { id: 'knock', name: 'Knock', group: 'explore', def: 'KeyQ' },
  { id: 'interact', name: 'Interact', group: 'explore', def: 'KeyE' },
  { id: 'breath', name: 'Hold breath / skip', group: 'explore', def: 'Space' },
  { id: 'evidence', name: 'Evidence', group: 'explore', def: 'Tab' },
  { id: 'transcript', name: 'Document transcript', group: 'explore', def: 'KeyT' },
  { id: 'monitor', name: 'Baby monitor', group: 'holdout', def: 'Space' },
  { id: 'lullaby', name: 'Lullaby lure', group: 'holdout', def: 'KeyL' },
];

export function defaultBinds() {
  const b = {};
  for (const a of ACTIONS) b[a.id] = a.def;
  return b;
}

// Fixed secondary keys that always work alongside the binding.
export const ALIASES = {
  forward: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  run: ['ShiftRight'], creep: ['ControlRight'], evidence: ['KeyJ'],
};

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  const map = {
    Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl',
    AltLeft: 'Alt', AltRight: 'R Alt', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  };
  return map[code] || code;
}
