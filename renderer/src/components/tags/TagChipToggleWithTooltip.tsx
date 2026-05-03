import type { TagRecord } from '../../services/db';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';

type Props = {
  tag: TagRecord;
  categoryColorHex: string;
  selected: boolean;
  onToggle: () => void;
};

/**
 * Чип выбора метки с тем же rich-tooltip, что на странице «Категории и метки» (описание / картинка).
 */
export default function TagChipToggleWithTooltip({
  tag,
  categoryColorHex,
  selected,
  onToggle
}: Props) {
  const hasTipText = Boolean(tag.description?.trim());
  const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
  const canShowTooltip = hasTipText || hasTipImage;

  const chip = (
    <button
      type="button"
      className={`chip${selected ? ' chip-active' : ''}`}
      aria-label={selected ? `Снять метку «${tag.name}»` : `Выбрать метку «${tag.name}»`}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className="chip-color" style={{ background: categoryColorHex }} aria-hidden="true" />
      <span>{tag.name}</span>
      <span className="chip-count">{tag.usageCount}</span>
    </button>
  );

  if (!canShowTooltip) {
    return chip;
  }

  return (
    <Tooltip
      content={<TagTooltipBody description={tag.description} imageDataUrl={tag.tooltipImageDataUrl} />}
      delay={1000}
      position="top"
      variant="rich"
    >
      {chip}
    </Tooltip>
  );
}
