// Pure display pieces shared by server pages and client forms in the booking flow.

/** Numbered step dots (template-parts/shipnow-stepper.php). */
export function ShipnowStepper({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <div className="shipnow-stepper" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, idx) => {
        const i = idx + 1;
        return (
          <span key={i} style={{ display: "contents" }}>
            <div className={"shipnow-step-dot" + (i === current ? " is-current" : i < current ? " is-done" : "")}>{i === current && <span>{i}</span>}</div>
            {i < total && <div className="shipnow-step-line" />}
          </span>
        );
      })}
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#1c1c1c" strokeWidth="1.8" />
      <path d="M3 9H21" stroke="#1c1c1c" strokeWidth="1.8" />
      <path d="M8 3V6" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3V6" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  sender: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="3.2" stroke="#1c1c1c" strokeWidth="1.8" />
      <path d="M4.5 20c1-3.8 4.2-6 7.5-6s6.5 2.2 7.5 6" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  receiver: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21S5 14.5 5 9.8C5 6.05 8.13 3 12 3s7 3.05 7 6.8C19 14.5 12 21 12 21Z" stroke="#1c1c1c" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.3" stroke="#1c1c1c" strokeWidth="1.8" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L20.5 7.5V16.5L12 21L3.5 16.5V7.5L12 3Z" stroke="#1c1c1c" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3.5 7.5L12 12L20.5 7.5" stroke="#1c1c1c" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 12V21" stroke="#1c1c1c" strokeWidth="1.8" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 12.5L12.5 20C11.7 20.8 10.4 20.8 9.6 20L4 14.4C3.2 13.6 3.2 12.3 4 11.5L11.5 4H18C19.1 4 20 4.9 20 6V12.5Z" stroke="#1c1c1c" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="15" cy="9" r="1.5" stroke="#1c1c1c" strokeWidth="1.8" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="#1c1c1c" strokeWidth="1.8" />
      <path d="M8 8H16" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12.5H16" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 17H12.5" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  route: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="2.3" stroke="#1c1c1c" strokeWidth="1.8" />
      <circle cx="18" cy="18" r="2.3" stroke="#1c1c1c" strokeWidth="1.8" />
      <path d="M6 8.3V13C6 15.5 8 17.5 10.5 17.5H12" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1.5 3" />
    </svg>
  ),
};

/** A boxed form section with its icon header (.ship-card-section). */
export function ShipCardSection({ icon, title, children }: { icon: keyof typeof ICONS | string; title: string; children: React.ReactNode }) {
  return (
    <div className="ship-card-section">
      <div className="ship-card-section-header">
        <span className="ship-card-icon">{ICONS[icon]}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}
