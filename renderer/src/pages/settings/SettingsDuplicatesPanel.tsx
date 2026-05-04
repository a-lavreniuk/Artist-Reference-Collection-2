import { useCallback, useEffect, useState } from 'react';
import type { ArcMetadataV1 } from '../../services/arcSchema';
import {
  addSkippedDuplicatePair,
  deleteCard,
  getDuplicateSimilarityThresholdPct,
  listCardsSorted,
  setDuplicateSimilarityThresholdPct,
  type CardRecord
} from '../../services/db';
import { fingerprintFromUrl, similarityCombined, type ImageDupFingerprint } from './imageDupHash';
type Pair = { a: CardRecord; b: CardRecord; sim: number };

export default function SettingsDuplicatesPanel() {
  const [threshold, setThreshold] = useState(85);
  const [scanTick, setScanTick] = useState(0);
  const [current, setCurrent] = useState<Pair | null>(null);
  const [busy, setBusy] = useState(false);
  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);

  const loadThreshold = useCallback(async () => {
    setThreshold(await getDuplicateSimilarityThresholdPct());
  }, []);

  useEffect(() => {
    void loadThreshold();
  }, [loadThreshold]);

  useEffect(() => {
    if (!window.arc?.maintenanceBegin) return undefined;
    let cancelled = false;

    void (async () => {
      const arc = window.arc;
      if (!arc) return;
      await arc.maintenanceBegin();
      try {
        if (cancelled) return;
        setBusy(true);
        try {
          const meta = (await arc.readMetadata()) as ArcMetadataV1 | null;
          const skip = new Set(
            (meta?.skippedDuplicatePairs ?? []).map(([x, y]) => {
              const a = x < y ? x : y;
              const b = x < y ? y : x;
              return `${a}:${b}`;
            })
          );
          const images = (await listCardsSorted('all')).filter((c) => c.type === 'image').slice(0, 80);
          const fps = new Map<string, ImageDupFingerprint | null>();
          for (const c of images) {
            if (cancelled) break;
            const u = await arc.toFileUrl(c.thumbRelativePath);
            if (!u) {
              fps.set(c.id, null);
              continue;
            }
            fps.set(c.id, await fingerprintFromUrl(u));
          }
          if (cancelled) return;
          const thr = await getDuplicateSimilarityThresholdPct();
          let found: Pair | null = null;
          outer: for (let i = 0; i < images.length; i++) {
            if (cancelled) break;
            for (let j = i + 1; j < images.length; j++) {
              const a = images[i]!;
              const b = images[j]!;
              const ka = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
              if (skip.has(ka)) continue;
              const fa = fps.get(a.id);
              const fb = fps.get(b.id);
              if (!fa || !fb) continue;
              const sim = similarityCombined(fa, fb);
              if (sim >= thr) {
                found = { a, b, sim };
                break outer;
              }
            }
          }
          if (!cancelled) {
            setCurrent(found);
            if (found) {
              setUrlA(await arc.toFileUrl(found.a.thumbRelativePath));
              setUrlB(await arc.toFileUrl(found.b.thumbRelativePath));
            } else {
              setUrlA(null);
              setUrlB(null);
            }
          }
        } finally {
          setBusy(false);
        }
      } finally {
        await arc.maintenanceEnd();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanTick]);

  const skipPair = async () => {
    if (!current) return;
    await addSkippedDuplicatePair(current.a.id, current.b.id);
    setCurrent(null);
    setUrlA(null);
    setUrlB(null);
    setScanTick((t) => t + 1);
  };

  const removeOne = async (id: string) => {
    if (!current) return;
    await deleteCard(id);
    await addSkippedDuplicatePair(current.a.id, current.b.id);
    setCurrent(null);
    setUrlA(null);
    setUrlB(null);
    setScanTick((t) => t + 1);
  };

  return (
    <div className="arc2-settings-stack">
      <section className="arc2-settings-block panel elevation-sunken">
        <h2 className="h2 arc2-settings-block__title">Поиск дублей</h2>
        <p className="typo-p-m hint">
          Порог сходства по комбинированной метрике (структура по поворотам и гистограмма яркости, веса 70/30 в коде). Скан — до 80
          изображений.
        </p>
        <div className="field field-full input-live">
          <label className="label" htmlFor="dup-threshold">
            Порог, %
          </label>
          <input
            id="dup-threshold"
            className="input input--size-l"
            type="number"
            min={50}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            onBlur={() => {
              const v = Math.min(100, Math.max(50, Math.round(threshold)));
              setThreshold(v);
              void setDuplicateSimilarityThresholdPct(v).then(() => void loadThreshold());
            }}
          />
        </div>

        {busy ? <p className="typo-p-m hint">Идёт поиск дублей…</p> : null}

        {!busy && current && urlA && urlB ? (
          <div className="arc2-dup-pair">
            <p className="typo-p-m">Сходство: {current.sim.toFixed(1)}%</p>
            <div className="arc2-dup-pair__images">
              <figure>
                <img className="arc2-dup-thumb" src={urlA} alt="" />
                <figcaption className="typo-p-m hint">Карточка A</figcaption>
              </figure>
              <figure>
                <img className="arc2-dup-thumb" src={urlB} alt="" />
                <figcaption className="typo-p-m hint">Карточка B</figcaption>
              </figure>
            </div>
            <div className="arc2-settings-row arc2-settings-row--wrap">
              <button type="button" className="btn btn-outline btn-ds" onClick={() => void skipPair()}>
                <span className="btn-ds__value">Пропустить пару</span>
              </button>
              <button type="button" className="btn btn-danger btn-ds" onClick={() => void removeOne(current.a.id)}>
                <span className="btn-ds__value">Удалить A</span>
              </button>
              <button type="button" className="btn btn-danger btn-ds" onClick={() => void removeOne(current.b.id)}>
                <span className="btn-ds__value">Удалить B</span>
              </button>
            </div>
          </div>
        ) : null}

        {!busy && !current ? <p className="typo-p-m hint">Пар с выбранным порогом не найдено (в пределах выборки).</p> : null}
      </section>

    </div>
  );
}
