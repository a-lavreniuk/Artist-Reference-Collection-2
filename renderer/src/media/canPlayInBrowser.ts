import { extractExtLower } from './allowedImportExtensions';

export type VideoPlaybackTier = 'html5' | 'partial' | 'legacy';

const HTML5 = new Set(['mp4', 'webm', 'ogv', 'm4v']);
const PARTIAL = new Set(['mov', 'avi', 'mkv', 'mpeg', 'mpg', 'm2v', '3gp', 'ts', 'mts']);
const LEGACY = new Set(['flv', 'wmv', 'vob', 'rmvb', 'swf']);

export function getVideoPlaybackTierFromPath(pathLike: string): VideoPlaybackTier {
  const ext = extractExtLower(pathLike);
  if (!ext) return 'legacy';
  if (HTML5.has(ext)) return 'html5';
  if (PARTIAL.has(ext)) return 'partial';
  if (LEGACY.has(ext)) return 'legacy';
  return 'legacy';
}

/** Соответствует правилу «встроенный плеер в Chromium» для известного контейнера. */
export function canPlayInBrowser(pathLike: string): boolean {
  const ext = extractExtLower(pathLike);
  if (!ext) return false;
  return HTML5.has(ext);
}

export function videoPlaybackDescription(tier: VideoPlaybackTier): string {
  if (tier === 'html5') {
    return 'Формат обычно воспроизводится встроенным плеером. Реальная совместимость зависит от кодеков в Chromium.';
  }
  if (tier === 'partial') {
    return 'Формат может не воспроизводиться встроенным плеером в зависимости от кодеков. При необходимости откройте файл из папки библиотеки во внешнем плеере.';
  }
  return 'Встроенный плеер, как правило, не подходит для этого формата. Используйте «Показать в папке» или «Выгрузить» и откройте во внешнем плеере.';
}
