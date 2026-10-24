import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/im-fell-english-sc/400.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/vt323/400.css';
import '@fontsource/reenie-beanie/400.css';
import '@fontsource/homemade-apple/400.css';
import './styles/main.css';
import { Game } from './core/Game.js';

async function boot() {
  // canvas textures use the web fonts, so wait for them first
  const fonts = ['IM Fell English', 'IM Fell English SC', 'IBM Plex Mono', 'Special Elite', 'VT323', 'Reenie Beanie', 'Homemade Apple'];
  try {
    await Promise.all(fonts.map((f) => document.fonts.load(`32px "${f}"`)));
  } catch (e) { /* fonts optional */ }
  const game = new Game(document.getElementById('view'), document.getElementById('ui'));
  window.__game = game;
  game.start();
}
boot();
