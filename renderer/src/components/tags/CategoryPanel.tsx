import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CategoryRecord, CategoryWeight, TagRecord } from '../../services/db';
import CategoryColorModal from '../layout/CategoryColorModal';
import ConfirmDeleteCategoryModal from '../layout/ConfirmDeleteCategoryModal';
import { hydrateArc2NavbarIcons } from '../layout/navbarIconHydrate';
import TagCategoryDropSurface from './TagCategoryDropSurface';
import { normalizeHex } from '../../utils/colorPicker';

const WEIGHT_OPTIONS: Array<{ key: CategoryWeight; label: string }> = [
  { key: 'neutral', label: 'Нулевой' },
  { key: 'low', label: 'Низкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'high', label: 'Высокий' }
];

type Props = {
  category: CategoryRecord;
  tags: TagRecord[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: (name: string) => Promise<void>;
  onColorHexCommit: (hex: string) => Promise<void>;
  onWeightChange: (weight: CategoryWeight) => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onDelete: () => Promise<void>;
  onAddTag: (name: string) => Promise<void>;
  onEditTag: (tag: TagRecord) => void;
  draggingTagId: string | null;
  allTags: TagRecord[];
  onTagDragStart: (tagId: string) => void;
  onTagDragEnd: () => void;
  onTagDrop: (tagId: string, targetCategoryId: string) => Promise<void>;
};

export default function CategoryPanel({
  category,
  tags,
  canMoveUp,
  canMoveDown,
  onRename,
  onColorHexCommit,
  onWeightChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddTag,
  onEditTag,
  draggingTagId,
  allTags,
  onTagDragStart,
  onTagDragEnd,
  onTagDrop
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [hexDraft, setHexDraft] = useState(category.colorHex.replace(/^#/, ''));
  const [tagDraft, setTagDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerSeed, setColorPickerSeed] = useState(category.colorHex);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setNameDraft(category.name);
    setHexDraft(category.colorHex.replace(/^#/, ''));
  }, [category.id, category.name, category.colorHex]);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArc2NavbarIcons(rootRef.current);
    }
  }, [category, tags, nameDraft, hexDraft, tagDraft, busy]);

  const openColorPicker = () => {
    const withHash = hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`;
    const parsed = normalizeHex(withHash);
    setColorPickerSeed(parsed ?? category.colorHex);
    setColorPickerOpen(true);
  };

  const commitName = async () => {
    const next = nameDraft.trim();
    if (!next || next === category.name) return;
    setBusy(true);
    try {
      await onRename(next);
    } finally {
      setBusy(false);
    }
  };

  const commitHex = async () => {
    const withHash = hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`;
    const n = normalizeHex(withHash);
    if (!n || n === category.colorHex) return;
    setBusy(true);
    try {
      await onColorHexCommit(n);
      setHexDraft(n.replace(/^#/, ''));
    } finally {
      setBusy(false);
    }
  };

  const handleAddTag = async () => {
    if (!tagDraft.trim() || busy) return;
    setBusy(true);
    try {
      await onAddTag(tagDraft.trim());
      setTagDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        ref={rootRef}
        className="arc2-category-panel-layout"
        data-elevation="sunken"
        data-typo-tone="white"
        data-input-size="m"
        data-btn-size="m"
      >
        <div className="arc2-category-panel-settings">
          <label className={`field input-live arc2-category-panel-stretch${nameDraft.trim() ? ' has-value' : ''}`} data-live-input>
            <input
              className="input"
              placeholder="Введите название…"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (!nameDraft.trim()) {
                  setNameDraft(category.name);
                  return;
                }
                void commitName();
              }}
              disabled={busy}
            />
            <button
              className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc2-icon-close"
              type="button"
              aria-label="Очистить"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setNameDraft('');
              }}
            />
          </label>

          <div className="input color-input input-slots arc2-category-panel-stretch" aria-label="Цвет категории">
            <span className="color-prepend slot-prepend">HEX</span>
            <input
              className="color-value-input slot-value"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
              onBlur={() => void commitHex()}
              disabled={busy}
              aria-label="HEX цвета категории"
            />
            <button
              type="button"
              className="color-swatch-inline slot-trailing"
              style={{ background: category.colorHex }}
              aria-label="Открыть палитру"
              disabled={busy}
              onClick={() => openColorPicker()}
            />
          </div>

          <div className="tabs arc2-category-priority" role="tablist" aria-label="Вес категории">
            {WEIGHT_OPTIONS.map((opt) => {
              const isActive = opt.key === category.weight;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`tab-button${isActive ? ' is-active' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    if (opt.key === category.weight || busy) return;
                    void onWeightChange(opt.key);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="arc2-category-panel-toolbar arc2-category-panel-stretch">
            <div className="arc2-category-rank-buttons">
              <button
                type="button"
                className="btn btn-outline btn-icon-only arc2-category-rank-btn"
                aria-label="Выше"
                disabled={!canMoveUp || busy}
                onClick={() => void onMoveUp()}
              >
                <span className="btn-icon-only__glyph arc2-icon-arrow-up" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-icon-only arc2-category-rank-btn"
                aria-label="Ниже"
                disabled={!canMoveDown || busy}
                onClick={() => void onMoveDown()}
              >
                <span className="btn-icon-only__glyph arc2-icon-arrow-down" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="btn btn-danger btn-icon-only"
              aria-label="Удалить категорию"
              disabled={busy}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <span className="btn-icon-only__glyph arc2-icon-trash" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="arc2-category-panel-divider" aria-hidden="true" />

        <TagCategoryDropSurface
          className="arc2-category-panel-tags"
          categoryId={category.id}
          draggingTagId={draggingTagId}
          allTags={allTags}
          onTagDrop={onTagDrop}
        >
          <div className="arc2-category-add-tag">
            <label
              className={`field input-live arc2-category-add-tag-field${tagDraft.trim() ? ' has-value' : ''}`}
              data-live-input
            >
              <input
                className="input arc2-category-add-tag-input"
                placeholder="Название новой метки…"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddTag();
                  }
                }}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc2-icon-close"
                type="button"
                aria-label="Очистить"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTagDraft('');
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-ds"
              disabled={!tagDraft.trim() || busy}
              onClick={() => void handleAddTag()}
            >
              <span className="btn-ds__value">Добавить</span>
              <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true" />
            </button>
          </div>
          <div className="arc2-category-tag-cloud">
            {tags.length === 0 ? (
              <p className="hint">В этой категории пока нет меток.</p>
            ) : (
              tags.map((tag) => {
                const hintParts = [tag.description?.trim()].filter(Boolean) as string[];
                if (tag.tooltipImageDataUrl) {
                  hintParts.push('Есть изображение для подсказки');
                }
                const titleHint = hintParts.length ? hintParts.join(' — ') : 'Открыть настройки метки';
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`chip${draggingTagId === tag.id ? ' arc2-tag-chip--dragging' : ''}`}
                    draggable={!busy}
                    title={titleHint}
                    aria-label={`Редактировать метку «${tag.name}»`}
                    aria-grabbed={draggingTagId === tag.id}
                    onClick={() => {
                      if (busy) return;
                      onEditTag(tag);
                    }}
                    onDragStart={(e) => {
                      if (busy) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData('application/tag-id', tag.id);
                      e.dataTransfer.setData('text/plain', tag.id);
                      e.dataTransfer.effectAllowed = 'move';
                      onTagDragStart(tag.id);
                    }}
                    onDragEnd={() => onTagDragEnd()}
                  >
                    <span className="chip-color" style={{ background: category.colorHex }} aria-hidden="true" />
                    <span>{tag.name}</span>
                    <span className="chip-count">{tag.usageCount}</span>
                  </button>
                );
              })
            )}
          </div>
        </TagCategoryDropSurface>
      </div>

      {colorPickerOpen ? (
        <CategoryColorModal
          initialHex={colorPickerSeed}
          onClose={() => setColorPickerOpen(false)}
          onSave={async (hex) => {
            setHexDraft(hex.replace(/^#/, ''));
            await onColorHexCommit(hex);
          }}
        />
      ) : null}

      {deleteConfirmOpen ? (
        <ConfirmDeleteCategoryModal
          categoryName={category.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={onDelete}
        />
      ) : null}
    </>
  );
}
