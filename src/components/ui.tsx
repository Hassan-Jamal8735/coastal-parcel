// Small shared form styles so every form across the app looks the same.
export const inputClass =
  "w-full rounded-lg border border-line bg-white px-4 py-3 outline-none transition focus:border-brand disabled:bg-cream";
export const labelClass = "mb-1.5 block text-sm font-semibold";
export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 font-bold text-ink transition hover:bg-brand-dark disabled:opacity-60";
export const outlineButton =
  "inline-flex items-center justify-center rounded-lg border-2 border-ink px-6 py-3 font-bold transition hover:bg-ink hover:text-white";
export const cardClass = "rounded-2xl border border-line bg-white p-6 md:p-8";

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={"block " + (className ?? "")}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function CountryOptions({ countries }: { countries: readonly string[] }) {
  return (
    <>
      {countries.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );
}
