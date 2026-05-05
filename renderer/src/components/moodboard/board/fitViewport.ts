import type { MoodboardBoardV1 } from '../../../services/arcSchema';
import { BOARD_WORLD, SCALE_MAX, SCALE_MIN } from './constants';

/** Вписать содержимое доски в размер контейнера (вид сверху с отступом). */
export function fitBoardToViewport(board: MoodboardBoardV1, cw: number, ch: number): { x: number; y: number; scale: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let empty = true;

  const bump = (ax: number, ay: number, bx: number, by: number) => {
    empty = false;
    minX = Math.min(minX, ax, bx);
    minY = Math.min(minY, ay, by);
    maxX = Math.max(maxX, ax, bx);
    maxY = Math.max(maxY, ay, by);
  };

  for (const i of board.imageInstances) {
    bump(i.x, i.y, i.x + i.width, i.y + i.height);
  }

  for (const s of board.strokes) {
    const pts = s.points;
    for (let k = 0; k + 1 < pts.length; k += 2) {
      bump(pts[k], pts[k + 1], pts[k], pts[k + 1]);
    }
  }

  for (const sh of board.shapes) {
    if (sh.type === 'rect' && sh.width != null && sh.height != null) {
      bump(sh.x, sh.y, sh.x + sh.width, sh.y + sh.height);
    } else if (sh.type === 'ellipse' && sh.width != null && sh.height != null) {
      bump(sh.x - sh.width / 2, sh.y - sh.height / 2, sh.x + sh.width / 2, sh.y + sh.height / 2);
    } else if (sh.type === 'line' && sh.x2 != null && sh.y2 != null) {
      bump(sh.x, sh.y, sh.x2, sh.y2);
    }
  }

  for (const t of board.texts) {
    const th = Math.max(t.fontSize * 1.4, t.fontSize);
    bump(t.x, t.y, t.x + t.width, t.y + th);
  }

  const pad = 64;
  if (empty || !Number.isFinite(minX)) {
    const scale = Math.min(cw / BOARD_WORLD, ch / BOARD_WORLD, 0.35);
    const s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
    return {
      x: (cw - BOARD_WORLD * s) / 2,
      y: (ch - BOARD_WORLD * s) / 2,
      scale: s
    };
  }

  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.min(cw / bw, ch / bh);
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
  const x = (cw - bw * clamped) / 2 - minX * clamped;
  const y = (ch - bh * clamped) / 2 - minY * clamped;
  return { x, y, scale: clamped };
}
