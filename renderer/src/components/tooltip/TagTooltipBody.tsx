import './TagTooltipBody.css';

export interface TagTooltipBodyProps {
  description?: string;
  /** data:image/... из TagRecord.tooltipImageDataUrl */
  imageDataUrl?: string;
}

export function TagTooltipBody({ description, imageDataUrl }: TagTooltipBodyProps) {
  const hasText = Boolean(description?.trim());
  const hasImage = Boolean(imageDataUrl?.startsWith('data:image/'));
  if (!hasText && !hasImage) return null;

  const row = hasText && hasImage;

  return (
    <div className={`arc2-tag-tooltip${row ? ' arc2-tag-tooltip--row' : ''}`}>
      {hasImage && (
        <img
          className="arc2-tag-tooltip__image"
          src={imageDataUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      {hasText && <div className="arc2-tag-tooltip__text">{description}</div>}
    </div>
  );
}
