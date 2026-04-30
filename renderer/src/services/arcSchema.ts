/** Контракт файла arc2-metadata.json в корне библиотеки */

export type CardRecord = {
  id: string;
  type: 'image' | 'video';
  addedAt: string;
  /** Относительно корня библиотеки, с прямыми слэшами */
  originalRelativePath: string;
  thumbRelativePath: string;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  fileSize?: number;
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
};
