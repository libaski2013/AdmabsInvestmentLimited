import mongoose from "mongoose";
import { randomUUID, createHash } from "node:crypto";
import JournalEntry from "../models/JournalEntry.js";
import User from "../models/User.js";
import {
  FuelError,
  fail,
  decimal,
  safe,
  add,
  valueOf,
  display,
  permitted,
  meterMovement,
  businessClock,
  reconcile,
} from "./domain.js";
import {
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
  Audit,
  RequestKey,
  Adjustment,
} from "./models.js";
export const number = (prefix) => `${prefix}-${randomUUID()}`;
export const create = async (Model, data, session) =>
  (await Model.create([data], { session }))[0];
export const scopeOf = (doc) => ({
  branch: doc.branch,
  outlet: doc.outlet,
  station: doc.station || doc._id,
});
export const reason = (body) => {
  fail(
    typeof body.reason === "string" && body.reason.trim().length >= 5,
    "A reason of at least five characters is required",
  );
  return body.reason.trim();
};
export const text = (value, required = false, max = 200) => {
  fail(value == null || typeof value === "string", "Text value required");
  const result = (value || "").trim();
  fail(
    result.length <= max && (!required || result.length > 0),
    `Text must contain ${required ? "1" : "0"}–${max} characters`,
  );
  return result;
};
export function evidence(value) {
  const result = text(value, false, 600000);
  fail(
    !result ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(result) ||
      /^https:\/\//.test(result),
    "Evidence must be a photo data URL or HTTPS attachment",
  );
  return result;
}
export function scopeFilter(user) {
  if (["super_admin", "ceo", "gm"].includes(user.role)) return {};
  const result = { branch: { $in: user.branchIds || [] } };
  if (user.outletIds?.length) result.outlet = { $in: user.outletIds };
  return result;
}
export async function freshUser(request) {
  const user = await User.findById(request.user?.id).lean();
  fail(user?.active, "Active user account required", 403);
  return {
    ...user,
    id: String(user._id),
    branchIds: [
      ...new Set(
        [user.branch, ...(user.branches || [])].filter(Boolean).map(String),
      ),
    ],
    outletIds: (user.outlets || []).map(String),
  };
}
export async function authorisedStation(user, id, session) {
  const station = await Station.findOne({
    _id: id,
    ...scopeFilter(user),
  }).session(session);
  fail(station, "Station not found in your assignment", 404);
  return station;
}
export async function lockStation(user, id, session) {
  const station = await authorisedStation(user, id, session);
  fail(station.active, "Station is inactive", 409);
  await Station.updateOne(
    { _id: station._id },
    { $inc: { revision: 1 } },
    { session },
  );
  return station;
}
export async function audit(
  session,
  user,
  entity,
  action,
  before,
  after,
  why = "",
) {
  const doc = after || before || {};
  return create(
    Audit,
    {
      ...(doc.branch
        ? { branch: doc.branch, outlet: doc.outlet, station: doc.station }
        : {}),
      entity,
      entityId: String(doc._id || ""),
      action,
      user: user.id,
      at: new Date(),
      reason: why,
      before: before?.toObject ? before.toObject() : before,
      after: after?.toObject ? after.toObject() : after,
    },
    session,
  );
}
export async function atomic(request, action) {
  const key = request.headers["idempotency-key"];
  fail(
    typeof key === "string" && /^[A-Za-z0-9:_-]{8,150}$/.test(key),
    "A valid Idempotency-Key header is required",
  );
  const fullKey = `${request.user.id}:${request.method}:${request.routeOptions.url}:${key}`;
  const hash = createHash("sha256")
    .update(JSON.stringify({ params: request.params, body: request.body }))
    .digest("hex");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(
      async () => {
        const old = await RequestKey.findOne({ key: fullKey }).session(session);
        if (old) {
          fail(
            old.hash === hash,
            "This request key was already used with different data",
            409,
          );
          result = old.result;
          return;
        }
        await create(RequestKey, { key: fullKey, hash }, session);
        const doc = await action(session);
        result = JSON.parse(JSON.stringify(doc));
        await RequestKey.updateOne(
          { key: fullKey },
          { $set: { result } },
          { session },
        );
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS: 20000,
      },
    );
    return result;
  } catch (error) {
    if (error.code === 11000) {
      const old = await RequestKey.findOne({ key: fullKey }).lean();
      if (old?.hash === hash && old.result) return old.result;
      throw new FuelError(
        "Duplicate reference or conflicting operation; refresh and review the existing record",
        409,
      );
    }
    if (/Transaction numbers|replica set|mongos/i.test(error.message))
      throw new FuelError(
        "Fuel posting requires a MongoDB replica set. No records were posted.",
        503,
      );
    throw error;
  } finally {
    await session.endSession();
  }
}
export async function journal(
  session,
  user,
  doc,
  description,
  lines,
  source = "sale",
) {
  const items = lines
    .filter((x) => x.debit || x.credit)
    .map((x) => ({
      ...x,
      debit: Number(display(x.debit || 0)),
      credit: Number(display(x.credit || 0)),
    }));
  if (!items.length) return;
  return create(
    JournalEntry,
    {
      number: number("JF"),
      source,
      sourceId: doc._id,
      description,
      branch: doc.branch,
      outlet: doc.outlet,
      createdBy: user.id,
      lines: items,
    },
    session,
  );
}
const line = (accountCode, accountName, debit = 0, credit = 0) => ({
  accountCode,
  accountName,
  debit,
  credit,
});
export async function stock(
  session,
  user,
  doc,
  tankId,
  deltaMl,
  kind,
  reference,
  why,
  linkedMovement,
) {
  safe(deltaMl);
  const tank = await Tank.findOne({
    _id: tankId,
    station: doc.station || doc._id,
  }).session(session);
  fail(tank?.active, "Tank is inactive", 409);
  fail(
    tank?.openingEstablished,
    "Establish a reviewed opening stock balance first",
    409,
  );
  const after = add(tank.bookMl, deltaMl);
  fail(
    after >= 0 && after <= tank.capacityMl,
    "Stock movement exceeds available tank stock or capacity",
    409,
  );
  tank.bookMl = after;
  await tank.save({ session });
  return create(
    Movement,
    {
      ...scopeOf(doc),
      tank: tankId,
      period: doc.nozzle ? doc._id : undefined,
      kind,
      litresMl: Math.abs(deltaMl),
      stockDeltaMl: deltaMl,
      status: "posted",
      reason: why,
      reference,
      linkedMovement,
      at: new Date(),
      user: user.id,
    },
    session,
  );
}
export async function lockPeriod(user, id, session, statuses = ["draft"]) {
  const period = await Period.findById(id).session(session);
  fail(period, "Period not found", 404);
  const station = await lockStation(user, period.station, session);
  fail(
    statuses.includes(period.status),
    `Period is ${period.status}; this action is locked`,
    409,
  );
  await Period.updateOne(
    { _id: period._id },
    { $inc: { revision: 1 } },
    { session },
  );
  // The revision increment belongs to the database lock, not the loaded document.
  period.revision += 1;
  return { period, station };
}
export function responsible(user, period) {
  fail(
    String(period.attendant) === user.id ||
      permitted(user, "fuel.readings.approve"),
    "Only the current attendant or authorised supervisor may record this period",
    403,
  );
}
export async function companyAccess(user, id, stationId, session) {
  const company = await Company.findById(id).session(session);
  fail(company, "Company account not found", 404);
  if (stationId) {
    await authorisedStation(user, stationId, session);
    fail(
      company.stations.map(String).includes(String(stationId)),
      "Company is not permitted at this station",
      403,
    );
  } else {
    fail(
      permitted(user, "fuel.reports.company"),
      "Company-wide account access requires fuel.reports.company",
      403,
    );
  }
  return company;
}
export async function companyLock(company, session) {
  await Company.updateOne(
    { _id: company._id },
    { $inc: { revision: 1 } },
    { session },
  );
  company.revision += 1;
}
export async function ledger(
  session,
  user,
  doc,
  company,
  type,
  debitCents,
  creditCents,
  advanceDeltaCents,
  why = "",
) {
  return create(
    Ledger,
    {
      ...scopeOf(doc),
      company: company._id,
      type,
      reference: doc.number || String(doc._id),
      debitCents,
      creditCents,
      advanceDeltaCents,
      at: new Date(),
      user: user.id,
      reason: why,
      invoice: doc.litresMl ? doc._id : undefined,
      payment: doc.receivedBy ? doc._id : undefined,
    },
    session,
  );
}
export async function currentPrice(
  station,
  fuelType,
  session,
  now = new Date(),
) {
  const price = await Price.findOne({
    station,
    fuelType,
    effectiveAt: { $lte: now },
  })
    .sort({ effectiveAt: -1 })
    .session(session);
  fail(price, "No effective fuel price is configured", 409);
  return price.priceUnits;
}
export function meter(value, nozzle) {
  const result = decimal(value, 3);
  fail(
    result % 10 ** (3 - nozzle.meterPrecision) === 0,
    `Meter supports ${nozzle.meterPrecision} decimal places`,
  );
  if (nozzle.rolloverMl)
    fail(result < nozzle.rolloverMl, "Meter must be below rollover modulus");
  return result;
}
export async function segment(
  session,
  period,
  closingMl,
  at,
  rollover = false,
  reasonText = "",
) {
  const nozzle = await Nozzle.findById(period.nozzle).session(session);
  const grossMl = meterMovement(
    period.segmentStartMl,
    closingMl,
    nozzle.rolloverMl,
    rollover,
  );
  period.segments.push({
    openingMl: period.segmentStartMl,
    closingMl,
    grossMl,
    priceUnits: period.currentPrice,
    attendant: period.attendant,
    startAt: period.segmentStartAt,
    endAt: at,
    rollover,
    reason: reasonText,
  });
  period.segmentStartMl = closingMl;
  period.segmentStartAt = at;
}
export async function calculate(session, period) {
  const sales = await FuelSale.find({ period: period._id, status: "posted" })
    .session(session)
    .lean();
  const movements = await Movement.find({
    period: period._id,
    kind: { $in: ["calibration", "non_sale"] },
  })
    .session(session)
    .lean();
  for (let i = 0; i < period.segments.length; i++) {
    const seg = period.segments[i];
    const sold = sales.filter((s) => s.segmentIndex === i);
    const moved = movements
      .filter((m) => m.segmentIndex === i && m.status === "approved")
      .reduce((n, m) => add(n, m.litresMl), 0);
    const remaining =
      seg.grossMl - moved - sold.reduce((n, s) => add(n, s.litresMl), 0);
    fail(
      remaining >= 0,
      "Recorded issues/non-sale dispensing exceed a meter segment; correct before submission",
      409,
    );
    seg.saleValueCents = add(
      ...sold.map((s) => s.amountCents),
      valueOf(remaining, seg.priceUnits),
    );
  }
  period.markModified("segments");
  return reconcile(period.toObject(), sales, movements);
}
export async function postSale(session, user, body, source = "manual") {
  const { period, station } = await lockPeriod(user, body.period, session);
  responsible(user, period);
  fail(
    !period.closedAt,
    "Period readings are closed; reverse or reopen before entering a sale",
    409,
  );
  const now = new Date();
  const at = source === "manual" ? now : new Date(body.transactionAt);
  fail(
    !Number.isNaN(+at) && at >= period.segmentStartAt && at <= now,
    "Event is outside the current meter/price segment; send it to supervised review",
    409,
  );
  const litresMl = decimal(body.litres, 3, { positive: true });
  const priceUnits = period.currentPrice;
  if (body.unitPrice != null)
    fail(
      decimal(body.unitPrice, 4, { positive: true }) === priceUnits,
      "Unit price differs from the effective period price",
      409,
    );
  const amountCents = valueOf(litresMl, priceUnits);
  fail(amountCents > 0, "Sale rounds to zero");
  if (body.amount != null)
    fail(
      decimal(body.amount) === amountCents,
      "Amount does not match litres × price",
    );
  const payments = (body.payments || []).map((p) => {
    fail(
      ["cash", "momo", "card"].includes(p.method),
      "Use cash, momo or card for current-sale collections",
    );
    return {
      method: p.method,
      amountCents: decimal(p.amount, 2, { positive: true }),
      reference: text(p.reference),
    };
  });
  const paidCents = add(...payments.map((p) => p.amountCents));
  const prepaidCents = decimal(body.prepaid || "0");
  const creditCents = amountCents - paidCents - prepaidCents;
  fail(creditCents >= 0, "Payments and prepaid use exceed sale amount");
  let company, vehicle, driver;
  if (body.company) {
    company = await companyAccess(user, body.company, station._id, session);
    await companyLock(company, session);
    fail(
      company.status === "active",
      "Company account is suspended or closed",
      409,
    );
    fail(
      company.fuelTypes.includes(period.fuelType),
      "Fuel type is not permitted for this account",
      403,
    );
    fail(
      !company.requireAuthorisation || text(body.authorisation),
      "Purchase authorisation is required",
    );
    fail(
      !company.requireVehicle || body.vehicle,
      "Authorised vehicle is required",
    );
    fail(
      !company.requireDriver || body.driver,
      "Authorised driver is required",
    );
    if (body.vehicle) {
      vehicle = await Vehicle.findOne({
        _id: body.vehicle,
        company: company._id,
        active: true,
      }).session(session);
      fail(vehicle, "Vehicle is not authorised");
    }
    if (body.driver) {
      driver = await Driver.findOne({
        _id: body.driver,
        company: company._id,
        active: true,
      }).session(session);
      fail(driver, "Driver is not authorised");
    }
    fail(
      company.advanceCents >= prepaidCents,
      "Insufficient advance credit",
      409,
    );
    const overdue =
      (await FuelSale.exists({
        company: company._id,
        dueCents: { $gt: 0 },
        dueAt: { $lt: now },
        status: "posted",
      }).session(session)) ||
      (await Adjustment.exists({
        company: company._id,
        dueCents: { $gt: 0 },
        dueAt: { $lt: now },
      }).session(session));
    const overLimit = add(company.debtCents, creditCents) > company.limitCents;
    const blocked =
      creditCents > 0 && (overLimit || (company.overdueBlock && overdue));
    if (blocked) {
      fail(
        permitted(user, "fuel.credit.override"),
        "Credit limit or overdue policy blocks this purchase",
        409,
      );
      reason(body);
    }
    if (vehicle) {
      // Company document lock serialises daily usage at all its stations.
      const daySales = await FuelSale.find({
        company: company._id,
        vehicle: vehicle._id,
        businessDate: period.businessDate,
        status: "posted",
      })
        .session(session)
        .lean();
      fail(
        !vehicle.dailyMl ||
          add(litresMl, ...daySales.map((s) => s.litresMl)) <= vehicle.dailyMl,
        "Vehicle daily litres limit exceeded",
        409,
      );
      fail(
        !vehicle.dailyCents ||
          add(amountCents, ...daySales.map((s) => s.amountCents)) <=
            vehicle.dailyCents,
        "Vehicle daily spending limit exceeded",
        409,
      );
    }
    company.debtCents = add(company.debtCents, creditCents);
    company.advanceCents -= prepaidCents;
    await company.save({ session });
    if (blocked)
      await audit(
        session,
        user,
        "Company",
        "credit_override",
        null,
        {
          ...scopeOf(period),
          _id: company._id,
          debtCents: company.debtCents,
          limitCents: company.limitCents,
          overdue: Boolean(overdue),
        },
        reason(body),
      );
  } else
    fail(
      !creditCents && !prepaidCents,
      "Company account required for credit/prepaid purchases",
    );
  fail(
    period.mode !== "summary" || company,
    "Summary mode records company issues only; walk-in sales are derived at reconciliation",
  );
  if (body.customer) {
    const Customer = mongoose.model("Customer");
    fail(
      await Customer.exists({
        _id: body.customer,
        ...scopeFilter(user),
      }).session(session),
      "Registered customer is outside your assignment",
      403,
    );
  }
  const doc = await create(
    FuelSale,
    {
      ...scopeOf(period),
      number: number("FS2"),
      period: period._id,
      nozzle: period.nozzle,
      tank: period.tank,
      pumpCode: period.pumpCode,
      nozzleCode: period.nozzleCode,
      fuelType: period.fuelType,
      litresMl,
      segmentIndex: period.segments.length,
      priceUnits,
      amountCents,
      paidCents,
      prepaidCents,
      creditCents,
      dueCents: creditCents,
      dueAt: new Date(+now + (company?.termsDays || 0) * 86400000),
      payments,
      company: company?._id,
      customer: body.customer || company?.customer,
      vehicle: vehicle?._id,
      registration: vehicle?.registration || text(body.registration),
      driver: driver?._id,
      driverName: driver?.name || text(body.driverName),
      attendant: user.id,
      businessDate: period.businessDate,
      transactionAt: at,
      entryAt: now,
      authorisation: text(body.authorisation),
      attachment: evidence(body.attachment),
      acknowledgement: text(body.acknowledgement),
      source,
      sourceRef: text(body.sourceRef, true),
      eventKey: text(body.eventKey, true),
    },
    session,
  );
  if (company) {
    if (prepaidCents) {
      let remaining = prepaidCents;
      const receipts = await Payment.find({
        company: company._id,
        status: "posted",
        unappliedCents: { $gt: 0 },
      })
        .sort({ receivedAt: 1, _id: 1 })
        .session(session);
      for (const receipt of receipts) {
        const used = Math.min(remaining, receipt.unappliedCents);
        if (!used) continue;
        receipt.unappliedCents -= used;
        remaining -= used;
        receipt.allocations.push({
          invoice: doc._id,
          kind: "prepaid",
          amountCents: used,
          at: now,
          user: user.id,
        });
        await receipt.save({ session });
      }
      fail(
        remaining === 0,
        "Advance ledger and receipts do not agree; review account before posting",
        409,
      );
    }
    await ledger(
      session,
      user,
      doc,
      company,
      "Fuel Purchases",
      creditCents,
      0,
      -prepaidCents,
    );
  }
  await journal(session, user, doc, `Fuel purchase ${doc.number}`, [
    line("1000", "Cash and payment clearing", paidCents),
    line("1100", "Accounts receivable", creditCents),
    line("2105", "Fuel customer advances", prepaidCents),
    line("4100", "Fuel sales", 0, amountCents),
  ]);
  if (period.mode === "individual")
    await stock(
      session,
      user,
      period,
      period.tank,
      -litresMl,
      "individual_sale",
      doc.number,
    );
  await audit(session, user, "FuelSale", "posted", null, doc);
  return doc;
}
export async function allocate(session, user, company, payment, body) {
  const mode = body.allocationMode || "oldest";
  fail(
    ["oldest", "manual", "on_account"].includes(mode),
    "Invalid allocation mode",
  );
  let rows = [];
  if (mode === "manual") {
    fail(Array.isArray(body.allocations), "Allocations required");
    rows = body.allocations;
  } else if (mode === "oldest")
    rows = (
      await FuelSale.find({
        company: company._id,
        status: "posted",
        dueCents: { $gt: 0 },
      })
        .sort({ dueAt: 1, transactionAt: 1, _id: 1 })
        .session(session)
    ).map((s) => ({ invoice: s._id, dueAt: s.dueAt }));
  if (mode === "oldest")
    rows = [
      ...rows,
      ...(
        await Adjustment.find({
          company: company._id,
          dueCents: { $gt: 0 },
        }).session(session)
      ).map((a) => ({ invoice: a._id, kind: "adjustment", dueAt: a.dueAt })),
    ].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  let remaining = payment.unappliedCents;
  const seen = new Set();
  for (const row of rows) {
    fail(!seen.has(String(row.invoice)), "Duplicate invoice allocation");
    seen.add(String(row.invoice));
    const kind = row.kind === "adjustment" ? "adjustment" : "sale";
    const inv = await (
      kind === "adjustment"
        ? Adjustment.findOne({
            _id: row.invoice,
            company: company._id,
            dueCents: { $gt: 0 },
          })
        : FuelSale.findOne({
            _id: row.invoice,
            company: company._id,
            status: "posted",
          })
    ).session(session);
    fail(inv, "Invoice not found");
    await authorisedStation(user, inv.station, session);
    const amount =
      row.amount == null
        ? Math.min(remaining, inv.dueCents)
        : decimal(row.amount, 2, { positive: true });
    fail(
      amount <= remaining && amount <= inv.dueCents,
      "Allocation exceeds available receipt or invoice balance",
      409,
    );
    if (!amount) continue;
    inv.dueCents -= amount;
    await inv.save({ session });
    remaining -= amount;
    payment.allocations.push({
      invoice: inv._id,
      kind,
      number: inv.number,
      amountCents: amount,
      at: new Date(),
      user: user.id,
    });
  }
  const applied = payment.unappliedCents - remaining;
  fail(
    company.advanceCents >= applied,
    "Advance credit has already been used by other purchases",
    409,
  );
  company.debtCents = add(company.debtCents, -applied);
  fail(company.debtCents >= 0, "Allocation would create negative debt");
  company.advanceCents = add(company.advanceCents, -applied);
  payment.unappliedCents = remaining;
  await company.save({ session });
  await payment.save({ session });
  if (applied) {
    await ledger(
      session,
      user,
      payment,
      company,
      "Payments Received",
      0,
      applied,
      -applied,
    );
    await journal(
      session,
      user,
      payment,
      `Payment allocation ${payment.number}`,
      [
        line("2105", "Fuel customer advances", applied),
        line("1100", "Accounts receivable", 0, applied),
      ],
      "payment",
    );
  }
  return payment;
}
export async function reverseSale(
  session,
  user,
  sale,
  why,
  entryError = false,
) {
  fail(sale.status === "posted", "Sale has already been reversed", 409);
  fail(
    sale.dueCents === sale.creditCents,
    "Reverse payment allocations or apply a reviewed credit note before reversing an allocated invoice",
    409,
  );
  const { period } = await lockPeriod(user, sale.period, session, [
    "draft",
    "submitted",
    "approved",
    "reversed",
  ]);
  if (sale.company) {
    const company = await Company.findById(sale.company).session(session);
    await companyLock(company, session);
    company.debtCents = add(company.debtCents, -sale.creditCents);
    company.advanceCents = add(company.advanceCents, sale.prepaidCents);
    if (sale.prepaidCents) {
      const receipts = await Payment.find({
        company: company._id,
        "allocations.invoice": sale._id,
      }).session(session);
      for (const receipt of receipts) {
        const before = receipt.toObject();
        for (const a of receipt.allocations)
          if (
            String(a.invoice) === String(sale._id) &&
            a.kind === "prepaid" &&
            !a.reversedAt
          ) {
            receipt.unappliedCents = add(receipt.unappliedCents, a.amountCents);
            a.reversedAt = new Date();
          }
        receipt.markModified("allocations");
        await receipt.save({ session });
        await audit(
          session,
          user,
          "Payment",
          "prepaid_restored",
          before,
          receipt,
          why,
        );
      }
    }
    await company.save({ session });
    await ledger(
      session,
      user,
      sale,
      company,
      "Credit Notes",
      0,
      sale.creditCents,
      sale.prepaidCents,
      why,
    );
  }
  await journal(
    session,
    user,
    sale,
    `Reversal ${sale.number}: ${why}`,
    [
      line("4100", "Fuel sales", sale.amountCents),
      line("1000", "Cash and payment clearing", 0, sale.paidCents),
      line("1100", "Accounts receivable", 0, sale.creditCents),
      line("2105", "Fuel customer advances", 0, sale.prepaidCents),
    ],
    "reversal",
  );
  // A confirmed entry error corrects the bookkeeping deduction; actual fuel returns use a linked return movement.
  if (entryError) {
    fail(
      !(await Movement.exists({ linkedSale: sale._id, kind: "return" }).session(
        session,
      )),
      "This sale already has physical returns; use a reviewed adjustment instead",
      409,
    );
    if (period.mode === "individual")
      await stock(
        session,
        user,
        period,
        sale.tank,
        sale.litresMl,
        "sale_entry_correction",
        sale.number,
        why,
      );
    sale.reversalStockCorrection = true;
  }
  sale.status = "reversed";
  sale.dueCents = 0;
  sale.reversalReason = why;
  await sale.save({ session });
  await audit(session, user, "FuelSale", "reversal", null, sale, why);
  return { sale, period };
}
