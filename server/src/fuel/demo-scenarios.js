import mongoose from "mongoose";
import { demoAdministrator } from "./demo.js";
import { models, DemoRun, Station, Tank, Nozzle, Price, Period, Company, Vehicle, Driver, FuelSale, Payment, Ledger, Movement, Audit, Dip, Connection, StationLoan, StationTransfer } from "./models.js";
import { fail, valueOf, reconcile } from "./domain.js";
import { scopeOf, number } from "./service.js";

// Only a named, active test batch is eligible. No existing tank, account,
// meter period or transaction is rewritten. All new documents use one session.
export async function expandFuelDemo(user, session) {
  demoAdministrator(user);
  let step = "reserve expanded training batch";
  try {
    const run = await DemoRun.findOneAndUpdate({ key: "fuel-flow", active: true }, { $inc: { revision: 1 } }, { new: true, session });
    fail(run, "Create starter fuel training records first", 409);
    if (run.scenarioVersion === 1) return { ...run.scenarioSummary, existing: true };
    const stations = await Station.find({ _id: { $in: run.stations }, demoBatch: run.batch }).sort({ code: 1 }).session(session);
    fail(stations.length === 3 && stations.length === run.stations.length, "Training station ownership changed; expansion requires review", 409);
    const rows = new Map();
    const put = (Model, data) => {
      const doc = new Model(data);
      if (!rows.has(Model)) rows.set(Model, []);
      rows.get(Model).push(doc);
      return doc;
    };
    const audit = (doc, action, reason, before) => put(Audit, { ...scopeOf(doc), entity: doc.constructor.modelName.replace(/V2$/, ""),
      entityId: String(doc._id), action, reason: "TEST ONLY SCENARIO: " + reason, user: user.id, at: new Date(), before, after: doc.toObject() });
    const summary = { version: 1, batch: run.batch, createdAt: new Date(), addedPurchases: 153, postedPurchases: 150,
      note: "Starting figures for this scenario pack only. Existing starter records and later test activity are additional. All prices and readings are fictional.", stations: [] };
    const stationAssets = [];
    for (let stationIndex = 0; stationIndex < stations.length; stationIndex++) {
      const station = stations[stationIndex], scope = scopeOf(station), tag = `SCENARIO-${run.batch.slice(0, 8)}-${stationIndex + 1}`;
      step = "build scenarios for training station " + (stationIndex + 1);
      const base = Math.max(Date.now() - 30000, +new Date(station.cutoverAt || 0) + 1000);
      fail(base + 25000 < Date.now(), "Allow thirty seconds after creating training stations before expanding", 409);
      const accounts = {};
      for (const [key, label, termsDays, limitCents, status] of [
        ["fleet", "Fleet credit and mixed payments", 30, 5000000, "active"],
        ["advance", "Prepaid fleet", 30, 0, "active"],
        ["overdue", "Overdue credit demonstration", 0, 500000, "active"],
        ["suspended", "Suspended account demonstration", 30, 500000, "suspended"],
        ["limit", "GHC 100 credit limit demonstration", 30, 10000, "active"],
      ]) {
        const c = put(Company, { demoBatch: run.batch, accountCode: `${tag}-${key}`, name: `[TEST ONLY] ${station.code} ${label}`,
          termsDays, limitCents, stations: [station._id], fuelTypes: ["diesel", "petrol"], status,
          requireVehicle: true, requireDriver: true, requireAuthorisation: true });
        const v = put(Vehicle, { company: c._id, registration: `${tag}-${key}-BUS`, dailyMl: 10000000, dailyCents: 5000000 });
        const d = put(Driver, { company: c._id, name: `[TEST ONLY] ${key} driver ${stationIndex + 1}` });
        accounts[key] = { c, v, d };
      }
      const movements = [], sales = [], periodDocs = [], tanks = [], nozzles = [];
      const recordMovement = (tank, delta, kind, at, extra = {}) => {
        tank.bookMl += delta;
        fail(tank.bookMl >= 0 && tank.bookMl <= tank.capacityMl, "Training stock outside tank capacity", 409);
        const m = put(Movement, { ...scope, tank: tank._id, kind, litresMl: Math.abs(delta), stockDeltaMl: delta,
          status: "posted", reference: tag, reason: "TEST ONLY SCENARIO " + kind, at, user: user.id, ...extra });
        movements.push(m); return m;
      };
      for (const fuelType of ["diesel", "petrol"]) {
        const tank = put(Tank, { ...scope, code: tag + "-" + fuelType, name: `[TEST ONLY] Scenario ${fuelType}`,
          fuelType, capacityMl: 50000000, bookMl: 0, openingEstablished: true });
        recordMovement(tank, 20000000, "opening", new Date(base - 3));
        recordMovement(tank, 3000000, "delivery", new Date(base - 2));
        const nozzle = put(Nozzle, { ...scope, pumpCode: tag + "-P1", code: fuelType === "diesel" ? "SC-D" : "SC-P",
          tank: tank._id, fuelType, meterPrecision: 3, baselineMl: 0, lastClosingMl: 0, lastClosingAt: new Date(base - 1) });
        tanks.push(tank); nozzles.push(nozzle);
      }
      for (const [fuelType, priceUnits, at] of [["diesel", 100000, base - 1], ["diesel", 110000, base + 5000], ["petrol", 120000, base - 1]])
        put(Price, { ...scope, fuelType, priceUnits, effectiveAt: new Date(at), createdBy: user.id });
      const advance = accounts.advance.c;
      const prepayReceipt = put(Payment, { ...scope, number: number("SC-ADVANCE"), company: advance._id, amountCents: 2000000,
        method: "bank", reference: tag + " prepaid deposit", receivedAt: new Date(base), entryAt: new Date(), receivedBy: user.id, unappliedCents: 2000000, allocations: [] });
      advance.advanceCents = 2000000;
      const ledger = (company, type, debitCents, creditCents, advanceDeltaCents, doc, at = new Date()) => put(Ledger, { ...scope,
        company: company._id, type, reference: doc.number, debitCents, creditCents, advanceDeltaCents, at, user: user.id,
        invoice: doc.constructor === FuelSale ? doc._id : undefined, payment: doc.constructor === Payment ? doc._id : undefined });
      ledger(advance, "On-account Receipt", 0, 0, 2000000, prepayReceipt, new Date(base));
      const meter = [0, 0];
      for (let p = 0; p < 5; p++) {
        const fuelIndex = p === 2 || p === 3 ? 1 : 0, tank = tanks[fuelIndex], nozzle = nozzles[fuelIndex];
        const start = base + p * 5000, priceUnits = fuelIndex ? 120000 : p === 0 ? 100000 : 110000;
        const period = put(Period, { ...scope, number: number("SC-PERIOD"), nozzle: nozzle._id, tank: tank._id,
          pumpCode: nozzle.pumpCode, nozzleCode: nozzle.code, fuelType: tank.fuelType, mode: p === 1 ? "summary" : "individual",
          attendant: user.id, businessDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(start)),
          workShift: p % 2 ? "night" : "day", openedAt: new Date(start), entryAt: new Date(), openingMl: meter[fuelIndex],
          currentPrice: priceUnits, segmentStartMl: meter[fuelIndex], segmentStartAt: new Date(start), segments: [],
          status: p < 3 ? "posted" : p === 3 ? "submitted" : "draft", lockActive: p >= 3,
          reason: "TEST ONLY SCENARIO " + (p === 1 ? "summary with 50 L derived walk-in" : p === 3 ? "submitted with GHC 20 collection shortage" : p === 4 ? "open for practice" : "balanced posted period") });
        periodDocs.push(period);
        const periodSales = [], nonSales = [], collections = { cash: 0, momo: 0, card: 0 };
        for (let j = 0; j < 10; j++) {
          const index = p * 10 + j, kind = j % 5, litresMl = (20 + j * 5) * 1000, amountCents = valueOf(litresMl, priceUnits);
          const account = kind === 4 ? accounts.advance : p === 0 && j === 2 ? accounts.overdue : kind >= 2 || p === 1 ? accounts.fleet : null;
          const prepaidCents = kind === 4 ? amountCents : 0;
          const creditCents = kind === 2 ? amountCents : kind === 3 ? Math.floor(amountCents / 2) : 0;
          const paidCents = amountCents - creditCents - prepaidCents;
          const method = kind === 0 ? "cash" : kind === 1 ? "momo" : "card";
          const at = new Date(start + 100 + j * 350);
          const doc = put(FuelSale, { ...scope, number: number("SC-SALE"), period: period._id, nozzle: nozzle._id, tank: tank._id,
            pumpCode: nozzle.pumpCode, nozzleCode: nozzle.code, fuelType: tank.fuelType, litresMl, segmentIndex: 0, priceUnits,
            amountCents, paidCents, prepaidCents, creditCents, dueCents: creditCents,
            dueAt: new Date(+at + (account?.c.termsDays || 0) * 86400000),
            payments: paidCents ? [{ method, amountCents: paidCents, reference: tag }] : [],
            company: account?.c._id, vehicle: account?.v._id, registration: account?.v.registration, driver: account?.d._id,
            driverName: account?.d.name, attendant: user.id, businessDate: period.businessDate, transactionAt: at, entryAt: new Date(),
            source: "manual", sourceRef: `${tag}-${index + 1}-${["CASH", "MOMO", "CREDIT", "MIXED", "PREPAID"][kind]}`,
            eventKey: `${run.batch}:scenario:${stationIndex}:${index}`, authorisation: account ? "TEST ONLY approved training purchase" : "" });
          sales.push(doc); periodSales.push(doc); collections[method] += paidCents;
          if (account) {
            account.c.debtCents += creditCents; account.c.advanceCents -= prepaidCents;
            ledger(account.c, "Fuel Purchases", creditCents, 0, -prepaidCents, doc, at);
          }
          if (prepaidCents) {
            prepayReceipt.unappliedCents -= prepaidCents;
            prepayReceipt.allocations.push({ invoice: doc._id, kind: "prepaid", amountCents: prepaidCents, at, user: user.id });
          }
          recordMovement(tank, -litresMl, p === 1 ? "period_dispensing" : "individual_sale", at,
            { period: period._id, linkedSale: doc._id, reference: doc.number });
          audit(doc, "posted", doc.sourceRef);
        }
        let extraMl = 0;
        if (p === 0) {
          extraMl = 2000;
          nonSales.push(recordMovement(tank, -extraMl, "calibration", new Date(start + 4000),
            { period: period._id, segmentIndex: 0, status: "approved", approvedBy: user.id }));
        }
        if (p === 1) {
          extraMl = 50000;
          collections.cash += valueOf(extraMl, priceUnits);
          recordMovement(tank, -extraMl, "period_dispensing", new Date(start + 4000), { period: period._id });
        }
        const grossMl = periodSales.reduce((sum, sale) => sum + sale.litresMl, 0) + extraMl;
        meter[fuelIndex] += grossMl;
        if (p < 4) {
          period.closedAt = new Date(start + 4500); period.closingMl = meter[fuelIndex]; period.closingEntryAt = new Date();
          period.collections = collections;
          if (p === 3) period.collections.cash -= 2000;
          period.segments = [{ openingMl: period.openingMl, closingMl: period.closingMl, grossMl, priceUnits,
            attendant: user.id, startAt: period.openedAt, endAt: period.closedAt, rollover: false,
            saleValueCents: periodSales.reduce((sum, sale) => sum + sale.amountCents, 0) + (p === 1 ? valueOf(extraMl, priceUnits) : 0) }];
          period.segmentStartMl = period.closingMl; period.segmentStartAt = period.closedAt;
          period.reconciliation = reconcile(period.toObject(), periodSales, nonSales);
          if (p < 3) {
            period.approvedBy = user.id; period.approvedAt = period.closedAt; period.postedBy = user.id; period.postedAt = period.closedAt;
            nozzle.lastClosingMl = period.closingMl; nozzle.lastClosingAt = period.closedAt; nozzle.lastPeriod = period._id;
          }
        }
        audit(period, p < 3 ? "posted" : p === 3 ? "submitted" : "opened", period.reason);
      }
      // Keep a reversed entry and its compensating stock movement as an audit example.
      const openPeriod = periodDocs[4], reversed = put(FuelSale, { ...sales[40].toObject(), _id: new mongoose.Types.ObjectId(), number: number("SC-REVERSED"),
        sourceRef: tag + "-ENTRY-ERROR", eventKey: `${run.batch}:scenario:${stationIndex}:reversed`, status: "reversed",
        reversalReason: "TEST ONLY entry error: no fuel was dispensed", reversalStockCorrection: true });
      const original = recordMovement(tanks[0], -reversed.litresMl, "individual_sale", new Date(base + 24000), { period: openPeriod._id, linkedSale: reversed._id, reference: reversed.number });
      recordMovement(tanks[0], reversed.litresMl, "sale_entry_error", new Date(base + 24500), { period: openPeriod._id, linkedSale: reversed._id, linkedMovement: original._id, reference: reversed.number });
      audit(reversed, "reversed", reversed.reversalReason);
      const fleet = accounts.fleet.c;
      const creditInvoices = sales.filter(sale => String(sale.company) === String(fleet._id) && sale.creditCents > 0);
      for (const [i, invoice] of creditInvoices.slice(0, 2).entries()) {
        const amount = i === 0 ? Math.floor(invoice.dueCents / 2) : invoice.dueCents;
        const receipt = put(Payment, { ...scope, number: number("SC-RECEIPT"), company: fleet._id, amountCents: amount,
          method: i === 0 ? "bank" : "momo", reference: tag + (i === 0 ? " partial invoice payment" : " full invoice payment"),
          receivedAt: new Date(), entryAt: new Date(), receivedBy: user.id, unappliedCents: 0,
          allocations: [{ invoice: invoice._id, kind: "sale", number: invoice.number, amountCents: amount, at: new Date(), user: user.id }] });
        invoice.dueCents -= amount; fleet.debtCents -= amount;
        ledger(fleet, "On-account Receipt", 0, 0, amount, receipt);
        ledger(fleet, "Payments Received", 0, amount, -amount, receipt);
        audit(receipt, "received", receipt.reference);
      }
      // Retain an unallocated receipt to demonstrate advance credit separately.
      const onAccount = put(Payment, { ...scope, number: number("SC-ON-ACCOUNT"), company: fleet._id, amountCents: 15000,
        method: "bank", reference: tag + " unallocated advance", receivedAt: new Date(), entryAt: new Date(), receivedBy: user.id, unappliedCents: 15000 });
      fleet.advanceCents += 15000;
      ledger(fleet, "On-account Receipt", 0, 0, 15000, onAccount);
      put(Connection, { ...scope, code: tag + "-DISABLED", enabled: false, mapping: { note: "TEST ONLY: no live hardware or ingestion" } });
      stationAssets.push({ station, tanks, nozzles, accounts, periodDocs, sales, recordMovement, base });
    }
    step = "build partial and fully repaid training loans";
    for (const [lenderIndex, borrowerIndex, borrowed, repaid] of [[2, 0, 1000000, 1000000], [0, 1, 600000, 200000]]) {
      const lender = stationAssets[lenderIndex], borrower = stationAssets[borrowerIndex];
      const loan = put(StationLoan, { number: number("SC-LOAN"), lender: lender.station._id, borrower: borrower.station._id,
        fuelType: "diesel", litresMl: borrowed, outstandingMl: borrowed - repaid, reference: "TEST ONLY SCENARIO", reason: "TEST ONLY fuel shortage and return", at: new Date(), user: user.id });
      for (const [kind, from, to, litresMl] of [["loan", lender, borrower, borrowed], ["repayment", borrower, lender, repaid]]) {
        const transfer = put(StationTransfer, { number: number("SC-TRANSFER"), loan: loan._id, kind,
          fromStation: from.station._id, toStation: to.station._id, fromTank: from.tanks[0]._id, toTank: to.tanks[0]._id,
          litresMl, reference: loan.number, reason: "TEST ONLY confirmed physical transfer", at: new Date(), user: user.id });
        const outgoing = from.recordMovement(from.tanks[0], -litresMl, "station_" + kind + "_out", new Date(), { reference: transfer.number });
        to.recordMovement(to.tanks[0], litresMl, "station_" + kind + "_in", new Date(), { reference: transfer.number, linkedMovement: outgoing._id });
      }
    }
    for (const asset of stationAssets) {
      const { station, tanks, accounts, sales, periodDocs } = asset;
      for (const [i, tank] of tanks.entries()) put(Dip, { ...scopeOf(station), tank: tank._id, calculatedMl: tank.bookMl,
        physicalMl: tank.bookMl - (i === 0 ? 10000 : 0), varianceMl: i === 0 ? -10000 : 0, at: new Date(), user: user.id, evidence: "" });
      const posted = sales.filter(sale => sale.status === "posted");
      summary.stations.push({ station: station._id, code: station.code, addedRecords: 51, postedPurchases: 50,
        litres: posted.reduce((sum, sale) => sum + sale.litresMl, 0) / 1000,
        salesValue: posted.reduce((sum, sale) => sum + sale.amountCents, 0) / 100,
        derivedWalkInLitres: 50, derivedWalkInValue: periodDocs[1].reconciliation.derivedValueCents / 100,
        immediateCollections: posted.reduce((sum, sale) => sum + sale.paidCents, 0) / 100,
        remainingDebt: Object.values(accounts).reduce((sum, account) => sum + account.c.debtCents, 0) / 100,
        availableAdvance: Object.values(accounts).reduce((sum, account) => sum + account.c.advanceCents, 0) / 100,
        dieselStockLitres: tanks[0].bookMl / 1000, petrolStockLitres: tanks[1].bookMl / 1000,
        openPeriod: String(periodDocs[4]._id), nextClosingMeterLitres: (periodDocs[4].openingMl + sales.filter(sale => String(sale.period) === String(periodDocs[4]._id)).reduce((sum, sale) => sum + sale.litresMl, 0)) / 1000 });
    }
    // insertMany validates schemas; each collection is written sequentially in
    // the same transaction. Do not parallelise operations on this session.
    for (const [Model, documents] of rows) {
      step = "save expanded training " + Model.modelName;
      await Model.insertMany(documents, { session, ordered: true });
    }
    run.companies.push(...(rows.get(Company) || []).map(company => company._id));
    run.scenarioVersion = 1; run.scenarioSummary = summary;
    step = "finish expanded training batch";
    await run.save({ session });
    return summary;
  } catch (error) { error.fuelDemoStep = step; throw error; }
}
