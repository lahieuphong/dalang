export type PuppetVariant = 'satria' | 'raja';

export interface PuppetPalette {
  face: readonly [top: string, bottom: string];
  faceLight: string;
  /** Prada gilding, light → dark → light again for a metallic sheen. */
  gold: readonly [string, string, string, string];
  /** Darker gilding for the far arm. */
  goldShade: readonly [string, string];
  hair: string;
  kain: { base: string; motif: string; border: string };
  accent: { base: string; light: string };
  trousers: { base: string; motif: string };
  jewel: string;
}

/** Stage-left hero: red face, sky-blue parang kain, red sash, "supit urang" hair bun. */
const satria: PuppetPalette = {
  face: ['#c84d3c', '#92281e'],
  faceLight: '#e57758',
  gold: ['#f6da90', '#d9a650', '#ad772e', '#e8c26c'],
  goldShade: ['#b98a45', '#7a4f21'],
  hair: '#180905',
  kain: { base: '#1d4266', motif: '#ddb462', border: '#9e2e27' },
  accent: { base: '#a3302a', light: '#d65a40' },
  trousers: { base: '#8e2a22', motif: '#e3b85e' },
  jewel: '#2c5f8c',
};

/** Stage-right rival: deeper red face, crimson kain, indigo sash, tall crown and praba. */
const raja: PuppetPalette = {
  face: ['#bd4432', '#84241b'],
  faceLight: '#da634a',
  gold: ['#f2d283', '#cf9944', '#a06a27', '#e3b75e'],
  goldShade: ['#ad7c3c', '#704619'],
  hair: '#160804',
  kain: { base: '#7d221b', motif: '#e4b862', border: '#1f4a6e' },
  accent: { base: '#234d70', light: '#3d76a2' },
  trousers: { base: '#1d3d5c', motif: '#d9ab58' },
  jewel: '#b3372c',
};

export const PALETTES: Record<PuppetVariant, PuppetPalette> = { satria, raja };
