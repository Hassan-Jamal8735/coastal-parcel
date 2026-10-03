"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/constants";

/**
 * Price + "Pay In" dropdown that converts instantly as you switch currency
 * (rates are passed in from the server — the same lookup used for the
 * real charge), without a reload.
 */
export function CurrencyPreview({ ngnBase, rates }: { ngnBase: number; rates: Record<string, number> }) {
  const [code, setCode] = useState("NGN");
  const symbol = CURRENCIES[code]?.symbol ?? code + " ";
  const naira = "₦" + ngnBase.toLocaleString("en-US", { maximumFractionDigits: 0 });

  let display = naira;
  let note = "This is the base price in Nigerian Naira. Pick the currency you’d like to pay in below.";
  if (code !== "NGN") {
    const converted = rates[code] ? ngnBase * rates[code] : code === "USD" ? ngnBase / 1600 : null;
    if (converted !== null) {
      display = symbol + converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      note = `Converted from ${naira} at today’s rate. The exact charge amount is confirmed on the payment page.`;
    } else {
      note = `Live rate for ${code} is unavailable right now — you’ll see the converted amount on the payment page instead.`;
    }
  }

  return (
    <>
      <h3 className="ship-section-heading">Price</h3>
      <p className="cp-price-display">{display}</p>
      <p className="p-light">{note}</p>
      <div className="form-field">
        <div className="label">Pay In</div>
        <select className="field w-select" name="currency" value={code} onChange={(e) => setCode(e.target.value)}>
          {Object.entries(CURRENCIES).map(([c, info]) => (
            <option key={c} value={c}>
              {c} — {info.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
