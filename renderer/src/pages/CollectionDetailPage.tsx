import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import ConfirmCollectionDeleteModal from '../components/layout/ConfirmCollectionDeleteModal';
import MessageModal from '../components/layout/MessageModal';
import RenameCollectionModal from '../components/layout/RenameCollectionModal';
import { ARC2_NAVBAR_COLLECTION_TITLE_EVENT } from '../components/layout/navbarEvents';
import {
  ARC2_CARDS_CHANGED_EVENT,
  deleteCollection,
  getAllCategories,
  getCollectionById,
  getTagsByCategory,
  listCardsInCollection,
  listSimilarCards,
  renameCollection,
  type CardRecord,
  type TagRecord
} from '../services/db';

const PAGE_INITIAL = 50;
const PAGE_MORE = 25;

function filterFromParams(raw: string | null): 'all' | 'images' | 'videos' {
  if (raw === 'images' || raw === 'videos') return raw;
  return 'all';
}

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = filterFromParams(searchParams.get('gf'));
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const hasSearchFilters = selectedTagIds.length > 0 || Boolean(cardIdExact);

  const [collectionName, setCollectionName] = useState('');
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadTagsIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const m = new Map<string, TagRecord>();
    for (const list of lists) {
      for (const t of list) m.set(t.id, t);
    }
    setTagsIndex(m);
  }, []);

  const loadMeta = useCallback(async () => {
    if (!collectionId) return;
    const c = await getCollectionById(collectionId);
    const title = c?.name ?? '';
    setCollectionName(title);
    window.dispatchEvent(new CustomEvent(ARC2_NAVBAR_COLLECTION_TITLE_EVENT, { detail: { title } }));
  }, [collectionId]);

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      if (!collectionId) return;
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listCardsInCollection(collectionId, {
          offset: start,
          limit: take,
          filter,
          selectedTagIds,
          cardIdExact
        });
        setHasMore(chunk.length === take);
        setOffset(start + chunk.length);
        setCards((prev) => (append ? [...prev, ...chunk] : chunk));
      } finally {
        setLoading(false);
      }
    },
    [collectionId, filter, selectedTagIds, cardIdExact]
  );

  useEffect(() => {
    void loadTagsIndex();
    void loadMeta();
    return () => {
      window.dispatchEvent(new CustomEvent(ARC2_NAVBAR_COLLECTION_TITLE_EVENT, { detail: { title: '' } }));
    };
  }, [loadMeta, loadTagsIndex]);

  useEffect(() => {
    if (!collectionId) return;
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [collectionId, filter, selectedTagIds, cardIdExact, loadPage]);

  useEffect(() => {
    const onCards = () => {
      void loadPage(0, false);
      void loadTagsIndex();
    };
    window.addEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
    return () => window.removeEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
  }, [loadPage, loadTagsIndex]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !collectionId || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(offset, true);
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [collectionId, hasMore, loading, offset, loadPage]);

  const title = useMemo(() => collectionName || 'Коллекция', [collectionName]);

  const removeCollection = async () => {
    if (!collectionId) return;
    await deleteCollection(collectionId);
    navigate('/collections');
  };

  if (!collectionId) {
    return null;
  }

  return (
    <div className="arc2-collection-detail">
      <div className="arc2-collection-toolbar panel elevation-default">
        <h2 className="h2 arc2-collection-toolbar-title">{title}</h2>
        <div className="arc2-collection-toolbar-actions">
          <button type="button" className="btn btn-outline btn-ds" onClick={() => setRenameModalOpen(true)}>
            <span className="btn-ds__value">Переименовать</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds" onClick={() => setDeleteModalOpen(true)}>
            <span className="btn-ds__value">Удалить коллекцию</span>
          </button>
        </div>
      </div>

      {cards.length === 0 && !loading ? (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">
            {hasSearchFilters
              ? 'Карточки не найдены. Измените фильтры поиска или сбросьте метки.'
              : 'В коллекции пока нет карточек.'}
          </p>
        </div>
      ) : (
        <>
          <GalleryBoard
            cards={cards}
            onOpenCard={(id) => setOpenCardId(id)}
            onFindSimilar={async (id) => {
              const sim = await listSimilarCards(id, 1);
              if (sim.length === 0) {
                setInfoModalMessage('Нет карточек с общими метками');
                return;
              }
              setOpenCardId(sim[0].id);
            }}
          />
          <div ref={sentinelRef} className="arc2-gallery-sentinel" aria-hidden />
          {loading ? <p className="hint arc2-gallery-loading">Загрузка…</p> : null}
        </>
      )}

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={() => setOpenCardId(null)}
          onDeleted={() => void loadPage(0, false)}
          onOpenCard={(cid) => setOpenCardId(cid)}
        />
      ) : null}

      {renameModalOpen && collectionId ? (
        <RenameCollectionModal
          initialName={collectionName}
          onClose={() => setRenameModalOpen(false)}
          onSubmit={async (next) => {
            await renameCollection(collectionId, next);
            await loadMeta();
          }}
        />
      ) : null}

      {deleteModalOpen ? (
        <ConfirmCollectionDeleteModal onClose={() => setDeleteModalOpen(false)} onConfirm={removeCollection} />
      ) : null}

      {infoModalMessage ? (
        <MessageModal message={infoModalMessage} onClose={() => setInfoModalMessage(null)} />
      ) : null}
    </div>
  );
}
