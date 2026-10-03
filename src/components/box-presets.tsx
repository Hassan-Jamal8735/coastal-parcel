import { BOX_PRESETS } from "@/lib/constants";

const ENVELOPE = (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="40" height="28" rx="3" stroke="#1c1c1c" strokeWidth="2.5" />
    <path d="M6 12L24 27L42 12" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BOX = (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 5L43 15.5V33.5L24 44L5 33.5V15.5L24 5Z" stroke="#1c1c1c" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M5 15.5L24 26L43 15.5" stroke="#1c1c1c" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M24 26V44" stroke="#1c1c1c" strokeWidth="2.5" />
  </svg>
);
const ICON_SIZE: Record<string, number> = { envelope: 26, small: 26, medium: 32, large: 38 };

export type BoxPreset = (typeof BOX_PRESETS)[number];

/** "Not sure about the size?" envelope/box buttons — same markup and icons as the original. */
export function BoxPresets({ active, onPick }: { active?: string; onPick: (preset: BoxPreset) => void }) {
  return (
    <>
      <p className="shipnow-preset-label">Not sure about the size?</p>
      <div className="shipnow-preset-grid">
        {BOX_PRESETS.map((b) => (
          <button key={b.key} type="button" className={"shipnow-preset-btn" + (active === b.key ? " active" : "")} onClick={() => onPick(b)}>
            <span className="shipnow-preset-icon" style={{ width: ICON_SIZE[b.key], height: ICON_SIZE[b.key] }}>
              {b.key === "envelope" ? ENVELOPE : BOX}
            </span>
            {b.label}
            <span className="shipnow-preset-dims">
              {b.l}&times;{b.w}&times;{b.h} cm
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
