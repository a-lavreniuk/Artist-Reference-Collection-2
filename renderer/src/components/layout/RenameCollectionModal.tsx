import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArc2NavbarIcons } from './navbarIconHydrate';

type Props = {
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export default function RenameCollectionModal({ initialName, onClose, onSubmit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArc2NavbarIcons(hostRef.current);
    }
  }, [name, error, busy]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка переименования');
    } finally {
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
        aria-labelledby="arc2RenameCollectionTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arc2RenameCollectionTitle">
            Переименовать коллекцию
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc2-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className={`field field-full input-live${error ? ' input-live--error' : ''}`}>
            <label className="field-label" htmlFor="arc2RenameCollectionName">
              Новое название
            </label>
            <div className="input input--size-s">
              <input
                ref={inputRef}
                id="arc2RenameCollectionName"
                className="input-native"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(error)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit();
                }}
              />
            </div>
            {error ? (
              <p className="hint input-inline-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds" onClick={onClose} disabled={busy}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button type="button" className="btn btn-primary btn-ds" onClick={() => void handleSubmit()} disabled={busy}>
            <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Сохранить'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
