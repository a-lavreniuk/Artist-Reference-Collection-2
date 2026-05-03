import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'fs';
import { copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import {
  extractVideoFrameToJpeg,
  isVideoExt,
  probeVideoDimensions,
  VIDEO_EXT
} from './ffmpeg';

const METADATA_FILENAME = 'arc2-metadata.json';
const LIBRARY_CONFIG_FILENAME = 'library-root.json';

function libraryConfigPath(): string {
  return path.join(app.getPath('userData'), LIBRARY_CONFIG_FILENAME);
}

async function readLibraryRootFromDisk(): Promise<string | null> {
  try {
    const raw = await readFile(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return j.path.trim();
  } catch {
    return null;
  }
}

function readLibraryRootSync(): string | null {
  try {
    const raw = fs.readFileSync(libraryConfigPath(), 'utf8');
    const j = JSON.parse(raw) as { path?: string };
    if (typeof j.path !== 'string' || !j.path.trim()) return null;
    return j.path.trim();
  } catch {
    return null;
  }
}

async function writeLibraryRootToDisk(abs: string): Promise<void> {
  await mkdir(path.dirname(libraryConfigPath()), { recursive: true });
  await writeFile(libraryConfigPath(), JSON.stringify({ path: abs }, null, 2), 'utf8');
}

function metadataPath(root: string): string {
  return path.join(root, METADATA_FILENAME);
}

/** Без привязки к окну диалог выбора файлов на Windows часто не показывается поверх приложения. */
function dialogParentWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
}

function showOpenDialogAttached(options: OpenDialogOptions) {
  const p = dialogParentWindow();
  if (p) {
    return dialog.showOpenDialog(p, options);
  }
  return dialog.showOpenDialog(options);
}

function isInsideLibrary(libRoot: string, candidateAbs: string): boolean {
  const root = path.resolve(libRoot);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

function isAllowedLibraryMediaExt(ext: string): boolean {
  const e = ext.toLowerCase();
  return isImageExt(e) || isVideoExt(e);
}

/** Расширения для диалога выбора: изображения + видео (совпадают с импортом). */
function mediaPickerExtensions(): string[] {
  const fromImages = [...IMAGE_EXT].map((x) => x.slice(1));
  const fromVideo = [...VIDEO_EXT].map((x) => x.slice(1));
  const merged = new Set([...fromImages, ...fromVideo]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export type ImportedMediaRow = {
  id: string;
  type: 'image' | 'video';
  originalRelativePath: string;
  thumbRelativePath: string;
  fileSize: number;
  addedAt: string;
  width?: number;
  height?: number;
};

export type ImportFileResult =
  | { ok: true; row: ImportedMediaRow }
  | { ok: false; error: string };

let ipcRegistered = false;
let arcMediaProtocolRegistered = false;

/**
 * Превью с http://localhost:5173 не могут грузить file:// — регистрируем безопасную схему `arc-media`.
 *
 * - `?rel=` — относительный путь внутри библиотеки (как раньше).
 * - `?abs=` — абсолютный путь к произвольному файлу на диске (для импорта «снаружи» библиотеки).
 */
export function registerArcMediaProtocol(): void {
  if (arcMediaProtocolRegistered) return;
  arcMediaProtocolRegistered = true;

  protocol.registerFileProtocol('arc-media', (request, callback) => {
    try {
      const u = new URL(request.url);
      const relEncoded = u.searchParams.get('rel');
      const absEncoded = u.searchParams.get('abs');

      let abs: string | null = null;

      if (absEncoded) {
        abs = path.resolve(decodeURIComponent(absEncoded));
      } else if (relEncoded) {
        const relativePath = relEncoded.replace(/\\/g, '/');
        const root = readLibraryRootSync();
        if (!root) {
          callback({ error: -6 });
          return;
        }
        const resolved = path.resolve(root, relativePath.replace(/\//g, path.sep));
        if (!isInsideLibrary(root, resolved)) {
          callback({ error: -2 });
          return;
        }
        abs = resolved;
      } else {
        callback({ error: -2 });
        return;
      }

      if (!abs) {
        callback({ error: -2 });
        return;
      }

      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        callback({ error: -6 });
        return;
      }

      const ext = path.extname(abs);
      if (!isAllowedLibraryMediaExt(ext)) {
        callback({ error: -2 });
        return;
      }

      callback({ path: abs });
    } catch {
      callback({ error: -2 });
    }
  });
}

export function registerArcIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:get-library-path', async () => readLibraryRootFromDisk());

  ipcMain.handle('arc:set-library-path', async (_e, absPath: unknown) => {
    if (typeof absPath !== 'string' || !absPath.trim()) {
      return { ok: false as const, error: 'Пустой путь' };
    }
    const resolved = path.resolve(absPath.trim());
    try {
      await mkdir(resolved, { recursive: true });
      await writeLibraryRootToDisk(resolved);
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось сохранить путь'
      };
    }
  });

  ipcMain.handle('arc:pick-library-folder', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openDirectory', 'createDirectory']
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle('arc:read-metadata', async () => {
    const root = await readLibraryRootFromDisk();
    if (!root) return null;
    try {
      const raw = await readFile(metadataPath(root), 'utf8');
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  });

  ipcMain.handle('arc:write-metadata', async (_e, data: unknown) => {
    const root = await readLibraryRootFromDisk();
    if (!root) throw new Error('Библиотека не выбрана');
    const dest = metadataPath(root);
    const tmp = `${dest}.${process.pid}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    await writeFile(tmp, payload, 'utf8');
    await rename(tmp, dest);
  });

  ipcMain.handle('arc:pick-image-files', async () => {
    const res = await showOpenDialogAttached({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }]
    });
    if (res.canceled) return [];
    return res.filePaths;
  });

  ipcMain.handle('arc:pick-media-files', async () => {
    const combined = mediaPickerExtensions();
    const res = await showOpenDialogAttached({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Изображения и видео', extensions: combined },
        {
          name: 'Изображения',
          extensions: [...IMAGE_EXT].map((x) => x.slice(1))
        },
        {
          name: 'Видео',
          extensions: [...VIDEO_EXT].map((x) => x.slice(1)).sort((a, b) => a.localeCompare(b))
        },
        { name: 'Все файлы', extensions: ['*'] }
      ]
    });
    if (res.canceled) return [];
    return res.filePaths;
  });

  ipcMain.handle('arc:import-files', async (_e, absolutePaths: unknown) => {
    if (!Array.isArray(absolutePaths) || !absolutePaths.every((x) => typeof x === 'string')) {
      throw new Error('Неверный список файлов');
    }
    const root = await readLibraryRootFromDisk();
    if (!root) throw new Error('Библиотека не выбрана');

    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dayDir = path.join(root, 'media', y, m, d);
    const thumbDir = path.join(root, 'media', '_cache', 'thumbs');
    await mkdir(dayDir, { recursive: true });
    await mkdir(thumbDir, { recursive: true });

    const results: ImportFileResult[] = [];

    for (const abs of absolutePaths as string[]) {
      const resolved = path.resolve(abs);
      const ext = path.extname(resolved);
      const baseName = path.basename(resolved);

      if (!isAllowedLibraryMediaExt(ext)) {
        results.push({
          ok: false,
          error: `Неподдерживаемый тип файла: ${baseName}`
        });
        continue;
      }

      let st;
      try {
        st = await stat(resolved);
      } catch {
        results.push({ ok: false, error: `Файл недоступен: ${baseName}` });
        continue;
      }
      if (!st.isFile()) {
        results.push({ ok: false, error: `Не файл: ${baseName}` });
        continue;
      }

      const id = crypto.randomUUID();
      const addedAt = new Date().toISOString();

      if (isImageExt(ext)) {
        const base = `${id}${ext}`;
        const originalAbs = path.join(dayDir, base);
        const thumbAbs = path.join(thumbDir, base);

        try {
          await copyFile(resolved, originalAbs);
          await copyFile(resolved, thumbAbs);
        } catch (err) {
          results.push({
            ok: false,
            error: err instanceof Error ? err.message : `Не удалось скопировать ${baseName}`
          });
          continue;
        }

        const originalRelativePath = path.relative(root, originalAbs).split(path.sep).join('/');
        const thumbRelativePath = path.relative(root, thumbAbs).split(path.sep).join('/');

        results.push({
          ok: true,
          row: {
            id,
            type: 'image',
            originalRelativePath,
            thumbRelativePath,
            fileSize: st.size,
            addedAt
          }
        });
        continue;
      }

      if (isVideoExt(ext)) {
        const base = `${id}${ext}`;
        const originalAbs = path.join(dayDir, base);
        const thumbAbs = path.join(thumbDir, `${id}.jpg`);

        try {
          await copyFile(resolved, originalAbs);
        } catch (err) {
          results.push({
            ok: false,
            error: err instanceof Error ? err.message : `Не удалось скопировать ${baseName}`
          });
          continue;
        }

        try {
          await extractVideoFrameToJpeg(originalAbs, thumbAbs);
        } catch (err) {
          try {
            await unlink(originalAbs);
          } catch {
            /* ignore */
          }
          const msg = err instanceof Error ? err.message : 'Не удалось создать превью';
          results.push({
            ok: false,
            error: `${baseName}: ${msg}`
          });
          continue;
        }

        const dims = await probeVideoDimensions(originalAbs);
        const originalRelativePath = path.relative(root, originalAbs).split(path.sep).join('/');
        const thumbRelativePath = path.relative(root, thumbAbs).split(path.sep).join('/');

        results.push({
          ok: true,
          row: {
            id,
            type: 'video',
            originalRelativePath,
            thumbRelativePath,
            fileSize: st.size,
            addedAt,
            ...(dims ? dims : {})
          }
        });
        continue;
      }

      results.push({ ok: false, error: `Внутренняя ошибка для ${baseName}` });
    }

    return results;
  });

  ipcMain.handle('arc:to-file-url', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return null;

    const raw = relativePath.trim();
    if (!raw) return null;

    const looksAbsolute =
      path.isAbsolute(raw) ||
      /^[a-zA-Z]:[\\/]/.test(raw) ||
      raw.startsWith('\\\\');

    if (looksAbsolute) {
      const abs = path.resolve(raw);
      try {
        const st = await stat(abs);
        if (!st.isFile()) return null;
        const ext = path.extname(abs);
        if (!isAllowedLibraryMediaExt(ext)) return null;
        return `arc-media://localhost/?abs=${encodeURIComponent(abs)}`;
      } catch {
        return null;
      }
    }

    const root = await readLibraryRootFromDisk();
    if (!root) return null;
    const relNorm = raw.replace(/\//g, path.sep);
    const abs = path.resolve(root, relNorm);
    if (!isInsideLibrary(root, abs)) return null;
    try {
      const st = await stat(abs);
      if (!st.isFile()) return null;
      const ext = path.extname(abs);
      if (!isAllowedLibraryMediaExt(ext)) return null;
      const relStable = raw.replace(/\\/g, '/');
      return `arc-media://localhost/?rel=${encodeURIComponent(relStable)}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle('arc:delete-file-if-inside-library', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    const abs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, abs)) return;
    try {
      await unlink(abs);
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle('arc:show-item-in-folder', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') return;
    const root = await readLibraryRootFromDisk();
    if (!root) return;
    const abs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, abs)) return;
    shell.showItemInFolder(abs);
  });

  ipcMain.handle('arc:save-media-to-folder', async (_e, relativePath: unknown) => {
    if (typeof relativePath !== 'string') {
      return { ok: false as const, error: 'Некорректный путь к файлу' };
    }
    const root = await readLibraryRootFromDisk();
    if (!root) {
      return { ok: false as const, error: 'Библиотека не выбрана' };
    }
    const sourceAbs = path.resolve(root, relativePath.replace(/\//g, path.sep));
    if (!isInsideLibrary(root, sourceAbs)) {
      return { ok: false as const, error: 'Файл вне библиотеки' };
    }
    try {
      const sourceStat = await stat(sourceAbs);
      if (!sourceStat.isFile()) {
        return { ok: false as const, error: 'Исходный файл не найден' };
      }
    } catch {
      return { ok: false as const, error: 'Исходный файл не найден' };
    }

    const pick = await showOpenDialogAttached({
      properties: ['openDirectory', 'createDirectory']
    });
    if (pick.canceled || pick.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const };
    }

    const destinationDir = pick.filePaths[0];
    const destinationAbs = path.join(destinationDir, path.basename(sourceAbs));
    try {
      if (destinationAbs !== sourceAbs) {
        await copyFile(sourceAbs, destinationAbs);
      }
      return { ok: true as const, destinationPath: destinationAbs };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Не удалось сохранить файл'
      };
    }
  });
}
