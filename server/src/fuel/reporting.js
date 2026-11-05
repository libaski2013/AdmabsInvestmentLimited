import Journal from "../models/JournalEntry.js";
import { FuelSale, Period, Adjustment } from "./models.js";
// Read journal recognition, never debt collections, for company-wide fuel revenue.
export async function fuelFinancials(scope, start, end, { workShift } = {}) {
  let entries = await Journal.find({
    ...scope,
    number: /^JF-/,
    date: { $gte: start, $lte: end },
    "lines.accountCode": { $in: ["4100", "4105"] },
  }).lean();
  if (workShift) {
    const periods = await Period.find({ ...scope, workShift }).distinct("_id");
    const sales = await FuelSale.find({
      ...scope,
      period: { $in: periods },
    }).distinct("_id");
    const adjustments = await Adjustment.find({
      ...scope,
      invoice: { $in: sales },
    }).distinct("_id");
    const allowed = new Set([...periods, ...sales, ...adjustments].map(String));
    entries = entries.filter((e) => allowed.has(String(e.sourceId)));
  }
  const rows = entries.map((entry) => ({
    branch: entry.branch,
    outlet: entry.outlet,
    at: entry.date,
    revenue:
      Math.round(
        entry.lines
          .filter((l) => ["4100", "4105"].includes(l.accountCode))
          .reduce((n, l) => n + l.credit - l.debit, 0) * 100,
      ) / 100,
  }));
  // Original and reversal journal lines both remain; their signed values cancel exactly once.
  const [invoices, adjustments] = await Promise.all([
    FuelSale.find({ ...scope, status: "posted", dueCents: { $gt: 0 } })
      .select("dueCents")
      .lean(),
    Adjustment.find({ ...scope, dueCents: { $gt: 0 } })
      .select("dueCents")
      .lean(),
  ]);
  return {
    rows,
    revenue: Math.round(rows.reduce((n, r) => n + r.revenue, 0) * 100) / 100,
    receivables:
      [...invoices, ...adjustments].reduce((n, i) => n + i.dueCents, 0) / 100,
    profitExcludesFuel: true,
    note: "Fuel revenue is included; fuel margin is not calculated because reviewed fuel delivery costs and costing policy are not configured. Profit figures cover the existing retail cost model. Fuel debt is separate from legacy customer balances.",
  };
}
export function groupedFuelReports(periods, sales) {
  const groups = new Map(),
    consumption = new Map();
  const include = (p, litresMl, amountCents) => {
    const key = [
      p.station,
      p.pumpCode,
      p.nozzleCode,
      p.fuelType,
      p.workShift || "",
      p.businessDate,
    ].join("|");
    if (!groups.has(key))
      groups.set(key, {
        station: p.station,
        pumpCode: p.pumpCode,
        nozzleCode: p.nozzleCode,
        fuelType: p.fuelType,
        workShift: p.workShift,
        businessDate: p.businessDate,
        litresMl: 0,
        amountCents: 0,
      });
    const group = groups.get(key);
    group.litresMl += litresMl;
    group.amountCents += amountCents;
  };
  const periodMap = new Map(periods.map((p) => [String(p._id), p]));
  for (const sale of sales.filter((s) => s.status === "posted")) {
    include(
      { ...sale, workShift: periodMap.get(String(sale.period))?.workShift },
      sale.litresMl,
      sale.amountCents,
    );
    if (sale.company) {
      const key = [
        sale.company,
        sale.vehicle || sale.registration || "unassigned",
        sale.fuelType,
      ].join("|");
      if (!consumption.has(key))
        consumption.set(key, {
          company: sale.company,
          vehicle: sale.vehicle,
          registration: sale.registration,
          fuelType: sale.fuelType,
          litresMl: 0,
          amountCents: 0,
        });
      const row = consumption.get(key);
      row.litresMl += sale.litresMl;
      row.amountCents += sale.amountCents;
    }
  }
  for (const p of periods.filter(
    (p) => p.status === "posted" && p.mode === "summary",
  ))
    include(
      p,
      p.reconciliation?.derivedMl || 0,
      p.reconciliation?.derivedValueCents || 0,
    );
  return {
    salesByNozzleShift: [...groups.values()],
    companyVehicleConsumption: [...consumption.values()],
  };
}
