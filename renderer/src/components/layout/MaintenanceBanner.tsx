import { useEffect, useState } from 'react';

export default function MaintenanceBanner() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setLocked(v));
  }, []);

  if (!locked) return null;

  return (
    <div className="arc2-maintenance-banner" role="status" aria-live="polite">
      <p className="typo-p-m arc2-maintenance-banner__text">Идёт операция…</p>
    </div>
  );
}
