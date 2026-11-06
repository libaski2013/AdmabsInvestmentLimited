import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Branch from "../models/Branch.js";
import Outlet from "../models/Outlet.js";
import Journal from "../models/JournalEntry.js";
import { models, DemoRun, Station, Tank, Nozzle, Price, Period, Company, Payment, Vehicle, Driver, StationLoan, StationTransfer } from "./models.js";
import { fail } from "./domain.js";
import { create, number, scopeOf, stock, postSale, ledger, journal, allocate, companyLock, lockStation } from "./service.js";

export function demoAdministrator(user) {
  fail(["super_admin", "ceo"].includes(user.role), "CEO or Super Admin is required to manage test data", 403);
}
export async function seedFuelDemo(user, session) {
  demoAdministrator(user);
  const run = await DemoRun.findOneAndUpdate({ key: "fuel-flow" },
    { $setOnInsert: { key: "fuel-flow", active: false }, $inc: { revision: 1 } },
    { upsert: true, new: true, session });
  if (run.active) return { stations: run.stations, batch: run.batch, existing: true };
  const batch = randomUUID(), tag = "TEST-" + batch.slice(0, 8).toUpperCase();
  const at = new Date(Date.now() - 60000);
  const branch = await create(Branch, { code: tag, name: "[TEST ONLY] Fuel training", type: "Filling Station", divisions: ["fuel"] }, session);
  const stations = [], tanks = [], periods = [];
  for (const letter of ["A", "B", "C"]) {
    const outlet = await create(Outlet, { code: tag + "-" + letter, name: "[TEST ONLY] Station " + letter,
      branch: branch._id, division: "fuel", runs24Hours: true, fuelCutoverAt: at }, session);
    const station = await create(Station, { branch: branch._id, outlet: outlet._id, code: tag + "-" + letter,
      name: "[TEST ONLY] Station " + letter, timeZone: "Africa/Accra", cutoverAt: at, demoBatch: batch }, session);
    const scope = scopeOf(station);
    const tank = await create(Tank, { ...scope, code: "TEST-DIESEL", name: "[TEST ONLY] Diesel tank", fuelType: "diesel",
      capacityMl: 30000000, bookMl: 0, openingEstablished: true }, session);
    await stock(session, user, station, tank._id, 10000000, "opening", tag, "TEST ONLY training opening stock");
    const nozzle = await create(Nozzle, { ...scope, pumpCode: "TEST-P1", code: "TEST-N1", tank: tank._id,
      fuelType: "diesel", meterPrecision: 3, baselineMl: 0, lastClosingMl: 0, lastClosingAt: at }, session);
    await create(Price, { ...scope, fuelType: "diesel", priceUnits: 100000, effectiveAt: at, createdBy: user.id }, session);
    const period = await create(Period, { ...scope, number: number("TEST-PERIOD"), nozzle: nozzle._id, tank: tank._id,
      pumpCode: nozzle.pumpCode, nozzleCode: nozzle.code, fuelType: "diesel", mode: "individual", attendant: user.id,
      businessDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" }).format(at),
      workShift: "day", openedAt: at, entryAt: at, openingMl: 0, currentPrice: 100000,
      segmentStartMl: 0, segmentStartAt: at, segments: [], reason: "TEST ONLY training period" }, session);
    stations.push(station); tanks.push(tank); periods.push(period);
  }
  const company = await create(Company, { demoBatch: batch, accountCode: tag + "-FLEET", name: "[TEST ONLY] Training Transport",
    termsDays: 30, limitCents: 5000000, stations: stations.map(x => x._id), fuelTypes: ["diesel"] }, session);
  await create(Vehicle, { company: company._id, registration: tag + "-BUS" }, session);
  await create(Driver, { company: company._id, name: "[TEST ONLY] Training Driver" }, session);
  for (let i = 0; i < 20; i++) {
    const litres = 10 + i;
    await postSale(session, user, { period: periods[i % 3]._id, litres: String(litres),
      sourceRef: tag + "-SALE-" + (i + 1), eventKey: batch + ":sale:" + i,
      ...(i % 2 === 0 ? { company: company._id } : { payments: [{ method: "cash", amount: String(litres * 10) }] }) });
  }
  // A real receipt/allocation workflow reduces demonstration debt, not revenue.
  const account = await Company.findById(company._id).session(session);
  await companyLock(account, session);
  const payment = await create(Payment, { ...scopeOf(stations[0]), number: number("TEST-RECEIPT"), company: account._id,
    amountCents: 10000, method: "bank", reference: tag + "-PAYMENT", receivedAt: new Date(), entryAt: new Date(),
    receivedBy: user.id, unappliedCents: 10000, allocations: [] }, session);
  account.advanceCents += 10000; await account.save({ session });
  await ledger(session, user, payment, account, "On-account Receipt", 0, 0, 10000);
  await journal(session, user, payment, "TEST ONLY receipt", [
    { accountCode: "1000", accountName: "Payment clearing", debit: 10000 },
    { accountCode: "2105", accountName: "Fuel advances", credit: 10000 },
  ], "payment");
  await allocate(session, user, account, payment, { allocationMode: "oldest" });
  const loan = await create(StationLoan, { number: number("TEST-LOAN"), lender: stations[1]._id, borrower: stations[0]._id,
    fuelType: "diesel", litresMl: 2000000, outstandingMl: 1200000, reference: tag, reason: "TEST ONLY fuel shortage", at, user: user.id }, session);
  for (const [kind, from, to, litresMl] of [["loan", 1, 0, 2000000], ["repayment", 0, 1, 800000]]) {
    const transfer = await create(StationTransfer, { number: number("TEST-TRANSFER"), loan: loan._id, kind,
      fromStation: stations[from]._id, toStation: stations[to]._id, fromTank: tanks[from]._id, toTank: tanks[to]._id,
      litresMl, reference: tag, reason: "TEST ONLY training transfer", at: new Date(), user: user.id }, session);
    const outgoing = await stock(session, user, stations[from], tanks[from]._id, -litresMl, "station_" + kind + "_out", transfer.number, "TEST ONLY transfer");
    await stock(session, user, stations[to], tanks[to]._id, litresMl, "station_" + kind + "_in", transfer.number, "TEST ONLY transfer", outgoing._id);
  }
  run.active = true; run.batch = batch; run.branch = branch._id;
  run.stations = stations.map(x => x._id); run.companies = [company._id]; run.user = user.id;
  await run.save({ session });
  return { batch, stations: run.stations, purchases: 20, outstandingLitres: 1200 };
}

export async function removeFuelDemo(user, session) {
  demoAdministrator(user);
  const run = await DemoRun.findOneAndUpdate({ key: "fuel-flow", active: true }, { $inc: { revision: 1 } }, { new: true, session });
  fail(run, "No active fuel demonstration batch", 404);
  const stations = await Station.find({ _id: { $in: run.stations }, demoBatch: run.batch }).session(session);
  fail(stations.length === run.stations.length, "Test ownership changed; cleanup requires review", 409);
  for (const station of stations) await lockStation(user, station._id, session);
  for (const c of await Company.find({ _id: { $in: run.companies } }).session(session)) await companyLock(c, session);
  const outlets = stations.map(x => x.outlet);
  run.companies = await Company.find({ demoBatch: run.batch }).session(session).distinct("_id");
  fail(!(await Journal.exists({ $or: [{ outlet: { $in: outlets } }, { branch: run.branch }] }).session(session)), "A business journal references test locations; finance must review it before cleanup", 409);
  fail(!(await Company.exists({ demoBatch: { $ne: run.batch }, stations: { $in: run.stations } }).session(session)), "A real company references test stations; review it before cleanup", 409);
  fail(!(await StationLoan.exists({ $or: [{ lender: { $in: run.stations }, borrower: { $nin: run.stations } }, { borrower: { $in: run.stations }, lender: { $nin: run.stations } }] }).session(session)), "A transfer crosses test/real stations; cleanup blocked", 409);
  const owned = new Set([...Object.values(models), Branch, Outlet, Journal].map(x => x.modelName));
  for (const Model of Object.values(mongoose.models).filter(x => !owned.has(x.modelName))) {
    const fields = ["branch", "branchRef", "branches", "outlet", "outlets", "outletIds", "branchIds"].filter(x => Model.schema.path(x));
    if (fields.length) fail(!(await Model.exists({ $or: fields.map(field => ({ [field]: { $in: /outlet/i.test(field) ? outlets : [run.branch] } })) }).session(session)),
      "Other records reference the test locations; review them before cleanup", 409);
  }
  for (const Model of Object.values(models)) {
    if ([Station, Company, DemoRun].includes(Model)) continue;
    const where = Model === StationLoan ? { lender: { $in: run.stations }, borrower: { $in: run.stations } }
      : Model === StationTransfer ? { fromStation: { $in: run.stations }, toStation: { $in: run.stations } }
      : [Vehicle, Driver].includes(Model) ? { company: { $in: run.companies } }
      : Model.schema.path("station") ? { station: { $in: run.stations } } : null;
    if (where) await Model.deleteMany(where, { session });
  }
  await Company.deleteMany({ _id: { $in: run.companies }, demoBatch: run.batch }, { session });
  await Station.deleteMany({ _id: { $in: run.stations }, demoBatch: run.batch }, { session });
  await Outlet.deleteMany({ _id: { $in: outlets }, branch: run.branch }, { session });
  await Branch.deleteOne({ _id: run.branch }, { session });
  run.active = false; await run.save({ session });
  return { removed: true, batch: run.batch };
}
