import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNavbarMetrics, invalidateLibraryCache, listCardsSorted } from '../../services/db';
import type { ArcMetadataV1 } from '../../services/arcSchema';
import { analyzeIntegrity, applyMetadataWarningFixes } from '../../services/libraryIntegrity';
import MessageModal from '../../components/layout/MessageModal';
import DemoAlert, { type DemoAlertVariant } from '../../components/layout/DemoAlert';
import ConfirmModal from './ConfirmModal';
import OldFolderModal from './OldFolderModal';
import { formatBytesRoundedToMb } from '../../utils/formatBytes';
import { computeLibraryMediaBytesFromCards } from '../../utils/computeLibraryMediaBytesFromCards';

function runningInElectronShell(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

type BackupPart = 1 | 2 | 4 | 8;

const BACKUP_PARTS: readonly BackupPart[] = [1, 2, 4, 8] as const;

type BackupAlert = { variant: DemoAlertVariant; message: string };

export default function SettingsStoragePanel() {
  const [libraryPath, setLibraryPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [migrateTarget, setMigrateTarget] = useState<string | null>(null);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [oldFolderPath, setOldFolderPath] = useState<string | null>(null);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [confirmedParts, setConfirmedParts] = useState<BackupPart | null>(null);
  const [backupAlert, setBackupAlert] = useState<BackupAlert | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
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

  /**
   * Суммарный объём медиа: байты из полей карточки + для записей без размера
   * — реальные размеры файлов на диске (IPC), как у старых карточек до появления
   * `fileSize` в БД.
   */
  const refreshBytesTotal = useCallback(async () => {
    if (!window.arc) {
      setBytesTotal(0);
      return;
    }
    try {
      const cards = await listCardsSorted('all');
      setBytesTotal(await computeLibraryMediaBytesFromCards(window.arc, cards));
    } catch {
      setBytesTotal(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshBytesTotal();
  }, [refresh, refreshBytesTotal]);

  useEffect(() => {
    const onLibraryChanged = () => {
      void refresh();
      void refreshBytesTotal();
    };
    window.addEventListener('arc2:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc2:library-changed', onLibraryChanged);
  }, [refresh, refreshBytesTotal]);

  /**
   * Подписка на прогресс бэкапа. Источник — onBackupProgress.
   * Алерт прогресса (info, без автоскрытия) обновляется на phase 'scan' и 'pack'.
   * На 'done' и 'error' переключаемся на success/danger с обычным автоскрытием.
   * При ошибке также сбрасываем подсветку группы.
   */
  useEffect(() => {
    if (!window.arc?.onBackupProgress) return undefined;
    return window.arc.onBackupProgress((p) => {
      const o = p as { percent?: number; phase?: string; message?: string };
      if (o.phase === 'error') {
        setBackupAlert({
          variant: 'danger',
          message: o.message?.trim() ? o.message : 'Не удалось создать резервную копию.'
        });
        setConfirmedParts(null);
        return;
      }
      if (o.phase === 'done') {
        setBackupAlert({ variant: 'success', message: 'Резервная копия готова' });
        return;
      }
      const pct = typeof o.percent === 'number' && Number.isFinite(o.percent) ? Math.round(o.percent) : 0;
      setBackupAlert({
        variant: 'info',
        message: `Идёт создание резервной копии ${pct}%`
      });
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

  /**
   * Текст для кнопки группы: вариант N=1 — единая подпись «Одним архивом X»,
   * остальные — число + «вес части» в `btn-ds__counter`.
   */
  const perPartLabel = useCallback(
    (n: BackupPart) => formatBytesRoundedToMb(bytesTotal / n),
    [bytesTotal]
  );

  /**
   * Клик по любой кнопке группы (включая повторный клик по подсвеченной):
   * 1) системный выбор папки;
   * 2) при отмене — снимаем подсветку, ничего не запускаем;
   * 3) при выборе — подсвечиваем N и запускаем бэкап.
   */
  const onClickBackupOption = useCallback(async (n: BackupPart) => {
    if (!window.arc) return;
    const dest = await window.arc.pickLibraryFolder();
    if (!dest) {
      setConfirmedParts(null);
      return;
    }
    setConfirmedParts(n);
    setBackupAlert({ variant: 'info', message: 'Идёт создание резервной копии 0%' });
    const res = await window.arc.backupStart({ destDir: dest, partCount: n });
    if (!res.ok) {
      setConfirmedParts(null);
      setBackupAlert({
        variant: 'danger',
        message: res.error?.trim() ? res.error : 'Не удалось создать резервную копию.'
      });
    }
  }, []);

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

  /**
   * Сценарий восстановления (после подтверждения в ConfirmModal):
   * выбор первой части архива → выбор пустой папки → restoreLibrary.
   * Ошибки показываем через DemoAlert (вариант danger).
   */
  const runRestoreFlow = async () => {
    setShowRestoreConfirm(false);
    if (!window.arc) return;
    const first = await window.arc.pickBackupArchive();
    if (!first) return;
    const dest = await window.arc.pickLibraryFolder();
    if (!dest) return;
    if (!(await window.arc.dirIsEmpty(dest))) {
      setBackupAlert({ variant: 'danger', message: 'Папка восстановления должна быть пустой.' });
      return;
    }
    const res = await window.arc.restoreLibrary({ firstPartPath: first, destDir: dest });
    if (!res.ok) {
      setBackupAlert({
        variant: 'danger',
        message: res.error?.trim() ? res.error : 'Не удалось восстановить библиотеку.'
      });
    }
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
          <div className="arc2-settings-storage-layout">
            <span className="arc2-settings-storage-icon arc2-settings-storage-icon--copy" aria-hidden="true" />
            <div className="arc2-settings-storage-head">
              <h2 className="h2 arc2-settings-block__title arc2-settings-storage-title">Резервная копия</h2>
              <p className="typo-p-l arc2-settings-storage-subtitle">
                Создание архивной копии базы данных. Архив можно разделить на несколько частей
              </p>
            </div>
            <div className="arc2-settings-backup-controls">
              <div className="btn-group btn-group-ds" role="group" aria-label="Количество частей резервной копии">
                {BACKUP_PARTS.map((n) => {
                  const selected = confirmedParts === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`btn btn-outline btn-ds${selected ? ' state-hover' : ''}`}
                      onClick={() => void onClickBackupOption(n)}
                      disabled={!window.arc}
                      aria-pressed={selected}
                    >
                      {n === 1 ? (
                        <>
                          <span className="btn-ds__value">Одним архивом</span>
                          <span className="btn-ds__counter">{perPartLabel(n)}</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-ds__value">{n}</span>
                          <span className="btn-ds__counter">{perPartLabel(n)}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-ds"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={!window.arc}
              >
                <span className="btn-ds__value">Восстановить резервную копию</span>
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

      {showRestoreConfirm ? (
        <ConfirmModal
          title="Восстановление"
          message="Восстановление заменит текущую библиотеку. Приложение перезапустится после завершения. Продолжить?"
          confirmLabel="Продолжить"
          onCancel={() => setShowRestoreConfirm(false)}
          onConfirm={() => void runRestoreFlow()}
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

      {backupAlert ? (
        <DemoAlert
          message={backupAlert.message}
          variant={backupAlert.variant}
          onClose={() => setBackupAlert(null)}
          autoDismissMs={backupAlert.variant === 'info' ? 0 : undefined}
        />
      ) : null}
    </div>
  );
}
