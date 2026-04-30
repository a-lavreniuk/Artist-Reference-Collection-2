import { useCallback, useEffect, useMemo, useState } from 'react';
import { invalidateLibraryCache, getNavbarMetrics } from '../services/db';

function runningInElectronShell(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

export default function SettingsPage() {
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arcHint = useMemo(() => {
    if (typeof window === 'undefined' || window.arc) return null;
    const inElectron = runningInElectronShell();
    if (!inElectron) {
      return (
        <>
          Сейчас интерфейс открыт не в Electron (например, вкладка браузера на <code className="typo-p-m">localhost:5173</code>
          ). Выбор папки и файлов работает только в десктопном окне приложения.
          <br />
          Запустите из корня проекта: <code className="typo-p-m">npm run dev</code> и пользуйтесь появившимся окном ARC, не копируйте URL в Chrome.
        </>
      );
    }
    return (
      <>
        Окно Electron открыто, но API хранилища не подключился (нет <code className="typo-p-m">window.arc</code>). Выполните{' '}
        <code className="typo-p-m">npm run build:main && npm run build:preload</code>, перезапустите <code className="typo-p-m">npm run dev</code>{' '}
        и проверьте консоль DevTools на ошибки загрузки preload.
      </>
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!window.arc) {
      setLibraryPath(null);
      return;
    }
    const p = await window.arc.getLibraryPath();
    setLibraryPath(p);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pickFolder = async () => {
    if (!window.arc) {
      setError('Функция доступна только в приложении Electron.');
      return;
    }
    setError(null);
    const picked = await window.arc.pickLibraryFolder();
    if (!picked) return;
    setBusy(true);
    try {
      const res = await window.arc.setLibraryPath(picked);
      if (!res.ok) {
        setError(res.error ?? 'Не удалось сохранить путь');
        return;
      }
      invalidateLibraryCache();
      await refresh();
      await getNavbarMetrics();
      window.dispatchEvent(new CustomEvent('arc2:library-changed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="arc2-settings panel elevation-default">
      <h2 className="h2" style={{ marginTop: 0 }}>
        Хранилище
      </h2>
      <p className="typo-p-m hint">
        Укажите папку библиотеки на диске. Внутри неё будут каталоги <code className="typo-p-m">media/</code> и файл
        метаданных.
      </p>
      <div className="arc2-settings-row">
        <div className={`field field-full input-live${error ? ' input-live--error' : ''}`}>
          <label className="field-label">Текущая папка</label>
          <div className="input input--size-l">
            <input
              className="input-native"
              readOnly
              value={libraryPath ?? 'Не выбрана'}
              aria-invalid={Boolean(error)}
            />
          </div>
          {error ? (
            <p className="hint input-inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button type="button" className="btn btn-primary btn-ds" onClick={() => void pickFolder()} disabled={busy || !window.arc}>
          <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Выбрать папку'}</span>
        </button>
      </div>
      {!window.arc && arcHint ? <p className="hint arc2-settings-electron-hint">{arcHint}</p> : null}
    </div>
  );
}
