/** Контракт файла arc2-metadata.json в корне библиотеки */

export type CardRecord = {
  id: string;
  type: 'image' | 'video';
  addedAt: string;
  dateModified?: string;
  /** Относительно корня библиотеки, с прямыми слэшами */
  originalRelativePath: string;
  thumbRelativePath: string;
  format?: string;
  width?: number;
  height?: number;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  fileSize?: number;
  fileSizeMb?: number;
};

export type CollectionRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type ArcMetadataV1 = {
  version: 1;
  categories: unknown[];
  tags: unknown[];
  cards: CardRecord[];
  collections: CollectionRecord[];
  moodboardCardIds: string[];
  /** Порог сходства для поиска дублей, % (по умолчанию 85). */
  duplicateSimilarityThresholdPct?: number;
  /** Пропущенные пары дублей как [minId, maxId]. */
  skippedDuplicatePairs?: [string, string][];
};
