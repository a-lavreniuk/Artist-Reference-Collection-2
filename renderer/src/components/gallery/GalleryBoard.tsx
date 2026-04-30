import { useEffect, useState } from 'react';
import type { CardRecord } from '../../services/db';

type Props = {
  cards: CardRecord[];
  onOpenCard: (id: string) => void;
  onFindSimilar?: (cardId: string) => void;
};

export default function GalleryBoard({ cards, onOpenCard, onFindSimilar }: Props) {
  const [srcMap, setSrcMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!window.arc) {
      setSrcMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const c of cards) {
        const rel = c.thumbRelativePath || c.originalRelativePath;
        if (!rel || rel === 'legacy') continue;
        const href = await window.arc!.toFileUrl(rel);
        if (href) next[c.id] = href;
      }
      if (!cancelled) setSrcMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  return (
    <div className="arc2-gallery-masonry">
      {cards.map((card) => (
        <div
          key={card.id}
          role="button"
          tabIndex={0}
          className="arc2-gallery-card-wrap panel elevation-default"
          onClick={() => onOpenCard(card.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenCard(card.id);
            }
          }}
        >
          <span className="arc2-gallery-card-stack">
            <span className="arc2-gallery-card-badge" aria-hidden="true">
              <span className="tab-icon arc2-icon-image" />
            </span>
            {srcMap[card.id] ? (
              <img className="arc2-gallery-thumb" src={srcMap[card.id]} alt="" loading="lazy" decoding="async" />
            ) : (
              <div className="arc2-gallery-skeleton" aria-hidden />
            )}
            <span className="arc2-gallery-card-overlay">
              <span className="arc2-gallery-card-overlay-inner">
                {onFindSimilar ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-ds arc2-gallery-overlay-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onFindSimilar(card.id);
                    }}
                  >
                    <span className="btn-ds__value">Найти похожее</span>
                    <span className="btn-ds__icon arc2-icon-search" aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc2-gallery-overlay-bookmark"
                  disabled
                  title="Скоро: мудборд"
                  aria-label="В мудборд (скоро)"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <span className="btn-icon-only__glyph arc2-icon-bookmark" aria-hidden="true" />
                </button>
              </span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
