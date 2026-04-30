import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hydrateArc2NavbarIcons } from '../components/layout/navbarIconHydrate';
import { ARC2_ADD_CARDS_SUBMIT_REQUEST } from '../components/layout/navbarEvents';
import {
  getAllCategories,
  getTagsByCategory,
  getAllCollections,
  getCollectionCardCounts,
  insertImportedCards,
  isLibraryConfigured,
  type TagRecord,
  type CollectionRecord,
  type CategoryRecord
} from '../services/db';

const MAX_QUEUE = 25;

type QueueItem = {
  key: string;
  absPath: string;
  tagIds: string[];
  collectionIds: string[];
  description: string;
};

type TabKey = 'tags' | 'collections' | 'description';

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

export default function AddCardsPage() {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<TabKey>('tags');
  const [tagSearch, setTagSearch] = useState('');
  const [colSearch, setColSearch] = useState('');
  const [clipboardTagIds, setClipboardTagIds] = useState<string[] | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);

  const active = queue[activeIndex];

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [queue.length, tab, activeIndex, active?.tagIds.length, active?.collectionIds.length, active?.description]);

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
    })();
  }, [reloadCatalog]);

  const handleSubmitAll = useCallback(async () => {
    setError(null);
    if (!(await isLibraryConfigured())) {
      setError('Сначала укажите папку библиотеки в «Настройках».');
      return;
    }
    if (!queue.length) {
      setError('Добавьте хотя бы один файл.');
      return;
    }
    const missing = queue.findIndex((q) => q.tagIds.length === 0);
    if (missing >= 0) {
      setActiveIndex(missing);
      setTab('tags');
      setError(`Назначьте хотя бы одну метку для файла ${missing + 1} в очереди.`);
      return;
    }
    if (!window.arc) {
      setError('Импорт доступен только в Electron.');
      return;
    }
    setBusy(true);
    try {
      const imported = await window.arc.importFiles(queue.map((q) => q.absPath));
      const merged = imported.map((row, i) => ({
        ...row,
        type: 'image' as const,
        tagIds: queue[i].tagIds,
        collectionIds: queue[i].collectionIds,
        ...(queue[i].description.trim() ? { description: queue[i].description.trim() } : {})
      }));
      await insertImportedCards(merged);
      navigate('/gallery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось импортировать');
    } finally {
      setBusy(false);
    }
  }, [queue, navigate]);

  useEffect(() => {
    const onSubmit = () => void handleSubmitAll();
    window.addEventListener(ARC2_ADD_CARDS_SUBMIT_REQUEST, onSubmit);
    return () => window.removeEventListener(ARC2_ADD_CARDS_SUBMIT_REQUEST, onSubmit);
  }, [handleSubmitAll]);

  const appendPaths = useCallback((paths: string[]) => {
    setQueue((prev) => {
      const remaining = Math.max(0, MAX_QUEUE - prev.length);
      if (remaining <= 0) {
        requestAnimationFrame(() =>
          setError(`В очереди уже ${MAX_QUEUE} файлов — удалите часть или завершите импорт.`)
        );
        return prev;
      }
      const slice = paths.slice(0, remaining).map((absPath) => ({
        key: `${crypto.randomUUID?.() ?? String(Math.random())}-${basename(absPath)}`,
        absPath,
        tagIds: [],
        collectionIds: [],
        description: ''
      }));
      if (paths.length > remaining) {
        requestAnimationFrame(() =>
          setError(`Добавлено ${slice.length} из ${paths.length} файлов (лимит очереди ${MAX_QUEUE}).`)
        );
      } else {
        requestAnimationFrame(() => setError(null));
      }
      return [...prev, ...slice];
    });
  }, []);

  const pickFiles = async () => {
    if (!window.arc) {
      setError('Доступно только в Electron.');
      return;
    }
    if (queue.length >= MAX_QUEUE) {
      setError(`В очереди уже ${MAX_QUEUE} файлов.`);
      return;
    }
    const paths = await window.arc.pickImageFiles();
    if (!paths.length) return;
    appendPaths(paths);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => d + 1);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => Math.max(0, d - 1));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    const paths: string[] = [];
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files.item(i);
      if (!f) continue;
      const p = (f as File & { path?: string }).path;
      if (typeof p === 'string') paths.push(p);
    }
    if (!paths.length) {
      void pickFiles();
      return;
    }
    appendPaths(paths);
  };

  const updateActive = (patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item, i) => (i === activeIndex ? { ...item, ...patch } : item)));
  };

  const toggleTag = (tagId: string) => {
    if (!active) return;
    const set = new Set(active.tagIds);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    updateActive({ tagIds: [...set] });
  };

  const toggleCollection = (colId: string) => {
    if (!active) return;
    const set = new Set(active.collectionIds);
    if (set.has(colId)) set.delete(colId);
    else set.add(colId);
    updateActive({ collectionIds: [...set] });
  };

  const removeFromQueue = (key: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((q) => q.key === key);
      const next = prev.filter((q) => q.key !== key);
      if (idx >= 0 && activeIndex >= next.length) {
        setActiveIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const copyTags = () => {
    if (!active) return;
    setClipboardTagIds([...active.tagIds]);
  };

  const applyTags = () => {
    if (!clipboardTagIds?.length) return;
    updateActive({ tagIds: [...clipboardTagIds] });
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

  const descFilled = Boolean(active?.description.trim());

  if (!ready) {
    return (
      <div className="arc2-page-empty panel elevation-default">
        <p className="typo-p-m">Сначала укажите папку библиотеки в «Настройках».</p>
      </div>
    );
  }

  const dropzoneActive = dragDepth > 0;

  return (
    <div ref={hostRef} className="arc2-add-page">
      {queue.length === 0 ? (
        <div
          className={`arc2-add-dropzone panel elevation-default${dropzoneActive ? ' arc2-add-dropzone--dropping' : ''}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div className="arc2-add-dropzone-inner">
            <span className="arc2-add-dropzone-icon tab-icon arc2-icon-images" aria-hidden="true" />
            <p className="text-l arc2-add-dropzone-title">Перетащите изображения сюда</p>
            <p className="text-s arc2-add-dropzone-sub">
              До {MAX_QUEUE} файлов за раз. При необходимости нажмите кнопку — откроется диалог выбора.
            </p>
            <button type="button" className="btn btn-primary btn-ds arc2-add-dropzone-cta" onClick={() => void pickFiles()}>
              <span className="btn-ds__value">Выбрать файлы</span>
              <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="arc2-add-with-queue">
          <div className="arc2-add-queue-head">
            <div className="arc2-add-queue-summary">
              <p className="text-l arc2-add-queue-title">Очередь</p>
              <span className="text-s arc2-add-queue-limit">
                {queue.length} / {MAX_QUEUE}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-ds"
              disabled={queue.length >= MAX_QUEUE}
              onClick={() => void pickFiles()}
            >
              <span className="btn-ds__value">Добавить файлы</span>
              <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true" />
            </button>
          </div>

          <div className="arc2-add-queue-scroll panel elevation-default" role="list">
            {queue.map((item, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={item.key}
                  className={`arc2-add-queue-row${isActive ? ' is-active' : ''}`}
                  role="listitem"
                >
                  <button type="button" className="arc2-add-queue-main" onClick={() => setActiveIndex(i)}>
                    <span className="arc2-add-queue-thumb" aria-hidden="true" />
                    <span className="arc2-add-queue-textblock">
                      <span className="text-m arc2-add-queue-name">{basename(item.absPath)}</span>
                      {item.tagIds.length > 0 ? (
                        <span className="arc2-add-queue-tag-hint text-s">{item.tagIds.length} меток</span>
                      ) : (
                        <span className="arc2-add-queue-tag-hint arc2-add-queue-tag-hint--warn text-s">
                          Нужна метка
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-icon-only btn-ds arc2-add-queue-remove-btn"
                    aria-label={`Убрать из очереди ${basename(item.absPath)}`}
                    onClick={() => removeFromQueue(item.key)}
                  >
                    <span className="btn-icon-only__glyph arc2-icon-close" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {active ? (
            <div className="arc2-add-editor panel elevation-default">
              <div className="tabs arc2-add-tabs" role="tablist" aria-label="Настройка карточки">
                {(
                  [
                    ['tags', 'Метки', active.tagIds.length],
                    ['collections', 'Коллекции', active.collectionIds.length],
                    ['description', 'Описание', descFilled ? 1 : 0]
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
                  <div className="arc2-add-toolbar">
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
                    <button type="button" className="btn btn-secondary btn-ds" onClick={copyTags}>
                      <span className="btn-ds__value">Копировать метки</span>
                      <span className="btn-ds__icon arc2-icon-copy" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-ds"
                      onClick={applyTags}
                      disabled={!clipboardTagIds?.length}
                    >
                      <span className="btn-ds__value">Применить метки</span>
                    </button>
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
                            const sel = active.tagIds.includes(t.id);
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
                      const sel = active.collectionIds.includes(c.id);
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
                      <label className="field-label text-m" htmlFor="arc2AddDesc">
                        Описание
                      </label>
                      <span className="text-s arc2-add-desc-counter">{active.description.length}</span>
                    </div>
                    <textarea
                      id="arc2AddDesc"
                      className="input textarea arc2-add-textarea"
                      rows={8}
                      placeholder="Кратко опишите содержимое — текст сохранится на карточке."
                      value={active.description}
                      onChange={(e) => updateActive({ description: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="hint input-inline-error arc2-add-error panel elevation-default" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? <p className="hint arc2-add-busy">Импортирование…</p> : null}
    </div>
  );
}
