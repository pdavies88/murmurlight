/**
 * The Murmurlight mark: the same lit orb the app shows in Breathe and the player, with a faint ring
 * and a soft glow, on a deep dusk gradient.
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
      <stop offset="0.6" stop-color="#241E62"/>
      <stop offset="1" stop-color="#3E2C8E"/>
    </linearGradient>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    ${background}
    <radialGradient id="mm-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#A99CFF" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#A99CFF" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#A99CFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mm-orb" cx="0.38" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.45" stop-color="#F0C6E8"/>
      <stop offset="1" stop-color="#6A5CE0"/>
    </radialGradient>
  </defs>
  ${withBackground ? `<rect width="64" height="64" rx="${cornerRadius}" fill="url(#mm-tile)"/>` : ''}
  <circle cx="32" cy="32" r="29" fill="url(#mm-glow)"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#C9C0FF" stroke-opacity="0.35" stroke-width="0.8"/>
  <circle cx="32" cy="32" r="16" fill="url(#mm-orb)"/>
</svg>`;
}
