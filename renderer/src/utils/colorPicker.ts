export function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

export function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh >= 0 && hh < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (hh < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (hh < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (hh < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const m = val - c;
  const rr = Math.round((r + m) * 255);
  const gg = Math.round((g + m) * 255);
  const bb = Math.round((b + m) * 255);
  return (
    '#' +
    [rr, gg, bb]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const raw = (hex || '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s: Math.round(s * 100), v: Math.round(v * 100) };
}

export function normalizeHex(value: string): string | null {
  const parsed = hexToHsv(value);
  if (!parsed) return null;
  return hsvToHex(parsed.h, parsed.s, parsed.v);
}
