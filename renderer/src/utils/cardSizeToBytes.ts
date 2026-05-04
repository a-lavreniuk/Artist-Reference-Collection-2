type CardSizeLike = {
  fileSize?: number;
  fileSizeMb?: number;
};

/**
 * Возвращает размер карточки в байтах для расчётных UI-сценариев.
 * Источник данных — поля карточки:
 * 1) `fileSize` (приоритетный, точный размер в байтах),
 * 2) `fileSizeMb` (fallback для старых записей, пересчёт в байты).
 */
export function cardSizeToBytes(card: CardSizeLike): number {
  if (typeof card.fileSize === 'number' && Number.isFinite(card.fileSize) && card.fileSize > 0) {
    return card.fileSize;
  }
  if (typeof card.fileSizeMb === 'number' && Number.isFinite(card.fileSizeMb) && card.fileSizeMb > 0) {
    return Math.round(card.fileSizeMb * 1024 * 1024);
  }
  return 0;
}
