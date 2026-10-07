export type PuppetVariant = 'satria' | 'raja';

export interface PuppetPalette {
  face: readonly [top: string, bottom: string];
  faceLight: string;
  /** Prada gilding, light → dark → light again for a metallic sheen. */
  gold: readonly [string, string, string, string];
  /** Darker gilding for the far arm. */
  goldShade: readonly [string, string];
  hair: string;
  kain: { base: string; motif: string; border: string; pattern: 'parang' | 'kawung' };
  /** Sashes, belt, front panel and necklace. */
  accent: { base: string; light: string };
  trousers: { base: string; motif: string };
  jewel: string;
  /** Deep blue for headdress details. */
  crest: string;
}

/** Stage-left hero: terracotta face, red parang kain, deep-blue sashes, "supit urang" hair bun. */
const satria: PuppetPalette = {
  face: ['#B83D31', '#8A2620'],
  faceLight: '#d6674d',
  gold: ['#EDCC84', '#D5AE62', '#AE833E', '#DFB86A'],
  goldShade: ['#B48A4A', '#7A5326'],
  hair: '#170a05',
  kain: { base: '#A5322D', motif: '#D9B266', border: '#244A68', pattern: 'parang' },
  accent: { base: '#244A68', light: '#3D6B8F' },
  trousers: { base: '#712019', motif: '#D5AE62' },
  jewel: '#B33A30',
  crest: '#244A68',
};

/** Stage-right rival: darker red face, oxblood kawung kain, red sashes, tall crown and praba. */
const raja: PuppetPalette = {
  face: ['#AE372D', '#712019'],
  faceLight: '#cf5b44',
  gold: ['#E8C47A', '#C89A48', '#9C7031', '#D8AE60'],
  goldShade: ['#A97F42', '#6E4A1E'],
  hair: '#160804',
  kain: { base: '#712019', motif: '#D5AE62', border: '#1E3E59', pattern: 'kawung' },
  accent: { base: '#A5322D', light: '#C4553F' },
  trousers: { base: '#1E3E59', motif: '#D0A458' },
  jewel: '#244A68',
  crest: '#1E3E59',
};

export const PALETTES: Record<PuppetVariant, PuppetPalette> = { satria, raja };
