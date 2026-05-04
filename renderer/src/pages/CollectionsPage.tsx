import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CollectionPreviewMosaic from '../components/collections/CollectionPreviewMosaic';
import NewCollectionModal from '../components/collections/NewCollectionModal';
import { ARC2_COLLECTIONS_ADD_REQUEST } from '../components/layout/navbarEvents';
import { hydrateArc2NavbarIcons } from '../components/layout/navbarIconHydrate';
import {
  addCollection,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  ARC2_COLLECTIONS_CHANGED_EVENT,
  type CardRecord,
  type CollectionRecord
} from '../services/db';

export default function CollectionsPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CollectionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [previewByCollection, setPreviewByCollection] = useState<Record<string, CardRecord[]>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [existingLowerNames, setExistingLowerNames] = useState<Set<string>>(() => new Set());

  const reload = useCallback(async () => {
    const cols = await getAllCollections();
    setItems(cols);
    const [countsMap, prev] = await Promise.all([getCollectionCardCounts(), getCollectionPreviewSlices(3)]);
    setCounts(countsMap);
    setPreviewByCollection(prev);
    setExistingLowerNames(new Set(cols.map((c) => c.name.trim().toLowerCase()).filter(Boolean)));
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [items]);

  useEffect(() => {
    void reload();
    const onEvt = () => void reload();
    window.addEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onEvt);
    const onLib = () => void reload();
    window.addEventListener('arc2:library-changed', onLib);
    return () => {
      window.removeEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onEvt);
      window.removeEventListener('arc2:library-changed', onLib);
    };
  }, [reload]);

  useEffect(() => {
    const onAdd = () => setModalOpen(true);
    window.addEventListener(ARC2_COLLECTIONS_ADD_REQUEST, onAdd);
    return () => window.removeEventListener(ARC2_COLLECTIONS_ADD_REQUEST, onAdd);
  }, []);

  return (
    <div ref={hostRef} className="arc2-collections-page">
      {items.length === 0 ? (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">Коллекций пока нет. Нажмите «Добавить коллекцию» в шапке.</p>
        </div>
      ) : (
        <div className="arc2-collections-grid">
          {items.map((c) => {
            const previews = previewByCollection[c.id] ?? [];
            const cnt = counts[c.id] ?? 0;
            return (
              <article key={c.id} className="arc2-collections-card">
                <div className="arc2-collections-card-mosaic-wrap">
                  <Link className="arc2-collections-card-preview-link" to={`/collections/${c.id}`}>
                    <CollectionPreviewMosaic previews={previews} />
                  </Link>
                </div>
                <Link className="arc2-collections-card-footer-link" to={`/collections/${c.id}`}>
                  <footer className="arc2-collections-card-footer">
                    <h3 className="arc2-collections-card-name">{c.name}</h3>
                    <span className="arc2-collections-card-count">{cnt}</span>
                  </footer>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <NewCollectionModal
          existingLowerNames={existingLowerNames}
          onClose={() => setModalOpen(false)}
          onSubmit={async (name) => {
            await addCollection(name);
          }}
        />
      ) : null}
    </div>
  );
}
