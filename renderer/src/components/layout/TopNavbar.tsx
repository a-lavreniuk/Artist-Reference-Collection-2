import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  addCategory,
  ARC2_CARDS_CHANGED_EVENT,
  ARC2_COLLECTIONS_CHANGED_EVENT,
  getNavbarMetrics,
  notifyCategoriesChanged,
  type NavbarMetrics
} from '../../services/db';
import {
  ARC2_ADD_CARDS_SUBMIT_REQUEST,
  ARC2_EDIT_CARD_SUBMIT_REQUEST,
  ARC2_COLLECTIONS_ADD_REQUEST,
  ARC2_NAVBAR_COLLECTION_TITLE_EVENT
} from './navbarEvents';
import { hydrateArc2NavbarIcons } from './navbarIconHydrate';
import NewCategoryModal from './NewCategoryModal';
import {
  parseUiKitElevation,
  parseUiKitSize,
  type UiKitElevationTab,
  type UiKitSizeTab,
  UI_KIT_URL
} from '../../ui-kit/uiKitToolbarSearch';

type MainSectionKey = 'gallery' | 'onboarding' | 'tags' | 'collections' | 'moodboard' | 'settings' | 'uiKit';
type ActiveView = MainSectionKey | 'add' | 'collectionDetail' | 'editCardDetail';

type TabItem = {
  key: string;
  label: string;
  count?: number;
  iconClass: string;
};

const MAIN_TABS: Array<{ key: MainSectionKey; label: string; path: string }> = [
  { key: 'gallery', label: 'Галерея', path: '/gallery' },
  { key: 'onboarding', label: 'Онбординг', path: '/onboarding' },
  { key: 'tags', label: 'Метки', path: '/tags' },
  { key: 'collections', label: 'Коллекции', path: '/collections' },
  { key: 'moodboard', label: 'Мудборд', path: '/moodboard' },
  { key: 'settings', label: 'Настройки', path: '/settings' },
  { key: 'uiKit', label: 'UI-Kit', path: '/ui-kit' }
];

const DEFAULT_METRICS: NavbarMetrics = {
  totalCards: 0,
  imageCards: 0,
  videoCards: 0,
  totalCollections: 0,
  moodboardCards: 0,
  totalCategories: 0
};

function formatTabCount(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    const rounded = Math.round(k * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0$/, '');
    return `${text}K`;
  }
  return String(value);
}

export default function TopNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const headerRef = useRef<HTMLElement>(null);

  const [metrics, setMetrics] = useState<NavbarMetrics>(DEFAULT_METRICS);
  const [searchValue, setSearchValue] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [collectionDetailTitle, setCollectionDetailTitle] = useState('');

  const galleryFilter = searchParams.get('gf') ?? 'all';
  const moodboardFilter = searchParams.get('mf') ?? 'cards';
  const settingsFilter = searchParams.get('sf') ?? 'storage';

  const setGalleryFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (key === 'all') n.delete('gf');
        else n.set('gf', key);
        return n;
      },
      { replace: true }
    );
  };

  const setMoodboardFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('mf', key);
        return n;
      },
      { replace: true }
    );
  };

  const setSettingsFilter = (key: string) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('sf', key);
        return n;
      },
      { replace: true }
    );
  };

  const uiKitElev = parseUiKitElevation(searchParams.get(UI_KIT_URL.elevation));
  const uiKitSize = parseUiKitSize(searchParams.get(UI_KIT_URL.size));

  const setUiKitElevParam = (v: UiKitElevationTab) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'default') n.delete(UI_KIT_URL.elevation);
        else n.set(UI_KIT_URL.elevation, v);
        return n;
      },
      { replace: true }
    );
  };

  const setUiKitSizeParam = (v: UiKitSizeTab) => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (v === 'm') n.delete(UI_KIT_URL.size);
        else n.set(UI_KIT_URL.size, v);
        return n;
      },
      { replace: true }
    );
  };

  const activeView = useMemo<ActiveView>(() => {
    const path = location.pathname;
    if (path === '/add') return 'add';
    if (/^\/collections\/[^/]+$/.test(path)) return 'collectionDetail';
    if (/^\/gallery\/[^/]+\/edit$/.test(path)) return 'editCardDetail';
    if (path.startsWith('/onboarding')) return 'onboarding';
    if (path.startsWith('/tags')) return 'tags';
    if (path.startsWith('/collections')) return 'collections';
    if (path.startsWith('/moodboard')) return 'moodboard';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/ui-kit')) return 'uiKit';
    return 'gallery';
  }, [location.pathname]);

  const activeMainTab: MainSectionKey =
    activeView === 'collectionDetail' || activeView === 'editCardDetail' || activeView === 'add'
      ? 'gallery'
      : activeView;

  useEffect(() => {
    void refreshMetrics();
    const onMetrics = () => void refreshMetrics();
    window.addEventListener(ARC2_CARDS_CHANGED_EVENT, onMetrics);
    window.addEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onMetrics);
    window.addEventListener('arc2:library-changed', onMetrics);
    return () => {
      window.removeEventListener(ARC2_CARDS_CHANGED_EVENT, onMetrics);
      window.removeEventListener(ARC2_COLLECTIONS_CHANGED_EVENT, onMetrics);
      window.removeEventListener('arc2:library-changed', onMetrics);
    };
  }, []);

  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<{ title?: string }>;
      setCollectionDetailTitle(typeof ce.detail?.title === 'string' ? ce.detail.title : '');
    };
    window.addEventListener(ARC2_NAVBAR_COLLECTION_TITLE_EVENT, fn);
    return () => window.removeEventListener(ARC2_NAVBAR_COLLECTION_TITLE_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!showAddCategoryModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAddCategoryModal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddCategoryModal]);

  const refreshMetrics = async () => {
    const nextMetrics = await getNavbarMetrics();
    setMetrics(nextMetrics);
  };

  const galleryTabs: TabItem[] = [
    { key: 'all', label: 'Все карточки', count: metrics.totalCards, iconClass: 'arc2-icon-images' },
    { key: 'images', label: 'Изображения', count: metrics.imageCards, iconClass: 'arc2-icon-image' }
  ];

  const moodboardTabs: TabItem[] = [
    { key: 'cards', label: 'Карточки', count: metrics.moodboardCards, iconClass: 'arc2-icon-images' },
    { key: 'board', label: 'Доска', iconClass: 'arc2-icon-whiteboard' }
  ];

  const settingsTabs: TabItem[] = [{ key: 'storage', label: 'Хранилище', iconClass: 'arc2-icon-hard-drive' }];

  const title = getTitle(activeView, collectionDetailTitle);

  const handleMainTabClick = (path: string) => {
    navigate(path);
  };

  const openAddCategoryModal = () => {
    setShowAddCategoryModal(true);
  };

  useLayoutEffect(() => {
    if (headerRef.current) {
      void hydrateArc2NavbarIcons(headerRef.current);
    }
  }, [
    activeView,
    activeMainTab,
    galleryFilter,
    moodboardFilter,
    settingsFilter,
    searchParams,
    searchValue,
    metrics,
    showAddCategoryModal,
    uiKitElev,
    uiKitSize
  ]);

  const requestCollectionsAdd = () => {
    window.dispatchEvent(new CustomEvent(ARC2_COLLECTIONS_ADD_REQUEST));
  };

  const requestAddCardsSubmit = () => {
    window.dispatchEvent(new CustomEvent(ARC2_ADD_CARDS_SUBMIT_REQUEST));
  };

  const requestEditCardSubmit = () => {
    window.dispatchEvent(new CustomEvent(ARC2_EDIT_CARD_SUBMIT_REQUEST));
  };

  return (
    <>
      <header ref={headerRef} className="arc2-navbar panel elevation-default" data-navbar-elevation="default">
        <div className="arc2-navbar-row">
          <div className="arc2-navbar-group">
            <div className="tabs arc2-navbar-main-tabs" role="tablist" aria-label="Основная навигация">
              {MAIN_TABS.map((tab) => {
                const isActive = tab.key === activeMainTab;
                return (
                  <button
                    key={tab.key}
                    className={`tab-button${isActive ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleMainTabClick(tab.path)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="arc2-navbar-group arc2-navbar-group--grow">
            <div
              className={`field field-full search-multiselect-live arc2-navbar-search-live${searchValue ? ' has-value' : ''}`}
              data-live-search-multi
            >
              <div className="input search-multiselect input--size-l input-slots arc2-navbar-search">
                <span className="search-icon slot-leading arc2-icon-search" aria-hidden="true"></span>
                <input
                  className="search-inner slot-value"
                  type="text"
                  placeholder="Поиск по названиям меток или ID карточек..."
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                <button
                  className="input-inline-icon search-multiselect-clear-btn input-inline-icon--close slot-trailing arc2-icon-close"
                  type="button"
                  aria-label="Очистить"
                  onClick={() => setSearchValue('')}
                ></button>
              </div>
            </div>
          </div>

          <div className="arc2-navbar-group">
            <button
              className="btn btn-primary btn-ds arc2-navbar-add"
              type="button"
              onClick={() => navigate('/add')}
            >
              <span className="btn-ds__value">Добавить карточки</span>
              <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true"></span>
            </button>
          </div>
        </div>

        <div className="arc2-navbar-row">
          {activeView !== 'editCardDetail' ? <h1 className="h1 arc2-navbar-title">{title}</h1> : null}
          <div className="arc2-navbar-secondary-actions">
            {activeView === 'uiKit' && (
              <UiKitNavbarToolbar
                elevation={uiKitElev}
                size={uiKitSize}
                onElevationChange={setUiKitElevParam}
                onSizeChange={setUiKitSizeParam}
              />
            )}
            {activeView === 'gallery' && (
              <FilterTabs
                ariaLabel="Фильтрация карточек"
                items={galleryTabs}
                activeKey={galleryFilter}
                onChange={setGalleryFilter}
              />
            )}
            {activeView === 'tags' && (
              <button className="btn btn-secondary btn-ds" type="button" onClick={openAddCategoryModal}>
                <span className="btn-ds__value">Добавить категорию</span>
                <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true"></span>
              </button>
            )}
            {activeView === 'collections' && (
              <button className="btn btn-secondary btn-ds" type="button" onClick={requestCollectionsAdd}>
                <span className="btn-ds__value">Добавить коллекцию</span>
                <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true"></span>
              </button>
            )}
            {activeView === 'moodboard' && (
              <FilterTabs
                ariaLabel="Фильтрация мудборда"
                items={moodboardTabs}
                activeKey={moodboardFilter}
                onChange={setMoodboardFilter}
              />
            )}
            {activeView === 'settings' && (
              <FilterTabs
                ariaLabel="Разделы настроек"
                items={settingsTabs}
                activeKey={settingsFilter}
                onChange={setSettingsFilter}
              />
            )}
            {activeView === 'add' && (
              <div className="arc2-navbar-action-group">
                <button className="btn btn-outline btn-ds" type="button" onClick={() => navigate('/gallery')}>
                  <span className="btn-ds__value">Отмена</span>
                </button>
                <button className="btn btn-success btn-ds" type="button" onClick={requestAddCardsSubmit}>
                  <span className="btn-ds__value">Добавить</span>
                  <span className="btn-ds__icon arc2-icon-plus" aria-hidden="true"></span>
                </button>
              </div>
            )}
            {activeView === 'collectionDetail' && (
              <div className="arc2-navbar-collection-detail">
                <div className="arc2-navbar-collection-detail-left">
                  <button
                    className="btn btn-outline btn-icon-only"
                    type="button"
                    aria-label="Назад"
                    onClick={() => navigate('/collections')}
                  >
                    <span
                      className="btn-icon-only__glyph arc2-icon-chevron arc2-chevron-point-left"
                      aria-hidden="true"
                    ></span>
                  </button>
                </div>
                <FilterTabs
                  ariaLabel="Фильтрация карточек коллекции"
                  items={galleryTabs}
                  activeKey={galleryFilter}
                  onChange={setGalleryFilter}
                />
              </div>
            )}
            {activeView === 'editCardDetail' && (
              <div className="arc2-navbar-edit-detail">
                <h1 className="h1 arc2-navbar-title">Изменить карточку</h1>
                <div className="arc2-navbar-action-group">
                  <button className="btn btn-outline btn-ds" type="button" onClick={() => navigate('/gallery')}>
                    <span className="btn-ds__value">Отмена</span>
                  </button>
                  <button className="btn btn-success btn-ds" type="button" onClick={requestEditCardSubmit}>
                    <span className="btn-ds__value">Сохранить изменения</span>
                    <span className="btn-ds__icon arc2-icon-save" aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showAddCategoryModal ? (
        <NewCategoryModal
          onClose={() => setShowAddCategoryModal(false)}
          onSubmit={async (name, colorHex) => {
            await addCategory(name, colorHex);
            notifyCategoriesChanged();
            await refreshMetrics();
          }}
        />
      ) : null}
    </>
  );
}

function UiKitNavbarToolbar({
  elevation,
  size,
  onElevationChange,
  onSizeChange
}: {
  elevation: UiKitElevationTab;
  size: UiKitSizeTab;
  onElevationChange: (v: UiKitElevationTab) => void;
  onSizeChange: (v: UiKitSizeTab) => void;
}) {
  const elevOptions: Array<{ key: UiKitElevationTab; label: string }> = [
    { key: 'sunken', label: 'Sunken' },
    { key: 'default', label: 'Default' },
    { key: 'raised', label: 'Raised' }
  ];
  const sizeOptions: Array<{ key: UiKitSizeTab; label: string }> = [
    { key: 'l', label: 'L' },
    { key: 'm', label: 'M' },
    { key: 's', label: 'S' }
  ];

  return (
    <div className="arc2-navbar-ui-kit-controls">
      <div className="control-group">
        <div className="tabs arc2-navbar-ui-kit-tabs" role="tablist" aria-label="Elevation">
          {elevOptions.map((opt) => {
            const isActive = opt.key === elevation;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                className={`tab-button${isActive ? ' is-active' : ''}`}
                aria-selected={isActive}
                onClick={() => onElevationChange(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="control-group">
        <div className="tabs arc2-navbar-ui-kit-tabs" role="tablist" aria-label="Глобальный размер">
          {sizeOptions.map((opt) => {
            const isActive = opt.key === size;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                className={`tab-button${isActive ? ' is-active' : ''}`}
                aria-selected={isActive}
                onClick={() => onSizeChange(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterTabs({
  ariaLabel,
  items,
  activeKey,
  onChange
}: {
  ariaLabel: string;
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="tabs arc2-navbar-filters" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            className={`tab-button${isActive ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
          >
            <span className={`tab-icon ${item.iconClass}`} aria-hidden="true"></span>
            <span>{item.label}</span>
            {typeof item.count === 'number' && <span className="tab-counter">{formatTabCount(item.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function getTitle(activeView: ActiveView, collectionTitle: string): string {
  switch (activeView) {
    case 'gallery':
      return 'Карточки';
    case 'onboarding':
      return 'Онбординг';
    case 'tags':
      return 'Категории и метки';
    case 'collections':
      return 'Коллекции';
    case 'moodboard':
      return 'Мудборд';
    case 'settings':
      return 'Настройки';
    case 'uiKit':
      return 'UI-Kit';
    case 'add':
      return 'Добавить карточки';
    case 'collectionDetail':
      return collectionTitle ? `Коллекция: «${collectionTitle}»` : 'Коллекция';
    case 'editCardDetail':
      return 'Изменить карточку';
    default:
      return 'Карточки';
  }
}
