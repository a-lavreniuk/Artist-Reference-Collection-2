import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArc2NavbarIcons } from './navbarIconHydrate';

type Props = {
  categoryName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export default function ConfirmDeleteCategoryModal({ categoryName, onClose, onConfirm }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [busy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc2DeleteCategoryTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arc2DeleteCategoryTitle">
            Удалить категорию?
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc2-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">
              Категория «{categoryName}» и все метки в ней будут удалены. Это действие нельзя отменить.
            </p>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds btn-s" disabled={busy} onClick={onClose}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button
            type="button"
            className="btn btn-danger btn-ds btn-s"
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            <span className="btn-ds__value">{busy ? 'Удаление…' : 'Удалить'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
