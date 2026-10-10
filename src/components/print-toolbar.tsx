"use client";

/** Screen-only bar above a printable document: Print and Back. Hidden when printing. */
export function PrintToolbar({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="doc-toolbar">
      <div>
        <strong>{title}</strong>
        {hint && <span className="doc-hint">{hint}</span>}
      </div>
      <div className="doc-toolbar-buttons">
        <button type="button" className="dv-chip" onClick={() => history.back()}>
          Back
        </button>
        <button type="button" className="main-button w-button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}
