import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SettingsStoragePanel from './settings/SettingsStoragePanel';
import SettingsStatisticsPanel from './settings/SettingsStatisticsPanel';
import SettingsHistoryPanel from './settings/SettingsHistoryPanel';
import SettingsDuplicatesPanel from './settings/SettingsDuplicatesPanel';

const VALID_SF = new Set(['storage', 'statistics', 'history', 'duplicates']);

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sf = searchParams.get('sf') ?? 'storage';

  const active = useMemo(() => (VALID_SF.has(sf) ? sf : 'storage'), [sf]);

  useEffect(() => {
    if (!VALID_SF.has(sf)) {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set('sf', 'storage');
          return n;
        },
        { replace: true }
      );
    }
  }, [sf, setSearchParams]);

  return (
    <div
      className="arc2-settings-page arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-role="primary"
      data-typo-tone="white"
      data-typo-state="default"
      data-btn-size="l"
      data-input-size="l"
    >
      {active === 'storage' ? <SettingsStoragePanel /> : null}
      {active === 'statistics' ? <SettingsStatisticsPanel /> : null}
      {active === 'history' ? <SettingsHistoryPanel /> : null}
      {active === 'duplicates' ? <SettingsDuplicatesPanel /> : null}
    </div>
  );
}
