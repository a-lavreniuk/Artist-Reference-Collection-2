import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArc2NavbarIcons } from '../components/layout/navbarIconHydrate';

type FeatureItem = {
  iconClass: string;
  title: string;
  description: string;
};

const FEATURES: FeatureItem[] = [
  {
    iconClass: 'arc2-icon-folder-open',
    title: 'Коллекции',
    description: 'Можно организовывать тематические коллекции.'
  },
  {
    iconClass: 'arc2-icon-tag',
    title: 'Метки',
    description: 'Продвинутая система категоризации метками.'
  },
  {
    iconClass: 'arc2-icon-server',
    title: 'Всё локально',
    description: 'Файлы хранятся локально, прямо на компьютере.'
  },
  {
    iconClass: 'arc2-icon-bookmark',
    title: 'Мудборд',
    description: 'Можно собирать мудборд-доску для актуальных проектов.'
  }
];

export default function OnboardingStubPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = document.body;
    const prev = body.getAttribute('data-elevation');
    body.setAttribute('data-elevation', 'sunken');
    return () => {
      if (prev) body.setAttribute('data-elevation', prev);
      else body.removeAttribute('data-elevation');
    };
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArc2NavbarIcons(rootRef.current);
    }
  }, []);

  const noop = () => {};

  return (
    <div
      ref={rootRef}
      className="arc2-onboarding"
      data-btn-size="m"
      data-arc2-icon-size="xl"
    >
      <div className="arc2-onboarding-welcome">
        <div className="arc2-onboarding-header">
          <div className="arc2-onboarding-title">
            <h1 className="h1">Добро пожаловать в ARC</h1>
            <p className="text-l arc2-onboarding-description">
              ARC — приложение для организации визуальных материалов без интернета. Создано для художников и
              дизайнеров с большими коллекциями референсов.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-ds" onClick={noop}>
            <span className="btn-ds__value">Начать проект</span>
            <span className="btn-ds__icon arc2-icon-folder-open" aria-hidden="true"></span>
          </button>
        </div>

        <div className="arc2-onboarding-features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="arc2-onboarding-feature panel elevation-sunken">
              <span
                className={`arc2-onboarding-feature__icon ${feature.iconClass}`}
                aria-hidden="true"
              ></span>
              <div className="arc2-onboarding-feature__content">
                <h2 className="h2">{feature.title}</h2>
                <p className="text-l arc2-onboarding-feature__description">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-ds" onClick={noop}>
          <span className="btn-ds__value">Восстановить резервную копию</span>
        </button>
      </div>
    </div>
  );
}
