import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('arc', {
  getLibraryPath: () => ipcRenderer.invoke('arc:get-library-path') as Promise<string | null>,
  setLibraryPath: (absPath: string) =>
    ipcRenderer.invoke('arc:set-library-path', absPath) as Promise<{ ok: boolean; error?: string }>,
  pickLibraryFolder: () => ipcRenderer.invoke('arc:pick-library-folder') as Promise<string | null>,
  readMetadata: () => ipcRenderer.invoke('arc:read-metadata'),
  writeMetadata: (data: unknown) => ipcRenderer.invoke('arc:write-metadata', data),
  pickImageFiles: () => ipcRenderer.invoke('arc:pick-image-files') as Promise<string[]>,
  pickMediaFiles: () => ipcRenderer.invoke('arc:pick-media-files') as Promise<string[]>,
  importFiles: (absolutePaths: string[]) =>
    ipcRenderer.invoke('arc:import-files', absolutePaths) as Promise<
      Array<
        | {
            ok: true;
            row: {
              id: string;
              type: 'image' | 'video';
              originalRelativePath: string;
              thumbRelativePath: string;
              fileSize: number;
              addedAt: string;
              width?: number;
              height?: number;
            };
          }
        | { ok: false; error: string }
      >
    >,
  toFileUrl: (relativePath: string) =>
    ipcRenderer.invoke('arc:to-file-url', relativePath) as Promise<string | null>,
  deleteFileIfInsideLibrary: (relativePath: string) =>
    ipcRenderer.invoke('arc:delete-file-if-inside-library', relativePath),
  showItemInFolder: (relativePath: string) => ipcRenderer.invoke('arc:show-item-in-folder', relativePath),
  showAbsoluteInFolder: (absPath: string) => ipcRenderer.invoke('arc:show-absolute-in-folder', absPath),
  saveMediaToFolder: (relativePath: string) =>
    ipcRenderer.invoke('arc:save-media-to-folder', relativePath) as Promise<
      { ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }
    >,

  dirIsEmpty: (absPath: string) => ipcRenderer.invoke('arc:dir-is-empty', absPath) as Promise<boolean>,
  migrateLibrary: (targetPath: string) =>
    ipcRenderer.invoke('arc:migrate-library', targetPath) as Promise<
      { ok: true; oldLibraryPath: string } | { ok: false; error: string }
    >,
  trashPath: (absPath: string) =>
    ipcRenderer.invoke('arc:trash-path', absPath) as Promise<{ ok: true } | { ok: false; error?: string }>,
  readHistory: () => ipcRenderer.invoke('arc:read-history') as Promise<Array<{ time: string; message: string }>>,
  appendHistoryLine: (message: string) => ipcRenderer.invoke('arc:append-history-line', message) as Promise<void>,
  pickBackupArchive: () => ipcRenderer.invoke('arc:pick-backup-archive') as Promise<string | null>,
  backupStart: (opts: { destDir: string; partCount: 1 | 2 | 4 | 8 }) =>
    ipcRenderer.invoke('arc:backup-start', opts) as Promise<{ ok: true } | { ok: false; error: string }>,
  backupCancel: () => ipcRenderer.invoke('arc:backup-cancel') as Promise<{ ok: true }>,
  onBackupProgress: (cb: (p: unknown) => void) => {
    const fn = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('arc:backup-progress', fn);
    return () => ipcRenderer.removeListener('arc:backup-progress', fn);
  },
  restoreLibrary: (payload: { firstPartPath: string; destDir: string }) =>
    ipcRenderer.invoke('arc:restore-library', payload) as Promise<
      { ok: true; restart: true } | { ok: false; error: string }
    >,
  consumePendingRestoreModal: () =>
    ipcRenderer.invoke('arc:consume-pending-restore-modal') as Promise<{ message: string } | null>,
  verifyLibraryPaths: (relativePaths: string[]) =>
    ipcRenderer.invoke('arc:verify-library-paths', relativePaths) as Promise<{ missing: string[] }>,
  maintenanceBegin: () => ipcRenderer.invoke('arc:maintenance-begin') as Promise<{ ok: true }>,
  maintenanceEnd: () => ipcRenderer.invoke('arc:maintenance-end') as Promise<{ ok: true }>,
  onMaintenance: (cb: (locked: boolean) => void) => {
    const fn = (_: unknown, payload: { locked?: boolean }) => {
      cb(Boolean(payload?.locked));
    };
    ipcRenderer.on('arc:maintenance', fn);
    return () => ipcRenderer.removeListener('arc:maintenance', fn);
  }
});
