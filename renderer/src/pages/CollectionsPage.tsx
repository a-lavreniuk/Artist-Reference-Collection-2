import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NewCollectionModal from '../components/collections/NewCollectionModal';
import { ARC2_COLLECTIONS_ADD_REQUEST } from '../components/layout/navbarEvents';
import {
  addCollection,
  deleteCollection,
  getAllCollections,
  ARC2_COLLECTIONS_CHANGED_EVENT,
  type CollectionRecord
} from '../services/db';

export default function CollectionsPage() {
  const [items, setItems] = useState<CollectionRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setItems(await getAllCollections());
  }, []);

  useEffect(() => {
    void load();
    const onEvt = () => void load();
    window.addEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onEvt);
    const onLib = () => void load();
    window.addEventListener('arc2:library-changed', onLib);
    return () => {
      window.removeEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onEvt);
      window.removeEventListener('arc2:library-changed', onLib);
    };
  }, [load]);

  useEffect(() => {
    const onAdd = () => setModalOpen(true);
    window.addEventListener(ARC2_COLLECTIONS_ADD_REQUEST, onAdd);
    return () => window.removeEventListener(ARC2_COLLECTIONS_ADD_REQUEST, onAdd);
  }, []);

  return (
    <div className="arc2-collections-page">
      {items.length === 0 ? (
        <div className="arc2-page-empty panel elevation-default">
          <p className="typo-p-m">Коллекций пока нет. Нажмите «Добавить коллекцию» в шапке.</p>
        </div>
      ) : (
        <ul className="arc2-collections-list">
          {items.map((c) => (
            <li key={c.id} className="arc2-collections-row panel elevation-default">
              <Link className="arc2-collections-link typo-p-m" to={`/collections/${c.id}`}>
                {c.name}
              </Link>
              <button
                type="button"
                className="btn btn-outline btn-ds btn-ds--compact"
                onClick={() => void deleteCollection(c.id)}
              >
                <span className="btn-ds__value">Удалить</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <NewCollectionModal
          onClose={() => setModalOpen(false)}
          onSubmit={async (name) => {
            await addCollection(name);
          }}
        />
      ) : null}
    </div>
  );
}
