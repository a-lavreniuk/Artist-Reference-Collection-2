import { Link } from 'react-router-dom';

/** Заглушка маршрута `gallery/:cardId/edit` до полноценного редактирования карточки. */
export default function GalleryCardEditStubPage() {
  return (
    <div className="arc2-page-empty panel elevation-default">
      <p className="typo-p-m">Редактирование карточки с этого экрана появится на следующем этапе.</p>
      <Link className="typo-p-m" to="/gallery">
        Вернуться в галерею
      </Link>
    </div>
  );
}
