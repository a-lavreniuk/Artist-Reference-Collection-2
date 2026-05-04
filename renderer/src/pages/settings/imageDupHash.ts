/**
 * Отпечаток для поиска дублей: средний хэш 8×8 по четырём поворотам (структура)
 * + нормализованная гистограмма яркости (цвет/тон).
 * Итоговое сходство: STRUCT_WEIGHT * max(sim по поворотам) + HIST_WEIGHT * sim по гистограмме.
 */

const STRUCT_WEIGHT = 0.7;
const HIST_WEIGHT = 0.3;
const SAMPLE = 32;
const HASH = 8;
const HIST_BINS = 32;

function gray(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function hamming(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d += 1;
  d += Math.abs(a.length - b.length);
  return d;
}

function similarityBitsPct(hashA: string, hashB: string): number {
  const denom = Math.max(hashA.length, hashB.length, 1);
  return 100 * (1 - hamming(hashA, hashB) / denom);
}

function averageHashFromGray8x8(vals: number[]): string {
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return vals.map((v) => (v > avg ? '1' : '0')).join('');
}

function luminanceHistogram(data: Uint8ClampedArray, bins: number): number[] {
  const h = new Array<number>(bins).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const y = gray(data, i);
    const idx = Math.min(bins - 1, Math.floor((y / 256) * bins));
    h[idx] += 1;
  }
  const sum = h.reduce((a, b) => a + b, 0) || 1;
  return h.map((x) => x / sum);
}

function histogramSimilarityPct(a: number[], b: number[]): number {
  let l1 = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) l1 += Math.abs(a[i]! - b[i]!);
  return 100 * (1 - Math.min(1, l1 / 2));
}

export type ImageDupFingerprint = {
  rotHashes: [string, string, string, string];
  hist: number[];
};

function decodeToImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

function drawSampled(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  deg: 0 | 90 | 180 | 270
): void {
  ctx.clearRect(0, 0, SAMPLE, SAMPLE);
  const rad = (deg * Math.PI) / 180;
  const hw = SAMPLE / 2;
  ctx.save();
  ctx.translate(hw, hw);
  ctx.rotate(rad);
  const scale = Math.min(SAMPLE / img.naturalWidth, SAMPLE / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function hash8FromSample(ctx: CanvasRenderingContext2D): string {
  const small = document.createElement('canvas');
  small.width = HASH;
  small.height = HASH;
  const sctx = small.getContext('2d');
  if (!sctx) return '';
  sctx.drawImage(ctx.canvas, 0, 0, SAMPLE, SAMPLE, 0, 0, HASH, HASH);
  const { data } = sctx.getImageData(0, 0, HASH, HASH);
  const vals: number[] = [];
  for (let i = 0; i < data.length; i += 4) vals.push(gray(data, i));
  return averageHashFromGray8x8(vals);
}

export async function fingerprintFromUrl(url: string): Promise<ImageDupFingerprint | null> {
  try {
    const img = await decodeToImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rots = [0, 90, 180, 270] as const;
    const rotHashes: [string, string, string, string] = ['', '', '', ''];
    let hist: number[] | null = null;

    rots.forEach((deg, i) => {
      drawSampled(ctx, img, deg);
      rotHashes[i] = hash8FromSample(ctx);
      if (deg === 0) {
        const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
        hist = luminanceHistogram(data, HIST_BINS);
      }
    });

    if (!hist) return null;
    return { rotHashes, hist };
  } catch {
    return null;
  }
}

export function similarityCombined(a: ImageDupFingerprint, b: ImageDupFingerprint): number {
  let bestStruct = 0;
  for (const ha of a.rotHashes) {
    for (const hb of b.rotHashes) {
      if (!ha || !hb) continue;
      bestStruct = Math.max(bestStruct, similarityBitsPct(ha, hb));
    }
  }
  const histSim = histogramSimilarityPct(a.hist, b.hist);
  return STRUCT_WEIGHT * bestStruct + HIST_WEIGHT * histSim;
}
