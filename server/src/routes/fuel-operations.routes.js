import { groupedFuelReports } from "../fuel/reporting.js";
import mongoose from "mongoose";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import Outlet from "../models/Outlet.js";
import Customer from "../models/Customer.js";
import FuelShift from "../models/FuelShift.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import { availableSchedule } from "./workforce.routes.js";
import {
  models,
  Station,
  Tank,
  Nozzle,
  Price,
  Period,
  Company,
  Vehicle,
  Driver,
  FuelSale,
  Payment,
  Ledger,
  Movement,
  Dip,
  Audit,
  Connection,
  Inbox,
  Adjustment,
} from "../fuel/models.js";
import {
  fail,
  decimal,
  add,
  valueOf,
  display,
  permitted,
  businessClock,
  ageing,
} from "../fuel/domain.js";
import {
  create,
  number,
  scopeOf,
  scopeFilter,
  freshUser,
  authorisedStation,
  lockStation,
  atomic,
  audit,
  reason,
  text,
  evidence,
  journal,
  stock,
  lockPeriod,
  responsible,
  companyAccess,
  companyLock,
  ledger,
  currentPrice,
  meter,
  segment,
  calculate,
  postSale,
  allocate,
  reverseSale,
} from "../fuel/service.js";

export default async function fuelOperations(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    const clientError = [
      "ValidationError",
      "CastError",
      "StrictModeError",
    ].includes(error.name);
    const status = error.statusCode || (clientError ? 400 : 500);
    if (status >= 500)
      request.log.error({ err: error }, "Fuel operation failed");
    reply
      .code(status)
      .send({
        error:
          status >= 500 && status !== 503
            ? "Fuel operation failed; no posting was completed. Review the server log."
            : error.message,
      });
  });
  const prefix = "/api/fuel/operations";
  let schemaReady = true;
  if (process.env.NODE_ENV === "production") {
    for (const Model of Object.values(models)) {
      try {
        const actual = await Model.collection.indexes();
        for (const [keys, opts] of Model.schema.indexes())
          if (
            !actual.some(
              (index) =>
                JSON.stringify(index.key) === JSON.stringify(keys) &&
                (!opts.unique || index.unique) &&
                (!opts.partialFilterExpression ||
                  JSON.stringify(index.partialFilterExpression) ===
                    JSON.stringify(opts.partialFilterExpression)),
            )
          )
            schemaReady = false;
      } catch {
        schemaReady = false;
      }
    }
  }
  // This hook is encapsulated: retail, website and legacy authentication are unchanged.
  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith(prefix)) return;
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    request.user = await freshUser(request);
    if (request.method !== "GET")
      fail(
        schemaReady,
        "Fuel schema migration must complete before production writes are enabled",
        503,
      );
    reply.header("Cache-Control", "no-store");
  });
  const access = (permission) => async (request) =>
    fail(
      permitted(request.user, permission),
      `Permission required: ${permission}`,
      403,
    );
  function get(path, permission, fn) {
    fastify.get(prefix + path, { preHandler: access(permission) }, fn);
  }
  function post(path, permission, fn) {
    fastify.post(prefix + path, { preHandler: access(permission) }, (request) =>
      atomic(request, (session) => fn(request, session)),
    );
  }
  get("/bootstrap", "fuel.view", async (request) => {
    const stations = await Station.find(scopeFilter(request.user))
      .sort({ code: 1 })
      .lean();
    const outlets = await Outlet.find({
      division: "fuel",
      ...scopeFilter(request.user),
    }).lean();
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return {
      stations,
      outlets,
      schemaReady,
      permissions: Object.fromEntries(
        [
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
        ].map((p) => [p, permitted(request.user, p)]),
      ),
      transactionsSupported: Boolean(hello.setName || hello.msg === "isdbgrid"),
      serverTime: new Date(),
      hardwareControlEnabled: false,
    };
  });
  get("/stations/:id", "fuel.view", async (request) => {
    const station = await authorisedStation(request.user, request.params.id);
    const where = { station: station._id };
    const [tanks, nozzles, prices, periods, sales, movements, dips, payments] =
      await Promise.all([
        Tank.find(where).lean(),
        Nozzle.find(where).lean(),
        Price.find(where).sort({ effectiveAt: -1 }).lean(),
        Period.find(where).sort({ openedAt: -1 }).limit(100).lean(),
        FuelSale.find(where).sort({ transactionAt: -1 }).limit(200).lean(),
        Movement.find(where).sort({ at: -1 }).limit(200).lean(),
        Dip.find(where).sort({ at: -1 }).limit(100).lean(),
        Payment.find(where).sort({ receivedAt: -1 }).limit(100).lean(),
      ]);
    return {
      station,
      tanks,
      nozzles,
      prices,
      periods,
      sales,
      movements,
      dips,
      payments,
    };
  });
  get("/stations/:id/people", "fuel.view", async (r) => {
    const station = await authorisedStation(r.user, r.params.id);
    const filter = scopeFilter(r.user);
    const customers = await Customer.find({ ...filter, active: true })
      .select("name phone")
      .sort({ name: 1 })
      .limit(500)
      .lean();
    let attendants = [];
    if (permitted(r.user, "fuel.readings.approve"))
      attendants = await mongoose
        .model("User")
        .find({
          active: true,
          $or: [
            { branch: station.branch },
            { branches: station.branch },
            { outlets: station.outlet },
            { role: "super_admin" },
          ],
        })
        .select("name")
        .lean();
    return { customers, attendants };
  });
  post("/stations", "fuel.equipment.configure", async (r, s) => {
    const b = r.body;
    const outlet = await Outlet.findOne({
      _id: b.outlet,
      division: "fuel",
      ...scopeFilter(r.user),
    }).session(s);
    fail(outlet, "Assigned fuel outlet required", 404);
    fail(
      !(await Station.exists({ outlet: outlet._id }).session(s)),
      "This outlet already has a station",
      409,
    );
    const cutover = await Outlet.findOneAndUpdate(
      {
        _id: outlet._id,
        fuelCutoverAt: { $exists: false },
        $or: [
          { fuelLegacyWrites: 0 },
          { fuelLegacyWrites: { $exists: false } },
        ],
      },
      { $set: { fuelCutoverAt: new Date() } },
      { new: true, session: s },
    );
    fail(
      !(await FuelShift.exists({
        outlet: outlet._id,
        status: { $in: ["open", "submitted", "queried"] },
      }).session(s)),
      "Close and approve legacy fuel shifts before cutover",
      409,
    );
    fail(
      cutover,
      "A legacy fuel write is still in flight or this outlet has already cut over. Wait for the old requests to finish before retrying.",
      409,
    );
    reason(b);
    fail(
      b.confirmLegacyReviewed === true,
      "Confirm legacy fuel balances and shifts have been reviewed",
    );
    const timeZone = text(b.timeZone, true);
    new Intl.DateTimeFormat("en", { timeZone }).format();
    // Existing schedules are in Ghana time; do not reinterpret them under another timezone.
    if (
      await ShiftSchedule.exists({
        outlet: outlet._id,
        division: "fuel",
        active: true,
      }).session(s)
    )
      fail(
        timeZone === "Africa/Accra",
        "Existing fuel schedules use Africa/Accra; review schedules before changing timezone",
      );
    const station = await create(
      Station,
      {
        branch: outlet.branch,
        outlet: outlet._id,
        code: text(b.code, true).toUpperCase(),
        name: text(b.name, true),
        timeZone,
        cutoverAt: new Date(),
      },
      s,
    );
    await audit(
      s,
      r.user,
      "Station",
      "legacy_cutover",
      null,
      station,
      reason(b),
    );
    return station;
  });
  post("/stations/:id/configure", "fuel.equipment.configure", async (r, s) => {
    const station = await authorisedStation(r.user, r.params.id, s);
    await Station.updateOne(
      { _id: station._id },
      { $inc: { revision: 1 } },
      { session: s },
    );
    station.revision += 1;
    const before = station.toObject();
    fail(
      !(await Period.exists({ station: station._id, lockActive: true }).session(
        s,
      )),
      "Finish active periods before changing station status",
      409,
    );
    station.active = r.body.active === true;
    await station.save({ session: s });
    await audit(
      s,
      r.user,
      "Station",
      "status",
      before,
      station,
      reason(r.body),
    );
    return station;
  });
  post("/stations/:id/tanks", "fuel.equipment.configure", async (r, s) => {
    const station = await lockStation(r.user, r.params.id, s);
    const b = r.body;
    const tank = await create(
      Tank,
      {
        ...scopeOf(station),
        code: text(b.code, true).toUpperCase(),
        name: text(b.name, true),
        fuelType: text(b.fuelType, true),
        capacityMl: decimal(b.capacity, 3, { positive: true }),
        bookMl: 0,
        openingEstablished: false,
      },
      s,
    );
    await audit(s, r.user, "Tank", "configured", null, tank);
    return tank;
  });
  post("/tanks/:id/configure", "fuel.equipment.configure", async (r, s) => {
    const tank = await Tank.findById(r.params.id).session(s);
    fail(tank, "Tank not found", 404);
    await lockStation(r.user, tank.station, s);
    fail(
      !(await Period.exists({ tank: tank._id, lockActive: true }).session(s)),
      "Finish active tank periods before reconfiguration",
      409,
    );
    const before = tank.toObject();
    if (r.body.active != null) {
      if (r.body.active === false)
        fail(
          !(await Nozzle.exists({ tank: tank._id, active: true }).session(s)),
          "Deactivate linked nozzles before deactivating a tank",
          409,
        );
      tank.active = r.body.active === true;
    }
    if (r.body.capacity != null) {
      const capacity = decimal(r.body.capacity, 3, { positive: true });
      fail(
        capacity >= tank.bookMl,
        "Capacity cannot be below calculated stock",
      );
      tank.capacityMl = capacity;
    }
    if (r.body.name != null) tank.name = text(r.body.name, true);
    await tank.save({ session: s });
    await audit(s, r.user, "Tank", "configured", before, tank, reason(r.body));
    return tank;
  });
  post("/stations/:id/nozzles", "fuel.equipment.configure", async (r, s) => {
    const station = await lockStation(r.user, r.params.id, s);
    const b = r.body;
    const tank = await Tank.findOne({
      _id: b.tank,
      station: station._id,
      active: true,
    }).session(s);
    fail(tank, "Active tank required");
    const precision = Number(b.meterPrecision);
    fail(
      Number.isInteger(precision) && precision >= 0 && precision <= 3,
      "Meter precision must be 0–3",
    );
    const nozzle = await create(
      Nozzle,
      {
        ...scopeOf(station),
        pumpCode: text(b.pumpCode, true).toUpperCase(),
        code: text(b.code, true).toUpperCase(),
        tank: tank._id,
        fuelType: tank.fuelType,
        meterPrecision: precision,
        rolloverMl: b.rollover
          ? decimal(b.rollover, 3, { positive: true })
          : undefined,
      },
      s,
    );
    await audit(s, r.user, "Nozzle", "configured", null, nozzle);
    return nozzle;
  });
  post("/nozzles/:id/configure", "fuel.equipment.configure", async (r, s) => {
    const nozzle = await Nozzle.findById(r.params.id).session(s);
    fail(nozzle, "Nozzle not found", 404);
    await lockStation(r.user, nozzle.station, s);
    fail(
      !(await Period.exists({ nozzle: nozzle._id, lockActive: true }).session(
        s,
      )),
      "Finish nozzle periods before reconfiguration",
      409,
    );
    const before = nozzle.toObject();
    if (r.body.tank) {
      const tank = await Tank.findOne({
        _id: r.body.tank,
        station: nozzle.station,
        active: true,
      }).session(s);
      fail(tank, "Tank not found");
      nozzle.tank = tank._id;
      nozzle.fuelType = tank.fuelType;
    }
    if (r.body.active != null) nozzle.active = r.body.active === true;
    await nozzle.save({ session: s });
    await audit(
      s,
      r.user,
      "Nozzle",
      "mapping_or_status",
      before,
      nozzle,
      reason(r.body),
    );
    return nozzle;
  });
  post("/nozzles/:id/meter-event", "fuel.readings.approve", async (r, s) => {
    const nozzle = await Nozzle.findById(r.params.id).session(s);
    fail(nozzle, "Nozzle not found", 404);
    await lockStation(r.user, nozzle.station, s);
    fail(
      !(await Period.exists({ nozzle: nozzle._id, lockActive: true }).session(
        s,
      )),
      "Post the old meter period before reset/replacement/correction",
      409,
    );
    const b = r.body;
    fail(
      ["baseline", "reset", "replacement", "correction"].includes(b.kind),
      "Select a meter event type",
    );
    fail(
      b.kind !== "baseline" || nozzle.baselineMl == null,
      "Baseline already exists",
      409,
    );
    const before = nozzle.toObject();
    nozzle.lastClosingMl = meter(b.reading, nozzle);
    nozzle.baselineMl = nozzle.lastClosingMl;
    nozzle.lastClosingAt = new Date();
    await nozzle.save({ session: s });
    await audit(s, r.user, "Nozzle", b.kind, before, nozzle, reason(b));
    return nozzle;
  });
  post("/stations/:id/prices", "fuel.equipment.configure", async (r, s) => {
    const station = await lockStation(r.user, r.params.id, s);
    const b = r.body;
    const now = new Date();
    const fuelType = text(b.fuelType, true);
    const priceUnits = decimal(b.price, 4, { positive: true });
    const periods = await Period.find({
      station: station._id,
      fuelType,
      lockActive: true,
    }).session(s);
    for (const period of periods) {
      fail(
        period.status === "draft" && !period.closedAt,
        "Approve/post closed periods before a price change",
        409,
      );
      const reading = b.boundaries?.find(
        (x) => String(x.period) === String(period._id),
      );
      fail(reading, `Boundary reading required for ${period.number}`, 409);
      const nozzle = await Nozzle.findById(period.nozzle).session(s);
      await segment(s, period, meter(reading.reading, nozzle), now);
      period.currentPrice = priceUnits;
      await period.save({ session: s });
      await audit(
        s,
        r.user,
        "Period",
        "price_boundary",
        null,
        period,
        reason(b),
      );
    }
    const price = await create(
      Price,
      {
        ...scopeOf(station),
        fuelType,
        priceUnits,
        effectiveAt: now,
        createdBy: r.user.id,
      },
      s,
    );
    await audit(s, r.user, "Price", "effective_price", null, price, reason(b));
    return price;
  });
  post("/periods", "fuel.readings.enter", async (r, s) => {
    const b = r.body;
    const nozzle = await Nozzle.findById(b.nozzle).session(s);
    fail(nozzle?.active, "Active nozzle required");
    const station = await lockStation(r.user, nozzle.station, s);
    const now = new Date();
    fail(
      await Tank.exists({
        _id: nozzle.tank,
        active: true,
        openingEstablished: true,
      }).session(s),
      "Active tank with reviewed opening stock required",
      409,
    );
    fail(
      nozzle.lastClosingMl != null,
      "Supervisor must establish a genuine baseline reading",
      409,
    );
    fail(
      !(await Period.exists({ nozzle: nozzle._id, lockActive: true }).session(
        s,
      )),
      "Nozzle has an unfinished meter period",
      409,
    );
    const count = await ShiftSchedule.countDocuments({
      outlet: station.outlet,
      division: "fuel",
      active: true,
    }).session(s);
    const schedule = count
      ? await availableSchedule(r.user, "fuel", station.outlet)
      : null;
    fail(
      !count || schedule,
      "No scheduled fuel shift is available for this attendant",
      409,
    );
    const clock = businessClock(now, station.timeZone, schedule);
    const outlet = await Outlet.findById(station.outlet).session(s);
    fail(
      clock.workShift !== "night" || outlet.runs24Hours,
      "Outlet is not configured for night operation",
      409,
    );
    const reading = meter(b.opening, nozzle);
    fail(
      reading === nozzle.lastClosingMl,
      "Opening differs from the last approved closing. Supervisor must record a correction with a reason.",
      409,
    );
    fail(
      !nozzle.lastClosingAt || now >= nozzle.lastClosingAt,
      "Reading time overlaps the prior approved reading",
      409,
    );
    fail(
      ["individual", "summary"].includes(b.mode),
      "Select an explicit operating mode",
    );
    const period = await create(
      Period,
      {
        ...scopeOf(station),
        number: number("FP"),
        nozzle: nozzle._id,
        tank: nozzle.tank,
        pumpCode: nozzle.pumpCode,
        nozzleCode: nozzle.code,
        fuelType: nozzle.fuelType,
        attendant: r.user.id,
        schedule: schedule?._id,
        ...clock,
        mode: b.mode,
        openingMl: reading,
        segmentStartMl: reading,
        currentPrice: await currentPrice(station._id, nozzle.fuelType, s),
        segmentStartAt: now,
        openedAt: now,
        entryAt: now,
        previousClosingAt: nozzle.lastClosingAt,
        openingGapMs: nozzle.lastClosingAt ? +now - +nozzle.lastClosingAt : 0,
        openingEvidence: evidence(b.photo),
        segments: [],
        handovers: [],
      },
      s,
    );
    await audit(s, r.user, "Period", "opened", null, period, text(b.reason));
    return period;
  });
  post("/periods/:id/handover", "fuel.readings.approve", async (r, s) => {
    const { period, station } = await lockPeriod(r.user, r.params.id, s);
    fail(!period.closedAt, "Period is closed", 409);
    const User = mongoose.model("User");
    const next = await User.findById(r.body.attendant).session(s);
    fail(next?.active, "Active attendant required");
    const ids = [next.branch, ...(next.branches || [])].map(String);
    fail(
      next.role === "super_admin" ||
        (ids.includes(String(station.branch)) &&
          (!next.outlets?.length ||
            next.outlets.map(String).includes(String(station.outlet)))),
      "Next attendant must be assigned to this station",
    );
    const nozzle = await Nozzle.findById(period.nozzle).session(s);
    const reading = meter(r.body.reading, nozzle);
    const now = new Date();
    await segment(s, period, reading, now);
    period.handovers.push({
      from: period.attendant,
      to: next._id,
      readingMl: reading,
      at: now,
      reason: reason(r.body),
      supervisor: r.user.id,
    });
    period.attendant = next._id;
    await period.save({ session: s });
    await audit(s, r.user, "Period", "handover", null, period, reason(r.body));
    return period;
  });
  post("/periods/:id/mode", "fuel.readings.approve", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s);
    fail(
      !period.closedAt &&
        !period.segments.length &&
        !(await FuelSale.exists({ period: period._id }).session(s)),
      "Mode is locked once activity exists; finish this period and start another",
      409,
    );
    fail(
      ["individual", "summary"].includes(r.body.mode),
      "Invalid operating mode",
    );
    const before = period.toObject();
    period.mode = r.body.mode;
    await period.save({ session: s });
    await audit(
      s,
      r.user,
      "Period",
      "mode_change",
      before,
      period,
      reason(r.body),
    );
    return period;
  });
  post("/periods/:id/non-sale", "fuel.readings.enter", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s);
    responsible(r.user, period);
    fail(!period.closedAt, "Period is closed", 409);
    fail(
      ["calibration", "non_sale"].includes(r.body.kind),
      "Select calibration or non_sale",
    );
    const movement = await create(
      Movement,
      {
        ...scopeOf(period),
        tank: period.tank,
        period: period._id,
        kind: r.body.kind,
        litresMl: decimal(r.body.litres, 3, { positive: true }),
        stockDeltaMl: 0,
        segmentIndex: period.segments.length,
        status: "pending",
        reason: reason(r.body),
        at: new Date(),
        user: r.user.id,
        reference: text(r.body.reference),
      },
      s,
    );
    await audit(
      s,
      r.user,
      "Movement",
      "non_sale_requested",
      null,
      movement,
      reason(r.body),
    );
    return movement;
  });
  post("/movements/:id/approve", "fuel.readings.approve", async (r, s) => {
    const movement = await Movement.findById(r.params.id).session(s);
    fail(movement?.status === "pending", "Pending movement not found", 404);
    await lockPeriod(r.user, movement.period, s);
    movement.status = "approved";
    movement.approvedBy = r.user.id;
    await movement.save({ session: s });
    await audit(
      s,
      r.user,
      "Movement",
      "approved",
      null,
      movement,
      reason(r.body),
    );
    return movement;
  });
  post("/periods/:id/close", "fuel.readings.enter", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s);
    responsible(r.user, period);
    fail(!period.closedAt, "Closing already recorded", 409);
    const nozzle = await Nozzle.findById(period.nozzle).session(s);
    const closing = meter(r.body.closing, nozzle);
    if (r.body.rollover) {
      fail(
        permitted(r.user, "fuel.readings.approve"),
        "Supervisor approval required for rollover",
        403,
      );
      reason(r.body);
    }
    const now = new Date();
    await segment(
      s,
      period,
      closing,
      now,
      r.body.rollover === true,
      r.body.reason,
    );
    period.closingMl = closing;
    period.closedAt = now;
    period.closingEntryAt = new Date();
    period.closingEvidence = evidence(r.body.photo);
    period.collections = Object.fromEntries(
      ["cash", "momo", "card"].map((k) => {
        fail(
          r.body.collections?.[k] != null,
          `Actual ${k} collection total is required`,
        );
        return [k, decimal(r.body.collections[k])];
      }),
    );
    period.reconciliation = await calculate(s, period);
    await period.save({ session: s });
    await audit(
      s,
      r.user,
      "Period",
      "closing_reading",
      null,
      period,
      text(r.body.reason),
    );
    return period;
  });
  post("/periods/:id/reopen", "fuel.readings.approve", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s, [
      "draft",
      "submitted",
      "approved",
    ]);
    fail(period.closedAt, "No closing reading to correct", 409);
    const before = period.toObject();
    const last = period.segments.pop();
    period.segmentStartMl = last.openingMl;
    period.segmentStartAt = last.startAt;
    period.closedAt = undefined;
    period.closingEntryAt = undefined;
    period.closingMl = undefined;
    period.collections = undefined;
    period.status = "draft";
    period.approvedAt = undefined;
    period.approvedBy = undefined;
    period.reconciliation = undefined;
    await period.save({ session: s });
    await audit(
      s,
      r.user,
      "Period",
      "closing_correction",
      before,
      period,
      reason(r.body),
    );
    return period;
  });
  post("/periods/:id/submit", "fuel.readings.enter", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s);
    responsible(r.user, period);
    fail(period.closedAt, "Close readings first", 409);
    period.reconciliation = await calculate(s, period);
    fail(
      !period.reconciliation.flags.some((x) => x !== "Collection variance"),
      period.reconciliation.flags.join("; "),
      409,
    );
    period.status = "submitted";
    await period.save({ session: s });
    await audit(s, r.user, "Period", "submitted", null, period);
    return period;
  });
  post("/periods/:id/approve", "fuel.readings.approve", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s, ["submitted"]);
    period.reconciliation = await calculate(s, period);
    fail(
      !period.reconciliation.flags.some((x) => x !== "Collection variance"),
      "Resolve meter/approval flags before approval",
      409,
    );
    if (period.reconciliation.moneyVarianceCents)
      period.reason = reason(r.body);
    period.status = "approved";
    period.approvedBy = r.user.id;
    period.approvedAt = new Date();
    // Approved closing becomes next baseline, but a new period remains blocked until posting.
    await Nozzle.updateOne(
      { _id: period.nozzle },
      {
        $set: {
          lastClosingMl: period.closingMl,
          lastClosingAt: period.closedAt,
          lastPeriod: period._id,
        },
      },
      { session: s },
    );
    await period.save({ session: s });
    await audit(
      s,
      r.user,
      "Period",
      "approved",
      null,
      period,
      text(r.body.reason),
    );
    return period;
  });
  post("/periods/:id/post", "fuel.periods.post", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s, ["approved"]);
    const calc = await calculate(s, period);
    fail(
      !calc.flags.some((x) => x !== "Collection variance"),
      "Reconciliation has unresolved flags",
      409,
    );
    if (calc.moneyVarianceCents) reason(r.body);
    // Sales posted earlier already recognised revenue and, in individual mode, stock.
    if (period.mode === "summary" && calc.derivedValueCents)
      await journal(
        s,
        r.user,
        period,
        `Derived walk-in sales ${period.number}`,
        [
          {
            accountCode: "1000",
            accountName: "Cash and payment clearing",
            debit: calc.derivedValueCents,
          },
          {
            accountCode: "4100",
            accountName: "Fuel sales",
            credit: calc.derivedValueCents,
          },
        ],
      );
    const physicallyDeducted =
      period.mode === "individual"
        ? (
            await FuelSale.find({
              period: period._id,
              reversalStockCorrection: { $ne: true },
            }).session(s)
          ).reduce((n, sale) => add(n, sale.litresMl), 0)
        : 0;
    const remainingStockMl = calc.grossMl - physicallyDeducted;
    fail(
      remainingStockMl >= 0,
      "Stock deductions exceed gross metered dispensing",
      409,
    );
    if (remainingStockMl)
      await stock(
        s,
        r.user,
        period,
        period.tank,
        -remainingStockMl,
        "period_dispensing",
        period.number,
      );
    const variance = calc.moneyVarianceCents;
    if (variance)
      await journal(
        s,
        r.user,
        period,
        `Collection variance ${period.number}`,
        variance < 0
          ? [
              {
                accountCode: "6190",
                accountName: "Fuel collection shortage",
                debit: -variance,
              },
              {
                accountCode: "1000",
                accountName: "Cash and payment clearing",
                credit: -variance,
              },
            ]
          : [
              {
                accountCode: "1000",
                accountName: "Cash and payment clearing",
                debit: variance,
              },
              {
                accountCode: "4190",
                accountName: "Fuel collection overage",
                credit: variance,
              },
            ],
        "manual",
      );
    period.status = "posted";
    period.lockActive = false;
    period.postedAt = new Date();
    period.postedBy = r.user.id;
    period.reconciliation = calc;
    await period.save({ session: s });
    await audit(
      s,
      r.user,
      "Period",
      "posted",
      null,
      period,
      text(r.body.reason),
    );
    return period;
  });
  post("/imports", "fuel.equipment.configure", (r, s) => {
    fail(
      permitted(r.user, "fuel.sales.record"),
      "Fuel sale recording permission is also required",
      403,
    );
    return postSale(s, r.user, r.body, "import");
  });
  post("/sales", "fuel.sales.record", (r, s) => {
    fail(
      !r.body.source || r.body.source === "manual",
      "Controller/import data requires the authenticated adapter workflow",
    );
    return postSale(s, r.user, r.body);
  });
  post("/sales/:id/reverse", "fuel.records.reverse", async (r, s) => {
    const sale = await FuelSale.findById(r.params.id).session(s);
    fail(sale, "Sale not found", 404);
    return reverseSale(
      s,
      r.user,
      sale,
      reason(r.body),
      r.body.entryError === true,
    );
  });
  post("/periods/:id/reverse", "fuel.records.reverse", async (r, s) => {
    const { period } = await lockPeriod(r.user, r.params.id, s, ["posted"]);
    const why = reason(r.body);
    fail(
      !(await Period.exists({
        nozzle: period.nozzle,
        openedAt: { $gt: period.openedAt },
      }).session(s)),
      "Later meter history exists. Use an account/stock adjustment instead of reversing this period.",
      409,
    );
    // Reverses journals only; physical stock and meter evidence remain. Reposting the same fuel is prohibited.
    const Journal = mongoose.model("JournalEntry");
    const entries = await Journal.find({
      sourceId: period._id,
      status: "posted",
    }).session(s);
    for (const entry of entries) {
      const lines = entry.lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: decimal(String(l.credit)),
        credit: decimal(String(l.debit)),
      }));
      const reversal = await journal(
        s,
        r.user,
        period,
        `Period reversal ${period.number}: ${why}`,
        lines,
        "reversal",
      );
      entry.status = "reversed";
      entry.reversedBy = reversal._id;
      await entry.save({ session: s });
    }
    period.status = "reversed";
    await period.save({ session: s });
    await audit(s, r.user, "Period", "financial_reversal", null, period, why);
    return period;
  });
  get("/companies", "fuel.view", async (r) => {
    const stations = await Station.find(scopeFilter(r.user)).distinct("_id");
    if (r.query.station) await authorisedStation(r.user, r.query.station);
    const filter =
      permitted(r.user, "fuel.reports.company") && !r.query.station
        ? {}
        : { stations: r.query.station || { $in: stations } };
    const companies = await Company.find(filter)
      .sort({ name: 1 })
      .limit(500)
      .lean();
    // Exposure is global for a company even when buying at an assigned station; invoice details remain scoped.
    return companies.map((c) => ({
      ...c,
      availableCents: Math.max(0, c.limitCents - c.debtCents),
    }));
  });
  post("/companies", "fuel.accounts.adjust", async (r, s) => {
    const b = r.body;
    fail(b.stations?.length, "Select at least one permitted station");
    for (const id of b.stations) await authorisedStation(r.user, id, s);
    if (b.customer)
      fail(
        await Customer.exists({
          _id: b.customer,
          ...scopeFilter(r.user),
        }).session(s),
        "Existing customer is outside your assignment",
      );
    const termsDays = Number(b.termsDays);
    fail(
      Number.isInteger(termsDays) && termsDays >= 0 && termsDays <= 365,
      "Payment terms must be 0–365 days",
    );
    const company = await create(
      Company,
      {
        accountCode: text(b.accountCode, true).toUpperCase(),
        name: text(b.name, true),
        customer: b.customer || undefined,
        contact: text(b.contact),
        phone: text(b.phone),
        address: text(b.address),
        billingDetails: text(b.billingDetails),
        termsDays,
        limitCents: decimal(b.creditLimit),
        stations: b.stations,
        fuelTypes: b.fuelTypes.map((x) => text(x, true)),
        overdueBlock: b.overdueBlock !== false,
        requireVehicle: b.requireVehicle === true,
        requireDriver: b.requireDriver === true,
        requireAuthorisation: b.requireAuthorisation === true,
      },
      s,
    );
    await audit(
      s,
      r.user,
      "Company",
      "created_zero_fuel_balance",
      null,
      company,
      reason(b),
    );
    return company;
  });
  post("/companies/:id/configure", "fuel.accounts.adjust", async (r, s) => {
    const company = await companyAccess(r.user, r.params.id, r.body.station, s);
    for (const id of company.stations) await authorisedStation(r.user, id, s);
    await companyLock(company, s);
    const before = company.toObject();
    const b = r.body;
    if (b.creditLimit != null) company.limitCents = decimal(b.creditLimit);
    if (b.status != null) {
      fail(
        ["active", "suspended", "closed"].includes(b.status),
        "Invalid account status",
      );
      fail(
        b.status !== "closed" || (!company.debtCents && !company.advanceCents),
        "Settle debt and advance balances before closing",
      );
      company.status = b.status;
    }
    for (const k of ["contact", "phone", "address", "billingDetails"])
      if (b[k] != null) company[k] = text(b[k]);
    for (const k of [
      "overdueBlock",
      "requireVehicle",
      "requireDriver",
      "requireAuthorisation",
    ])
      if (b[k] != null) company[k] = b[k] === true;
    if (b.stations) {
      fail(b.stations.length, "At least one station required");
      for (const id of b.stations) await authorisedStation(r.user, id, s);
      company.stations = b.stations;
    }
    if (b.fuelTypes) company.fuelTypes = b.fuelTypes.map((x) => text(x, true));
    if (b.termsDays != null) {
      fail(
        Number.isInteger(+b.termsDays) &&
          +b.termsDays >= 0 &&
          +b.termsDays <= 365,
        "Invalid terms",
      );
      company.termsDays = +b.termsDays;
    }
    await company.save({ session: s });
    await audit(s, r.user, "Company", "configured", before, company, reason(b));
    return company;
  });
  post(
    "/companies/:id/vehicle-policy",
    "fuel.accounts.adjust",
    async (r, s) => {
      const company = await companyAccess(
        r.user,
        r.params.id,
        r.body.station,
        s,
      );
      await companyLock(company, s);
      const vehicle = await Vehicle.findOne({
        _id: r.body.vehicle,
        company: company._id,
      }).session(s);
      fail(vehicle, "Vehicle not found");
      const before = vehicle.toObject();
      vehicle.active = r.body.active === true;
      vehicle.dailyMl = r.body.dailyLitres
        ? decimal(r.body.dailyLitres, 3, { positive: true })
        : undefined;
      vehicle.dailyCents = r.body.dailySpend
        ? decimal(r.body.dailySpend, 2, { positive: true })
        : undefined;
      await vehicle.save({ session: s });
      await audit(
        s,
        r.user,
        "Vehicle",
        "policy_changed",
        before,
        vehicle,
        reason(r.body),
      );
      return vehicle;
    },
  );
  post("/companies/:id/driver-policy", "fuel.accounts.adjust", async (r, s) => {
    const company = await companyAccess(r.user, r.params.id, r.body.station, s);
    const driver = await Driver.findOne({
      _id: r.body.driver,
      company: company._id,
    }).session(s);
    fail(driver, "Driver not found");
    const before = driver.toObject();
    driver.active = r.body.active === true;
    await driver.save({ session: s });
    await audit(
      s,
      r.user,
      "Driver",
      "status_changed",
      before,
      driver,
      reason(r.body),
    );
    return driver;
  });
  get("/companies/:id/statement", "fuel.view", async (r) => {
    const company = await companyAccess(r.user, r.params.id, r.query.station);
    const full = permitted(r.user, "fuel.reports.company");
    const scope = full ? {} : scopeFilter(r.user);
    const [
      invoices,
      payments,
      entries,
      vehicles,
      drivers,
      legacy,
      adjustments,
    ] = await Promise.all([
      FuelSale.find({ company: company._id, ...scope })
        .sort({ transactionAt: 1 })
        .lean(),
      Payment.find({ company: company._id, ...scope })
        .sort({ receivedAt: 1 })
        .lean(),
      Ledger.find({ company: company._id, ...scope })
        .sort({ at: 1 })
        .lean(),
      Vehicle.find({ company: company._id }).lean(),
      Driver.find({ company: company._id }).lean(),
      company.customer
        ? Customer.findById(company.customer).select("name balance").lean()
        : null,
      Adjustment.find({ company: company._id, ...scope })
        .sort({ at: 1 })
        .lean(),
    ]);
    const due = await FuelSale.find({
      company: company._id,
      status: "posted",
      dueCents: { $gt: 0 },
    }).lean();
    return {
      company,
      invoices,
      payments,
      entries,
      vehicles,
      drivers,
      legacyCustomerBalance: legacy?.balance,
      legacyBalanceIncludedInFuel: false,
      scope: full
        ? "Company-wide"
        : "Assigned locations; global exposure shown separately",
      balanceDueCents: company.debtCents,
      advanceCreditCents: company.advanceCents,
      availableCents: Math.max(0, company.limitCents - company.debtCents),
      adjustments,
      ageing: ageing([
        ...due,
        ...(await Adjustment.find({
          company: company._id,
          dueCents: { $gt: 0 },
        }).lean()),
      ]),
    };
  });
  post("/companies/:id/vehicles", "fuel.accounts.adjust", async (r, s) => {
    const company = await companyAccess(r.user, r.params.id, r.body.station, s);
    await companyLock(company, s);
    const vehicle = await create(
      Vehicle,
      {
        company: company._id,
        registration: text(r.body.registration, true).toUpperCase(),
        dailyMl: r.body.dailyLitres
          ? decimal(r.body.dailyLitres, 3, { positive: true })
          : undefined,
        dailyCents: r.body.dailySpend
          ? decimal(r.body.dailySpend, 2, { positive: true })
          : undefined,
      },
      s,
    );
    await audit(s, r.user, "Vehicle", "authorised", null, vehicle);
    return vehicle;
  });
  post("/companies/:id/drivers", "fuel.accounts.adjust", async (r, s) => {
    const company = await companyAccess(r.user, r.params.id, r.body.station, s);
    const driver = await create(
      Driver,
      {
        company: company._id,
        name: text(r.body.name, true),
        phone: text(r.body.phone),
      },
      s,
    );
    await audit(s, r.user, "Driver", "authorised", null, driver);
    return driver;
  });
  post("/companies/:id/payments", "fuel.payments.receive", async (r, s) => {
    const b = r.body;
    const station = await lockStation(r.user, b.station, s);
    const company = await companyAccess(r.user, r.params.id, station._id, s);
    await companyLock(company, s);
    fail(company.status !== "closed", "Account is closed");
    const amountCents = decimal(b.amount, 2, { positive: true });
    fail(
      ["cash", "momo", "card", "bank", "cheque"].includes(b.method),
      "Select payment method",
    );
    const payment = await create(
      Payment,
      {
        ...scopeOf(station),
        number: number("FPR"),
        company: company._id,
        amountCents,
        method: b.method,
        reference: text(b.reference),
        receivedAt: new Date(),
        entryAt: new Date(),
        receivedBy: r.user.id,
        unappliedCents: amountCents,
        allocations: [],
      },
      s,
    );
    company.advanceCents = add(company.advanceCents, amountCents);
    await company.save({ session: s });
    await ledger(
      s,
      r.user,
      payment,
      company,
      "On-account Receipt",
      0,
      0,
      amountCents,
    );
    await journal(
      s,
      r.user,
      payment,
      `Fuel payment ${payment.number}`,
      [
        {
          accountCode: "1000",
          accountName: "Cash and payment clearing",
          debit: amountCents,
        },
        {
          accountCode: "2105",
          accountName: "Fuel customer advances",
          credit: amountCents,
        },
      ],
      "payment",
    );
    await allocate(s, r.user, company, payment, b);
    await audit(s, r.user, "Payment", "received", null, payment);
    return payment;
  });
  post("/payments/:id/allocate", "fuel.payments.receive", async (r, s) => {
    const payment = await Payment.findById(r.params.id).session(s);
    fail(payment?.status === "posted", "Receipt not found");
    await lockStation(r.user, payment.station, s);
    const company = await companyAccess(
      r.user,
      payment.company,
      payment.station,
      s,
    );
    await companyLock(company, s);
    const before = payment.toObject();
    await allocate(s, r.user, company, payment, r.body);
    await audit(
      s,
      r.user,
      "Payment",
      "allocation",
      before,
      payment,
      reason(r.body),
    );
    return payment;
  });
  post("/companies/:id/adjustments", "fuel.accounts.adjust", async (r, s) => {
    const b = r.body;
    const station = await lockStation(r.user, b.station, s);
    const company = await companyAccess(r.user, r.params.id, station._id, s);
    await companyLock(company, s);
    const why = reason(b);
    fail(
      ["opening_debt", "debit", "credit_note"].includes(b.kind),
      "Select an adjustment type",
    );
    const amountCents = decimal(b.amount, 2, { positive: true });
    const dueAt = new Date(b.dueAt);
    fail(!Number.isNaN(+dueAt), "A due date is required");
    if (b.kind === "opening_debt" && company.customer) {
      const legacy = await Customer.findById(company.customer).session(s);
      fail(
        !legacy?.balance,
        "This linked customer has a legacy balance. Keep it separate; an invoice-by-invoice migration and accounting reclassification must be reviewed before bringing it into the fuel ledger.",
        409,
      );
    }
    if (b.kind === "opening_debt") {
      fail(
        b.confirmReviewed === true,
        "Reviewed opening balance confirmation required",
      );
      fail(
        !(await Ledger.exists({ company: company._id }).session(s)),
        "Opening balance requires an unused fuel account",
        409,
      );
    }
    let invoice;
    if (b.kind === "credit_note") {
      invoice = await FuelSale.findOne({
        _id: b.invoice,
        company: company._id,
        station: station._id,
        status: "posted",
      }).session(s);
      fail(
        invoice && amountCents <= invoice.dueCents,
        "Credit note must reference an outstanding invoice and cannot exceed its balance",
      );
      invoice.dueCents -= amountCents;
      await invoice.save({ session: s });
      company.debtCents -= amountCents;
    } else company.debtCents = add(company.debtCents, amountCents);
    const adjustment = await create(
      Adjustment,
      {
        ...scopeOf(station),
        company: company._id,
        number: number("FA"),
        kind: b.kind,
        amountCents,
        dueCents: invoice ? 0 : amountCents,
        dueAt,
        reference: text(b.reference, true),
        reason: why,
        user: r.user.id,
        at: new Date(),
        invoice: invoice?._id,
      },
      s,
    );
    await company.save({ session: s });
    await ledger(
      s,
      r.user,
      adjustment,
      company,
      invoice ? "Credit Notes" : "Debit Adjustments",
      invoice ? 0 : amountCents,
      invoice ? amountCents : 0,
      0,
      why,
    );
    await journal(
      s,
      r.user,
      adjustment,
      `${b.kind}: ${why}`,
      invoice
        ? [
            {
              accountCode: "4105",
              accountName: "Fuel credit notes",
              debit: amountCents,
            },
            {
              accountCode: "1100",
              accountName: "Accounts receivable",
              credit: amountCents,
            },
          ]
        : [
            {
              accountCode: "1100",
              accountName: "Accounts receivable",
              debit: amountCents,
            },
            {
              accountCode: "3990",
              accountName: "Reviewed fuel opening and adjustment clearing",
              credit: amountCents,
            },
          ],
      "manual",
    );
    await audit(s, r.user, "Adjustment", b.kind, null, adjustment, why);
    return adjustment;
  });
  post("/payments/:id/reverse", "fuel.records.reverse", async (r, s) => {
    const payment = await Payment.findById(r.params.id).session(s);
    fail(payment?.status === "posted", "Posted payment required");
    await lockStation(r.user, payment.station, s);
    const company = await companyAccess(
      r.user,
      payment.company,
      payment.station,
      s,
    );
    await companyLock(company, s);
    const why = reason(r.body);
    fail(
      !payment.allocations.some((a) => a.kind === "prepaid" && !a.reversedAt),
      "Reverse linked prepaid purchases before reversing this receipt",
      409,
    );
    let restored = 0;
    for (const allocation of payment.allocations) {
      if (allocation.reversedAt) continue;
      const inv = await (
        allocation.kind === "adjustment" ? Adjustment : FuelSale
      )
        .findById(allocation.invoice)
        .session(s);
      fail(inv, "Allocated invoice missing");
      await authorisedStation(r.user, inv.station, s);
      inv.dueCents = add(inv.dueCents, allocation.amountCents);
      await inv.save({ session: s });
      restored = add(restored, allocation.amountCents);
      allocation.reversedAt = new Date();
    }
    company.debtCents = add(company.debtCents, restored);
    company.advanceCents = add(company.advanceCents, -payment.unappliedCents);
    fail(company.advanceCents >= 0, "Advance balance already consumed");
    await company.save({ session: s });
    await ledger(
      s,
      r.user,
      payment,
      company,
      "Payment Reversal",
      restored,
      0,
      -payment.unappliedCents,
      why,
    );
    await journal(
      s,
      r.user,
      payment,
      `Payment reversal ${payment.number}`,
      [
        {
          accountCode: "1100",
          accountName: "Accounts receivable",
          debit: restored,
        },
        {
          accountCode: "2105",
          accountName: "Fuel customer advances",
          debit: payment.unappliedCents,
        },
        {
          accountCode: "1000",
          accountName: "Cash and payment clearing",
          credit: payment.amountCents,
        },
      ],
      "reversal",
    );
    payment.markModified("allocations");
    payment.status = "reversed";
    payment.unappliedCents = 0;
    await payment.save({ session: s });
    await audit(s, r.user, "Payment", "reversed", null, payment, why);
    return payment;
  });
  post("/stations/:id/stock", "fuel.stock.manage", async (r, s) => {
    const station = await lockStation(r.user, r.params.id, s);
    const b = r.body;
    const tank = await Tank.findOne({
      _id: b.tank,
      station: station._id,
    }).session(s);
    fail(tank, "Tank not found");
    const why = reason(b);
    fail(
      ["opening", "delivery", "transfer", "return", "adjustment"].includes(
        b.kind,
      ),
      "Invalid stock movement",
    );
    if (b.kind === "opening") {
      fail(
        !tank.openingEstablished &&
          !(await Movement.exists({ tank: tank._id }).session(s)),
        "Opening stock already established",
        409,
      );
      fail(
        b.confirmReviewed === true,
        "Confirm reviewed physical/legacy opening balance",
      );
      const litresMl = decimal(b.litres, 3);
      fail(litresMl <= tank.capacityMl, "Opening exceeds capacity");
      tank.bookMl = litresMl;
      tank.openingEstablished = true;
      await tank.save({ session: s });
      const movement = await create(
        Movement,
        {
          ...scopeOf(station),
          tank: tank._id,
          kind: "opening",
          litresMl,
          stockDeltaMl: litresMl,
          status: "posted",
          at: new Date(),
          user: r.user.id,
          reason: why,
          reference: text(b.reference),
        },
        s,
      );
      await audit(
        s,
        r.user,
        "Movement",
        "reviewed_opening",
        null,
        movement,
        why,
      );
      return movement;
    }
    let litresMl = decimal(b.litres, 3, { positive: true });
    let linked;
    if (b.kind === "return") {
      if (b.linkedSale) {
        linked = await FuelSale.findOne({
          _id: b.linkedSale,
          station: station._id,
          tank: tank._id,
        }).session(s);
        fail(linked, "Linked fuel sale not found");
        const previous = await Movement.find({
          linkedSale: linked._id,
          kind: "return",
        }).session(s);
        fail(
          add(litresMl, ...previous.map((m) => m.litresMl)) <= linked.litresMl,
          "Return exceeds dispensed litres",
        );
      } else {
        linked = await Movement.findOne({
          _id: b.linkedMovement,
          station: station._id,
          tank: tank._id,
          kind: { $in: ["calibration", "non_sale"] },
          status: "approved",
        }).session(s);
        fail(
          linked,
          "Return must link to an actual sale or approved non-sale dispensing",
        );
        const old = await Movement.find({
          linkedMovement: linked._id,
          kind: "return",
        }).session(s);
        fail(
          add(litresMl, ...old.map((m) => m.litresMl)) <= linked.litresMl,
          "Return exceeds dispensed litres",
        );
      }
      const period = await Period.findById(linked.period).session(s);
      fail(
        ["posted", "reversed"].includes(period.status),
        "Post the dispensing period before returning fuel to tank",
        409,
      );
    }
    if (b.kind === "adjustment") {
      fail(
        permitted(r.user, "fuel.accounts.adjust"),
        "Stock adjustments require fuel.accounts.adjust",
        403,
      );
      if (b.direction === "out") litresMl = -litresMl;
    }
    if (b.kind === "transfer") litresMl = -litresMl;
    const movement = await stock(
      s,
      r.user,
      station,
      tank._id,
      litresMl,
      b.kind,
      text(b.reference, true),
      why,
      b.linkedSale ? undefined : linked?._id,
    );
    if (b.kind === "return" && b.linkedSale) {
      movement.linkedSale = linked._id;
      await movement.save({ session: s });
    }
    if (b.kind === "transfer") {
      const target = await Tank.findById(b.targetTank).session(s);
      fail(
        target &&
          String(target._id) !== String(tank._id) &&
          target.fuelType === tank.fuelType,
        "Select another tank of the same fuel type",
      );
      const targetStation = await lockStation(r.user, target.station, s);
      await stock(
        s,
        r.user,
        targetStation,
        target._id,
        -litresMl,
        "transfer_in",
        movement.reference,
        why,
        movement._id,
      );
    }
    await audit(s, r.user, "Movement", "stock_posted", null, movement, why);
    return movement;
  });
  post("/stations/:id/dips", "fuel.readings.enter", async (r, s) => {
    const station = await lockStation(r.user, r.params.id, s);
    const tank = await Tank.findOne({
      _id: r.body.tank,
      station: station._id,
    }).session(s);
    fail(tank?.openingEstablished, "Tank opening stock required");
    fail(
      !(await Period.exists({ tank: tank._id, lockActive: true }).session(s)),
      "Post tank nozzle periods before comparing a physical dip with calculated stock",
      409,
    );
    const physicalMl = decimal(r.body.litres, 3);
    fail(physicalMl <= tank.capacityMl, "Dip exceeds tank capacity");
    const dip = await create(
      Dip,
      {
        ...scopeOf(station),
        tank: tank._id,
        physicalMl,
        calculatedMl: tank.bookMl,
        varianceMl: physicalMl - tank.bookMl,
        at: new Date(),
        user: r.user.id,
        evidence: evidence(r.body.photo),
      },
      s,
    );
    await audit(s, r.user, "Dip", "physical_measurement", null, dip);
    return dip;
  });
  get("/reports", "fuel.view", async (r) => {
    const station = r.query.station;
    if (station) await authorisedStation(r.user, station);
    else
      fail(
        permitted(r.user, "fuel.reports.company"),
        "Company-wide reports permission required",
        403,
      );
    const filter = { ...(station ? { station } : scopeFilter(r.user)) };
    for (const key of ["start", "end"])
      if (r.query[key])
        fail(
          /^\d{4}-\d{2}-\d{2}$/.test(r.query[key]),
          "Report dates must use YYYY-MM-DD",
        );
    if (r.query.shift) {
      fail(["day", "night"].includes(r.query.shift), "Invalid shift");
      filter.workShift = r.query.shift;
    }
    if (r.query.start || r.query.end) {
      filter.businessDate = {};
      if (r.query.start) filter.businessDate.$gte = text(r.query.start);
      if (r.query.end) filter.businessDate.$lte = text(r.query.end);
    }
    if (r.query.pumpCode) filter.pumpCode = text(r.query.pumpCode);
    if (r.query.nozzleCode) filter.nozzleCode = text(r.query.nozzleCode);
    if (r.query.fuelType) filter.fuelType = text(r.query.fuelType);
    const periods = await Period.find(filter)
      .sort({ openedAt: -1 })
      .limit(5000)
      .lean();
    const ids = periods.map((p) => p._id);
    const base = station ? { station } : scopeFilter(r.user);
    const [sales, payments, movements, dips, audits] = await Promise.all([
      FuelSale.find({ period: { $in: ids } }).lean(),
      Payment.find(base).sort({ receivedAt: -1 }).limit(5000).lean(),
      Movement.find(base).sort({ at: -1 }).limit(5000).lean(),
      Dip.find(base).sort({ at: -1 }).limit(5000).lean(),
      Audit.find(base).sort({ at: -1 }).limit(5000).lean(),
    ]);
    const permittedStations = station
      ? [station]
      : await Station.find(scopeFilter(r.user)).distinct("_id");
    const exposure = await Company.find({
      stations: { $in: permittedStations },
    })
      .select("name accountCode debtCents advanceCents limitCents")
      .lean();
    const debtAgeing = [];
    for (const c of exposure) {
      const invoices = await FuelSale.find({
        company: c._id,
        status: "posted",
        dueCents: { $gt: 0 },
      }).lean();
      const adjustments = await Adjustment.find({
        company: c._id,
        dueCents: { $gt: 0 },
      }).lean();
      debtAgeing.push({ ...c, ageing: ageing([...invoices, ...adjustments]) });
    }
    return {
      ...groupedFuelReports(periods, sales),
      exposure: debtAgeing,
      periods,
      sales,
      payments,
      movements,
      dips,
      audits,
      units: { money: "pesewas", litres: "millilitres", price: "GHS/10000" },
      limitedTo: 5000,
      warning:
        "Period/sale filters apply to business date; payment, stock and audit lists show the latest location records with their own timestamps. Reversed periods retain physical dispensing history.",
    };
  });
  get("/stations/:id/connections", "fuel.equipment.configure", async (r) => {
    await authorisedStation(r.user, r.params.id);
    return Connection.find({ station: r.params.id })
      .select("-secretHash")
      .lean();
  });
  post(
    "/stations/:id/connections",
    "fuel.equipment.configure",
    async (r, s) => {
      const station = await lockStation(r.user, r.params.id, s);
      const secret = randomBytes(32).toString("hex");
      const connection = await create(
        Connection,
        {
          ...scopeOf(station),
          code: text(r.body.code, true),
          secretHash: createHash("sha256").update(secret).digest("hex"),
          mapping: {},
          enabled: false,
          verifiedModel: "UNVERIFIED — LIVE CONTROL DISABLED",
        },
        s,
      );
      await audit(s, r.user, "Connection", "disabled_adapter_created", null, {
        ...connection.toObject(),
        secretHash: undefined,
      });
      return {
        connection: { ...connection.toObject(), secretHash: undefined },
        secret,
        note: "Save this secret securely. Authentication is prepared; live ingestion remains disabled until verified equipment and an adapter are reviewed.",
      };
    },
  );
  // Mapping and polling lifecycle are prepared; no protocol or remote dispenser control is assumed.
  get("/stations/:id/inbox", "fuel.equipment.configure", async (r) => {
    await authorisedStation(r.user, r.params.id);
    return Inbox.find({ station: r.params.id })
      .sort({ receivedAt: -1 })
      .limit(500)
      .lean();
  });
  fastify.post(
    prefix + "/inbox/:id/retry",
    { preHandler: access("fuel.equipment.configure") },
    async (r) => {
      const current = await Inbox.findById(r.params.id);
      fail(current, "Event not found", 404);
      await authorisedStation(r.user, current.station);
      try {
        return await atomic(r, async (s) => {
          const event = await Inbox.findById(r.params.id).session(s);
          fail(event.status !== "processed", "Event is already processed", 409);
          await lockStation(r.user, event.station, s);
          const connection = await Connection.findById(
            event.connection,
          ).session(s);
          fail(
            connection?.enabled,
            "Verified live adapter is not enabled",
            409,
          );
          const sale = await postSale(
            s,
            r.user,
            {
              ...event.payload,
              sourceRef: `${connection.code}:${event.sourceRef}`,
              eventKey: event.eventKey,
            },
            "controller",
          );
          event.sale = sale._id;
          event.status = "processed";
          event.error = undefined;
          event.attempts += 1;
          await event.save({ session: s });
          await Connection.updateOne(
            { _id: connection._id },
            { $unset: { lastError: 1 } },
            { session: s },
          );
          await audit(s, r.user, "Inbox", "processed", null, event);
          return event;
        });
      } catch (error) {
        // The financial transaction has rolled back completely. Only retry diagnostics are updated.
        await Inbox.updateOne(
          { _id: current._id, status: { $ne: "processed" } },
          {
            $inc: { attempts: 1 },
            $set: {
              status: "failed",
              error: String(error.message).slice(0, 500),
            },
          },
        );
        await Connection.updateOne(
          { _id: current.connection },
          { $set: { lastError: String(error.message).slice(0, 500) } },
        );
        throw error;
      }
    },
  );
}
