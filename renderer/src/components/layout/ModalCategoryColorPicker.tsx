import { useLayoutEffect, useRef, useState } from 'react';
import { clamp, hexToHsv, hsvToHex, normalizeHex } from '../../utils/colorPicker';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

const HUE_INSET = 2;
const HUE_THUMB_SIZE = 12;

export default function ModalCategoryColorPicker({ value, onChange }: Props) {
  const hueTrackRef = useRef<HTMLDivElement>(null);
  const toneTrackRef = useRef<HTMLDivElement>(null);
  const [hueTrackWidth, setHueTrackWidth] = useState(0);

  const safeHex = normalizeHex(value) ?? '#EAB308';
  const parsed = hexToHsv(safeHex) ?? { h: 45, s: 95, v: 92 };
  const { h: hue, s: saturation, v: brightness } = parsed;

  useLayoutEffect(() => {
    const el = hueTrackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHueTrackWidth(el.clientWidth));
    ro.observe(el);
    setHueTrackWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const applyHsv = (h: number, s: number, v: number) => {
    onChange(hsvToHex(h, s, v));
  };

  const hueTravel = Math.max(0, hueTrackWidth - HUE_THUMB_SIZE - HUE_INSET * 2);
  const hueLeft = HUE_INSET + (hue / 360) * hueTravel;

  const paletteBackground = `linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, #000000 100%), linear-gradient(90deg, #ffffff 0%, hsl(${Math.round(hue)} 100% 50%) 100%)`;

  const bindHueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const track = hueTrackRef.current;
    if (!track) return;
    const move = (e: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      applyHsv(x * 360, saturation, brightness);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    move(event.nativeEvent);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const bindToneDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const track = toneTrackRef.current;
    if (!track) return;
    const move = (e: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      applyHsv(hue, Math.round(x * 100), Math.round((1 - y) * 100));
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    move(event.nativeEvent);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <>
      <div className="arc-modal__slot">
        <div className="input color-input input-slots" aria-label="Color value">
          <span className="color-prepend slot-prepend">HEX</span>
          <input
            className="color-value-input slot-value"
            value={safeHex}
            onChange={(e) => {
              const parsedHex = normalizeHex(e.target.value);
              if (!parsedHex) return;
              onChange(parsedHex);
            }}
            aria-label="HEX цвета"
          />
          <span className="color-swatch-inline slot-trailing" style={{ background: safeHex }} aria-hidden="true" />
        </div>
      </div>
      <div className="arc-modal__slot">
        <div
          ref={hueTrackRef}
          className="arc-modal__gradient-track"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hue)}
          tabIndex={0}
          onPointerDown={bindHueDrag}
        >
          <span className="arc-modal__gradient-thumb" style={{ left: hueLeft }} />
        </div>
      </div>
      <div className="arc-modal__slot">
        <div
          ref={toneTrackRef}
          className="arc-modal__palette"
          style={{ background: paletteBackground }}
          role="presentation"
          tabIndex={0}
          onPointerDown={bindToneDrag}
        >
          <span
            className="arc-modal__palette-thumb"
            style={{ left: `${saturation}%`, top: `${100 - brightness}%` }}
          />
        </div>
      </div>
    </>
  );
}
