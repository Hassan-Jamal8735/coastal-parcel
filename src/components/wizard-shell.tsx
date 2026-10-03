import { SiteHeader } from "./site-header";

const STEPS = ["Details", "Options", "Add-ons", "Customs", "Review", "Payment"];

/**
 * Layout for every booking step, with a progress stepper. Customs only
 * applies to international shipments, so domestic flows hide that step.
 */
export function WizardShell({
  step,
  international = true,
  title,
  subtitle,
  children,
}: {
  step: (typeof STEPS)[number];
  international?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const steps = international ? STEPS : STEPS.filter((s) => s !== "Customs");
  const current = steps.indexOf(step);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-bold uppercase tracking-wide">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] " +
                  (i < current ? "bg-success text-white" : i === current ? "bg-brand text-ink" : "bg-line text-muted")
                }
              >
                {i < current ? "✓" : i + 1}
              </span>
              <span className={i === current ? "text-ink" : "text-muted"}>{s}</span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-line" />}
            </li>
          ))}
        </ol>
        <h1 className="text-4xl font-bold">{title}</h1>
        {subtitle && <p className="mb-8 mt-2 text-muted">{subtitle}</p>}
        {children}
      </main>
    </>
  );
}
