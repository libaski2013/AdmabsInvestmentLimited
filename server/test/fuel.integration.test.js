import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import posRoutes from "../src/routes/pos.routes.js";
import dashboardRoutes from "../src/routes/dashboard.routes.js";
import analyticsRoutes from "../src/routes/analytics.routes.js";
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Fastify from "fastify";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import authPlugin from "../src/plugins/auth.js";
import operations from "../src/routes/fuel-operations.routes.js";
import controllerRoutes from "../src/fuel/controller.js";
import legacyRoutes from "../src/routes/fuel.routes.js";
import "../src/models/Branch.js";
import User from "../src/models/User.js";
import Outlet from "../src/models/Outlet.js";
import Customer from "../src/models/Customer.js";
import Journal from "../src/models/JournalEntry.js";
import {
  models,
  Tank,
  Nozzle,
  Period,
  Company,
  FuelSale,
  Payment,
  Audit,
  Adjustment,
} from "../src/fuel/models.js";
let repl, app, token, station, tank, nozzle, other, company;
async function req(
  path,
  body,
  expected = 200,
  key = randomUUID(),
  auth = token,
) {
  const r = await app.inject({
    method: body === undefined ? "GET" : "POST",
    url: "/api/fuel/operations" + path,
    headers: { authorization: `Bearer ${auth}`, "idempotency-key": key },
    ...(body === undefined ? {} : { payload: body }),
  });
  assert.equal(r.statusCode, expected, `${path}: ${r.body}`);
  return r.json();
}
const open = (mode = "summary", n = nozzle, opening = "0") =>
  req("/periods", { nozzle: n._id, mode, opening });
const sale = (p, litres, extra = {}) =>
  req("/sales", {
    period: p._id,
    litres,
    sourceRef: randomUUID(),
    eventKey: randomUUID(),
    ...extra,
  });
const close = (p, closing, cash, extra = {}) =>
  req(`/periods/${p._id}/close`, {
    closing,
    collections: { cash, momo: "0", card: "0" },
    ...extra,
  });
async function post(p) {
  await req(`/periods/${p._id}/submit`, {});
  await req(`/periods/${p._id}/approve`, { reason: "TEST FIXTURE reviewed" });
  return req(`/periods/${p._id}/post`, { reason: "TEST FIXTURE approved" });
}
async function setup(code) {
  const branch = await mongoose
    .model("Branch")
    .create({
      name: `TEST ONLY ${code}`,
      code: `TEST-${code}`,
      city: "TEST ONLY",
      type: "Filling Station",
    });
  const outlet = await Outlet.create({
    branch: branch._id,
    name: `TEST ONLY ${code}`,
    code: `TEST-${code}`,
    division: "fuel",
    runs24Hours: true,
  });
  const station = await req("/stations", {
    outlet: String(outlet._id),
    code: `TEST-${code}`,
    name: "TEST ONLY",
    timeZone: "Africa/Accra",
    confirmLegacyReviewed: true,
    reason: "TEST FIXTURE CUTOVER",
  });
  const tank = await req(`/stations/${station._id}/tanks`, {
    code: "TEST-T1",
    name: "TEST ONLY",
    fuelType: "diesel",
    capacity: "10000",
  });
  await req(`/stations/${station._id}/stock`, {
    tank: tank._id,
    kind: "opening",
    litres: "1000",
    confirmReviewed: true,
    reference: "TEST ONLY",
    reason: "TEST FIXTURE OPENING",
  });
  const nozzle = await req(`/stations/${station._id}/nozzles`, {
    pumpCode: "TEST-P1",
    code: "TEST-N1",
    tank: tank._id,
    meterPrecision: 3,
    rollover: "10000",
  });
  await req(`/nozzles/${nozzle._id}/meter-event`, {
    kind: "baseline",
    reading: "0",
    reason: "TEST FIXTURE BASELINE",
  });
  await req(`/stations/${station._id}/prices`, {
    fuelType: "diesel",
    price: "10",
    reason: "TEST FIXTURE PRICE",
  });
  return { station, tank, nozzle };
}
before(
  async () => {
    process.env.JWT_SECRET = "TEST-ONLY-SECRET-NOT-PRODUCTION-12345678";
    repl = await MongoMemoryReplSet.create({
      binary: { version: process.env.TEST_MONGO_VERSION || "7.0.14" },
      replSet: {
        count: 1,
        storageEngine: "wiredTiger",
        args: [
          "--nounixsocket",
          "--setParameter",
          "diagnosticDataCollectionEnabled=false",
        ],
      },
    });
    await mongoose.connect(repl.getUri("admabs_fuel_TEST_ONLY"));
    for (const m of Object.values(models)) await m.init();
    await Promise.all([Journal.init(), User.init(), Outlet.init()]);
    app = Fastify();
    await app.register(authPlugin);
    await app.register(operations);
    await app.register(controllerRoutes);
    await app.register(legacyRoutes);
    await app.register(dashboardRoutes);
    await app.register(posRoutes);
    await app.register(analyticsRoutes);
    await app.ready();
  },
  { timeout: 180000 },
);
after(async () => {
  if (app) await app.close();
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
beforeEach(async () => {
  for (const c of Object.values(mongoose.connection.collections))
    await c.deleteMany({});
  const user = await User.create({
    name: "TEST ONLY ADMIN",
    username: "test-only-admin",
    passwordHash: "TEST ONLY",
    role: "super_admin",
  });
  token = app.jwt.sign({ id: String(user._id), role: "super_admin" });
  ({ station, tank, nozzle } = await setup("A"));
  other = await setup("B");
  company = await req("/companies", {
    accountCode: "TEST-CO",
    name: "TEST ONLY COMPANY",
    stations: [station._id, other.station._id],
    fuelTypes: ["diesel"],
    termsDays: 30,
    creditLimit: "1000",
    reason: "TEST FIXTURE ACCOUNT",
  });
});
test("summary posts stock and revenue exactly once", async () => {
  const p = await open();
  const c = await close(p, "100", "1000");
  assert.equal(c.reconciliation.derivedMl, 100000);
  await post(p);
  assert.equal((await Tank.findById(tank._id)).bookMl, 900000);
  assert.equal(await FuelSale.countDocuments(), 0);
  assert.equal(await Journal.countDocuments({ sourceId: p._id }), 1);
  await req(`/periods/${p._id}/post`, { reason: "TEST duplicate" }, 409);
  assert.equal((await Tank.findById(tank._id)).bookMl, 900000);
  assert.equal((await open("summary", nozzle, "100")).openingMl, 100000);
});
test("individual sale deduction is not repeated at shift posting", async () => {
  const p = await open("individual");
  await sale(p, "100", { payments: [{ method: "cash", amount: "1000" }] });
  await close(p, "100", "1000");
  await post(p);
  assert.equal((await Tank.findById(tank._id)).bookMl, 900000);
  assert.equal(await Journal.countDocuments(), 1);
});
test("mixed prepaid/credit/walk-in and partial/manual allocations", async () => {
  const receipt = await req(`/companies/${company._id}/payments`, {
    station: station._id,
    amount: "200",
    method: "bank",
    allocationMode: "on_account",
  });
  const p = await open();
  const inv = await sale(p, "50", {
    company: company._id,
    prepaid: "100",
    payments: [{ method: "momo", amount: "100" }],
  });
  assert.equal(inv.creditCents, 30000);
  assert.equal((await Payment.findById(receipt._id)).unappliedCents, 10000);
  await close(p, "100", "600");
  await post(p);
  await req(`/companies/${company._id}/payments`, {
    station: station._id,
    amount: "150",
    method: "cash",
    allocationMode: "oldest",
  });
  await req(`/payments/${receipt._id}/allocate`, {
    allocationMode: "manual",
    allocations: [{ invoice: inv._id, amount: "50" }],
    reason: "TEST allocation",
  });
  const co = await Company.findById(company._id);
  assert.equal(co.debtCents, 10000);
  assert.equal(co.advanceCents, 5000);
  const revenue = (await Journal.find())
    .flatMap((j) => j.lines)
    .filter((l) => l.accountCode === "4100")
    .reduce((n, l) => n + l.credit - l.debit, 0);
  assert.equal(revenue, 1000);
});
test("concurrent purchases across stations enforce one global credit limit", async () => {
  await Company.updateOne(
    { _id: company._id },
    { $set: { limitCents: 10000 } },
  );
  const a = await open();
  const b = await open("summary", other.nozzle);
  const results = await Promise.all(
    [a, b].map((p) =>
      app.inject({
        method: "POST",
        url: "/api/fuel/operations/sales",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": randomUUID(),
        },
        payload: {
          period: p._id,
          litres: "8",
          company: company._id,
          sourceRef: randomUUID(),
          eventKey: randomUUID(),
        },
      }),
    ),
  );
  assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
  assert.equal((await Company.findById(company._id)).debtCents, 8000);
  assert.equal(await FuelSale.countDocuments(), 1);
});
test("price boundary required; both prices value their own litres", async () => {
  const p = await open();
  await req(
    `/stations/${station._id}/prices`,
    { fuelType: "diesel", price: "12", reason: "TEST price" },
    409,
  );
  await req(`/stations/${station._id}/prices`, {
    fuelType: "diesel",
    price: "12",
    boundaries: [{ period: p._id, reading: "50" }],
    reason: "TEST price",
  });
  const c = await close(p, "100", "1100");
  assert.equal(c.reconciliation.expectedCents, 110000);
  await post(p);
});
test("rollover, reset, replacement and overlap protection", async () => {
  await req(`/nozzles/${nozzle._id}/meter-event`, {
    kind: "replacement",
    reading: "9990",
    reason: "TEST replacement",
  });
  const p = await open("summary", nozzle, "9990");
  await req(
    "/periods",
    { nozzle: nozzle._id, mode: "summary", opening: "9990" },
    409,
  );
  await req(
    `/periods/${p._id}/close`,
    { closing: "10", collections: { cash: "200", momo: "0", card: "0" } },
    400,
  );
  const c = await close(p, "10", "200", {
    rollover: true,
    reason: "TEST supervised rollover",
  });
  assert.equal(c.reconciliation.grossMl, 20000);
  await post(p);
  await req(`/nozzles/${nozzle._id}/meter-event`, {
    kind: "reset",
    reading: "0",
    reason: "TEST reset after posting",
  });
});
test("approved calibration and linked tank return", async () => {
  const p = await open();
  const m = await req(`/periods/${p._id}/non-sale`, {
    kind: "calibration",
    litres: "5",
    reason: "TEST calibration",
  });
  await req(`/movements/${m._id}/approve`, { reason: "TEST verified" });
  await close(p, "100", "950");
  await post(p);
  assert.equal((await Tank.findById(tank._id)).bookMl, 900000);
  await req(`/stations/${station._id}/stock`, {
    tank: tank._id,
    kind: "return",
    linkedMovement: m._id,
    litres: "5",
    reference: "TEST return",
    reason: "TEST fuel returned",
  });
  assert.equal((await Tank.findById(tank._id)).bookMl, 905000);
  await req(
    `/stations/${station._id}/stock`,
    {
      tank: tank._id,
      kind: "return",
      linkedMovement: m._id,
      litres: "1",
      reference: "TEST duplicate",
      reason: "TEST extra return",
    },
    400,
  );
});
test("idempotency and cross-source event reference prevent duplicate stock/revenue", async () => {
  const p = await open("individual");
  const key = randomUUID();
  const body = {
    period: p._id,
    litres: "1",
    payments: [{ method: "cash", amount: "10" }],
    sourceRef: "TEST-REF",
    eventKey: "TEST-EVENT",
  };
  const a = await req("/sales", body, 200, key);
  const b = await req("/sales", body, 200, key);
  assert.equal(a._id, b._id);
  await req("/sales", { ...body, litres: "2" }, 409, key);
  await req("/sales", { ...body, sourceRef: "TEST-REF-OTHER" }, 409);
  assert.equal(await FuelSale.countDocuments(), 1);
  assert.equal((await Tank.findById(tank._id)).bookMl, 999000);
});
test("unexplained litres block submission", async () => {
  const p = await open("individual");
  await sale(p, "1", { payments: [{ method: "cash", amount: "10" }] });
  await close(p, "2", "10");
  await req(`/periods/${p._id}/submit`, {}, 409);
});
test("correction audit and financial period reversal preserve meter/stock", async () => {
  const p = await open();
  await close(p, "10", "100");
  await req(`/periods/${p._id}/reopen`, { reason: "TEST correct closing" });
  await close(p, "20", "200");
  await post(p);
  await req(`/periods/${p._id}/reverse`, { reason: "TEST financial reversal" });
  assert.equal(await Audit.countDocuments({ action: "closing_correction" }), 1);
  assert.equal((await Tank.findById(tank._id)).bookMl, 980000);
  assert.equal((await Period.findById(p._id)).status, "reversed");
});
test("current DB permissions and branch restrictions override stale JWT grants", async () => {
  const u = await User.create({
    name: "TEST ONLY FUEL",
    username: "test-only-fuel",
    passwordHash: "TEST ONLY",
    role: "fuel",
    branches: [station.branch],
    outlets: [station.outlet],
  });
  const t = app.jwt.sign({ id: String(u._id), role: "super_admin" });
  await req(`/stations/${other.station._id}`, undefined, 404, undefined, t);
  await req(
    `/stations/${station._id}/tanks`,
    { code: "BAD", name: "BAD", fuelType: "diesel", capacity: "1000" },
    403,
    undefined,
    t,
  );
  await User.updateOne(
    { _id: u._id },
    { $set: { permissions: ["fuel.equipment.configure"] } },
  );
  await req(
    `/stations/${station._id}/tanks`,
    {
      code: "TEST-NEW",
      name: "TEST ONLY",
      fuelType: "diesel",
      capacity: "1000",
    },
    200,
    undefined,
    t,
  );
});
test("reviewed opening debt allocation and receipt reversal", async () => {
  const a = await req(`/companies/${company._id}/adjustments`, {
    station: station._id,
    kind: "opening_debt",
    amount: "100",
    dueAt: "2026-01-01",
    reference: "TEST opening",
    confirmReviewed: true,
    reason: "TEST reviewed debt",
  });
  const p = await req(`/companies/${company._id}/payments`, {
    station: station._id,
    amount: "40",
    method: "bank",
    allocationMode: "oldest",
  });
  assert.equal((await Adjustment.findById(a._id)).dueCents, 6000);
  await req(`/payments/${p._id}/reverse`, { reason: "TEST receipt reversal" });
  assert.equal((await Adjustment.findById(a._id)).dueCents, 10000);
  assert.equal((await Company.findById(company._id)).debtCents, 10000);
});
test("physical dip never overwrites book stock; legacy writes locked after cutover", async () => {
  await req(`/stations/${station._id}/dips`, { tank: tank._id, litres: "990" });
  assert.equal((await Tank.findById(tank._id)).bookMl, 1000000);
  const r = await app.inject({
    method: "POST",
    url: "/api/fuel/tanks",
    headers: { authorization: `Bearer ${token}` },
    payload: { outlet: station.outlet },
  });
  assert.equal(r.statusCode, 409);
});
test("equipment authentication and disabled live ingestion", async () => {
  const c = await req(`/stations/${station._id}/connections`, {
    code: "TEST-CONTROLLER",
  });
  let r = await app.inject({
    method: "POST",
    url: `/api/fuel/controller/${c.connection._id}/events`,
    payload: {},
  });
  assert.equal(r.statusCode, 401);
  r = await app.inject({
    method: "POST",
    url: `/api/fuel/controller/${c.connection._id}/events`,
    headers: { "x-equipment-secret": c.secret },
    payload: { sourceRef: "TEST-EVENT", eventKey: "TEST-EVENT" },
  });
  assert.equal(r.statusCode, 423);
  assert.equal(await FuelSale.countDocuments(), 0);
});
test("sale entry-error reversal restores only erroneous stock and permits corrected reconciliation", async () => {
  const p = await open("individual");
  const bad = await sale(p, "20", {
    payments: [{ method: "cash", amount: "200" }],
  });
  await req(`/sales/${bad._id}/reverse`, {
    entryError: true,
    reason: "TEST incorrect entry; dispensing did not occur",
  });
  assert.equal((await Tank.findById(tank._id)).bookMl, 1000000);
  await sale(p, "10", { payments: [{ method: "cash", amount: "100" }] });
  await close(p, "10", "100");
  await post(p);
  assert.equal((await Tank.findById(tank._id)).bookMl, 990000);
  const revenue = (await Journal.find())
    .flatMap((j) => j.lines)
    .filter((l) => l.accountCode === "4100")
    .reduce((n, l) => n + l.credit - l.debit, 0);
  assert.equal(revenue, 100);
});
test("prepaid reversal restores receipt advance with an allocation history", async () => {
  const receipt = await req(`/companies/${company._id}/payments`, {
    station: station._id,
    amount: "100",
    method: "cash",
    allocationMode: "on_account",
  });
  const p = await open("individual");
  const inv = await sale(p, "10", { company: company._id, prepaid: "100" });
  await req(`/sales/${inv._id}/reverse`, {
    entryError: true,
    reason: "TEST prepaid entry error",
  });
  assert.equal((await Company.findById(company._id)).advanceCents, 10000);
  assert.equal((await Payment.findById(receipt._id)).unappliedCents, 10000);
  await req(`/payments/${receipt._id}/reverse`, {
    reason: "TEST payment reversed after prepaid correction",
  });
  assert.equal((await Company.findById(company._id)).advanceCents, 0);
});
test("overdue reviewed debt blocks credit without a reasoned override", async () => {
  await req(`/companies/${company._id}/adjustments`, {
    station: station._id,
    kind: "opening_debt",
    amount: "100",
    dueAt: "2020-01-01",
    reference: "TEST opening",
    confirmReviewed: true,
    reason: "TEST reviewed debt",
  });
  const p = await open();
  await req(
    "/sales",
    {
      period: p._id,
      litres: "1",
      company: company._id,
      sourceRef: "TEST overdue",
      eventKey: "TEST overdue",
    },
    400,
  );
  const inv = await sale(p, "1", {
    company: company._id,
    reason: "TEST override approved against reviewed authorisation",
  });
  assert.equal(inv.creditCents, 1000);
  assert.equal(await Audit.countDocuments({ action: "credit_override" }), 1);
});
test("report aggregates, accounting revenue and linked stock return remain separate", async () => {
  const p = await open("individual");
  const inv = await sale(p, "10", {
    payments: [{ method: "cash", amount: "100" }],
  });
  await close(p, "10", "100");
  await post(p);
  const report = await req(`/reports?station=${station._id}`);
  assert.equal(report.salesByNozzleShift[0].litresMl, 10000);
  await req(`/stations/${station._id}/stock`, {
    tank: tank._id,
    kind: "return",
    linkedSale: inv._id,
    litres: "2",
    reference: "TEST physical return",
    reason: "TEST returned fuel received",
  });
  assert.equal((await Tank.findById(tank._id)).bookMl, 992000);
  const { fuelFinancials } = await import("../src/fuel/reporting.js");
  const financial = await fuelFinancials(
    {},
    new Date("2000-01-01"),
    new Date("2100-01-01"),
  );
  assert.equal(financial.revenue, 100);
});
test("verified test adapter queues duplicate events once and quarantines out-of-order retry", async () => {
  const { Connection, Inbox } = await import("../src/fuel/models.js");
  const p = await open("individual");
  const c = await req(`/stations/${station._id}/connections`, {
    code: "TEST ADAPTER ONLY",
  });
  await Connection.updateOne(
    { _id: c.connection._id },
    {
      $set: {
        enabled: true,
        verifiedModel: "TEST ONLY SIMULATOR",
        mapping: { "TEST-NOZZLE": { period: p._id } },
      },
    },
  );
  const event = {
    sourceRef: "TEST-CONTROLLER-1",
    eventKey: "TEST-CROSS-SOURCE-1",
    equipmentId: "TEST-NOZZLE",
    payload: {
      litres: "1",
      payments: [{ method: "cash", amount: "10" }],
      transactionAt: new Date().toISOString(),
    },
  };
  const inject = (body) =>
    app.inject({
      method: "POST",
      url: `/api/fuel/controller/${c.connection._id}/events`,
      headers: { "x-equipment-secret": c.secret },
      payload: body,
    });
  let r = await inject(event);
  assert.equal(r.statusCode, 202, r.body);
  const inbox = r.json();
  r = await inject(event);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(await Inbox.countDocuments(), 1);
  r = await inject({ ...event, payload: { ...event.payload, litres: "2" } });
  assert.equal(r.statusCode, 409);
  await req(`/inbox/${inbox._id}/retry`, {});
  assert.equal(await FuelSale.countDocuments(), 1);
  r = await inject({
    ...event,
    sourceRef: "TEST-LATE",
    eventKey: "TEST-LATE",
    payload: { ...event.payload, transactionAt: "2020-01-01T00:00:00Z" },
  });
  assert.equal(r.statusCode, 202);
  await req(`/inbox/${r.json()._id}/retry`, {}, 409);
  assert.equal((await Inbox.findById(r.json()._id)).status, "failed");
  assert.equal(await FuelSale.countDocuments(), 1);
});
test("additive migration dry run and repeat application preserve customer balances and transactions", async () => {
  const existing = await Customer.create({
    name: "TEST ONLY LEGACY CUSTOMER",
    balance: 42,
  });
  const env = {
    ...process.env,
    MONGODB_URI: repl.getUri("admabs_fuel_TEST_ONLY"),
  };
  const run = (args) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ["src/utils/migrate-fuel-operations.js", ...args],
        { env, encoding: "utf8" },
      ),
    );
  assert.equal(run([]).mode, "READ-ONLY REVIEW");
  assert.equal(run(["--apply"]).historicalRecordsChanged, false);
  assert.equal(run(["--apply"]).openingBalancesCopied, false);
  assert.equal((await Customer.findById(existing._id)).balance, 42);
  assert.equal(await FuelSale.countDocuments(), 0);
});
test("existing dashboard includes fuel revenue once and preserves retail costs and legacy balances", async () => {
  const Sale = (await import("../src/models/Sale.js")).default;
  await Sale.create({
    invoiceNumber: "TEST-RETAIL",
    branch: station.branch,
    outlet: station.outlet,
    subtotal: 100,
    tax: 0,
    total: 100,
    items: [
      {
        name: "TEST ONLY TYRE",
        category: "Tyre",
        price: 100,
        cost: 60,
        qty: 1,
      },
    ],
    status: "posted",
  });
  await Customer.create({ name: "TEST ONLY LEGACY BALANCE", balance: 30 });
  const p = await open("individual");
  await sale(p, "10", { payments: [{ method: "cash", amount: "100" }] });
  let r = await app.inject({
    method: "GET",
    url: "/api/dashboard",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  const dash = r.json();
  assert.equal(dash.revenue, 200);
  assert.equal(dash.grossProfit, 40);
  assert.equal(dash.receivables, 30);
  assert.equal(dash.fuelRevenue, 100);
  assert.equal(dash.profitExcludesFuel, true);
  r = await app.inject({
    method: "GET",
    url: "/api/analytics/financial",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().summary.revenue, 200);
  assert.equal(r.json().summary.grossProfit, 40);
});
test("production writes fail closed if idempotency unique index has not been migrated", async () => {
  const { RequestKey } = models;
  await RequestKey.collection.dropIndex("key_1");
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const check = Fastify();
  try {
    await check.register(authPlugin);
    await check.register(operations);
    await check.ready();
    const r = await check.inject({
      method: "POST",
      url: `/api/fuel/operations/stations/${station._id}/tanks`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": randomUUID(),
      },
      payload: {
        code: "TEST FAIL CLOSED",
        name: "TEST ONLY",
        fuelType: "diesel",
        capacity: "1",
      },
    });
    assert.equal(r.statusCode, 503, r.body);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
    await check.close();
    await RequestKey.createIndexes();
  }
});
test("authorised vehicle/driver policy and daily limits are enforced on the server", async () => {
  await req(`/companies/${company._id}/configure`, {
    station: station._id,
    requireVehicle: true,
    requireDriver: true,
    requireAuthorisation: true,
    reason: "TEST vehicle controls",
  });
  const vehicle = await req(`/companies/${company._id}/vehicles`, {
    station: station._id,
    registration: "TEST VEHICLE",
    dailyLitres: "5",
  });
  const driver = await req(`/companies/${company._id}/drivers`, {
    station: station._id,
    name: "TEST ONLY DRIVER",
  });
  const p = await open();
  await req(
    "/sales",
    {
      period: p._id,
      litres: "1",
      company: company._id,
      sourceRef: "TEST missing vehicle",
      eventKey: "TEST missing vehicle",
    },
    400,
  );
  await sale(p, "5", {
    company: company._id,
    vehicle: vehicle._id,
    driver: driver._id,
    authorisation: "TEST PO",
  });
  await req(
    "/sales",
    {
      period: p._id,
      litres: "1",
      company: company._id,
      vehicle: vehicle._id,
      driver: driver._id,
      authorisation: "TEST PO",
      sourceRef: "TEST over daily",
      eventKey: "TEST over daily",
    },
    409,
  );
  assert.equal((await Company.findById(company._id)).debtCents, 5000);
  assert.equal(await FuelSale.countDocuments(), 1);
});
test("fuel cutover locks generic POS dispensing while preserving retail checkout", async () => {
  const Product = (await import("../src/models/Product.js")).default;
  const fuel = await Product.create({
    name: "TEST ONLY LEGACY FUEL",
    code: "TEST-FUEL",
    category: "Fuel",
    branch: station.branch,
    outlet: station.outlet,
    qty: 100,
    price: 10,
    cost: 5,
  });
  const tyre = await Product.create({
    name: "TEST ONLY TYRE",
    code: "TEST-TYRE",
    category: "Tyre",
    branch: station.branch,
    outlet: station.outlet,
    qty: 10,
    price: 100,
    cost: 60,
  });
  const buy = (product) =>
    app.inject({
      method: "POST",
      url: "/api/sales",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        branch: station.branch,
        outlet: station.outlet,
        taxRate: 0,
        items: [
          {
            product: String(product._id),
            name: product.name,
            qty: 1,
            price: product.price,
          },
        ],
        paymentMethod: "Cash",
      },
    });
  let r = await buy(fuel);
  assert.equal(r.statusCode, 409, r.body);
  assert.equal((await Product.findById(fuel._id)).qty, 100);
  r = await buy(tyre);
  assert.equal(r.statusCode, 201, r.body);
  assert.equal((await Product.findById(tyre._id)).qty, 9);
});
test("cutover refuses in-flight legacy writes and succeeds after they drain", async () => {
  const outlet = await Outlet.create({
    branch: station.branch,
    name: "TEST ONLY CUTOVER",
    code: "TEST-CUTOVER",
    division: "fuel",
    runs24Hours: true,
    fuelLegacyWrites: 1,
  });
  const body = {
    outlet: String(outlet._id),
    code: "TEST-CUTOVER",
    name: "TEST ONLY CUTOVER",
    timeZone: "Africa/Accra",
    confirmLegacyReviewed: true,
    reason: "TEST operator reviewed cutover",
  };
  const key = randomUUID();
  await req("/stations", body, 409, key);
  assert.equal((await Outlet.findById(outlet._id)).fuelCutoverAt, undefined);
  await Outlet.updateOne(
    { _id: outlet._id },
    { $set: { fuelLegacyWrites: 0 } },
  );
  await req("/stations", body, 200, key);
  assert.ok((await Outlet.findById(outlet._id)).fuelCutoverAt);
});
