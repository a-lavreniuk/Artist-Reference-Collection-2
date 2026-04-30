/** Параметры URL для табов стенда UI-Kit в навбаре (синхронизация с `.arc-ui-kit-scope`). */
export const UI_KIT_URL = {
  elevation: 'ukElev',
  size: 'ukSize'
} as const;

export type UiKitElevationTab = 'sunken' | 'default' | 'raised';
export type UiKitSizeTab = 'l' | 'm' | 's';

export function parseUiKitElevation(value: string | null): UiKitElevationTab {
  if (value === 'sunken' || value === 'raised') return value;
  return 'default';
}

export function parseUiKitSize(value: string | null): UiKitSizeTab {
  if (value === 'l' || value === 's') return value;
  return 'm';
}

export function applyUiKitScopeDataset(el: HTMLElement, elevation: UiKitElevationTab, size: UiKitSizeTab): void {
  el.setAttribute('data-elevation', elevation);
  el.setAttribute('data-btn-size', size);
  el.setAttribute('data-input-size', size);
}
