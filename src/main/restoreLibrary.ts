import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { extractZipStore } from './zipRead';

export type ManifestV1 = {
  backupFormatVersion: number;
  createdLocalDate: string;
  partFiles: string[];
  files: Array<{ path: string; sha256: string; size: number }>;
};

export async function discoverBackupParts(firstPartAbs: string): Promise<string[]> {
  const abs = path.resolve(firstPartAbs);
  const dir = path.dirname(abs);
  const base = path.basename(abs);
  if (base.endsWith('.arc') && !/\.part\d{2}$/i.test(base)) {
    return [abs];
  }
  const m = /^(.+\.arc)\.part(\d{2})$/i.exec(base);
  if (!m) throw new Error('Ожидался файл .arc или .arc.part01');
  const prefix = m[1];
  const names = await readdir(dir);
  const parts = names
    .filter((n) => n.startsWith(`${prefix}.part`) && /\.part\d{2}$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(/part(\d+)/i.exec(a)?.[1] ?? '0', 10);
      const nb = parseInt(/part(\d+)/i.exec(b)?.[1] ?? '0', 10);
      return na - nb;
    })
    .map((n) => path.join(dir, n));
  if (parts.length === 0) return [abs];
  for (let i = 0; i < parts.length; i++) {
    const expected = `${prefix}.part${String(i + 1).padStart(2, '0')}`;
    if (path.basename(parts[i]!) !== expected) {
      throw new Error(`Не найдена часть бэкапа: ${expected}`);
    }
  }
  return parts;
}

async function sha256File(abs: string): Promise<string> {
  const buf = await readFile(abs);
  return createHash('sha256').update(buf).digest('hex');
}

export async function restoreFromParts(
  partPaths: string[],
  destRoot: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    for (const zp of partPaths) {
      await extractZipStore(zp, destRoot);
    }
    const manPath = path.join(destRoot, 'manifest.json');
    let raw: string;
    try {
      raw = await readFile(manPath, 'utf8');
    } catch {
      return { ok: false, error: 'В восстановленных данных нет manifest.json' };
    }
    const manifest = JSON.parse(raw) as ManifestV1;
    if (!manifest.files || !Array.isArray(manifest.files)) {
      return { ok: false, error: 'Некорректный manifest.json' };
    }
    for (const ent of manifest.files) {
      const fp = path.join(destRoot, ent.path.split('/').join(path.sep));
      try {
        const st = await stat(fp);
        if (!st.isFile()) throw new Error('not file');
      } catch {
        return { ok: false, error: `Отсутствует файл из бэкапа: ${ent.path}` };
      }
      const h = await sha256File(fp);
      if (h !== ent.sha256) {
        return { ok: false, error: `Не совпал хэш для ${ent.path}` };
      }
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка восстановления'
    };
  }
}
