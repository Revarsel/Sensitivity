import { revealMaterial, PAT, glassMaterial } from '../render/RevealMaterial.js';
import * as T from './Textures.js';

// Material library. Colours are albedo multipliers on the reveal light.
export function createMaterials() {
  const M = {
    wallpaperHall: revealMaterial({ color: 0xb4ad9c, pattern: PAT.WALLPAPER }),
    wallpaperLiving: revealMaterial({ color: 0xa9a48f, pattern: PAT.WALLPAPER }),
    wallpaperMom: revealMaterial({ color: 0xa1ab9a, pattern: PAT.WALLPAPER }),
    wallpaperJune: revealMaterial({ color: 0xc4aaa6, pattern: PAT.WALLPAPER }),
    wallpaperKitchen: revealMaterial({ color: 0xb8b29a, pattern: PAT.WALLPAPER }),
    wallTile: revealMaterial({ color: 0xaab6b2, pattern: PAT.WALLTILE }),
    siding: revealMaterial({ color: 0x8c8a84, pattern: PAT.WALLPAPER, scale: 1 }),
    floorWood: revealMaterial({ color: 0x9c8568, pattern: PAT.FLOORBOARD }),
    carpet: revealMaterial({ color: 0x8e8378, pattern: PAT.CARPET }),
    carpetMom: revealMaterial({ color: 0x86837a, pattern: PAT.CARPET }),
    carpetJune: revealMaterial({ color: 0x9e8288, pattern: PAT.CARPET }),
    rug: revealMaterial({ color: 0x8a5d52, pattern: PAT.FABRIC }),
    rugBlue: revealMaterial({ color: 0x5f6a80, pattern: PAT.FABRIC }),
    tile: revealMaterial({ color: 0xbdbab2, pattern: PAT.TILE }),
    plaster: revealMaterial({ color: 0x8f8c86, pattern: PAT.PLASTER }),
    trim: revealMaterial({ color: 0xb4ab9a, pattern: PAT.WOOD, scale: 1.05 }),
    wood: revealMaterial({ color: 0x8e6e50, pattern: PAT.WOOD }),
    darkWood: revealMaterial({ color: 0x64503e, pattern: PAT.WOOD }),
    paintedWood: revealMaterial({ color: 0xa8a49a, pattern: PAT.WOOD, scale: 1.1 }),
    fabric: revealMaterial({ color: 0x7d7268, pattern: PAT.FABRIC }),
    fabricRed: revealMaterial({ color: 0x7c524a, pattern: PAT.FABRIC }),
    fabricGreen: revealMaterial({ color: 0x66705e, pattern: PAT.FABRIC }),
    fabricPink: revealMaterial({ color: 0xa08288, pattern: PAT.FABRIC }),
    linen: revealMaterial({ color: 0xbab3a6, pattern: PAT.FABRIC }),
    metal: revealMaterial({ color: 0x9aa0a4, pattern: PAT.METAL }),
    darkMetal: revealMaterial({ color: 0x55595c, pattern: PAT.METAL }),
    brass: revealMaterial({ color: 0xa88e5a, pattern: PAT.METAL }),
    porcelain: revealMaterial({ color: 0xc9c9c4, pattern: PAT.PLAIN, scale: 0.3 }),
    glass: revealMaterial({ color: 0x5c6670, pattern: PAT.GLASS }),
    windowGlass: glassMaterial(),
    bottleGlass: revealMaterial({ color: 0x6d8a6a, pattern: PAT.GLASS }),
    paper: revealMaterial({ color: 0xd6cfbd, pattern: PAT.PAPER }),
    blood: revealMaterial({ color: 0x5c0a08, pattern: PAT.BLOOD, tint: 0xffb0a8 }),
    stuffing: revealMaterial({ color: 0xcfcabd, pattern: PAT.STUFFING }),
    brick: revealMaterial({ color: 0x8c5e4c, pattern: PAT.BRICK }),
    black: revealMaterial({ color: 0x2c2c2e, pattern: PAT.PLAIN }),
    plastic: revealMaterial({ color: 0x8a8578, pattern: PAT.PLAIN, scale: 0.5 }),
    plasticDark: revealMaterial({ color: 0x3e3d3a, pattern: PAT.PLAIN, scale: 0.5 }),
    crtScreen: revealMaterial({ color: 0x3a4248, pattern: PAT.GLASS }),
    ground: revealMaterial({ color: 0x4a4a44, pattern: PAT.CARPET }),
    bark: revealMaterial({ color: 0x5a5048, pattern: PAT.FUR }),
    toyRed: revealMaterial({ color: 0x9a4a40, pattern: PAT.PLAIN, scale: 0.5 }),
    toyBlue: revealMaterial({ color: 0x4a6a9a, pattern: PAT.PLAIN, scale: 0.5 }),
    toyYellow: revealMaterial({ color: 0xb09a4a, pattern: PAT.PLAIN, scale: 0.5 }),
    plushSmall: revealMaterial({ color: 0x8a7462, pattern: PAT.FUR }),
  };

  // textured decals and art
  M.drawingBigger = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.drawingTexture('bigger') });
  M.drawingListens = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.drawingTexture('listens') });
  M.heightChart = revealMaterial({ color: 0x504a48, pattern: PAT.PLAIN, map: T.heightChartTexture(), cutout: true });
  M.bloodSplat = revealMaterial({ color: 0x5a0a08, pattern: PAT.BLOOD, map: T.bloodTexture(4, 'splat'), cutout: true, tint: 0xffb0a8 });
  M.bloodSplat2 = revealMaterial({ color: 0x4a0806, pattern: PAT.BLOOD, map: T.bloodTexture(11, 'splat'), cutout: true, tint: 0xffb0a8 });
  M.bloodSmear = revealMaterial({ color: 0x500a08, pattern: PAT.BLOOD, map: T.bloodTexture(5, 'smear'), cutout: true, tint: 0xffb0a8 });
  M.bloodHand = revealMaterial({ color: 0x500a08, pattern: PAT.BLOOD, map: T.bloodTexture(6, 'hand'), cutout: true, tint: 0xffb0a8 });
  M.bloodTrail = revealMaterial({ color: 0x4a0806, pattern: PAT.BLOOD, map: T.bloodTexture(8, 'trail'), cutout: true, tint: 0xffb0a8 });
  M.mirrorWriting = revealMaterial({ color: 0x6a0c0a, pattern: PAT.BLOOD, map: T.writingTexture('BE QUIET', { font: '150px "Homemade Apple"' }), cutout: true, tint: 0xffb0a8 });
  M.hallWriting = revealMaterial({ color: 0x3a3634, pattern: PAT.PLAIN, map: T.writingTexture('it hears the house', { font: '64px "Homemade Apple"', drip: false, rot: 0.02, seed: 4 }), cutout: true });
  M.photo0 = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.photoTexture(0) });
  M.photo1 = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.photoTexture(1) });
  M.photo2 = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.photoTexture(2) });
  M.clockFace = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.clockFaceTexture() });
  M.poster = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.hushabyPosterTexture() });
  M.spines = revealMaterial({ color: 0xffffff, pattern: PAT.FABRIC, map: T.spinesTexture(5) });
  M.spines2 = revealMaterial({ color: 0xffffff, pattern: PAT.FABRIC, map: T.spinesTexture(12) });
  M.notePaper = revealMaterial({ color: 0xffffff, pattern: PAT.PAPER, map: T.paperTexture(12, 9) });
  M.staticTex = T.staticTexture();
  M.tvStatic = revealMaterial({ color: 0x9aa4ac, pattern: PAT.PLAIN, map: M.staticTex, emissive: 0 });
  return M;
}
