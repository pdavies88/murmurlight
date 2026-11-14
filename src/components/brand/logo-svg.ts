/**
 * The Murmurlight mark: a warm crescent moon (the light) with three soft sound arcs flowing from
 * it (the murmur), on a deep dusk gradient.
 *
 * This file is the single source for the logo. The app renders it with `SvgXml`, and
 * `scripts/generate-brand-assets.mjs` renders the same markup to the app icon and splash PNGs.
 * Keep it free of imports so Node can load it directly.
 */

export type LogoSvgOptions = {
  /** Corner radius of the tile in 64-unit space. Use 0 for the iOS icon, which iOS masks itself. */
  cornerRadius?: number;
  /** Draw the gradient tile. Turn off for the Android adaptive icon foreground. */
  withBackground?: boolean;
};

export function buildLogoSvg({ cornerRadius = 16, withBackground = true }: LogoSvgOptions = {}): string {
  const background = withBackground
    ? `<linearGradient id="mm-tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0E1033"/>
      <stop offset="0.55" stop-color="#2A2470"/>
      <stop offset="1" stop-color="#5B3FB8"/>
    </linearGradient>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    ${background}
    <radialGradient id="mm-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFD9A8" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#FFD9A8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mm-moon" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#FFF4E0"/>
      <stop offset="1" stop-color="#FFB98A"/>
    </linearGradient>
    <mask id="mm-crescent">
      <rect width="64" height="64" fill="#000"/>
      <circle cx="25" cy="32" r="13" fill="#fff"/>
      <circle cx="31.5" cy="27" r="11.5" fill="#000"/>
    </mask>
  </defs>
  ${withBackground ? `<rect width="64" height="64" rx="${cornerRadius}" fill="url(#mm-tile)"/>` : ''}
  <circle cx="25" cy="32" r="20" fill="url(#mm-glow)"/>
  <rect width="64" height="64" fill="url(#mm-moon)" mask="url(#mm-crescent)"/>
  <g fill="none" stroke="#D9D0FF" stroke-linecap="round" stroke-width="2.4">
    <path d="M39.6 19.8 A19 19 0 0 1 39.6 44.2" stroke-opacity="0.9"/>
    <path d="M43.4 16.6 A24 24 0 0 1 43.4 47.4" stroke-opacity="0.6"/>
    <path d="M47.2 13.4 A29 29 0 0 1 47.2 50.6" stroke-opacity="0.32"/>
  </g>
  <circle cx="44" cy="10" r="0.9" fill="#FFF4E0" fill-opacity="0.8"/>
  <circle cx="13" cy="15" r="0.7" fill="#FFF4E0" fill-opacity="0.6"/>
</svg>`;
}
