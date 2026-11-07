import React, { useId } from "react";
import "./fuel-menu.css";

export const FUEL_SECTIONS = [
  "Fuel Dashboard", "Fuel Sales", "Meter Readings", "Shift Reconciliation",
  "Company Accounts", "Vehicles and Drivers", "Payments", "Statements and Invoices",
  "Inter-station Fuel", "Tanks and Stock", "Reports", "Integration Settings",
];

const tooltips = {
  "Fuel Sales":
    "Individual mode records every sale. Summary mode records company issues and derives walk-in totals.",
  "Meter Readings":
    "Opening must equal the last approved closing. Supervisor meter events handle resets and replacements.",
  "Shift Reconciliation":
    "Record actual current-sale collections. Earlier debt receipts appear separately.",
  "Company Accounts":
    "Fuel debt and advance credit are separate. Existing customer balances remain unchanged.",
  "Tanks and Stock":
    "Physical dips never overwrite calculated stock. All changes require linked stock movements.",
};

export default function FuelMenu({ expanded, onToggle, section, onSelect, active = false, dark = false, compact = false, icon = "⛽" }) {
  const id = useId();
  return <div className={`fuel-menu${dark ? " fuel-menu-dark" : ""}`}>
    <button type="button" className={`fuel-menu-toggle${active ? " is-active" : ""}${compact ? " is-compact" : ""}`}
      aria-label="Fuel Station" aria-expanded={expanded} aria-controls={id} onClick={onToggle} title="Fuel Station">
      <span aria-hidden="true">{icon}</span>{!compact && <><span>Fuel Station</span><span className="fuel-menu-chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span></>}
    </button>
    <ul id={id} hidden={!expanded || compact} aria-label="Fuel Station sections" className="fuel-menu-list">
      {FUEL_SECTIONS.map(label => <li key={label}><button type="button" aria-current={active && section === label ? "page" : undefined}
        title={tooltips[label] || label} onClick={() => onSelect(label)}>{label}</button></li>)}
    </ul>
  </div>;
}
