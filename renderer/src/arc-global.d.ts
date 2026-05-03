import type { ArcMetadataV1 } from './services/arcSchema';

export {};

export type ArcImportedMediaRow = {
  id: string;
  type: 'image' | 'video';
  originalRelativePath: string;
  thumbRelativePath: string;
  fileSize: number;
  fileSizeMb?: number;
  addedAt: string;
  dateModified?: string;
  width?: number;
  height?: number;
  format?: string;
};

export type ArcImportFileResult = { ok: true; row: ArcImportedMediaRow } | { ok: false; error: string };

declare global {
  interface Window {
    arc?: {
      getLibraryPath: () => Promise<string | null>;
      setLibraryPath: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
      pickLibraryFolder: () => Promise<string | null>;
      readMetadata: () => Promise<ArcMetadataV1 | null>;
      writeMetadata: (data: ArcMetadataV1) => Promise<void>;
      pickImageFiles: () => Promise<string[]>;
      pickMediaFiles: () => Promise<string[]>;
      importFiles: (absolutePaths: string[]) => Promise<ArcImportFileResult[]>;
      /** Относительный путь внутри библиотеки или абсолютный путь к файлу на диске (для предпросмотра до импорта). */
      toFileUrl: (path: string) => Promise<string | null>;
      deleteFileIfInsideLibrary: (relativePath: string) => Promise<void>;
      showItemInFolder: (relativePath: string) => Promise<void>;
      saveMediaToFolder: (
        relativePath: string
      ) => Promise<{ ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }>;
    };
  }
}
