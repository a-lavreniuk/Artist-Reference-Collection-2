import type { MoodboardBoardV1 } from '../../../services/arcSchema';

export function cloneBoard(b: MoodboardBoardV1): MoodboardBoardV1 {
  return structuredClone(b);
}
