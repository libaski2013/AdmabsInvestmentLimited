// Stored quantities are integer millilitres, prices 1/10,000 GHS, money pesewas.
// Multiplication uses BigInt; half-up rounding happens once per sale/segment.
export class FuelError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
export const fail = (condition, message, status = 400) => {
  if (!condition) throw new FuelError(message, status);
};
export function decimal(
  value,
  places = 2,
  { positive = false, signed = false } = {},
) {
  const text = String(value ?? "");
  fail(
    new RegExp(`^${signed ? "-?" : ""}\\d{1,10}(?:\\.\\d{1,${places}})?$`).test(
      text,
    ),
    `Enter a decimal with at most ${places} decimal places`,
  );
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const result =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0"));
  fail(result <= 9000000000000n, "Value exceeds supported precision");
  fail(!positive || result > 0n, "Value must be greater than zero");
  return Number(negative ? -result : result);
}
export function safe(value) {
  fail(
    Number.isSafeInteger(value) && Math.abs(value) <= 9000000000000,
    "Integer amount exceeds supported precision",
  );
  return value;
}
export const add = (...values) => safe(values.reduce((a, b) => a + b, 0));
export function valueOf(litresMl, priceUnits) {
  return safe(
    Number((BigInt(litresMl) * BigInt(priceUnits) + 50000n) / 100000n),
  );
}
export const display = (value, places = 2) => {
  const n = BigInt(value || 0);
  return `${n < 0 ? "-" : ""}${(n < 0 ? -n : n) / 10n ** BigInt(places)}.${String((n < 0 ? -n : n) % 10n ** BigInt(places)).padStart(places, "0")}`;
};
export function meterMovement(opening, closing, rollover, approved = false) {
  fail(opening >= 0 && closing >= 0, "Meters must be non-negative");
  if (closing >= opening) {
    fail(!approved, "Rollover is only valid when the meter wraps");
    return closing - opening;
  }
  fail(
    approved && rollover > opening && closing < rollover,
    "Closing below opening requires a configured, supervised rollover",
  );
  return add(rollover - opening, closing);
}
export function businessClock(now, timeZone, schedule) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (k) => parts.find((p) => p.type === k).value;
  const minutes = +part("hour") * 60 + +part("minute");
  let date = `${part("year")}-${part("month")}-${part("day")}`;
  const end = schedule
    ? +schedule.endTime.slice(0, 2) * 60 + +schedule.endTime.slice(3)
    : 360;
  const start = schedule
    ? +schedule.startTime.slice(0, 2) * 60 + +schedule.startTime.slice(3)
    : 1080;
  // Existing ADMABS uses day 06:00–18:00/night 18:00–06:00. Anchor overnight work to its starting date.
  if (end <= start && minutes < end)
    date = new Date(Date.parse(`${date}T12:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    businessDate: date,
    workShift:
      schedule?.workShift ||
      (minutes >= 1080 || minutes < 360 ? "night" : "day"),
  };
}
export function reconcile(period, sales, movements) {
  const sum = (rows, key) => add(...rows.map((r) => r[key] || 0));
  const grossMl = sum(period.segments, "grossMl");
  const nonSaleMl = sum(
    movements.filter((m) => m.status === "approved"),
    "litresMl",
  );
  const recordedMl = sum(sales, "litresMl");
  const recordedValue = sum(sales, "amountCents");
  const creditMl = sum(
    sales.filter((s) => s.creditCents > 0),
    "litresMl",
  );
  const prepaidMl = sum(
    sales.filter((s) => s.prepaidCents > 0),
    "litresMl",
  );
  const expectedMeterValue = sum(period.segments, "saleValueCents");
  const derivedMl =
    period.mode === "summary" ? grossMl - nonSaleMl - recordedMl : 0;
  const derivedValueCents =
    period.mode === "summary" ? expectedMeterValue - recordedValue : 0;
  const expectedCents =
    period.mode === "summary" ? expectedMeterValue : recordedValue;
  const paidCents = sum(sales, "paidCents");
  const collectionsCents = add(...Object.values(period.collections || {}));
  const flags = [];
  if (!period.closedAt) flags.push("Missing closing readings");
  if (movements.some((m) => m.status !== "approved"))
    flags.push("Unapproved non-sale dispensing");
  const litresVarianceMl =
    period.mode === "individual"
      ? grossMl - nonSaleMl - recordedMl
      : Math.min(0, derivedMl);
  if (litresVarianceMl) flags.push("Unexplained metered litres");
  if (derivedValueCents < 0) flags.push("Tracked sales exceed meter value");
  const moneyVarianceCents =
    period.mode === "summary"
      ? collectionsCents - (paidCents + derivedValueCents)
      : collectionsCents - paidCents;
  if (moneyVarianceCents) flags.push("Collection variance");
  return {
    grossMl,
    nonSaleMl,
    recordedMl,
    creditMl,
    prepaidMl,
    derivedMl,
    recordedValue,
    derivedValueCents,
    expectedCents,
    paidCents,
    collectionsCents,
    litresVarianceMl,
    moneyVarianceCents,
    flags,
  };
}
export function ageing(invoices, now = new Date()) {
  const buckets = {
    notDue: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };
  for (const inv of invoices) {
    const days = Math.ceil((now - new Date(inv.dueAt)) / 86400000);
    const key =
      days <= 0
        ? "notDue"
        : days <= 30
          ? "days1to30"
          : days <= 60
            ? "days31to60"
            : days <= 90
              ? "days61to90"
              : "over90";
    buckets[key] = add(buckets[key], inv.dueCents);
  }
  return buckets;
}
export const FUEL_PERMISSIONS = [
  "fuel.view",
  "fuel.sales.record",
  "fuel.readings.enter",
  "fuel.readings.approve",
  "fuel.payments.receive",
  "fuel.credit.override",
  "fuel.accounts.adjust",
  "fuel.reports.company",
  "fuel.equipment.configure",
  "fuel.periods.post",
  "fuel.records.reverse",
  "fuel.stock.manage",
];
const managers = ["ceo", "gm", "branch", "sub_manager"];
export function permitted(user, permission) {
  if (user.role === "super_admin" || user.permissions?.includes(permission))
    return true;
  const defaults = {
    "fuel.view": [
      ...managers,
      "fuel",
      "finance",
      "accountant",
      "auditor",
      "cashier",
    ],
    "fuel.sales.record": [...managers, "fuel", "cashier"],
    "fuel.readings.enter": [...managers, "fuel"],
    "fuel.readings.approve": managers,
    "fuel.payments.receive": [...managers, "finance", "accountant"],
    "fuel.periods.post": [...managers, "finance", "accountant"],
    "fuel.stock.manage": managers,
    "fuel.reports.company": ["ceo", "gm"],
  };
  return (defaults[permission] || []).includes(user.role);
}
