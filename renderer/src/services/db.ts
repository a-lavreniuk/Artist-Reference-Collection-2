import { normalizeHex } from '../utils/colorPicker';

export type NavbarMetrics = {
  totalCards: number;
  imageCards: number;
  videoCards: number;
  totalCollections: number;
  moodboardCards: number;
  totalCategories: number;
};

export type CategoryWeight = 'neutral' | 'low' | 'medium' | 'high';

export type CategoryRecord = {
  id: string;
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  sortIndex: number;
  createdAt: string;
};

export type TagRecord = {
  id: string;
  categoryId: string;
  name: string;
  usageCount: number;
  description?: string;
  /** data:image/* для подсказки при наведении; хранится в localStorage */
  tooltipImageDataUrl?: string;
};

type CardRecord = {
  id: string;
  type?: 'image' | 'video';
};

type CollectionRecord = {
  id: string;
};

const STORAGE_KEYS = {
  cards: 'arc2.cards',
  collections: 'arc2.collections',
  moodboard: 'arc2.moodboard.cards',
  categories: 'arc2.categories',
  tags: 'arc2.tags'
} as const;

export const ARC2_CATEGORIES_CHANGED_EVENT = 'arc2:categories-changed';
export const ARC2_TAGS_CHANGED_EVENT = 'arc2:tags-changed';

function safeReadArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeWriteArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseWeight(v: unknown): CategoryWeight {
  if (v === 'low' || v === 'medium' || v === 'high' || v === 'neutral') {
    return v;
  }
  return 'neutral';
}

function normalizeCategoryRecord(item: unknown, index: number): CategoryRecord {
  const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const id = typeof r.id === 'string' ? r.id : newId();
  const name = typeof r.name === 'string' ? r.name : '';
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString();
  let colorHex = '#EAB308';
  if (typeof r.colorHex === 'string') {
    const n = normalizeHex(r.colorHex);
    if (n) colorHex = n;
  }
  const weight = parseWeight(r.weight);
  const sortIndex = typeof r.sortIndex === 'number' ? r.sortIndex : index;
  return { id, name, colorHex, weight, sortIndex, createdAt };
}

function readCategories(): CategoryRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.categories);
  return raw.map((item, index) => normalizeCategoryRecord(item, index));
}

function persistCategories(list: CategoryRecord[]): void {
  safeWriteArray(STORAGE_KEYS.categories, list);
}

function normalizeTagRecord(item: unknown): TagRecord | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : newId();
  const categoryId = typeof r.categoryId === 'string' ? r.categoryId : '';
  const name = typeof r.name === 'string' ? r.name : '';
  if (!categoryId || !name) return null;
  const usageCount = typeof r.usageCount === 'number' ? r.usageCount : 0;
  let description: string | undefined;
  if (typeof r.description === 'string' && r.description.trim()) {
    description = r.description.trim();
  }
  let tooltipImageDataUrl: string | undefined;
  if (typeof r.tooltipImageDataUrl === 'string' && r.tooltipImageDataUrl.startsWith('data:image/')) {
    tooltipImageDataUrl = r.tooltipImageDataUrl;
  }
  return {
    id,
    categoryId,
    name,
    usageCount,
    ...(description ? { description } : {}),
    ...(tooltipImageDataUrl ? { tooltipImageDataUrl } : {})
  };
}

function readTags(): TagRecord[] {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.tags);
  const out: TagRecord[] = [];
  for (const item of raw) {
    const t = normalizeTagRecord(item);
    if (t) out.push(t);
  }
  return out;
}

function persistTags(list: TagRecord[]): void {
  safeWriteArray(STORAGE_KEYS.tags, list);
}

function migrateCategoriesIfNeeded(list: CategoryRecord[]): void {
  const raw = safeReadArray<unknown>(STORAGE_KEYS.categories);
  if (!Array.isArray(raw) || raw.length !== list.length) {
    persistCategories(list);
    return;
  }
  let needs = false;
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i];
    if (!o || typeof o !== 'object') {
      needs = true;
      break;
    }
    const rec = o as Record<string, unknown>;
    if (typeof rec.colorHex !== 'string' || typeof rec.weight !== 'string' || typeof rec.sortIndex !== 'number') {
      needs = true;
      break;
    }
  }
  if (needs) {
    persistCategories(list);
  }
}

export async function getNavbarMetrics(): Promise<NavbarMetrics> {
  const cards = safeReadArray<CardRecord>(STORAGE_KEYS.cards);
  const collections = safeReadArray<CollectionRecord>(STORAGE_KEYS.collections);
  const moodboardCards = safeReadArray<CardRecord>(STORAGE_KEYS.moodboard);
  const categories = readCategories();

  const imageCards = cards.filter((card) => card.type === 'image').length;
  const videoCards = cards.filter((card) => card.type === 'video').length;

  return {
    totalCards: cards.length,
    imageCards,
    videoCards,
    totalCollections: collections.length,
    moodboardCards: moodboardCards.length,
    totalCategories: categories.length
  };
}

export async function getAllCategories(): Promise<CategoryRecord[]> {
  const list = readCategories();
  migrateCategoriesIfNeeded(list);
  return [...list].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'ru'));
}

export async function addCategory(name: string, colorHex: string): Promise<CategoryRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название категории не может быть пустым');
  }
  const hex = normalizeHex(colorHex) ?? '#EAB308';
  const list = readCategories();
  const maxSort = list.reduce((m, c) => Math.max(m, c.sortIndex), -1);
  const created: CategoryRecord = {
    id: newId(),
    name: trimmed,
    colorHex: hex,
    weight: 'neutral',
    sortIndex: maxSort + 1,
    createdAt: new Date().toISOString()
  };
  persistCategories([...list, created]);
  return created;
}

export async function updateCategoryName(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название не может быть пустым');
  }
  const list = readCategories();
  persistCategories(list.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  notifyCategoriesChanged();
}

export async function updateCategoryColorHex(id: string, colorHex: string): Promise<void> {
  const hex = normalizeHex(colorHex);
  if (!hex) {
    throw new Error('Некорректный цвет');
  }
  const list = readCategories();
  persistCategories(list.map((c) => (c.id === id ? { ...c, colorHex: hex } : c)));
  notifyCategoriesChanged();
}

export async function updateCategoryWeight(id: string, weight: CategoryWeight): Promise<void> {
  const list = readCategories();
  persistCategories(list.map((c) => (c.id === id ? { ...c, weight } : c)));
  notifyCategoriesChanged();
}

export async function moveCategory(id: string, direction: -1 | 1): Promise<void> {
  const sorted = [...(await getAllCategories())];
  const index = sorted.findIndex((c) => c.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) {
    return;
  }
  const a = sorted[index];
  const b = sorted[swapIndex];
  const list = readCategories().map((c) => {
    if (c.id === a.id) return { ...c, sortIndex: b.sortIndex };
    if (c.id === b.id) return { ...c, sortIndex: a.sortIndex };
    return c;
  });
  persistCategories(list);
  notifyCategoriesChanged();
}

export async function deleteCategory(id: string): Promise<void> {
  const tags = readTags().filter((t) => t.categoryId !== id);
  persistTags(tags);
  persistCategories(readCategories().filter((c) => c.id !== id));
  notifyTagsChanged();
  notifyCategoriesChanged();
}

export async function getTagsByCategory(categoryId: string): Promise<TagRecord[]> {
  return readTags()
    .filter((t) => t.categoryId === categoryId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export async function addTag(
  categoryId: string,
  name: string,
  extras?: { description?: string; tooltipImageDataUrl?: string }
): Promise<TagRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Название метки не может быть пустым');
  }
  if (!readCategories().some((c) => c.id === categoryId)) {
    throw new Error('Категория не найдена');
  }
  const tags = readTags();
  const desc = extras?.description?.trim();
  const img = extras?.tooltipImageDataUrl;
  const created: TagRecord = {
    id: newId(),
    categoryId,
    name: trimmed,
    usageCount: 0,
    ...(desc ? { description: desc } : {}),
    ...(img && img.startsWith('data:image/') ? { tooltipImageDataUrl: img } : {})
  };
  persistTags([...tags, created]);
  notifyTagsChanged();
  return created;
}

export async function updateTag(
  tagId: string,
  patch: {
    name: string;
    categoryId: string;
    description?: string;
    tooltipImageDataUrl?: string;
  }
): Promise<void> {
  const tags = readTags();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) {
    throw new Error('Метка не найдена');
  }
  if (!readCategories().some((c) => c.id === patch.categoryId)) {
    throw new Error('Категория не найдена');
  }
  const trimmed = patch.name.trim();
  if (!trimmed) {
    throw new Error('Название метки не может быть пустым');
  }
  const next: TagRecord = {
    ...tag,
    name: trimmed,
    categoryId: patch.categoryId,
    usageCount: tag.usageCount
  };
  const desc = patch.description?.trim();
  if (desc) {
    next.description = desc;
  } else {
    delete next.description;
  }
  if (patch.tooltipImageDataUrl && patch.tooltipImageDataUrl.startsWith('data:image/')) {
    next.tooltipImageDataUrl = patch.tooltipImageDataUrl;
  } else {
    delete next.tooltipImageDataUrl;
  }
  persistTags(tags.map((t) => (t.id === tagId ? next : t)));
  notifyTagsChanged();
}

export async function deleteTag(tagId: string): Promise<void> {
  const tags = readTags();
  if (!tags.some((t) => t.id === tagId)) {
    throw new Error('Метка не найдена');
  }
  persistTags(tags.filter((t) => t.id !== tagId));
  notifyTagsChanged();
}

export async function moveTagToCategory(tagId: string, targetCategoryId: string): Promise<void> {
  const categories = readCategories();
  if (!categories.some((c) => c.id === targetCategoryId)) {
    throw new Error('Категория не найдена');
  }
  const tags = readTags();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) {
    throw new Error('Метка не найдена');
  }
  if (tag.categoryId === targetCategoryId) {
    return;
  }
  persistTags(tags.map((t) => (t.id === tagId ? { ...t, categoryId: targetCategoryId } : t)));
  notifyTagsChanged();
}

export function notifyCategoriesChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC2_CATEGORIES_CHANGED_EVENT));
}

export function notifyTagsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(ARC2_TAGS_CHANGED_EVENT));
}
