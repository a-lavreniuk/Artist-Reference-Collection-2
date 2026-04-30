/**
 * Добавляет `listenerOpts` третьим аргументом ко всем `addEventListener` в arcUiKitBoot.ts,
 * где его ещё нет — иначе в React Strict Mode после abort остаются старые слушатели на DOM
 * и клики срабатывают дважды (chip/dropdown «не работают»).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../renderer/src/ui-kit/arcUiKitBoot.ts');

let s = fs.readFileSync(filePath, 'utf8');
s = s.replace(/\bdocOpts\b/g, 'listenerOpts');

function patchCalls(source) {
  const needle = 'addEventListener(';
  let i = 0;
  let out = '';

  while (i < source.length) {
    const idx = source.indexOf(needle, i);
    if (idx === -1) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, idx);

    let j = idx + needle.length;
    let depth = 1;
    let inStr = false;
    let quote = '';

    while (j < source.length && depth > 0) {
      const c = source[j];
      const prev = j > 0 ? source[j - 1] : '';

      if (!inStr) {
        if ((c === '"' || c === "'" || c === '`') && prev !== '\\') {
          inStr = true;
          quote = c;
        } else if (c === '(') {
          depth++;
        } else if (c === ')') {
          depth--;
        }
      } else if (c === quote && prev !== '\\') {
        inStr = false;
      }
      j++;
    }

    const call = source.slice(idx, j);
    if (!/\blistenerOpts\b/.test(call)) {
      out += call.slice(0, -1) + ', listenerOpts)';
    } else {
      out += call;
    }
    i = j;
  }
  return out;
}

s = patchCalls(s);
fs.writeFileSync(filePath, s, 'utf8');
console.log('patched', filePath);
