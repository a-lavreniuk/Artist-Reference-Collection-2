/** Счётчики табов и меток: 1–999; ≥1000 — формат с одной десятичной (Notion). */
export function formatNavbarTabCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  const rounded = Math.round(k * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
  return `${text}K`;
}
