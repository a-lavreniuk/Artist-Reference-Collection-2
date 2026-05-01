import type { ArcMetadataV1 } from './services/arcSchema';

export {};

declare global {
  interface Window {
    arc?: {
      getLibraryPath: () => Promise<string | null>;
      setLibraryPath: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
      pickLibraryFolder: () => Promise<string | null>;
      readMetadata: () => Promise<ArcMetadataV1 | null>;
      writeMetadata: (data: ArcMetadataV1) => Promise<void>;
      pickImageFiles: () => Promise<string[]>;
      importFiles: (
        absolutePaths: string[]
      ) => Promise<
        Array<{
          id: string;
          type: 'image';
          originalRelativePath: string;
          thumbRelativePath: string;
          fileSize: number;
          fileSizeMb?: number;
          addedAt: string;
          dateModified?: string;
          width?: number;
          height?: number;
          format?: string;
        }>
      >;
      toFileUrl: (relativePath: string) => Promise<string | null>;
      deleteFileIfInsideLibrary: (relativePath: string) => Promise<void>;
      showItemInFolder: (relativePath: string) => Promise<void>;
    };
  }
}
