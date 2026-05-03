export const ARC2_NAVBAR_COLLECTION_TITLE_EVENT = 'arc2:navbar-collection-title';
/** Открыть модалку переименования коллекции (кнопка в навбаре на детали коллекции). */
export const ARC2_RENAME_COLLECTION_REQUEST = 'arc2:rename-collection-request';
export const ARC2_COLLECTIONS_ADD_REQUEST = 'arc2:collections-add-request';
export const ARC2_ADD_CARDS_SUBMIT_REQUEST = 'arc2:add-cards-submit-request';
export const ARC2_EDIT_CARD_SUBMIT_REQUEST = 'arc2:edit-card-submit-request';
export const ARC2_ADD_CARDS_QUEUE_STATE_EVENT = 'arc2:add-cards-queue-state';

export type Arc2AddCardsQueueStateDetail = {
  hasItems: boolean;
  count: number;
};

let lastAddCardsQueueState: Arc2AddCardsQueueStateDetail = { hasItems: false, count: 0 };

/** Последнее состояние очереди (для навбара до первого события или после гонки mount). */
export function getLastAddCardsQueueState(): Arc2AddCardsQueueStateDetail {
  return lastAddCardsQueueState;
}

export function publishAddCardsQueueState(detail: Arc2AddCardsQueueStateDetail): void {
  lastAddCardsQueueState = detail;
  window.dispatchEvent(
    new CustomEvent<Arc2AddCardsQueueStateDetail>(ARC2_ADD_CARDS_QUEUE_STATE_EVENT, { detail })
  );
}
