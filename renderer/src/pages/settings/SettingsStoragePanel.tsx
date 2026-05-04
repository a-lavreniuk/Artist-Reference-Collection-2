import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNavbarMetrics, invalidateLibraryCache, listCardsSorted } from '../../services/db';
import type { ArcMetadataV1 } from '../../services/arcSchema';
import { analyzeIntegrity, applyMetadataWarningFixes } from '../../services/libraryIntegrity';
import MessageModal from '../../components/layout/MessageModal';
import ConfirmModal from './ConfirmModal';
import OldFolderModal from './OldFolderModal';

function runningInElectronShell(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

type BackupPart = 1 | 2 | 4 | 8;

export default function SettingsStoragePanel() {
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [migrateTarget, setMigrateTarget] = useState<string | null>(null);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [oldFolderPath, setOldFolderPath] = useState<string | null>(null);
  const [backupParts, setBackupParts] = useState<BackupPart>(1);
  const [backupDest, setBackupDest] = useState<string | null>(null);
  const [backupProgress, setBackupProgress] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [warnModal, setWarnModal] = useState<{ text: string; onFix: () => void } | null>(null);

  const arcHint = useMemo(() => {
    if (typeof window === 'undefined' || window.arc) return null;
    const inElectron = runningInElectronShell();
    if (!inElectron) {
      return (
        <>
          Сейчас интерфейс открыт не в Electron. Выбор папки работает только в окне ARC после{' '}
          <code className="typo-p-m">npm run dev</code>.
        </>
      );
    }
    return (
      <>
        Нет <code className="typo-p-m">window.arc</code>. Выполните <code className="typo-p-m">npm run build:main && npm run build:preload</code> и
        перезапустите dev.
      </>
    );
  }, []);

  const refresh = useCallback(async () => {
    if (!window.arc) {
      setLibraryPath(null);
      return;
    }
    setLibraryPath(await window.arc.getLibraryPath());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!window.arc?.onBackupProgress) return undefined;
    return window.arc.onBackupProgress((p) => {
      const o = p as { percent?: number; phase?: string; message?: string; etaSeconds?: number };
      if (o.phase === 'error' && o.message) setBackupProgress(null);
      if (o.message && o.phase === 'error') {
        setInfoModal(o.message);
        return;
      }
      const pct = typeof o.percent === 'number' ? o.percent : 0;
      const eta = typeof o.etaSeconds === 'number' ? `, ~${o.etaSeconds} с` : '';
      setBackupProgress(`Бэкап: ${pct}%${eta}`);
    });
  }, []);

  /** Один сценарий: выбор папки → либо первичное указание библиотеки, либо перенос в пустую папку. */
  const chooseLibraryFolderFlow = async () => {
    if (!window.arc) return;
    setFieldError(false);
    setMigrateError(null);
    const picked = await window.arc.pickLibraryFolder();
    if (!picked) return;

    const current = await window.arc.getLibraryPath();

    if (!current) {
      setBusy(true);
      try {
        const res = await window.arc.setLibraryPath(picked);
        if (!res.ok) {
          setFieldError(true);
          setInfoModal(res.error ?? 'Не удалось сохранить путь');
          return;
        }
        invalidateLibraryCache();
        await refresh();
        await getNavbarMetrics();
        window.dispatchEvent(new CustomEvent('arc2:library-changed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    if (norm(picked) === norm(current)) {
      setMigrateError('Выберите другую папку — она совпадает с текущей библиотекой.');
      setInfoModal('Выберите другую папку — она совпадает с текущей библиотекой.');
      return;
    }

    const empty = await window.arc.dirIsEmpty(picked);
    if (!empty) {
      setMigrateError('Целевая папка должна быть пустой.');
      setInfoModal('Целевая папка должна быть пустой.');
      return;
    }
    setMigrateTarget(picked);
    setShowMigrateConfirm(true);
  };

  const runMigrate = async () => {
    if (!window.arc || !migrateTarget) return;
    setShowMigrateConfirm(false);
    setBusy(true);
    setMigrateError(null);
    try {
      const res = await window.arc.migrateLibrary(migrateTarget);
      if (!res.ok) {
        setMigrateError(res.error);
        setInfoModal(res.error);
        return;
      }
      invalidateLibraryCache();
      await refresh();
      await getNavbarMetrics();
      window.dispatchEvent(new CustomEvent('arc2:library-changed'));
      setOldFolderPath(res.oldLibraryPath);
    } finally {
      setBusy(false);
      setMigrateTarget(null);
    }
  };

  const pickBackupDest = async () => {
    if (!window.arc) return;
    const p = await window.arc.pickLibraryFolder();
    if (p) setBackupDest(p);
  };

  const startBackup = async () => {
    if (!window.arc || !backupDest) {
      setInfoModal('Выберите папку для сохранения бэкапа.');
      return;
    }
    setBackupProgress('Запуск…');
    const res = await window.arc.backupStart({ destDir: backupDest, partCount: backupParts });
    if (!res.ok) {
      setBackupProgress(null);
      setInfoModal(res.error ?? 'Ошибка бэкапа');
    } else {
      setBackupProgress('Готово');
      setTimeout(() => setBackupProgress(null), 2000);
    }
  };

  const cancelBackup = async () => {
    if (!window.arc) return;
    await window.arc.backupCancel();
    setBackupProgress(null);
  };

  const runIntegrity = async () => {
    if (!window.arc) return;
    const meta = (await window.arc.readMetadata()) as ArcMetadataV1 | null;
    if (!meta) {
      setInfoModal('Нет метаданных библиотеки.');
      return;
    }
    const cards = await listCardsSorted('all');
    const rels = new Set<string>();
    for (const c of cards) {
      rels.add(c.originalRelativePath);
      rels.add(c.thumbRelativePath);
    }
    const { missing } = await window.arc.verifyLibraryPaths([...rels]);
    const missSet = new Set(missing);
    const issues = analyzeIntegrity(meta, missSet);
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    if (errors.length > 0) {
      setInfoModal(errors.map((e) => e.detail).join('\n'));
      return;
    }
    if (warnings.length === 0) {
      setInfoModal('Проверка завершена: проблем не найдено.');
      return;
    }
    setWarnModal({
      text: warnings.map((w) => w.detail).join('\n'),
      onFix: async () => {
        setWarnModal(null);
        const arc = window.arc;
        if (!arc) return;
        const fixed = applyMetadataWarningFixes(meta);
        await arc.writeMetadata(fixed);
        invalidateLibraryCache();
        window.dispatchEvent(new CustomEvent('arc2:library-changed'));
        const again = analyzeIntegrity(fixed, missSet);
        const err2 = again.filter((i) => i.level === 'error');
        if (err2.length) setInfoModal(err2.map((e) => e.detail).join('\n'));
        else setInfoModal('Исправления применены.');
      }
    });
  };

  const runRestore = async () => {
    if (!window.arc) return;
    const first = await window.arc.pickBackupArchive();
    if (!first) return;
    const dest = await window.arc.pickLibraryFolder();
    if (!dest) return;
    if (!(await window.arc.dirIsEmpty(dest))) {
      setInfoModal('Папка восстановления должна быть пустой.');
      return;
    }
    const res = await window.arc.restoreLibrary({ firstPartPath: first, destDir: dest });
    if (!res.ok) setInfoModal(res.error);
  };

  return (
    <div className="arc2-settings-stack">
      <div className="arc2-settings-storage-row">
        <section className="arc2-settings-block panel elevation-sunken arc2-settings-block--tile">
          <div className="arc2-settings-storage-layout">
            <span className="arc2-settings-storage-icon arc2-settings-storage-icon--hard-drive" aria-hidden="true" />
            <div className="arc2-settings-storage-head">
              <h2 className="h2 arc2-settings-block__title arc2-settings-storage-title">Локальное хранилище</h2>
              <p className="typo-p-l arc2-settings-storage-subtitle">
                Папка на компьютере для автоматического сохранения загружаемых файлов
              </p>
            </div>
            <div className="arc2-settings-storage-controls">
              <div className={`field field-full input-live${fieldError ? ' field-error' : ''}`}>
                <input
                  id="arc2-settings-library-path"
                  className="input input--size-l"
                  readOnly
                  value={libraryPath ?? 'Не выбрана'}
                  aria-label="Текущая папка библиотеки"
                  aria-invalid={fieldError}
                />
              </div>
              <button type="button" className="btn btn-primary btn-ds" onClick={() => void chooseLibraryFolderFlow()} disabled={busy || !window.arc}>
                <span className="btn-ds__value">{busy ? '…' : 'Перенести'}</span>
              </button>
            </div>
          </div>
          {migrateError ? <p className="hint">{migrateError}</p> : null}
          {!window.arc && arcHint ? (
            <div className="typo-p-m hint arc2-settings-electron-hint">{arcHint}</div>
          ) : null}
        </section>

        <section className="arc2-settings-block panel elevation-sunken arc2-settings-block--tile">
        <h2 className="h2 arc2-settings-block__title">Резервная копия и восстановление</h2>
        <div className="arc2-settings-field-row">
          <span className="label">Части</span>
          <div className="arc2-settings-segment">
            {([1, 2, 4, 8] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`btn btn-ds btn-s${backupParts === n ? ' btn-primary' : ' btn-outline'}`}
                onClick={() => setBackupParts(n)}
              >
                <span className="btn-ds__value">{n === 1 ? 'Один файл' : String(n)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="arc2-settings-row">
          <div className="field field-full input-live">
            <label className="label" htmlFor="arc2-settings-backup-dest">
              Папка сохранения
            </label>
            <input
              id="arc2-settings-backup-dest"
              className="input input--size-l"
              readOnly
              value={backupDest ?? 'Не выбрана'}
            />
          </div>
          <button type="button" className="btn btn-outline btn-ds" onClick={() => void pickBackupDest()} disabled={!window.arc}>
            <span className="btn-ds__value">Выбрать</span>
          </button>
        </div>
        <div className="arc2-settings-row arc2-settings-row--wrap">
          <button type="button" className="btn btn-primary btn-ds" onClick={() => void startBackup()} disabled={!window.arc}>
            <span className="btn-ds__value">Создать бэкап</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds" onClick={() => void cancelBackup()} disabled={!window.arc}>
            <span className="btn-ds__value">Отменить бэкап</span>
          </button>
        </div>
        {backupProgress ? <p className="typo-p-m hint">{backupProgress}</p> : null}
        <div className="arc2-settings-restore">
          <p className="typo-p-m hint">
            Восстановление: первый файл <code className="typo-p-m">.part01</code> или одиночный <code className="typo-p-m">.arc</code>, затем пустая папка. Приложение перезапустится.
          </p>
          <div className="arc2-settings-row arc2-settings-row--wrap">
            <button type="button" className="btn btn-outline btn-ds" onClick={() => void runRestore()} disabled={!window.arc}>
              <span className="btn-ds__value">Восстановить из бэкапа…</span>
            </button>
          </div>
        </div>
        </section>

        <section className="arc2-settings-block panel elevation-sunken arc2-settings-block--tile">
        <h2 className="h2 arc2-settings-block__title">Проверка данных</h2>
        <button type="button" className="btn btn-secondary btn-ds" onClick={() => void runIntegrity()} disabled={!window.arc}>
          <span className="btn-ds__value">Проверить</span>
        </button>
        </section>
      </div>

      {showMigrateConfirm ? (
        <ConfirmModal
          title="Перенос библиотеки"
          message="Вы уверены, что хотите перенести файлы? Будет скопировано всё содержимое в выбранную пустую папку."
          confirmLabel="Перенести"
          onCancel={() => {
            setShowMigrateConfirm(false);
            setMigrateTarget(null);
          }}
          onConfirm={() => void runMigrate()}
        />
      ) : null}

      {oldFolderPath ? (
        <OldFolderModal
          pathLabel={oldFolderPath}
          onLeave={() => setOldFolderPath(null)}
          onTrash={async () => {
            if (!window.arc) return;
            await window.arc.trashPath(oldFolderPath);
            setOldFolderPath(null);
          }}
          onOpenInExplorer={() => {
            void window.arc?.showAbsoluteInFolder(oldFolderPath);
            setOldFolderPath(null);
          }}
        />
      ) : null}

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}

      {warnModal ? (
        <ConfirmModal
          title="Предупреждения"
          message={warnModal.text}
          confirmLabel="Исправить"
          cancelLabel="Закрыть"
          onCancel={() => setWarnModal(null)}
          onConfirm={() => void warnModal.onFix()}
        />
      ) : null}
    </div>
  );
}
