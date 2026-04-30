import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import {
  ARC2_CARDS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  isLibraryConfigured,
  listCardsPage,
  listSimilarCards,
  type CardRecord,
  type TagRecord
} from '../services/db';

const PAGE_INITIAL = 50;
const PAGE_MORE = 25;

function filterFromParams(raw: string | null): 'all' | 'images' | 'videos' {
  if (raw === 'images' || raw === 'videos') return raw;
  return 'all';
}

export default function GalleryPage() {
  const [searchParams] = useSearchParams();
  const filter = filterFromParams(searchParams.get('gf'));
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());

  const loadTagsIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const m = new Map<string, TagRecord>();
    for (const list of lists) {
      for (const t of list) m.set(t.id, t);
    }
    setTagsIndex(m);
  }, []);

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listCardsPage({
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
    [filter]
  );

  useEffect(() => {
    void (async () => {
      const ok = await isLibraryConfigured();
      setReady(ok);
      if (ok) {
        await loadTagsIndex();
        setCards([]);
        setOffset(0);
        setHasMore(true);
        await loadPage(0, false);
      }
    })();
  }, [loadPage, loadTagsIndex]);

  useEffect(() => {
    const onCards = () => {
      void loadPage(0, false);
      void loadTagsIndex();
    };
    window.addEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
    window.addEventListener('arc2:library-changed', onCards);
    return () => {
      window.removeEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
      window.removeEventListener('arc2:library-changed', onCards);
    };
  }, [loadPage, loadTagsIndex]);

  useEffect(() => {
    if (!ready) return;
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [filter, ready, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !ready || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(offset, true);
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, hasMore, loading, offset, loadPage]);

  const overlay = useMemo(() => {
    if (!ready) {
      return (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">Сначала укажите папку библиотеки в разделе «Настройки».</p>
        </div>
      );
    }
    if (cards.length === 0 && !loading) {
      return (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">Карточек пока нет. Добавьте изображения через «Добавить карточки».</p>
        </div>
      );
    }
    return null;
  }, [ready, cards.length, loading]);

  return (
    <div className="arc2-gallery-page">
      {overlay}
      {ready && cards.length > 0 ? (
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
      ) : null}

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
