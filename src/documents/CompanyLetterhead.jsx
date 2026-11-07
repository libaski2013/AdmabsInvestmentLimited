import React from "react";
import { companyBrand } from "./branding.js";
import "./documents.css";
export default function CompanyLetterhead({ site, title, compact = false }) {
  const brand = companyBrand(site);
  return <header data-company-letterhead className={`company-letterhead${compact ? " compact" : ""}`}>
    <img src={brand.logoUrl} alt="ADMABS" onError={e => { if (!e.currentTarget.src.endsWith("/admabs-app-icon.png")) e.currentTarget.src = "/admabs-app-icon.png"; }} />
    <strong>{brand.companyName}</strong><p>HEAD OFFICE: {brand.address}</p>
    {(brand.phone || brand.email) && <p>{[brand.phone, brand.email].filter(Boolean).join(" | ")}</p>}
    {title && <h2>{title}</h2>}
  </header>;
}
