import React, { useEffect, useState } from "react";
import "./fuel-operations.css";
const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");
export async function requestFuel(
  path,
  body,
  key,
  storageKey = "admabs_token",
) {
  const response = await fetch(`${BASE}/fuel/operations${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${localStorage.getItem(storageKey) || ""}`,
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "Idempotency-Key": key || crypto.randomUUID(),
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || result.message || `Request failed (${response.status})`,
    );
  return result;
}
const f = (n, p = 2) =>
  (Number(n || 0) / 10 ** p).toLocaleString("en-GH", {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
  });
const money = (n) => `GH₵ ${f(n)}`;
const ref = (row) => row.number || row.code || row._id;
const options = (rows) =>
  (rows || []).map((x) => [
    x._id,
    x.name || x.registration || x.number || `${x.pumpCode || ""} / ${x.code}`,
  ]);
const tabs = [
  "Fuel Dashboard",
  "Fuel Sales",
  "Meter Readings",
  "Shift Reconciliation",
  "Company Accounts",
  "Vehicles and Drivers",
  "Payments",
  "Statements and Invoices",
  "Tanks and Stock",
  "Reports",
  "Integration Settings",
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
function Table({ columns, rows, empty = "No records yet." }) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="fo-table-wrap">
      <input
        className="fo-search"
        aria-label="Search records"
        placeholder="Search these records…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="fo-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={row._id || i}>
                {columns.map(([key, , render]) => (
                  <td key={key}>
                    {render ? render(row) : String(row[key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="fo-empty">{empty}</p>}
      </div>
    </div>
  );
}
function Form({ title, fields, initial, onClose, onSave, children, preview }) {
  const [values, setValues] = useState(initial || {});
  const [searches, setSearches] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestKey, setKey] = useState(crypto.randomUUID());
  const change = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setKey(crypto.randomUUID());
  };
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(values, requestKey);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form className="fo-form" onSubmit={submit}>
        <header>
          <h3>{title}</h3>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </header>
        {children}
        <div className="fo-fields">
          {fields.map((field) => (
            <label
              key={field.key}
              className={
                field.type === "textarea" || field.type === "photo"
                  ? "fo-wide"
                  : ""
              }
            >
              <span title={field.help}>
                {field.label}
                {field.required !== false && field.type !== "checkbox"
                  ? " *"
                  : ""}
              </span>
              {field.type === "select" && field.options.length > 5 && (
                <input
                  aria-label={`Search ${field.label}`}
                  placeholder={`Search ${field.label.toLowerCase()}…`}
                  value={searches[field.key] || ""}
                  onChange={(e) =>
                    setSearches({ ...searches, [field.key]: e.target.value })
                  }
                />
              )}
              {field.type === "multi" ? (
                <select
                  multiple
                  aria-label={field.label}
                  required={field.required !== false}
                  value={values[field.key] || []}
                  onChange={(e) =>
                    change(
                      field.key,
                      [...e.target.selectedOptions].map((o) => o.value),
                    )
                  }
                >
                  {field.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : field.type === "select" ? (
                <select
                  aria-label={field.label}
                  required={field.required !== false}
                  value={values[field.key] || ""}
                  onChange={(e) => change(field.key, e.target.value)}
                >
                  <option value="">Choose…</option>
                  {field.options
                    .filter(
                      ([value, label]) =>
                        String(value) === String(values[field.key]) ||
                        String(label)
                          .toLowerCase()
                          .includes((searches[field.key] || "").toLowerCase()),
                    )
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              ) : field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={values[field.key] === true}
                  onChange={(e) => change(field.key, e.target.checked)}
                />
              ) : field.type === "textarea" ? (
                <textarea
                  required={field.required !== false}
                  value={values[field.key] || ""}
                  onChange={(e) => change(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              ) : field.type === "photo" ? (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 400000) {
                      setError(
                        "Photo must be under 400 KB. Resize before attaching.",
                      );
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => change(field.key, reader.result);
                    reader.readAsDataURL(file);
                  }}
                />
              ) : (
                <input
                  required={field.required !== false}
                  type={field.type === "date" ? "date" : "text"}
                  inputMode={field.numeric ? "decimal" : undefined}
                  list={field.search ? `fo-${field.key}` : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(e) => change(field.key, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}
              {field.search && (
                <datalist id={`fo-${field.key}`}>
                  {field.search.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </datalist>
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          ))}
        </div>
        {preview && preview(values)}
        {error && (
          <p className="fo-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="fo-primary" disabled={saving}>
            {saving ? "Saving…" : "Save record"}
          </button>
        </footer>
      </form>
    </div>
  );
}
const input = (key, label, extra = {}) => ({ key, label, ...extra });
const choice = (key, label, values, extra = {}) =>
  input(key, label, { type: "select", options: values, ...extra });
const why = input("reason", "Reason / supporting explanation", {
  type: "textarea",
});
const photo = input("photo", "Optional photo evidence", {
  type: "photo",
  required: false,
});
const numeric = (key, label, extra = {}) =>
  input(key, label, { numeric: true, ...extra });
const methods = [
  ["cash", "Cash"],
  ["momo", "MoMo"],
  ["card", "Card"],
  ["bank", "Bank transfer"],
  ["cheque", "Cheque"],
];
export default function FuelOperations({
  user,
  tokenStorageKey = "admabs_token",
}) {
  const fuelRequest = (path, body, key) =>
    requestFuel(path, body, key, tokenStorageKey);
  const [tab, setTab] = useState(tabs[0]);
  const [boot, setBoot] = useState(null);
  const [stationId, setStationId] = useState("");
  const [data, setData] = useState(null);
  const [people, setPeople] = useState({ customers: [], attendants: [] });
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [statement, setStatement] = useState(null);
  const [report, setReport] = useState(null);
  const [connections, setConnections] = useState([]);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    pumpCode: "",
    nozzleCode: "",
    fuelType: "",
    shift: "",
  });
  const can = (permission) =>
    boot?.permissions?.[`fuel.${permission}`] === true;
  const loadBoot = async () => {
    const result = await fuelRequest("/bootstrap");
    setBoot(result);
    setStationId((id) => id || result.stations[0]?._id || "");
  };
  useEffect(() => {
    loadBoot().catch((e) => setError(e.message));
  }, []);
  const refresh = async () => {
    if (!stationId) return;
    setLoading(true);
    setError("");
    try {
      const [result, list] = await Promise.all([
        fuelRequest(`/stations/${stationId}`),
        fuelRequest(`/companies?station=${stationId}`),
      ]);
      setData(result);
      setCompanies(list);
      setPeople(await fuelRequest(`/stations/${stationId}/people`));
      if (companyId)
        setStatement(
          await fuelRequest(
            `/companies/${companyId}/statement?station=${stationId}`,
          ),
        );
      if (can("equipment.configure"))
        setConnections(await fuelRequest(`/stations/${stationId}/connections`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setData(null);
    setStatement(null);
    setCompanyId("");
    refresh();
  }, [stationId]);
  useEffect(() => {
    if (!companyId || !stationId) {
      setStatement(null);
      return;
    }
    fuelRequest(`/companies/${companyId}/statement?station=${stationId}`)
      .then(setStatement)
      .catch((e) => setError(e.message));
  }, [companyId, stationId]);
  const open = (
    title,
    fields,
    path,
    build = (x) => x,
    initial = {},
    description,
    preview,
  ) => setModal({ title, fields, path, build, initial, description, preview });
  const send = async (path, body, key) => {
    const result = await fuelRequest(path, body, key);
    setModal(null);
    setNotice("Record saved.");
    await loadBoot();
    await refresh();
    return result;
  };
  const action = async (path, body) => {
    try {
      await send(path, body);
    } catch (e) {
      setError(e.message);
    }
  };
  const confirmed = (title, path, extra = {}, description) =>
    open(title, [why], path, (x) => ({ ...extra, ...x }), {}, description);
  const companySelect = (
    <label className="fo-company-select">
      Company account
      <input
        aria-label="Search company accounts"
        placeholder="Search company / account code…"
        value={companySearch}
        onChange={(e) => setCompanySearch(e.target.value)}
      />
      <select
        aria-label="Company account"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
      >
        <option value="">Select company…</option>
        {companies
          .filter(
            (c) =>
              c._id === companyId ||
              `${c.name} ${c.accountCode}`
                .toLowerCase()
                .includes(companySearch.toLowerCase()),
          )
          .map((c) => (
            <option key={c._id} value={c._id}>
              {c.accountCode} · {c.name}
            </option>
          ))}
      </select>
    </label>
  );
  const tanks = data?.tanks || [],
    nozzles = data?.nozzles || [],
    periods = data?.periods || [],
    sales = data?.sales || [];
  const active = periods.filter((p) => p.status === "draft" && !p.closedAt);
  const periodFields = [
    choice("period", "Open nozzle period", options(active)),
  ];
  const company = companies.find((c) => c._id === companyId);
  const createStation = () =>
    open(
      "Configure station and review legacy cutover",
      [
        choice(
          "outlet",
          "Existing fuel outlet / branch",
          options(boot?.outlets),
        ),
        input("code", "Unique station code"),
        input("name", "Station name"),
        input("timeZone", "Station timezone", {
          help: "Use Africa/Accra for Ghana and existing ADMABS schedules.",
        }),
        input(
          "confirmLegacyReviewed",
          "Legacy shifts, balances and cutover reviewed",
          { type: "checkbox" },
        ),
        why,
      ],
      "/stations",
    );
  const createCompany = () =>
    open(
      "Create company fuel account",
      [
        input("name", "Company name"),
        input("accountCode", "Unique account code"),
        choice(
          "customer",
          "Existing customer (optional)",
          options(people.customers),
          {
            required: false,
            help: "Links identity only. Existing customer balance is shown separately; it is not migrated automatically.",
          },
        ),
        input("contact", "Contact person", { required: false }),
        input("phone", "Phone", { required: false }),
        input("address", "Address", { required: false }),
        input("billingDetails", "Billing details", { required: false }),
        numeric("termsDays", "Payment terms (days)"),
        numeric("creditLimit", "Credit limit (GH₵)"),
        input("stations", "Permitted stations", {
          type: "multi",
          options: options(boot?.stations),
          help: "Choose every authorised station. On a computer, use Ctrl/Cmd to select multiple.",
        }),
        input("fuelTypes", "Permitted fuel types (comma separated)", {
          help: "Use exactly the fuel type names configured on your tanks.",
        }),
        input("requireVehicle", "Require authorised vehicle", {
          type: "checkbox",
        }),
        input("requireDriver", "Require authorised driver", {
          type: "checkbox",
        }),
        input("requireAuthorisation", "Require voucher / PO", {
          type: "checkbox",
        }),
        input("overdueBlock", "Block overdue credit", { type: "checkbox" }),
        why,
      ],
      "/companies",
      (x) => ({
        ...x,
        stations: x.stations?.length ? x.stations : [stationId],
        fuelTypes: x.fuelTypes
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
      { overdueBlock: true, stations: [stationId] },
    );
  const creditPreview = statement && (
    <div className="fo-exposure">
      <strong>{statement.company.name}</strong>
      <span>Balance Due {money(statement.balanceDueCents)}</span>
      <span>Advance Credit {money(statement.advanceCreditCents)}</span>
      <span>Available credit {money(statement.availableCents)}</span>
      <span>
        Overdue{" "}
        {money(
          Object.entries(statement.ageing)
            .filter(([k]) => k !== "notDue")
            .reduce((n, [, v]) => n + v, 0),
        )}
      </span>
      <small>{statement.scope}</small>
    </div>
  );
  const salePreview = (values) => {
    const p = active.find((p) => p._id === values.period);
    if (!p)
      return (
        <p className="fo-hint">
          Select an open nozzle period to preview its effective price.
        </p>
      );
    const match = /^(\d+)(?:\.(\d{0,3}))?$/.exec(String(values.litres || ""));
    const ml = match
      ? BigInt(match[1]) * 1000n + BigInt((match[2] || "").padEnd(3, "0"))
      : 0n;
    const total = Number((ml * BigInt(p.currentPrice || 0) + 50000n) / 100000n);
    const paid = ["cash", "momo", "card", "prepaid"].reduce(
      (n, k) => n + Math.round(Number(values[k] || 0) * 100),
      0,
    );
    return (
      <div className="fo-exposure">
        <span>Effective price GH₵ {f(p.currentPrice, 4)} / L</span>
        <span>Fuel Purchases {money(total)}</span>
        <span>Remaining company credit {money(Math.max(0, total - paid))}</span>
        <small>
          Server revalidates the effective price, rounding, company limits and
          available advance before posting.
        </small>
      </div>
    );
  };
  const newSale = () =>
    open(
      "Record fuel purchase",
      [
        ...periodFields,
        numeric("litres", "Actual litres", {
          help: "Up to three decimal places. Effective segment price is applied on the server.",
        }),
        choice(
          "vehicle",
          "Authorised vehicle",
          options(statement?.vehicles?.filter((v) => v.active)),
          { required: false },
        ),
        choice(
          "driver",
          "Authorised driver",
          options(statement?.drivers?.filter((v) => v.active)),
          { required: false },
        ),
        input("registration", "Walk-in / registered customer vehicle", {
          required: false,
        }),
        choice("customer", "Registered customer", options(people.customers), {
          required: false,
        }),
        input("driverName", "Other driver name", { required: false }),
        ...["cash", "momo", "card"].map((k) =>
          numeric(k, `${k === "momo" ? "MoMo" : k} paid now (GH₵)`, {
            required: false,
          }),
        ),
        numeric("prepaid", "Use Advance Credit (GH₵)", { required: false }),
        input("authorisation", "Voucher / purchase order reference", {
          required: false,
        }),
        input("sourceRef", "Unique manual transaction reference"),
        input("eventKey", "Unique dispensing event reference", {
          help: "Use the same event reference if this event is later received from a controller/import.",
        }),
        input("acknowledgement", "Driver acknowledgement", { required: false }),
        photo,
        input("reason", "Credit override reason, when required", {
          required: false,
          type: "textarea",
        }),
      ],
      "/sales",
      (x) => ({
        ...x,
        company: companyId || undefined,
        payments: ["cash", "momo", "card"]
          .filter((k) => Number(x[k]) > 0)
          .map((k) => ({ method: k, amount: x[k] })),
        attachment: x.photo,
        unitPrice: (
          (active.find((p) => p._id === x.period)?.currentPrice || 0) / 10000
        ).toFixed(4),
      }),
      {},
      <>
        <p>
          Company: {company?.name || "Walk-in / registered customer"}. Select a
          company on the page first for credit or prepaid purchases. Any amount
          not paid now or prepaid becomes company credit.
        </p>
        {creditPreview}
      </>,
      salePreview,
    );
  const periodColumns = [
    ["number", "Period"],
    ["nozzle", "Pump / nozzle", (r) => `${r.pumpCode} / ${r.nozzleCode}`],
    ["businessDate", "Business date"],
    ["mode", "Mode"],
    [
      "gap",
      "Reading continuity",
      (r) =>
        r.previousClosingAt ? (
          <span
            title={`Last approved reading ${new Date(r.previousClosingAt).toLocaleString()}. Verify there was no unrecorded dispensing.`}
          >
            {Math.floor((r.openingGapMs || 0) / 60000)} min since approved
            reading; opening matches
          </span>
        ) : (
          "Reviewed baseline"
        ),
    ],
    ["status", "Status"],
    ["openingMl", "Opening", (r) => f(r.openingMl, 3)],
    [
      "closingMl",
      "Closing",
      (r) => (r.closingMl == null ? "—" : f(r.closingMl, 3)),
    ],
    [
      "litresVariance",
      "Litres variance",
      (r) => (r.reconciliation ? f(r.reconciliation.litresVarianceMl, 3) : "—"),
    ],
    [
      "moneyVariance",
      "Money variance",
      (r) =>
        r.reconciliation ? money(r.reconciliation.moneyVarianceCents) : "—",
    ],
    [
      "actions",
      "Actions",
      (r) => (
        <div className="fo-row-actions">
          {r.status === "draft" && !r.closedAt && can("readings.enter") && (
            <button
              onClick={() =>
                open(
                  "Close readings and declare actual collections",
                  [
                    numeric("closing", "Closing meter"),
                    ...["cash", "momo", "card"].map((k) =>
                      numeric(k, `${k} current-sale collections (GH₵)`),
                    ),
                    input("rollover", "Supervised meter rollover", {
                      type: "checkbox",
                    }),
                    input("reason", "Rollover / variance reason", {
                      required: false,
                    }),
                    photo,
                  ],
                  `/periods/${r._id}/close`,
                  (x) => ({
                    ...x,
                    collections: { cash: x.cash, momo: x.momo, card: x.card },
                  }),
                )
              }
            >
              Close
            </button>
          )}
          {r.status === "draft" && r.closedAt && can("readings.enter") && (
            <button onClick={() => action(`/periods/${r._id}/submit`, {})}>
              Submit
            </button>
          )}
          {r.status === "submitted" && can("readings.approve") && (
            <button
              onClick={() =>
                confirmed("Approve reconciliation", `/periods/${r._id}/approve`)
              }
            >
              Approve
            </button>
          )}
          {r.status === "approved" && can("periods.post") && (
            <button
              onClick={() =>
                confirmed(
                  "Post reconciliation",
                  `/periods/${r._id}/post`,
                  {},
                  "Posts derived walk-in revenue and only stock not already deducted by individual sales.",
                )
              }
            >
              Post
            </button>
          )}
          {r.closedAt &&
            ["draft", "submitted", "approved"].includes(r.status) &&
            can("readings.approve") && (
              <button
                onClick={() =>
                  confirmed(
                    "Correct closing reading",
                    `/periods/${r._id}/reopen`,
                    {},
                    "The previous closing is retained in the audit trail. Enter corrected readings and submit again.",
                  )
                }
              >
                Correct
              </button>
            )}
          {r.status === "posted" && can("records.reverse") && (
            <button
              onClick={() =>
                confirmed(
                  "Reverse period financial posting",
                  `/periods/${r._id}/reverse`,
                  {},
                  "Retains meter and physical stock history. Individual sales remain posted. This period cannot be posted a second time.",
                )
              }
            >
              Reverse posting
            </button>
          )}
        </div>
      ),
    ],
  ];
  const saleColumns = [
    ["number", "Receipt / invoice"],
    [
      "transactionAt",
      "Transaction time",
      (r) => new Date(r.transactionAt).toLocaleString(),
    ],
    ["nozzle", "Pump / nozzle", (r) => `${r.pumpCode}/${r.nozzleCode}`],
    ["fuelType", "Fuel"],
    ["registration", "Vehicle"],
    ["litresMl", "Litres", (r) => f(r.litresMl, 3)],
    ["priceUnits", "Unit price", (r) => f(r.priceUnits, 4)],
    ["amountCents", "Fuel Purchases", (r) => money(r.amountCents)],
    ["dueCents", "Balance Due", (r) => money(r.dueCents)],
    ["status", "Status"],
    [
      "action",
      "",
      (r) => (
        <div className="fo-row-actions">
          <button onClick={() => print(r)}>Receipt / PDF</button>
          {r.status === "posted" && can("records.reverse") ? (
            <button
              onClick={() =>
                open(
                  "Reverse fuel sale",
                  [
                    input(
                      "entryError",
                      "This was an entry error; correct its bookkeeping stock deduction",
                      { type: "checkbox" },
                    ),
                    why,
                  ],
                  `/sales/${r._id}/reverse`,
                  (x) => x,
                  {},
                  "Financial reversal alone does not return fuel. Select entry error only when the recorded dispensing did not occur. Actual fuel returns require a separate tank return movement. Posted period must be reversed first.",
                )
              }
            >
              Reverse
            </button>
          ) : (
            ""
          )}
        </div>
      ),
    ],
  ];
  const paymentColumns = [
    ["number", "Receipt"],
    ["receivedAt", "Received", (r) => new Date(r.receivedAt).toLocaleString()],
    ["method", "Method"],
    ["reference", "Reference"],
    ["amountCents", "Payments Received", (r) => money(r.amountCents)],
    [
      "unappliedCents",
      "Unapplied / Advance Credit",
      (r) => money(r.unappliedCents),
    ],
    ["status", "Status"],
    [
      "actions",
      "",
      (r) => (
        <div className="fo-row-actions">
          {r.status === "posted" &&
            can("payments.receive") &&
            r.unappliedCents > 0 && (
              <button
                onClick={() =>
                  open(
                    "Allocate existing receipt",
                    [
                      choice("allocationMode", "Allocation method", [
                        ["oldest", "Oldest due first"],
                        ["manual", "Specific invoice"],
                      ]),
                      choice(
                        "invoice",
                        "Invoice / debit adjustment",
                        [
                          ...options(
                            statement?.invoices.filter((i) => i.dueCents > 0),
                          ),
                          ...(statement?.adjustments || [])
                            .filter((a) => a.dueCents > 0)
                            .map((a) => [a._id, `${a.number} (adjustment)`]),
                        ],
                        { required: false },
                      ),
                      numeric("amount", "Allocation amount (GH₵)", {
                        required: false,
                      }),
                      why,
                    ],
                    `/payments/${r._id}/allocate`,
                    (x) => ({
                      ...x,
                      allocations: x.invoice
                        ? [
                            {
                              invoice: x.invoice,
                              amount: x.amount,
                              kind: statement?.adjustments?.some(
                                (a) => a._id === x.invoice,
                              )
                                ? "adjustment"
                                : "sale",
                            },
                          ]
                        : [],
                    }),
                  )
                }
              >
                Allocate
              </button>
            )}
          {r.status === "posted" && can("records.reverse") && (
            <button
              onClick={() =>
                confirmed(
                  "Reverse payment and allocations",
                  `/payments/${r._id}/reverse`,
                )
              }
            >
              Reverse
            </button>
          )}
        </div>
      ),
    ],
  ];
  const exportRows = (name, rows) => {
    const flat = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(
            ([k]) =>
              ![
                "_id",
                "__v",
                "openingEvidence",
                "closingEvidence",
                "attachment",
              ].includes(k),
          )
          .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]),
      ),
    );
    const keys = [...new Set(flat.flatMap(Object.keys))];
    const cell = (v) =>
      `"${String(v ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv =
      "\uFEFF" +
      [keys, ...flat.map((row) => keys.map((k) => row[k]))]
        .map((row) => row.map(cell).join(","))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ADMABS-${name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const print = async (onlySale) => {
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      let y = 18;
      const line = (value, bold = false) => {
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        const lines = pdf.splitTextToSize(
          String(value).replaceAll("GH₵", "GHS"),
          182,
        );
        for (const l of lines) {
          if (y > 280) {
            pdf.addPage();
            y = 18;
          }
          pdf.text(l, 14, y);
          y += 6;
        }
      };
      pdf.setFontSize(14);
      line("ADMABS — Fuel Operations", true);
      pdf.setFontSize(9);
      line(data?.station?.name || "");
      line(`Generated ${new Date().toISOString()}`);
      line(tab, true);
      if (onlySale?._id || tab === "Fuel Sales") {
        for (const inv of onlySale?._id ? [onlySale] : sales) {
          line(`Receipt / Invoice ${inv.number}`, true);
          line(
            `${inv.status} | ${new Date(inv.transactionAt).toISOString()} | business date ${inv.businessDate}`,
          );
          line(
            `Station ${inv.station} | Pump ${inv.pumpCode} / Nozzle ${inv.nozzleCode}`,
          );
          line(
            `Company ${inv.company || "Walk-in"} | customer ${inv.customer || "—"}`,
          );
          line(
            `Vehicle ${inv.registration || "—"} | driver ${inv.driverName || "—"}`,
          );
          line(
            `${inv.fuelType} | ${f(inv.litresMl, 3)} L at GHS ${f(inv.priceUnits, 4)} | ${money(inv.amountCents)}`,
          );
          line(
            `Paid now ${money(inv.paidCents)} | Advance Credit used ${money(inv.prepaidCents)} | Balance Due ${money(inv.dueCents)}`,
          );
          for (const payment of inv.payments || [])
            line(
              `${payment.method}: ${money(payment.amountCents)} ${payment.reference || ""}`,
            );
          line(
            `Attendant ${people.attendants?.find((u) => u._id === inv.attendant)?.name || inv.attendant} | Voucher ${inv.authorisation || "—"}`,
          );
          line(
            `Source ${inv.source}: ${inv.sourceRef} | event ${inv.eventKey}`,
          );
          line(inv.acknowledgement || "");
          line("");
        }
      } else if (
        statement &&
        ["Statements and Invoices", "Payments", "Company Accounts"].includes(
          tab,
        )
      ) {
        line(
          `${statement.company.accountCode} — ${statement.company.name}`,
          true,
        );
        line(statement.scope);
        line(
          `Balance Due ${money(statement.balanceDueCents)} | Advance Credit ${money(statement.advanceCreditCents)}`,
        );
        line(
          `Legacy customer balance (separate): ${statement.legacyCustomerBalance ?? "not linked"}`,
        );
        for (const inv of statement.invoices) {
          line(
            `${inv.number} | ${inv.status} | ${new Date(inv.transactionAt).toISOString()} | station ${inv.station}`,
          );
          line(
            `${inv.registration || "—"} | ${inv.driverName || "—"} | ${inv.fuelType} | ${f(inv.litresMl, 3)} L × GHS ${f(inv.priceUnits, 4)} | ${money(inv.amountCents)} | due ${money(inv.dueCents)}`,
          );
          line(
            `Source ${inv.source}: ${inv.sourceRef}; voucher ${inv.authorisation || "—"}`,
          );
          line(
            `Attendant ${inv.attendant} | business date ${inv.businessDate} | pump ${inv.pumpCode}/${inv.nozzleCode}`,
          );
          line(
            `Paid now ${money(inv.paidCents)} | prepaid ${money(inv.prepaidCents)} | original credit ${money(inv.creditCents)}`,
          );
          for (const payment of inv.payments || [])
            line(
              `${payment.method}: ${money(payment.amountCents)} ${payment.reference || ""}`,
            );
        }
        for (const p of statement.payments) {
          line(
            `${p.number} | ${p.method} | ${p.reference || "—"} | ${money(p.amountCents)} | ${p.status}`,
          );
          line(
            `Received ${new Date(p.receivedAt).toISOString()} by user ${p.receivedBy}`,
          );
          for (const a of p.allocations)
            line(
              `Allocated ${money(a.amountCents)} to ${a.number || a.invoice}${a.reversedAt ? " (reversed)" : ""}`,
            );
        }
        for (const a of statement.adjustments || [])
          line(
            `${a.number} | ${a.kind} | ${money(a.amountCents)} | ${a.reason}`,
          );
      } else {
        for (const p of report?.periods || periods) {
          line(
            `${p.number} | ${p.businessDate} | ${p.pumpCode}/${p.nozzleCode} | ${p.status}`,
            true,
          );
          line(
            `Opening ${f(p.openingMl, 3)} Closing ${p.closingMl == null ? "—" : f(p.closingMl, 3)} Mode ${p.mode}`,
          );
          if (p.reconciliation)
            line(
              `Gross ${f(p.reconciliation.grossMl, 3)} L | sales ${money(p.reconciliation.expectedCents)} | money variance ${money(p.reconciliation.moneyVarianceCents)}`,
            );
        }
      }
      pdf.save(`ADMABS-fuel-${tab.replaceAll(" ", "-")}.pdf`);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="fo">
      <header className="fo-heading">
        <div>
          <p className="fo-eyebrow">ADMABS OPERATIONS</p>
          <h2>Fuel Station Operations</h2>
          <p>Meter accountability, company credit and tank stock</p>
        </div>
        <div className="fo-actions">
          <button onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => print()}>Print / PDF</button>
          {can("equipment.configure") && (
            <button onClick={createStation}>+ Station</button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="fo-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="fo-success">
          {notice}
        </p>
      )}
      {boot && boot.schemaReady === false && (
        <p className="fo-error">
          The additive fuel schema migration must be applied before posting.
        </p>
      )}
      {boot && !boot.transactionsSupported && (
        <p className="fo-error">
          MongoDB transactions are unavailable. Configure a replica set before
          posting fuel records.
        </p>
      )}
      <div className="fo-toolbar">
        <label>
          Station
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">Select station…</option>
            {boot?.stations.map((s) => (
              <option key={s._id} value={s._id}>
                {s.code} · {s.name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <span className="fo-tag">
          Manual operations · Live hardware control disabled
        </span>
      </div>
      <nav className="fo-nav" aria-label="Fuel operations">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
            title={tooltips[t] || t}
          >
            {t}
          </button>
        ))}
      </nav>
      {!stationId && (
        <div className="fo-card">
          <h3>Set up a real station to begin</h3>
          <p>
            An authorised administrator must select an existing fuel outlet,
            review legacy records, configure tanks and nozzles, and establish
            genuine meter and stock openings. No sample transactions are
            created.
          </p>
        </div>
      )}
      {data && (
        <>
          {tab === "Fuel Dashboard" && (
            <>
              <div className="fo-kpis">
                {[
                  [
                    "Calculated tank stock",
                    `${f(
                      tanks.reduce((n, t) => n + t.bookMl, 0),
                      3,
                    )} L`,
                  ],
                  ["Open meter periods", active.length],
                  [
                    "Company Balance Due",
                    money(companies.reduce((n, c) => n + c.debtCents, 0)),
                  ],
                  [
                    "Advance Credit",
                    money(companies.reduce((n, c) => n + c.advanceCents, 0)),
                  ],
                ].map(([label, value]) => (
                  <div className="fo-card" key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <p className="fo-hint">
                Company exposure is the global balance of companies permitted at
                this station. It is not a station revenue total. Recent lists
                are limited; use reports for wider review.
              </p>
              <Table columns={periodColumns} rows={periods.slice(0, 10)} />
            </>
          )}
          {tab === "Fuel Sales" && (
            <>
              <div className="fo-toolbar">
                {companySelect}
                {can("sales.record") && (
                  <button className="fo-primary" onClick={newSale}>
                    + Fuel Purchase
                  </button>
                )}
                <button onClick={() => exportRows("fuel-sales", sales)}>
                  Spreadsheet export
                </button>
              </div>
              {creditPreview}
              <Table columns={saleColumns} rows={sales} />
            </>
          )}
          {tab === "Meter Readings" && (
            <>
              <div className="fo-actions">
                {can("readings.enter") && (
                  <button
                    className="fo-primary"
                    onClick={() =>
                      open(
                        "Open a nozzle meter period",
                        [
                          choice(
                            "nozzle",
                            "Active nozzle",
                            options(nozzles.filter((n) => n.active)),
                          ),
                          choice("mode", "Operating mode", [
                            ["individual", "Individual — record every sale"],
                            ["summary", "Meter summary — derive walk-in sales"],
                          ]),
                          numeric(
                            "opening",
                            "Opening meter (must match approved closing)",
                          ),
                          photo,
                        ],
                        "/periods",
                      )
                    }
                  >
                    + Open period
                  </button>
                )}
                {can("readings.approve") && (
                  <button
                    onClick={() =>
                      open(
                        "Supervised meter event",
                        [
                          choice("nozzle", "Nozzle", options(nozzles)),
                          choice("kind", "Event", [
                            ["baseline", "Initial reviewed baseline"],
                            ["reset", "Meter reset"],
                            ["replacement", "Meter replacement"],
                            ["correction", "Approved baseline correction"],
                          ]),
                          numeric("reading", "Actual new meter reading"),
                          why,
                        ],
                        (x) => `/nozzles/${x.nozzle}/meter-event`,
                      )
                    }
                  >
                    Baseline / reset / replacement
                  </button>
                )}
                {can("readings.approve") && (
                  <button
                    onClick={() =>
                      open(
                        "Supervised attendant handover",
                        [
                          ...periodFields,
                          choice(
                            "attendant",
                            "Next attendant",
                            options(people.attendants),
                          ),
                          numeric("reading", "Handover meter"),
                          why,
                        ],
                        (x) => `/periods/${x.period}/handover`,
                      )
                    }
                  >
                    Handover
                  </button>
                )}
              </div>
              <Table columns={periodColumns} rows={periods} />
              <h3>Nozzle baselines</h3>
              <Table
                rows={nozzles}
                columns={[
                  ["pumpCode", "Pump"],
                  ["code", "Nozzle"],
                  ["fuelType", "Fuel"],
                  [
                    "lastClosingMl",
                    "Approved closing",
                    (n) =>
                      n.lastClosingMl == null
                        ? "Baseline required"
                        : f(n.lastClosingMl, 3),
                  ],
                  ["lastClosingAt", "Reading time"],
                  ["meterPrecision", "Precision"],
                  ["active", "Active", (n) => (n.active ? "Yes" : "No")],
                ]}
              />
            </>
          )}
          {tab === "Shift Reconciliation" && (
            <>
              <div className="fo-actions">
                {can("readings.enter") && (
                  <button
                    onClick={() =>
                      open(
                        "Record non-sale dispensing",
                        [
                          ...periodFields,
                          choice("kind", "Movement", [
                            ["calibration", "Test / calibration"],
                            ["non_sale", "Other approved non-sale dispensing"],
                          ]),
                          numeric("litres", "Actual litres"),
                          input("reference", "Reference"),
                          why,
                        ],
                        (x) => `/periods/${x.period}/non-sale`,
                      )
                    }
                  >
                    + Non-sale dispensing
                  </button>
                )}
              </div>
              <Table columns={periodColumns} rows={periods} />
              {periods
                .filter((p) => p.reconciliation)
                .map((p) => (
                  <div className="fo-card" key={p._id}>
                    <h3>
                      {p.pumpCode}/{p.nozzleCode} · {p.businessDate} ·{" "}
                      {p.status}
                    </h3>
                    <div className="fo-reconcile">
                      {[
                        [
                          "Gross metered",
                          `${f(p.reconciliation.grossMl, 3)} L`,
                        ],
                        [
                          "Approved non-sale",
                          `${f(p.reconciliation.nonSaleMl, 3)} L`,
                        ],
                        [
                          "Credit issues (litres on mixed sales)",
                          `${f(p.reconciliation.creditMl, 3)} L`,
                        ],
                        [
                          "Prepaid issues (litres on mixed sales)",
                          `${f(p.reconciliation.prepaidMl, 3)} L`,
                        ],
                        [
                          "Recorded issues",
                          `${f(p.reconciliation.recordedMl, 3)} L`,
                        ],
                        [
                          "Derived walk-in",
                          `${f(p.reconciliation.derivedMl, 3)} L`,
                        ],
                        [
                          "Expected sales",
                          money(p.reconciliation.expectedCents),
                        ],
                        [
                          "Current-sales cash / MoMo / card",
                          `${money(p.collections?.cash)} / ${money(p.collections?.momo)} / ${money(p.collections?.card)}`,
                        ],
                        [
                          "Money variance",
                          money(p.reconciliation.moneyVarianceCents),
                        ],
                        [
                          "Litres variance",
                          `${f(p.reconciliation.litresVarianceMl, 3)} L`,
                        ],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <small>{k}</small>
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>
                    {p.reconciliation.flags.length > 0 && (
                      <p className="fo-error">
                        {p.reconciliation.flags.join(" · ")}
                      </p>
                    )}
                    <p className="fo-hint">
                      Older debt collections are recorded in Payments and
                      excluded from these current-sale declarations. Mixed
                      credit/prepaid litre categories can overlap.
                    </p>
                    <details>
                      <summary>Price and meter segments</summary>
                      {p.segments.map((seg, i) => (
                        <p key={i}>
                          {f(seg.openingMl, 3)} → {f(seg.closingMl, 3)} ·{" "}
                          {f(seg.grossMl, 3)} L at GH₵ {f(seg.priceUnits, 4)}
                          {seg.rollover ? " · supervised rollover" : ""}
                        </p>
                      ))}
                    </details>
                  </div>
                ))}
              <h3>Non-sale approvals</h3>
              <Table
                rows={(data.movements || []).filter((m) =>
                  ["calibration", "non_sale"].includes(m.kind),
                )}
                columns={[
                  ["kind", "Movement"],
                  ["period", "Period"],
                  ["litresMl", "Litres", (m) => f(m.litresMl, 3)],
                  ["reason", "Reason"],
                  ["status", "Status"],
                  [
                    "approve",
                    "",
                    (m) =>
                      m.status === "pending" && can("readings.approve") ? (
                        <button
                          onClick={() =>
                            confirmed(
                              "Approve non-sale dispensing",
                              `/movements/${m._id}/approve`,
                            )
                          }
                        >
                          Approve
                        </button>
                      ) : (
                        ""
                      ),
                  ],
                ]}
              />
            </>
          )}
          {tab === "Company Accounts" && (
            <>
              <div className="fo-toolbar">
                {companySelect}
                {can("accounts.adjust") && (
                  <button className="fo-primary" onClick={createCompany}>
                    + Company account
                  </button>
                )}
                {companyId && can("accounts.adjust") && (
                  <>
                    <button
                      onClick={() =>
                        open(
                          "Change company policy",
                          [
                            numeric("creditLimit", "Credit limit (GH₵)"),
                            numeric("termsDays", "Payment terms (days)"),
                            input("stations", "Permitted stations", {
                              type: "multi",
                              options: options(boot?.stations),
                            }),
                            input(
                              "fuelTypes",
                              "Permitted fuel types (comma separated)",
                            ),
                            input(
                              "requireVehicle",
                              "Require authorised vehicle",
                              { type: "checkbox" },
                            ),
                            input(
                              "requireDriver",
                              "Require authorised driver",
                              { type: "checkbox" },
                            ),
                            input(
                              "requireAuthorisation",
                              "Require voucher / PO",
                              { type: "checkbox" },
                            ),
                            choice("status", "Status", [
                              ["active", "Active"],
                              ["suspended", "Suspended"],
                              ["closed", "Closed"],
                            ]),
                            input("overdueBlock", "Block overdue purchases", {
                              type: "checkbox",
                            }),
                            why,
                          ],
                          `/companies/${companyId}/configure`,
                          (x) => ({
                            ...x,
                            fuelTypes: x.fuelTypes
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean),
                            station: stationId,
                          }),
                          {
                            termsDays: company.termsDays,
                            stations: company.stations,
                            fuelTypes: company.fuelTypes.join(", "),
                            requireVehicle: company.requireVehicle,
                            requireDriver: company.requireDriver,
                            requireAuthorisation: company.requireAuthorisation,
                            creditLimit: (company.limitCents / 100).toFixed(2),
                            status: company.status,
                            overdueBlock: company.overdueBlock,
                          },
                        )
                      }
                    >
                      Account policy
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Reviewed account adjustment",
                          [
                            choice("kind", "Adjustment", [
                              ["opening_debt", "Reviewed opening debt"],
                              ["debit", "Debit adjustment"],
                              ["credit_note", "Credit note against invoice"],
                            ]),
                            numeric("amount", "Amount (GH₵)"),
                            input("dueAt", "Due date", { type: "date" }),
                            choice(
                              "invoice",
                              "Outstanding invoice",
                              options(
                                statement?.invoices.filter(
                                  (i) => i.dueCents > 0,
                                ),
                              ),
                              { required: false },
                            ),
                            input("reference", "Supporting reference"),
                            input(
                              "confirmReviewed",
                              "Opening debt reviewed against source records",
                              { type: "checkbox" },
                            ),
                            why,
                          ],
                          `/companies/${companyId}/adjustments`,
                          (x) => ({ ...x, station: stationId }),
                        )
                      }
                    >
                      Adjustment / opening debt
                    </button>
                  </>
                )}
              </div>
              {creditPreview}
              <Table
                rows={companies}
                columns={[
                  ["accountCode", "Account"],
                  ["name", "Company"],
                  ["status", "Status"],
                  ["debtCents", "Balance Due", (c) => money(c.debtCents)],
                  [
                    "advanceCents",
                    "Advance Credit",
                    (c) => money(c.advanceCents),
                  ],
                  ["limitCents", "Credit limit", (c) => money(c.limitCents)],
                  [
                    "availableCents",
                    "Available",
                    (c) => money(c.availableCents),
                  ],
                ]}
              />
            </>
          )}
          {tab === "Vehicles and Drivers" && (
            <>
              {companySelect}
              {creditPreview}
              {companyId && can("accounts.adjust") && (
                <div className="fo-actions">
                  <button
                    onClick={() =>
                      open(
                        "Authorise vehicle",
                        [
                          input("registration", "Vehicle registration"),
                          numeric("dailyLitres", "Daily litres limit", {
                            required: false,
                          }),
                          numeric("dailySpend", "Daily spending limit (GH₵)", {
                            required: false,
                          }),
                        ],
                        `/companies/${companyId}/vehicles`,
                        (x) => ({ ...x, station: stationId }),
                      )
                    }
                  >
                    + Vehicle
                  </button>
                  <button
                    onClick={() =>
                      open(
                        "Authorise driver",
                        [
                          input("name", "Driver name"),
                          input("phone", "Phone", { required: false }),
                        ],
                        `/companies/${companyId}/drivers`,
                        (x) => ({ ...x, station: stationId }),
                      )
                    }
                  >
                    + Driver
                  </button>
                </div>
              )}
              <Table
                rows={statement?.vehicles || []}
                columns={[
                  ["registration", "Registration"],
                  [
                    "dailyMl",
                    "Daily litres limit",
                    (v) => (v.dailyMl ? f(v.dailyMl, 3) : "—"),
                  ],
                  [
                    "dailyCents",
                    "Daily spending limit",
                    (v) => (v.dailyCents ? money(v.dailyCents) : "—"),
                  ],
                  ["active", "Active", (v) => (v.active ? "Yes" : "No")],
                  [
                    "policy",
                    "",
                    (v) =>
                      can("accounts.adjust") ? (
                        <button
                          onClick={() =>
                            open(
                              "Vehicle policy",
                              [
                                choice("active", "Status", [
                                  ["true", "Active"],
                                  ["false", "Inactive"],
                                ]),
                                numeric("dailyLitres", "Daily litres limit", {
                                  required: false,
                                }),
                                numeric(
                                  "dailySpend",
                                  "Daily spending limit (GH₵)",
                                  { required: false },
                                ),
                                why,
                              ],
                              `/companies/${companyId}/vehicle-policy`,
                              (x) => ({
                                ...x,
                                vehicle: v._id,
                                station: stationId,
                                active: x.active === "true",
                              }),
                              {
                                active: String(v.active),
                                dailyLitres: v.dailyMl
                                  ? (v.dailyMl / 1000).toFixed(3)
                                  : "",
                                dailySpend: v.dailyCents
                                  ? (v.dailyCents / 100).toFixed(2)
                                  : "",
                              },
                            )
                          }
                        >
                          Policy
                        </button>
                      ) : (
                        ""
                      ),
                  ],
                ]}
              />
              <Table
                rows={statement?.drivers || []}
                columns={[
                  ["name", "Driver"],
                  ["phone", "Phone"],
                  ["active", "Active", (v) => (v.active ? "Yes" : "No")],
                  [
                    "policy",
                    "",
                    (v) =>
                      can("accounts.adjust") ? (
                        <button
                          onClick={() =>
                            confirmed(
                              v.active ? "Suspend driver" : "Activate driver",
                              `/companies/${companyId}/driver-policy`,
                              {
                                station: stationId,
                                driver: v._id,
                                active: !v.active,
                              },
                            )
                          }
                        >
                          {v.active ? "Suspend" : "Activate"}
                        </button>
                      ) : (
                        ""
                      ),
                  ],
                ]}
              />
            </>
          )}
          {tab === "Payments" && (
            <>
              <div className="fo-toolbar">
                {companySelect}
                {companyId && can("payments.receive") && (
                  <button
                    className="fo-primary"
                    onClick={() =>
                      open(
                        "Receive company payment",
                        [
                          numeric("amount", "Amount received (GH₵)"),
                          choice("method", "Payment method", methods),
                          input(
                            "reference",
                            "Bank / MoMo / payment reference",
                            { required: false },
                          ),
                          choice("allocationMode", "Allocate payment", [
                            ["oldest", "Oldest due first"],
                            ["on_account", "Hold as advance / on-account"],
                            ["manual", "Specific invoice"],
                          ]),
                          choice(
                            "invoice",
                            "Invoice / debit adjustment",
                            [
                              ...options(
                                statement?.invoices.filter(
                                  (i) => i.dueCents > 0,
                                ),
                              ),
                              ...(statement?.adjustments || [])
                                .filter((a) => a.dueCents > 0)
                                .map((a) => [a._id, a.number]),
                            ],
                            { required: false },
                          ),
                          numeric(
                            "allocatedAmount",
                            "Amount to allocate (GH₵)",
                            { required: false },
                          ),
                        ],
                        `/companies/${companyId}/payments`,
                        (x) => ({
                          ...x,
                          station: stationId,
                          allocations: x.invoice
                            ? [
                                {
                                  invoice: x.invoice,
                                  amount: x.allocatedAmount,
                                  kind: statement?.adjustments?.some(
                                    (a) => a._id === x.invoice,
                                  )
                                    ? "adjustment"
                                    : "sale",
                                },
                              ]
                            : [],
                        }),
                      )
                    }
                  >
                    + Payments Received
                  </button>
                )}
              </div>
              {creditPreview}
              <p className="fo-hint">
                Debt collections do not create fuel revenue. Unallocated
                receipts remain Advance Credit. Receiving time is recorded by
                the server.
              </p>
              <Table
                rows={statement?.payments || data.payments || []}
                columns={paymentColumns}
              />
              {statement?.payments.map((p) => (
                <details className="fo-card" key={p._id}>
                  <summary>{p.number} allocation history</summary>
                  {p.allocations.map((a, i) => (
                    <p key={i}>
                      {a.kind} · {a.number || a.invoice} ·{" "}
                      {money(a.amountCents)} ·{" "}
                      {a.reversedAt ? "Reversed" : "Applied"} ·{" "}
                      {new Date(a.at).toLocaleString()}
                    </p>
                  ))}
                </details>
              ))}
            </>
          )}
          {tab === "Statements and Invoices" && (
            <>
              {companySelect}
              {creditPreview}
              {statement && (
                <>
                  <p className="fo-hint">
                    Existing customer balance:{" "}
                    {statement.legacyCustomerBalance == null
                      ? "Not linked"
                      : money(
                          Math.round(statement.legacyCustomerBalance * 100),
                        )}{" "}
                    (separate from fuel ledger; never added automatically).
                  </p>
                  <div className="fo-kpis">
                    {Object.entries(statement.ageing).map(([k, v]) => (
                      <div className="fo-card" key={k}>
                        <small>
                          {
                            {
                              notDue: "Not due",
                              days1to30: "1–30 days",
                              days31to60: "31–60 days",
                              days61to90: "61–90 days",
                              over90: "Over 90 days",
                            }[k]
                          }
                        </small>
                        <strong>{money(v)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="fo-actions">
                    <button
                      onClick={() =>
                        exportRows("company-invoices", statement.invoices)
                      }
                    >
                      Invoices spreadsheet
                    </button>
                    <button
                      onClick={() =>
                        exportRows("company-ledger", statement.entries)
                      }
                    >
                      Ledger spreadsheet
                    </button>
                  </div>
                  <Table rows={statement.invoices} columns={saleColumns} />
                  <h3>Traceable fuel ledger</h3>
                  <Table
                    rows={statement.entries}
                    columns={[
                      ["at", "Date", (r) => new Date(r.at).toLocaleString()],
                      ["type", "Entry"],
                      ["reference", "Reference"],
                      ["debitCents", "Debit", (r) => money(r.debitCents)],
                      ["creditCents", "Credit", (r) => money(r.creditCents)],
                      [
                        "advanceDeltaCents",
                        "Advance change",
                        (r) => money(r.advanceDeltaCents),
                      ],
                      ["reason", "Reason"],
                    ]}
                  />
                </>
              )}
            </>
          )}
          {tab === "Tanks and Stock" && (
            <>
              <div className="fo-actions">
                {can("equipment.configure") && (
                  <>
                    <button
                      onClick={() =>
                        open(
                          "Add fuel tank",
                          [
                            input("code", "Tank code"),
                            input("name", "Tank name"),
                            input("fuelType", "Fuel type"),
                            numeric("capacity", "Tank capacity (litres)"),
                          ],
                          `/stations/${stationId}/tanks`,
                        )
                      }
                    >
                      + Tank
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Configure tank",
                          [
                            choice("tank", "Tank", options(tanks)),
                            choice("active", "Status", [
                              ["true", "Active"],
                              ["false", "Inactive"],
                            ]),
                            numeric("capacity", "Capacity (litres)"),
                            why,
                          ],
                          (x) => `/tanks/${x.tank}/configure`,
                          (x) => ({ ...x, active: x.active === "true" }),
                        )
                      }
                    >
                      Tank settings
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Configure pump / nozzle",
                          [
                            input("pumpCode", "Pump code"),
                            input("code", "Nozzle code"),
                            choice(
                              "tank",
                              "Linked tank and fuel type",
                              options(tanks),
                            ),
                            choice("meterPrecision", "Meter decimal places", [
                              [0, "0"],
                              [1, "1"],
                              [2, "2"],
                              [3, "3"],
                            ]),
                            numeric("rollover", "Rollover modulus (litres)", {
                              required: false,
                              help: "The value at which the display wraps to zero, not its highest displayed value.",
                            }),
                          ],
                          `/stations/${stationId}/nozzles`,
                        )
                      }
                    >
                      + Pump / nozzle
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Change nozzle mapping / status",
                          [
                            choice("nozzle", "Nozzle", options(nozzles)),
                            choice("tank", "Tank", options(tanks)),
                            choice("active", "Status", [
                              ["true", "Active"],
                              ["false", "Inactive"],
                            ]),
                            why,
                          ],
                          (x) => `/nozzles/${x.nozzle}/configure`,
                          (x) => ({ ...x, active: x.active === "true" }),
                        )
                      }
                    >
                      Nozzle settings
                    </button>
                  </>
                )}
                {can("stock.manage") && (
                  <button
                    onClick={() =>
                      open(
                        "Post reviewed tank stock movement",
                        [
                          choice("tank", "Tank", options(tanks)),
                          choice("kind", "Movement", [
                            ["opening", "Reviewed opening stock"],
                            ["delivery", "Delivery"],
                            ["transfer", "Transfer to another tank"],
                            ["return", "Return approved non-sale dispensing"],
                            ["adjustment", "Approved stock adjustment"],
                          ]),
                          numeric("litres", "Actual litres"),
                          choice(
                            "targetTank",
                            "Transfer destination tank",
                            options(tanks),
                            { required: false },
                          ),
                          choice(
                            "linkedMovement",
                            "Approved non-sale movement to return",
                            (data.movements || [])
                              .filter((m) => m.status === "approved")
                              .map((m) => [
                                m._id,
                                `${m.kind} ${f(m.litresMl, 3)} L`,
                              ]),
                            { required: false },
                          ),
                          choice(
                            "linkedSale",
                            "Fuel sale being returned",
                            options(sales),
                            { required: false },
                          ),
                          choice(
                            "direction",
                            "Adjustment direction",
                            [
                              ["in", "Increase"],
                              ["out", "Decrease"],
                            ],
                            { required: false },
                          ),
                          input("reference", "Delivery / supporting reference"),
                          input(
                            "confirmReviewed",
                            "Opening stock reviewed against genuine source records",
                            { type: "checkbox" },
                          ),
                          why,
                        ],
                        `/stations/${stationId}/stock`,
                      )
                    }
                  >
                    + Stock movement
                  </button>
                )}
                {can("readings.enter") && (
                  <button
                    onClick={() =>
                      open(
                        "Record physical tank dip",
                        [
                          choice("tank", "Tank", options(tanks)),
                          numeric("litres", "Physical dip litres"),
                          photo,
                        ],
                        `/stations/${stationId}/dips`,
                      )
                    }
                  >
                    + Physical dip
                  </button>
                )}
              </div>
              <Table
                rows={tanks}
                columns={[
                  ["code", "Tank"],
                  ["fuelType", "Fuel"],
                  ["capacityMl", "Capacity L", (t) => f(t.capacityMl, 3)],
                  [
                    "bookMl",
                    "Calculated stock L",
                    (t) =>
                      t.openingEstablished
                        ? f(t.bookMl, 3)
                        : "Reviewed opening required",
                  ],
                ]}
              />
              <h3>Physical dip versus calculated stock</h3>
              <Table
                rows={data.dips}
                columns={[
                  ["at", "Measured"],
                  ["tank", "Tank"],
                  ["physicalMl", "Physical L", (d) => f(d.physicalMl, 3)],
                  ["calculatedMl", "Calculated L", (d) => f(d.calculatedMl, 3)],
                  ["varianceMl", "Variance L", (d) => f(d.varianceMl, 3)],
                ]}
              />
              <h3>Stock and dispensing movements</h3>
              <Table
                rows={data.movements}
                columns={[
                  ["at", "Time"],
                  ["kind", "Movement"],
                  ["tank", "Tank"],
                  ["litresMl", "Litres", (m) => f(m.litresMl, 3)],
                  [
                    "stockDeltaMl",
                    "Book stock change L",
                    (m) => f(m.stockDeltaMl, 3),
                  ],
                  ["status", "Status"],
                  ["reason", "Reason"],
                  ["reference", "Reference"],
                ]}
              />
            </>
          )}
          {tab === "Reports" && (
            <>
              <div className="fo-toolbar">
                {Object.entries(filters).map(([k, v]) => (
                  <label key={k}>
                    {k}
                    <input
                      type={["start", "end"].includes(k) ? "date" : "text"}
                      value={v}
                      onChange={(e) =>
                        setFilters({ ...filters, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <button
                  className="fo-primary"
                  onClick={async () => {
                    try {
                      setReport(
                        await fuelRequest(
                          `/reports?${new URLSearchParams({ station: stationId, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })}`,
                        ),
                      );
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Run report
                </button>
              </div>
              {report && (
                <>
                  <p className="fo-hint">
                    {report.warning} Export units: pesewas, millilitres and
                    price units of 1/10,000 GHS; columns retain explicit unit
                    names.
                  </p>
                  <div className="fo-actions">
                    {[
                      "salesByNozzleShift",
                      "companyVehicleConsumption",
                      "exposure",
                      "periods",
                      "sales",
                      "payments",
                      "movements",
                      "dips",
                      "audits",
                    ].map((k) => (
                      <button key={k} onClick={() => exportRows(k, report[k])}>
                        Export {k}
                      </button>
                    ))}
                  </div>
                  <Table rows={report.periods} columns={periodColumns} />
                  <h3>Sales and litres by nozzle and shift</h3>
                  <Table
                    rows={report.salesByNozzleShift || []}
                    columns={[
                      ["businessDate", "Business date"],
                      ["pumpCode", "Pump"],
                      ["nozzleCode", "Nozzle"],
                      ["fuelType", "Fuel"],
                      ["workShift", "Shift"],
                      ["litresMl", "Litres", (r) => f(r.litresMl, 3)],
                      [
                        "amountCents",
                        "Sales value",
                        (r) => money(r.amountCents),
                      ],
                    ]}
                  />
                  <h3>Company and vehicle consumption</h3>
                  <Table
                    rows={report.companyVehicleConsumption || []}
                    columns={[
                      ["company", "Company"],
                      ["registration", "Vehicle"],
                      ["fuelType", "Fuel"],
                      ["litresMl", "Litres", (r) => f(r.litresMl, 3)],
                      ["amountCents", "Purchases", (r) => money(r.amountCents)],
                    ]}
                  />
                  <h3>Consumption and invoices</h3>
                  <Table rows={report.sales} columns={saleColumns} />
                  <h3>Credit exposure and ageing</h3>
                  <Table
                    rows={report.exposure || []}
                    columns={[
                      ["accountCode", "Account"],
                      ["name", "Company"],
                      ["debtCents", "Balance Due", (r) => money(r.debtCents)],
                      [
                        "advanceCents",
                        "Advance Credit",
                        (r) => money(r.advanceCents),
                      ],
                      ...Object.entries({
                        notDue: "Not due",
                        days1to30: "1–30 overdue",
                        days31to60: "31–60 overdue",
                        days61to90: "61–90 overdue",
                        over90: "Over 90 overdue",
                      }).map(([k, l]) => [k, l, (r) => money(r.ageing?.[k])]),
                    ]}
                  />
                  <h3>Payments and allocations</h3>
                  <Table
                    rows={report.payments || []}
                    columns={paymentColumns}
                  />
                  <h3>Overrides, reversals and adjustments</h3>
                  <Table
                    rows={report.audits.filter((a) =>
                      /override|revers|adjust|correction/.test(a.action),
                    )}
                    columns={[
                      ["at", "Time"],
                      ["entity", "Entity"],
                      ["action", "Action"],
                      ["user", "User"],
                      ["reason", "Reason"],
                    ]}
                  />
                </>
              )}
            </>
          )}
          {tab === "Integration Settings" && (
            <>
              <div className="fo-card">
                <h3>Manual operations available now</h3>
                <p>
                  Dispenser manufacturer, model, controller and API must be
                  verified before live integration. Connections are created
                  disabled. No remote start/stop or dispenser protocol is
                  implemented.
                </p>
              </div>
              {can("equipment.configure") && (
                <>
                  <div className="fo-actions">
                    <button
                      onClick={() =>
                        open(
                          "Set effective fuel price",
                          [
                            input("fuelType", "Fuel type"),
                            numeric("price", "New price (GH₵ / litre)"),
                            ...active.map((p) =>
                              numeric(
                                `boundary_${p._id}`,
                                `Boundary meter for ${p.pumpCode}/${p.nozzleCode}`,
                                {
                                  required: false,
                                  help: "Required for active periods of the affected fuel type.",
                                },
                              ),
                            ),
                            why,
                          ],
                          `/stations/${stationId}/prices`,
                          (x) => ({
                            ...x,
                            boundaries: active.map((p) => ({
                              period: p._id,
                              reading: x[`boundary_${p._id}`],
                            })),
                          }),
                        )
                      }
                    >
                      Effective price / boundary readings
                    </button>
                    <button
                      onClick={() =>
                        open(
                          "Prepare disabled controller connection",
                          [input("code", "Unique controller code")],
                          `/stations/${stationId}/connections`,
                        )
                      }
                    >
                      + Disabled connection
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      confirmed(
                        data.station.active
                          ? "Deactivate station"
                          : "Reactivate station",
                        `/stations/${stationId}/configure`,
                        { active: !data.station.active },
                      )
                    }
                  >
                    {data.station.active
                      ? "Deactivate station"
                      : "Reactivate station"}
                  </button>
                  <h3>Immutable effective price history</h3>
                  <Table
                    rows={data.prices}
                    columns={[
                      ["fuelType", "Fuel"],
                      ["priceUnits", "GH₵ / litre", (p) => f(p.priceUnits, 4)],
                      [
                        "effectiveAt",
                        "Effective from",
                        (p) => new Date(p.effectiveAt).toLocaleString(),
                      ],
                    ]}
                  />
                  <h3>Controller monitoring</h3>
                  <Table
                    rows={connections}
                    columns={[
                      ["code", "Connection"],
                      [
                        "enabled",
                        "Enabled",
                        (c) => (c.enabled ? "Yes" : "Disabled"),
                      ],
                      ["verifiedModel", "Equipment verification"],
                      ["lastSeenAt", "Last seen"],
                      ["lastError", "Last error"],
                    ]}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
      {modal && (
        <Form
          title={modal.title}
          fields={modal.fields}
          initial={modal.initial}
          preview={modal.preview}
          onClose={() => setModal(null)}
          onSave={async (values, key) => {
            const result = await send(
              typeof modal.path === "function"
                ? modal.path(values)
                : modal.path,
              modal.build(values),
              key,
            );
            if (result.secret)
              setNotice(
                `Connection created disabled. Store this secret securely now; it is shown only once: ${result.secret}`,
              );
          }}
        >
          {modal.description && (
            <div className="fo-hint">{modal.description}</div>
          )}
        </Form>
      )}
    </section>
  );
}
