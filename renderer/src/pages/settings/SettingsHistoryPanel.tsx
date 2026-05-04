import { useEffect, useMemo, useState } from 'react';

type Entry = { time: string; message: string };

type FilterKey = 'today' | 'week' | 'month' | 'all';

function parseLocalEntryTime(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(): Date {
  const d = startOfToday();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function SettingsHistoryPanel() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState<FilterKey>('today');

  useEffect(() => {
    void (async () => {
      if (!window.arc?.readHistory) {
        setEntries([]);
        return;
      }
      setEntries(await window.arc.readHistory());
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const t0 =
      filter === 'today'
        ? startOfToday()
        : filter === 'week'
          ? startOfWeekMonday()
          : filter === 'month'
            ? startOfMonth()
            : null;
    return entries.filter((e) => {
      const d = parseLocalEntryTime(e.time);
      if (!d) return filter === 'all';
      if (filter === 'all') return true;
      if (!t0) return true;
      return d >= t0 && d <= now;
    });
  }, [entries, filter]);

  const tabs: { key: FilterKey; label: string }[] = [
    { key: 'today', label: 'Сегодня' },
    { key: 'week', label: 'Неделя' },
    { key: 'month', label: 'Месяц' },
    { key: 'all', label: 'Вся история' }
  ];

  return (
    <div className="arc2-settings-stack">
      <section className="arc2-settings-block panel elevation-sunken">
        <h2 className="h2 arc2-settings-block__title">История</h2>
        <div className="tabs arc2-navbar-filters arc2-history-filters" role="tablist" aria-label="Период истории">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-button${filter === t.key ? ' is-active' : ''}`}
              role="tab"
              aria-selected={filter === t.key}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <ul className="arc2-settings-list arc2-history-list">
          {filtered.map((e, i) => (
            <li key={`${e.time}-${i}`} className="typo-p-m arc2-history-line">
              <span className="hint arc2-history-time">{e.time}</span> — {e.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
