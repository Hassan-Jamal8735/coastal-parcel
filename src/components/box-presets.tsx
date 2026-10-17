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
const BARREL = (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="9" rx="14" ry="4.5" stroke="#1c1c1c" strokeWidth="2.5" />
    <path d="M10 9V39C10 41.5 16.3 43.5 24 43.5C31.7 43.5 38 41.5 38 39V9" stroke="#1c1c1c" strokeWidth="2.5" />
    <path d="M10 19C10 21.5 16.3 23.5 24 23.5C31.7 23.5 38 21.5 38 19M10 30C10 32.5 16.3 34.5 24 34.5C31.7 34.5 38 32.5 38 30" stroke="#1c1c1c" strokeWidth="2" />
  </svg>
);
const ICON_SIZE: Record<string, number> = { envelope: 26, small: 26, medium: 32, large: 38, half_barrel: 32, barrel: 38 };

export type BoxPreset = (typeof BOX_PRESETS)[number];

/** "Not sure about the size?" envelope/box buttons — same markup and icons as the original. */
export function BoxPresets({ active, onPick, charges }: { active?: string; onPick: (preset: BoxPreset) => void; charges?: Record<string, number> }) {
  return (
    <>
      <p className="shipnow-preset-label">Choose a package type, or enter your own size</p>
      <div className="shipnow-preset-grid">
        {BOX_PRESETS.map((b) => (
          <button key={b.key} type="button" className={"shipnow-preset-btn" + (active === b.key ? " active" : "")} onClick={() => onPick(b)}>
            <span className="shipnow-preset-icon" style={{ width: ICON_SIZE[b.key], height: ICON_SIZE[b.key] }}>
              {b.key === "envelope" ? ENVELOPE : b.key.includes("barrel") ? BARREL : BOX}
            </span>
            {b.label}
            <span className="shipnow-preset-dims">
              {b.l}&times;{b.w}&times;{b.h} cm
            </span>
            {charges?.[b.key] ? <span className="shipnow-preset-charge">+&#8358;{charges[b.key].toLocaleString("en-US")} each</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}
