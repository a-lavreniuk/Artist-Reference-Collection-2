import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
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

  const [collectionName, setCollectionName] = useState('');
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
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
          filter
        });
        setHasMore(chunk.length === take);
        setOffset(start + chunk.length);
        setCards((prev) => (append ? [...prev, ...chunk] : chunk));
      } finally {
        setLoading(false);
      }
    },
    [collectionId, filter]
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
  }, [collectionId, filter, loadPage]);

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

  const rename = async () => {
    if (!collectionId) return;
    const next = window.prompt('Новое название коллекции', collectionName);
    if (!next || !next.trim()) return;
    try {
      await renameCollection(collectionId, next.trim());
      await loadMeta();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Ошибка переименования');
    }
  };

  const remove = async () => {
    if (!collectionId) return;
    if (!window.confirm('Удалить коллекцию? Карточки останутся в галерее.')) return;
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
          <button type="button" className="btn btn-outline btn-ds" onClick={() => void rename()}>
            <span className="btn-ds__value">Переименовать</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds" onClick={() => void remove()}>
            <span className="btn-ds__value">Удалить коллекцию</span>
          </button>
        </div>
      </div>

      {cards.length === 0 && !loading ? (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">В коллекции пока нет карточек.</p>
        </div>
      ) : (
        <>
          <GalleryBoard
            cards={cards}
            onOpenCard={(id) => setOpenCardId(id)}
            onFindSimilar={async (id) => {
              const sim = await listSimilarCards(id, 1);
              if (sim.length === 0) {
                window.alert('Нет карточек с общими метками');
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
    </div>
  );
}
