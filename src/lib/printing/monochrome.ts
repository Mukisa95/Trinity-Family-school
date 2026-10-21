/** Shared monochrome policy for list documents. Layout and numeric values are untouched. */
const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080', yellow: '#ffff00',
};

export function grayChannel(red: number, green: number, blue: number): number {
  return Math.round(.299 * red + .587 * green + .114 * blue);
}

export function monochromeColor(value: string): string {
  const input = NAMED[value.toLowerCase()] || value;
  if (input === 'transparent' || input === 'none' || input === 'currentColor') return input;
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(input);
  if (hex) {
    const full = hex[1].length <= 4 ? [...hex[1]].map(char => char + char).join('') : hex[1];
    const gray = grayChannel(...[0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16)) as [number, number, number]).toString(16).padStart(2, '0');
    return `#${gray}${gray}${gray}${full.slice(6)}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(input);
  if (rgb) {
    const gray = grayChannel(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
    return rgb[4] === undefined ? `rgb(${gray}, ${gray}, ${gray})` : `rgba(${gray}, ${gray}, ${gray}, ${rgb[4]})`;
  }
  // Border shorthands contain both geometry and a colour.
  return input.replace(/#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b|rgba?\([^)]*\)|\b(?:black|white|red|green|blue|gray|grey|orange|purple|yellow)\b/gi, monochromeColor);
}

export function monochromeStyle<T>(style: T): T {
  if (Array.isArray(style)) return style.map(monochromeStyle) as T;
  if (!style || typeof style !== 'object') return style;
  return Object.fromEntries(Object.entries(style).map(([key, value]) => [key,
    typeof value === 'string' && (/color$/i.test(key) || /^(border|borderTop|borderBottom|borderLeft|borderRight|background|fill|stroke)$/.test(key))
      ? monochromeColor(value) : value,
  ])) as T;
}

export const MONOCHROME_PRINT_CSS = `
  html, body { background: #fff !important; color: #000 !important; }
  body *, body *::before, body *::after {
    color: #000 !important; border-color: #000 !important;
    background-color: #fff !important; background-image: none !important;
    box-shadow: none !important; text-shadow: none !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  img, svg, canvas { filter: grayscale(1) !important; }
`;
