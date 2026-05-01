import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ARC2_EDIT_CARD_SUBMIT_REQUEST } from '../components/layout/navbarEvents';
import { hydrateArc2NavbarIcons } from '../components/layout/navbarIconHydrate';
import {
  getAllCategories,
  getAllCollections,
  getCardById,
  getCollectionCardCounts,
  getTagsByCategory,
  isLibraryConfigured,
  updateCardPayload,
  type CategoryRecord,
  type CollectionRecord,
  type TagRecord
} from '../services/db';

type TabKey = 'tags' | 'collections' | 'description';

export default function GalleryCardEditStubPage() {
  const navigate = useNavigate();
  const params = useParams<{ cardId: string }>();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('tags');
  const [tagSearch, setTagSearch] = useState('');
  const [colSearch, setColSearch] = useState('');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [tab, tagIds.length, collectionIds.length, description.length, busy]);

  const reloadCatalog = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const map: Record<string, TagRecord[]> = {};
    cats.forEach((c, i) => {
      map[c.id] = lists[i] ?? [];
    });
    setTagsByCat(map);
    setCollections(await getAllCollections());
    setCollCounts(await getCollectionCardCounts());
  }, []);

  useEffect(() => {
    void (async () => {
      setReady(await isLibraryConfigured());
      await reloadCatalog();
      if (!params.cardId) {
        setError('Карточка не найдена.');
        return;
      }
      const card = await getCardById(params.cardId);
      if (!card) {
        setError('Карточка не найдена.');
        return;
      }
      setTagIds(card.tagIds);
      setCollectionIds(card.collectionIds);
      setDescription(card.description ?? '');
      setLoaded(true);
    })();
  }, [params.cardId, reloadCatalog]);

  const handleSubmit = useCallback(async () => {
    if (!params.cardId || busy || !loaded) return;
    setError(null);
    if (tagIds.length === 0) {
      setTab('tags');
      setError('Назначьте хотя бы одну метку.');
      return;
    }
    setBusy(true);
    try {
      await updateCardPayload(params.cardId, {
        tagIds,
        collectionIds,
        description
      });
      navigate('/gallery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить изменения карточки.');
    } finally {
      setBusy(false);
    }
  }, [params.cardId, busy, loaded, tagIds, collectionIds, description, navigate]);

  useEffect(() => {
    const onSubmit = () => void handleSubmit();
    window.addEventListener(ARC2_EDIT_CARD_SUBMIT_REQUEST, onSubmit);
    return () => window.removeEventListener(ARC2_EDIT_CARD_SUBMIT_REQUEST, onSubmit);
  }, [handleSubmit]);

  const toggleTag = (tagId: string) => {
    setTagIds((prev) => {
      const set = new Set(prev);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      return [...set];
    });
  };

  const toggleCollection = (colId: string) => {
    setCollectionIds((prev) => {
      const set = new Set(prev);
      if (set.has(colId)) set.delete(colId);
      else set.add(colId);
      return [...set];
    });
  };

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const rows: { cat: CategoryRecord; tags: TagRecord[] }[] = [];
    for (const cat of categories) {
      const allT = tagsByCat[cat.id] ?? [];
      const tags = q ? allT.filter((t) => t.name.toLowerCase().includes(q)) : allT;
      if (!q || tags.length > 0 || cat.name.toLowerCase().includes(q)) {
        rows.push({ cat, tags: q ? tags : allT });
      }
    }
    return rows;
  }, [categories, tagsByCat, tagSearch]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  if (!ready) {
    return (
      <div className="arc2-page-empty panel elevation-default">
        <p className="typo-p-m">Сначала укажите папку библиотеки в «Настройках».</p>
      </div>
    );
  }

  if (!loaded && !error) {
    return (
      <div className="arc2-page-empty panel elevation-default">
        <p className="typo-p-m">Загрузка карточки...</p>
      </div>
    );
  }

  return (
    <div ref={hostRef} className="arc2-add-page">
      <div className="arc2-add-editor panel elevation-default">
        <div className="tabs arc2-add-tabs" role="tablist" aria-label="Редактирование карточки">
          {(
            [
              ['tags', 'Метки', tagIds.length],
              ['collections', 'Коллекции', collectionIds.length],
              ['description', 'Описание', description.trim() ? 1 : 0]
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab-button${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span>{label}</span>
              {key === 'description' ? (
                count > 0 ? (
                  <span className="arc2-add-tab-dot" title="Есть текст" aria-hidden="true" />
                ) : null
              ) : count > 0 ? (
                <span className="tab-counter">{count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === 'tags' ? (
          <div className="arc2-add-tab-body">
            <div className="field field-full input-live arc2-add-search">
              <div className="input input--size-m input-slots search-live">
                <span className="search-icon slot-leading arc2-icon-search" aria-hidden="true" />
                <input
                  className="search-inner slot-value"
                  placeholder="Поиск метки или категории"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  aria-label="Поиск метки или категории"
                />
              </div>
            </div>
            <div className="arc2-add-tags-scroll">
              {filteredTags.map(({ cat, tags }) => (
                <div key={cat.id} className="arc2-add-tag-group">
                  <p className="text-m arc2-add-tag-group-title">
                    <span className="arc2-add-cat-dot" style={{ background: cat.colorHex }} aria-hidden />
                    {cat.name}
                  </p>
                  <div className="arc2-add-tag-chips">
                    {tags.map((t) => {
                      const sel = tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`arc2-add-tag-chip${sel ? ' is-selected' : ''}`}
                          onClick={() => toggleTag(t.id)}
                        >
                          <span className="arc2-add-tag-chip-dot" style={{ background: cat.colorHex }} aria-hidden />
                          <span className="arc2-add-tag-chip-name">{t.name}</span>
                          <span className="arc2-add-tag-chip-count">{t.usageCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'collections' ? (
          <div className="arc2-add-tab-body">
            <div className="field field-full input-live arc2-add-search">
              <div className="input input--size-m input-slots search-live">
                <span className="search-icon slot-leading arc2-icon-search" aria-hidden="true" />
                <input
                  className="search-inner slot-value"
                  placeholder="Поиск коллекции"
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                  aria-label="Поиск коллекции"
                />
              </div>
            </div>
            <div className="arc2-add-collection-chips">
              {filteredCols.map((c) => {
                const sel = collectionIds.includes(c.id);
                const n = collCounts[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`arc2-add-collection-chip${sel ? ' is-selected' : ''}`}
                    onClick={() => toggleCollection(c.id)}
                  >
                    <span className="arc2-add-collection-chip-name">{c.name}</span>
                    <span className="arc2-add-collection-chip-count">{n}</span>
                  </button>
                );
              })}
            </div>
            {filteredCols.length === 0 ? <p className="hint">Коллекций не найдено</p> : null}
          </div>
        ) : null}

        {tab === 'description' ? (
          <div className="arc2-add-tab-body arc2-add-tab-body--description">
            <div className="field field-full">
              <div className="arc2-add-desc-head">
                <label className="field-label text-m" htmlFor="arc2EditDesc">
                  Описание
                </label>
                <span className="text-s arc2-add-desc-counter">{description.length}</span>
              </div>
              <textarea
                id="arc2EditDesc"
                className="input textarea arc2-add-textarea"
                rows={8}
                placeholder="Кратко опишите содержимое — текст сохранится на карточке."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="hint input-inline-error arc2-add-error panel elevation-default" role="alert">
          {error}
        </p>
      ) : null}
      {busy ? <p className="hint arc2-add-busy">Сохранение...</p> : null}
    </div>
  );
}
