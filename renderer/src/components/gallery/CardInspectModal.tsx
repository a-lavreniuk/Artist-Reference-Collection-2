import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hydrateArc2NavbarIcons } from '../layout/navbarIconHydrate';
import type { CardRecord, CategoryRecord, TagRecord } from '../../services/db';
import {
  getMoodboardCardIds,
  deleteCard,
  getAllCategories,
  getAllCollections,
  getCardById,
  getCollectionCardCounts,
  listSimilarCards,
  toggleCardInMoodboard
} from '../../services/db';

type Props = {
  cardId: string;
  tagsIndex: Map<string, TagRecord>;
  onClose: () => void;
  onDeleted: () => void;
  onOpenCard: (id: string) => void;
};

function SimilarThumb({
  card,
  onPick
}: {
  card: CardRecord;
  onPick: () => void;
}) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!window.arc) return;
      const rel = card.thumbRelativePath || card.originalRelativePath;
      if (!rel || rel === 'legacy') return;
      const u = await window.arc.toFileUrl(rel);
      if (!cancelled) setHref(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <button type="button" className="arc2-card-similar-thumb" onClick={onPick}>
      {href ? (
        <img src={href} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="arc2-gallery-skeleton arc2-card-similar-skeleton" aria-hidden />
      )}
    </button>
  );
}

export default function CardInspectModal({ cardId, tagsIndex, onClose, onDeleted, onOpenCard }: Props) {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<CardRecord | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [categoriesById, setCategoriesById] = useState<Map<string, CategoryRecord>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, string>>(new Map());
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [similar, setSimilar] = useState<CardRecord[]>([]);
  const [inMoodboard, setInMoodboard] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [confirmDelete, busy, card, similar, categoriesById, inMoodboard, isBookmarkHovered]);

  useEffect(() => {
    void (async () => {
      const cats = await getAllCategories();
      const cm = new Map<string, CategoryRecord>();
      for (const c of cats) cm.set(c.id, c);
      setCategoriesById(cm);

      const cols = await getAllCollections();
      const colm = new Map<string, string>();
      for (const c of cols) colm.set(c.id, c.name);
      setCollectionsById(colm);

      const counts = await getCollectionCardCounts();
      setCollCounts(counts);

      const c = await getCardById(cardId);
      setCard(c);

      if (c && window.arc) {
        const rel = c.originalRelativePath || c.thumbRelativePath;
        if (rel && rel !== 'legacy') {
          const href = await window.arc.toFileUrl(rel);
          setSrc(href);
        } else {
          setSrc(null);
        }
      } else {
        setSrc(null);
      }

      const sim = await listSimilarCards(cardId, 15);
      setSimilar(sim);

      const moodboardIds = await getMoodboardCardIds();
      setInMoodboard(moodboardIds.includes(cardId));
    })();
  }, [cardId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete]);

  const tagsResolved =
    card?.tagIds
      .map((id) => {
        const t = tagsIndex.get(id);
        if (!t) return null;
        const cat = categoriesById.get(t.categoryId);
        return { tag: t, colorHex: cat?.colorHex ?? '#989aa4' };
      })
      .filter((x): x is { tag: TagRecord; colorHex: string } => x !== null) ?? [];

  const collectionsResolved =
    card?.collectionIds
      .map((id) => ({
        id,
        name: collectionsById.get(id) ?? id,
        count: collCounts[id] ?? 0
      }))
      .filter((x) => x.name) ?? [];

  const handleDelete = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await deleteCard(card.id);
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.id);
    } catch {
      /* Electron / браузер без доступа к буферу */
    }
  };

  const openInFolder = () => {
    if (!card?.originalRelativePath || !window.arc) return;
    void window.arc.showItemInFolder(card.originalRelativePath);
  };

  const editCard = () => {
    if (!card) return;
    onClose();
    navigate(`/gallery/${card.id}/edit`);
  };

  const openSimilarCard = async () => {
    if (!card) return;
    const candidate = similar[0] ?? (await listSimilarCards(card.id, 1))[0];
    if (!candidate) {
      window.alert('Нет карточек с общими метками');
      return;
    }
    onOpenCard(candidate.id);
  };

  const bookmarkIconClass = isBookmarkHovered
    ? inMoodboard
      ? 'arc2-icon-bookmark-minus'
      : 'arc2-icon-bookmark-plus'
    : 'arc2-icon-bookmark';
  const mediaTypeIconClass = card?.type === 'video' ? 'arc2-icon-play' : 'arc2-icon-image';

  return (
    <div ref={hostRef} className="arc-modal-host arc-modal-host--card-inspect" aria-hidden="false" role="presentation">
      <div className="arc2-card-inspect-backdrop" aria-hidden />

      <section
        className="arc-modal arc-modal--card-detail"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc2CardInspectHeading"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc2-card-inspect-toolbar">
          <h2 id="arc2CardInspectHeading" className="sr-only">
            Просмотр карточки
          </h2>
          <div className="arc2-card-inspect-toolbar-left">
            <button
              type="button"
              className="btn btn-outline btn-icon-only btn-ds arc2-card-inspect-delete"
              aria-label="Удалить карточку"
              onClick={() => setConfirmDelete(true)}
            >
              <span className="btn-icon-only__glyph arc2-icon-trash" aria-hidden="true" />
            </button>
          </div>

          <div className="arc2-card-inspect-toolbar-right">
            <div className="arc2-card-inspect-segmented" role="group" aria-label="Действия с карточкой">
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds arc2-card-inspect-segmented-btn"
                title={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                onMouseEnter={() => setIsBookmarkHovered(true)}
                onMouseLeave={() => setIsBookmarkHovered(false)}
                onFocus={() => setIsBookmarkHovered(true)}
                onBlur={() => setIsBookmarkHovered(false)}
                onClick={async () => {
                  if (!card) return;
                  const next = await toggleCardInMoodboard(card.id);
                  setInMoodboard(next);
                }}
                disabled={!card}
              >
                <span className={`btn-icon-only__glyph ${bookmarkIconClass}`} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds arc2-card-inspect-segmented-btn"
                disabled
                title="Скоро: экспорт файла"
                aria-label="Скачать (скоро)"
              >
                <span className="btn-icon-only__glyph arc2-icon-download" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds arc2-card-inspect-segmented-btn"
                onClick={() => void openInFolder()}
                disabled={!card?.originalRelativePath || !window.arc}
                title="Показать файл в папке"
                aria-label="Открыть папку с файлом"
              >
                <span className="btn-icon-only__glyph arc2-icon-folder-open" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds arc2-card-inspect-segmented-btn arc2-card-inspect-segmented-btn--last"
                onClick={() => void editCard()}
                disabled={!card}
                title="Редактировать карточку"
                aria-label="Редактировать карточку"
              >
                <span className="btn-icon-only__glyph arc2-icon-edit" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-ds arc2-card-inspect-id-pill"
              onClick={() => void copyId()}
              disabled={!card}
              title="Скопировать ID"
            >
              <span className="arc2-card-inspect-id-text">{card?.id ?? ''}</span>
              <span className="tab-icon arc2-icon-copy" aria-hidden="true" />
            </button>

            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
              <span className="tab-icon arc2-icon-close" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="arc-modal__body arc2-card-inspect-body">
          <div className="arc2-card-inspect-main">
            <div className="arc2-card-inspect-preview panel elevation-sunken">
              <span className="arc2-card-inspect-preview-badge" aria-hidden="true" data-btn-size="s">
                <span className={`tab-icon ${mediaTypeIconClass}`} style={{ color: 'var(--gray-50)' }} />
              </span>
              {src ? (
                <img className="arc2-card-inspect-img" src={src} alt="" />
              ) : (
                <div className="arc2-gallery-skeleton arc2-card-inspect-skeleton" aria-hidden />
              )}
              <span className={`arc2-card-inspect-preview-overlay${inMoodboard ? ' is-pinned' : ''}`}>
                <span className="arc2-card-inspect-preview-overlay-inner" data-btn-size="s">
                  <button
                    type="button"
                    className="btn btn-secondary btn-ds arc2-gallery-overlay-btn arc2-card-slot-blur-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void openSimilarCard();
                    }}
                    disabled={!card}
                  >
                    <span className="btn-ds__icon arc2-icon-search" aria-hidden="true" />
                    <span className="btn-ds__value">Найти похожее</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-icon-only btn-ds arc2-gallery-overlay-bookmark arc2-card-slot-blur-btn"
                    title={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                    aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                    onMouseEnter={() => setIsBookmarkHovered(true)}
                    onMouseLeave={() => setIsBookmarkHovered(false)}
                    onFocus={() => setIsBookmarkHovered(true)}
                    onBlur={() => setIsBookmarkHovered(false)}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!card) return;
                      const next = await toggleCardInMoodboard(card.id);
                      setInMoodboard(next);
                    }}
                    disabled={!card}
                  >
                    <span className={`btn-icon-only__glyph ${bookmarkIconClass}`} aria-hidden="true" />
                  </button>
                </span>
              </span>
            </div>

            <div className="arc2-card-inspect-sidebar">
              <div className="arc2-card-inspect-scroll">
                <section className="arc2-card-inspect-section">
                  <div className="arc2-card-inspect-section-head">
                    <p className="text-l">Описание</p>
                  </div>
                  <p className="text-m">{card?.description?.trim() ? card.description.trim() : '—'}</p>
                </section>

                <div className="arc2-card-inspect-sep" role="separator" />

                <section className="arc2-card-inspect-section">
                  <div className="arc2-card-inspect-section-head">
                    <p className="text-l">Коллекции</p>
                    {collectionsResolved.length > 0 ? (
                      <span className="text-s arc2-card-inspect-count">{collectionsResolved.length}</span>
                    ) : null}
                  </div>
                  {collectionsResolved.length === 0 ? (
                    <p className="text-s">Не добавлено в коллекции</p>
                  ) : (
                    <div className="arc2-card-meta-chips">
                      {collectionsResolved.map((col) => (
                        <span key={col.id} className="arc2-card-meta-chip arc2-card-meta-chip--neutral">
                          <span className="arc2-card-meta-chip-name">{col.name}</span>
                          <span className="arc2-card-meta-chip-count">{col.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <div className="arc2-card-inspect-sep" role="separator" />

                <section className="arc2-card-inspect-section">
                  <div className="arc2-card-inspect-section-head">
                    <p className="text-l">Метки</p>
                    {tagsResolved.length > 0 ? (
                      <span className="text-s arc2-card-inspect-count">{tagsResolved.length}</span>
                    ) : null}
                  </div>
                  {tagsResolved.length === 0 ? (
                    <p className="text-s">Метки не назначены</p>
                  ) : (
                    <div className="arc2-card-meta-chips arc2-card-meta-chips--tags">
                      {tagsResolved.map(({ tag, colorHex }) => (
                        <span key={tag.id} className="arc2-card-meta-chip arc2-card-meta-chip--tag">
                          <span className="arc2-card-meta-chip-dot" style={{ background: colorHex }} />
                          <span className="arc2-card-meta-chip-name">{tag.name}</span>
                          <span className="arc2-card-meta-chip-count">{tag.usageCount}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <div className="arc2-card-inspect-sep" role="separator" />

                <section className="arc2-card-inspect-section arc2-card-inspect-section--similar">
                  <div className="arc2-card-inspect-section-head">
                    <p className="text-l">Похожие</p>
                    {similar.length > 0 ? (
                      <span className="text-s arc2-card-inspect-count">{similar.length}</span>
                    ) : null}
                  </div>
                  {similar.length === 0 ? (
                    <p className="text-s">Нет карточек с общими метками</p>
                  ) : (
                    <div className="arc2-card-similar-row">
                      {similar.map((sc) => (
                        <SimilarThumb key={sc.id} card={sc} onPick={() => onOpenCard(sc.id)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      {confirmDelete ? (
        <div
          className="arc-modal-host arc-modal-host--nested"
          aria-hidden="false"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmDelete(false);
          }}
        >
          <section
            className="arc-modal"
            data-elevation="raised"
            data-input-size="s"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arc2CardDeleteTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="arc-modal__header arc-modal__header--title">
              <h3 className="arc-modal__title" id="arc2CardDeleteTitle">
                Удалить карточку?
              </h3>
              <button
                type="button"
                className="arc-modal__close"
                aria-label="Закрыть"
                onClick={() => setConfirmDelete(false)}
              >
                <span className="tab-icon arc2-icon-close" aria-hidden="true" />
              </button>
            </header>
            <div className="arc-modal__body">
              <p className="typo-p-m">Файл будет удалён из библиотеки. Это действие нельзя отменить.</p>
              <div className="arc-modal__footer">
                <button
                  type="button"
                  className="btn btn-outline btn-ds"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  <span className="btn-ds__value">Отмена</span>
                </button>
                <button type="button" className="btn btn-primary btn-ds" onClick={() => void handleDelete()} disabled={busy}>
                  <span className="btn-ds__value">{busy ? 'Удаление…' : 'Удалить'}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
