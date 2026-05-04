import { useEffect, useState } from 'react';
import {
  getAllCategories,
  getNavbarMetrics,
  getTagsByCategory,
  listCardsSorted,
  deleteTag,
  type TagRecord
} from '../../services/db';
import { formatBytes } from '../../utils/formatBytes';
import { computeSplitLibraryMediaBytesFromCards } from '../../utils/computeLibraryMediaBytesFromCards';

export default function SettingsStatisticsPanel() {
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getNavbarMetrics>> | null>(null);
  const [bytesImages, setBytesImages] = useState(0);
  const [bytesVideos, setBytesVideos] = useState(0);
  const [totalTags, setTotalTags] = useState(0);
  const [topTags, setTopTags] = useState<TagRecord[]>([]);
  const [lowTags, setLowTags] = useState<TagRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const m = await getNavbarMetrics();
      setMetrics(m);
      const cards = await listCardsSorted('all');
      if (window.arc) {
        const { imageBytes, videoBytes } = await computeSplitLibraryMediaBytesFromCards(window.arc, cards);
        setBytesImages(imageBytes);
        setBytesVideos(videoBytes);
      } else {
        setBytesImages(0);
        setBytesVideos(0);
      }
      const cats = await getAllCategories();
      const allTags: TagRecord[] = [];
      for (const cat of cats) {
        allTags.push(...(await getTagsByCategory(cat.id)));
      }
      setTotalTags(allTags.length);
      const sorted = [...allTags].sort((a, b) => b.usageCount - a.usageCount);
      setTopTags(sorted.slice(0, 10));
      setLowTags(sorted.filter((t) => t.usageCount <= 5).sort((a, b) => a.usageCount - b.usageCount).slice(0, 30));
    })();
  }, []);

  const totalData = bytesImages + bytesVideos;

  return (
    <div className="arc2-settings-stack">
      <section className="arc2-settings-block panel elevation-sunken">
        <h2 className="h2 arc2-settings-block__title">Сводка</h2>
        <div className="arc2-stats-grid">
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Изображения</p>
            <p className="h3">{metrics?.imageCards ?? 0}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Видео</p>
            <p className="h3">{metrics?.videoCards ?? 0}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Коллекции</p>
            <p className="h3">{metrics?.totalCollections ?? 0}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Категории</p>
            <p className="h3">{metrics?.totalCategories ?? 0}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Метки (всего)</p>
            <p className="h3">{totalTags}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Мудборд</p>
            <p className="h3">{metrics?.moodboardCards ?? 0}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Объём изображений</p>
            <p className="h3">{formatBytes(bytesImages)}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Объём видео</p>
            <p className="h3">{formatBytes(bytesVideos)}</p>
          </div>
          <div className="arc2-stat-card">
            <p className="typo-p-m hint">Все данные (оценка)</p>
            <p className="h3">{formatBytes(totalData)}</p>
          </div>
        </div>
      </section>

      <section className="arc2-settings-block panel elevation-sunken">
        <h2 className="h2 arc2-settings-block__title">Популярные метки</h2>
        <ul className="arc2-settings-list">
          {topTags.map((t) => (
            <li key={t.id} className="typo-p-m">
              {t.name} — {t.usageCount}
            </li>
          ))}
        </ul>
      </section>

      <section className="arc2-settings-block panel elevation-sunken">
        <h2 className="h2 arc2-settings-block__title">Малоиспользуемые (0–5 карточек)</h2>
        <ul className="arc2-settings-list">
          {lowTags.map((t) => (
            <li key={t.id} className="arc2-settings-list__row">
              <span className="typo-p-m">
                {t.name} — {t.usageCount}
              </span>
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={() => void deleteTag(t.id)}>
                <span className="btn-ds__value">Удалить</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
