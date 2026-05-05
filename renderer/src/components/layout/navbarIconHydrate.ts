/**
 * Подставляет в узлы `arc2-icon-*` inline-SVG из `public/ui/icons/`:
 * `stroke`/`fill` с белого переводятся в `currentColor`, чтобы работали токены родителя.
 */
const ICON_DIR = '/ui/icons/';

type IconKey =
  | 'search'
  | 'close'
  | 'plus'
  | 'images'
  | 'image'
  | 'play'
  | 'whiteboard'
  | 'hardDrive'
  | 'pieChart'
  | 'history'
  | 'copy'
  | 'save'
  | 'chevron'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowUpRight'
  | 'trash'
  | 'bookmark'
  | 'bookmarkPlus'
  | 'bookmarkMinus'
  | 'download'
  | 'folderOpen'
  | 'edit'
  | 'tag'
  | 'server'
  | 'undo'
  | 'cursor'
  | 'pan'
  | 'pencil'
  | 'type'
  | 'eraser'
  | 'lineThin'
  | 'lineThik'
  | 'predictable'
  | 'line'
  | 'circle'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'minus';

const ICON_FILES: Record<IconKey, string> = {
  search: 'search_m.svg',
  close: 'close_m.svg',
  plus: 'plus_m.svg',
  images: 'images_m.svg',
  image: 'image_m.svg',
  play: 'play_m.svg',
  whiteboard: 'whiteboard_m.svg',
  hardDrive: 'hard-drive_m.svg',
  pieChart: 'pie-chart_m.svg',
  history: 'history_m.svg',
  copy: 'copy_m.svg',
  save: 'save_m.svg',
  chevron: 'chevron_m.svg',
  arrowUp: 'arrow-up_s.svg',
  arrowDown: 'arrow-down_s.svg',
  arrowUpRight: 'arrow-up-right_m.svg',
  trash: 'trash_m.svg',
  bookmark: 'bookmark_m.svg',
  bookmarkPlus: 'bookmark-plus_m.svg',
  bookmarkMinus: 'bookmark-minus_m.svg',
  download: 'download_m.svg',
  folderOpen: 'folder-open_m.svg',
  edit: 'edit_m.svg',
  tag: 'tag_m.svg',
  server: 'server_m.svg',
  undo: 'undo_m.svg',
  cursor: 'cursor_m.svg',
  pan: 'hand_m.svg',
  pencil: 'pencil_m.svg',
  type: 'type_m.svg',
  eraser: 'eraser_m.svg',
  lineThin: 'line-thin_m.svg',
  lineThik: 'line-thik_m.svg',
  predictable: 'redictable_m.svg',
  line: 'line_m.svg',
  circle: 'circle_m.svg',
  alignLeft: 'align-left_m.svg',
  alignCenter: 'align-center_m.svg',
  alignRight: 'align-right_m.svg',
  minus: 'minus_m.svg'
};
const SIZE_SUFFIX_RE = /_(s|m|l|xl)\.svg$/;
type UiSize = 's' | 'm' | 'l' | 'xl';

const ICON_CLASS_TO_KEY: Record<string, IconKey> = {
  arc2_icon_search: 'search',
  arc2_icon_close: 'close',
  arc2_icon_plus: 'plus',
  arc2_icon_images: 'images',
  arc2_icon_image: 'image',
  arc2_icon_play: 'play',
  arc2_icon_whiteboard: 'whiteboard',
  arc2_icon_hard_drive: 'hardDrive',
  arc2_icon_pie_chart: 'pieChart',
  arc2_icon_history: 'history',
  arc2_icon_copy: 'copy',
  arc2_icon_save: 'save',
  arc2_icon_chevron: 'chevron',
  arc2_icon_arrow_up: 'arrowUp',
  arc2_icon_arrow_down: 'arrowDown',
  arc2_icon_arrow_up_right: 'arrowUpRight',
  arc2_icon_trash: 'trash',
  arc2_icon_bookmark: 'bookmark',
  arc2_icon_bookmark_plus: 'bookmarkPlus',
  arc2_icon_bookmark_minus: 'bookmarkMinus',
  arc2_icon_download: 'download',
  arc2_icon_folder_open: 'folderOpen',
  arc2_icon_edit: 'edit',
  arc2_icon_tag: 'tag',
  arc2_icon_server: 'server',
  arc2_icon_undo: 'undo',
  arc2_icon_cursor: 'cursor',
  arc2_icon_pan: 'pan',
  arc2_icon_pencil: 'pencil',
  arc2_icon_type: 'type',
  arc2_icon_eraser: 'eraser',
  arc2_icon_line_thin: 'lineThin',
  arc2_icon_line_thik: 'lineThik',
  arc2_icon_predictable: 'predictable',
  arc2_icon_line: 'line',
  arc2_icon_circle: 'circle',
  arc2_icon_align_left: 'alignLeft',
  arc2_icon_align_center: 'alignCenter',
  arc2_icon_align_right: 'alignRight',
  arc2_icon_minus: 'minus'
};

const ICON_SELECTOR =
  '.arc2-icon-search, .arc2-icon-plus, .arc2-icon-images, .arc2-icon-image, .arc2-icon-play, .arc2-icon-whiteboard, .arc2-icon-hard-drive, .arc2-icon-pie-chart, .arc2-icon-history, .arc2-icon-copy, .arc2-icon-close, .arc2-icon-save, .arc2-icon-chevron, .arc2-icon-arrow-up, .arc2-icon-arrow-down, .arc2-icon-arrow-up-right, .arc2-icon-trash, .arc2-icon-bookmark, .arc2-icon-bookmark-plus, .arc2-icon-bookmark-minus, .arc2-icon-download, .arc2-icon-folder-open, .arc2-icon-edit, .arc2-icon-tag, .arc2-icon-server, .arc2-icon-undo, .arc2-icon-cursor, .arc2-icon-pan, .arc2-icon-pencil, .arc2-icon-type, .arc2-icon-eraser, .arc2-icon-line-thin, .arc2-icon-line-thik, .arc2-icon-predictable, .arc2-icon-line, .arc2-icon-circle, .arc2-icon-align-left, .arc2-icon-align-center, .arc2-icon-align-right, .arc2-icon-minus';

const svgMarkupCache = new Map<string, string>();
let preloadPromise: Promise<void> | null = null;

let idUniq = 0;
function uniquifySvgIds(svgText: string): string {
  const sfx = `i${++idUniq}`;
  return svgText
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${id}-${sfx}"`)
    .replace(/url\(#([^)]+)\)/g, (_, ref: string) => `url(#${ref}-${sfx})`);
}

function isLikelySvgMarkup(raw: string): boolean {
  const t = raw.replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>/gi, '').trimStart();
  return /^<svg\b/i.test(t);
}

function normalizeSvgForTokens(svgText: string): string {
  return svgText
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/stroke="white"/gi, 'stroke="currentColor"')
    .replace(/stroke='white'/gi, "stroke='currentColor'")
    .replace(/stroke="#ffffff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFFFFF"/gi, 'stroke="currentColor"')
    .replace(/stroke="#fff"/gi, 'stroke="currentColor"')
    .replace(/stroke="#FFF"/gi, 'stroke="currentColor"')
    .replace(/fill="white"/gi, 'fill="currentColor"')
    .replace(/fill='white'/gi, "fill='currentColor'")
    .replace(/fill="#ffffff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFFFFF"/gi, 'fill="currentColor"')
    .replace(/fill="#fff"/gi, 'fill="currentColor"')
    .replace(/fill="#FFF"/gi, 'fill="currentColor"');
}

function iconUrl(file: string): string {
  const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalized}${ICON_DIR}${file}`;
}

function getIconSize(scope?: HTMLElement): UiSize {
  const explicit = scope?.closest('[data-arc2-icon-size]')?.getAttribute('data-arc2-icon-size');
  if (explicit === 's' || explicit === 'm' || explicit === 'l' || explicit === 'xl') return explicit;
  const btnSize =
    scope?.closest('[data-btn-size]')?.getAttribute('data-btn-size') ?? document.body?.getAttribute('data-btn-size');
  if (btnSize === 's' || btnSize === 'm' || btnSize === 'l') return btnSize;
  return 'm';
}

function withSizeVariant(file: string, size: UiSize): string {
  if (!SIZE_SUFFIX_RE.test(file)) return file;
  return file.replace(SIZE_SUFFIX_RE, `_${size}.svg`);
}

function resolveIconFile(iconKey: IconKey, scope?: HTMLElement): { preferred: string; fallback: string } {
  const fallback = ICON_FILES[iconKey];
  const preferred = withSizeVariant(fallback, getIconSize(scope));
  return { preferred, fallback };
}

async function ensureSvgMarkup(file: string): Promise<string | null> {
  const cached = svgMarkupCache.get(file);
  if (cached) {
    if (isLikelySvgMarkup(cached)) return cached;
    svgMarkupCache.delete(file);
  }
  try {
    const res = await fetch(iconUrl(file));
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    if (!isLikelySvgMarkup(raw)) return null;
    const normalized = normalizeSvgForTokens(raw);
    if (!isLikelySvgMarkup(normalized)) return null;
    svgMarkupCache.set(file, normalized);
    return normalized;
  } catch {
    return null;
  }
}

function preloadAllIcons(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const files = [...new Set(Object.values(ICON_FILES))];
  preloadPromise = Promise.all(files.map((f) => ensureSvgMarkup(f))).then(() => undefined);
  return preloadPromise;
}

function classToIconKey(element: HTMLElement): IconKey | null {
  for (const className of element.classList) {
    if (!className.startsWith('arc2-icon-')) continue;
    const key = className.replace(/-/g, '_');
    const mapped = ICON_CLASS_TO_KEY[key];
    if (mapped) return mapped;
  }
  return null;
}

function injectSvgMarkup(host: HTMLElement, normalizedMarkup: string, file: string): void {
  host.innerHTML = uniquifySvgIds(normalizedMarkup);
  const svg = host.querySelector('svg');
  if (!svg) {
    host.innerHTML = '';
    delete host.dataset.arc2IconFile;
    return;
  }
  svg.classList.add('arc-navbar-icon-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  host.dataset.arc2IconFile = file;
}

/** Асинхронно: дожидается кэша файлов, затем вставляет SVG с currentColor. */
export async function hydrateArc2NavbarIcons(scope: ParentNode = document): Promise<void> {
  await preloadAllIcons();

  const nodes = scope.querySelectorAll(ICON_SELECTOR);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const iconKey = classToIconKey(node);
    if (!iconKey) continue;
    const { preferred, fallback } = resolveIconFile(iconKey, node);
    if (node.dataset.arc2IconFile === preferred && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
      continue;
    }
    const normalized = (await ensureSvgMarkup(preferred)) ?? (preferred !== fallback ? await ensureSvgMarkup(fallback) : null);
    if (!normalized) continue;
    const usedFile = svgMarkupCache.get(preferred) ? preferred : fallback;
    if (node.dataset.arc2IconFile === usedFile && node.querySelector(':scope > svg.arc-navbar-icon-svg')) {
      continue;
    }
    injectSvgMarkup(node, normalized, usedFile);
  }
}
