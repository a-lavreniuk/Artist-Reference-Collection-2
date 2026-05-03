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
  saveMediaToFolder: (relativePath: string) =>
    ipcRenderer.invoke('arc:save-media-to-folder', relativePath) as Promise<
      { ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }
    >
});
