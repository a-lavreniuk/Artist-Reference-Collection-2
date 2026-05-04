import type { ArcMetadataV1, CardRecord, CollectionRecord } from './arcSchema';

export type IntegrityIssue = {
  level: 'error' | 'warning';
  code: string;
  detail: string;
};

function asTag(r: unknown): { id: string; categoryId: string; usageCount: number } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.categoryId !== 'string') return null;
  const usageCount = typeof o.usageCount === 'number' ? o.usageCount : 0;
  return { id: o.id, categoryId: o.categoryId, usageCount };
}

function asCat(r: unknown): { id: string } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return { id: o.id };
}

function asCol(r: unknown): CollectionRecord | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return {
    id: o.id,
    name: typeof o.name === 'string' ? o.name : '',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : ''
  };
}

function asCard(r: unknown): CardRecord | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  const type = o.type === 'video' ? ('video' as const) : ('image' as const);
  const originalRelativePath = typeof o.originalRelativePath === 'string' ? o.originalRelativePath : '';
  const thumbRelativePath = typeof o.thumbRelativePath === 'string' ? o.thumbRelativePath : originalRelativePath;
  if (!originalRelativePath) return null;
  const tagIds = Array.isArray(o.tagIds) ? o.tagIds.filter((x): x is string => typeof x === 'string') : [];
  const collectionIds = Array.isArray(o.collectionIds)
    ? o.collectionIds.filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: o.id,
    type,
    addedAt: typeof o.addedAt === 'string' ? o.addedAt : '',
    originalRelativePath,
    thumbRelativePath,
    tagIds,
    collectionIds
  };
}

export function analyzeIntegrity(meta: ArcMetadataV1, missingRelPaths: Set<string>): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const tags = (meta.tags ?? []).map(asTag).filter((t): t is NonNullable<typeof t> => t !== null);
  const cats = (meta.categories ?? []).map(asCat).filter((c): c is NonNullable<typeof c> => c !== null);
  const cols = (meta.collections ?? []).map(asCol).filter((c): c is CollectionRecord => c !== null);
  const cards = (meta.cards ?? []).map(asCard).filter((c): c is CardRecord => c !== null);

  const catIds = new Set(cats.map((c) => c.id));
  const tagIds = new Set(tags.map((t) => t.id));
  const colIds = new Set(cols.map((c) => c.id));
  const cardIds = new Set(cards.map((c) => c.id));

  for (const c of cards) {
    if (missingRelPaths.has(c.originalRelativePath)) {
      issues.push({
        level: 'error',
        code: 'missing_original',
        detail: `Нет файла оригинала: ${c.originalRelativePath}`
      });
    }
    if (missingRelPaths.has(c.thumbRelativePath)) {
      issues.push({
        level: 'error',
        code: 'missing_thumb',
        detail: `Нет превью: ${c.thumbRelativePath}`
      });
    }
    for (const tid of c.tagIds) {
      if (!tagIds.has(tid)) {
        issues.push({
          level: 'warning',
          code: 'card_tag_missing',
          detail: `Карточка ${c.id}: ссылка на несуществующую метку ${tid}`
        });
      }
    }
    for (const colId of c.collectionIds) {
      if (!colIds.has(colId)) {
        issues.push({
          level: 'warning',
          code: 'card_collection_missing',
          detail: `Карточка ${c.id}: несуществующая коллекция ${colId}`
        });
      }
    }
  }

  for (const t of tags) {
    if (!catIds.has(t.categoryId)) {
      issues.push({
        level: 'warning',
        code: 'tag_bad_category',
        detail: `Метка ${t.id}: несуществующая категория ${t.categoryId}`
      });
    }
  }

  const usage = new Map<string, number>();
  for (const c of cards) {
    for (const tid of c.tagIds) {
      usage.set(tid, (usage.get(tid) ?? 0) + 1);
    }
  }
  for (const t of tags) {
    const u = usage.get(t.id) ?? 0;
    if (u !== t.usageCount) {
      issues.push({
        level: 'warning',
        code: 'tag_usage_mismatch',
        detail: `Метка «${t.id}»: счётчик ${t.usageCount}, фактически ${u}`
      });
    }
  }

  for (const mid of meta.moodboardCardIds ?? []) {
    if (!cardIds.has(mid)) {
      issues.push({
        level: 'warning',
        code: 'moodboard_missing_card',
        detail: `Мудборд: несуществующая карточка ${mid}`
      });
    }
  }

  return issues;
}

/** Одна транзакция правок только для warnings (по плану). */
export function applyMetadataWarningFixes(meta: ArcMetadataV1): ArcMetadataV1 {
  const out = JSON.parse(JSON.stringify(meta)) as ArcMetadataV1;
  if (!Array.isArray(out.tags)) out.tags = [];
  if (!Array.isArray(out.categories)) out.categories = [];
  if (!Array.isArray(out.collections)) out.collections = [];
  if (!Array.isArray(out.cards)) out.cards = [];
  if (!Array.isArray(out.moodboardCardIds)) out.moodboardCardIds = [];

  const catIds = new Set(
    out.categories
      .map(asCat)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => c.id)
  );
  out.tags = out.tags.filter((raw) => {
    const t = asTag(raw);
    return t !== null && catIds.has(t.categoryId);
  });
  const tagIds = new Set(out.tags.map((raw) => asTag(raw)!.id));

  const colIds = new Set(
    out.collections
      .map(asCol)
      .filter((c): c is CollectionRecord => c !== null)
      .map((c) => c.id)
  );

  out.cards = out.cards
    .map(asCard)
    .filter((c): c is CardRecord => c !== null)
    .map((c) => ({
      ...c,
      tagIds: c.tagIds.filter((id) => tagIds.has(id)),
      collectionIds: c.collectionIds.filter((id) => colIds.has(id))
    }));

  const cardIds = new Set(out.cards.map((c) => c.id));
  out.moodboardCardIds = (out.moodboardCardIds ?? []).filter((id) => cardIds.has(id));

  const usage = new Map<string, number>();
  for (const c of out.cards) {
    for (const tid of c.tagIds) {
      usage.set(tid, (usage.get(tid) ?? 0) + 1);
    }
  }
  for (const raw of out.tags) {
    if (!raw || typeof raw !== 'object') continue;
    const t = asTag(raw);
    if (!t) continue;
    (raw as Record<string, unknown>).usageCount = usage.get(t.id) ?? 0;
  }

  return out;
}
