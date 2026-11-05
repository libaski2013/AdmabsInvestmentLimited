import test from "node:test";
import assert from "node:assert/strict";
import {
  decimal,
  display,
  valueOf,
  meterMovement,
  businessClock,
  reconcile,
  ageing,
} from "../src/fuel/domain.js";
test("decimal-safe amounts and half-up rounding", () => {
  assert.equal(decimal("12.345", 3), 12345);
  assert.equal(valueOf(12345, 134567), 16612);
  assert.equal(valueOf(1, 50000), 1);
  assert.equal(display(16612), "166.12");
  for (const v of ["NaN", "Infinity", "1e3", "-1", "1.001", "", null])
    assert.throws(() => decimal(v));
});
test("rollover must be explicit and valid", () => {
  assert.equal(meterMovement(99000, 1000, 100000, true), 2000);
  assert.throws(() => meterMovement(99000, 1000, 100000));
  assert.throws(() => meterMovement(1000, 2000, 100000, true));
});
test("overnight business date anchors to shift start", () =>
  assert.deepEqual(
    businessClock(new Date("2026-10-18T02:00:00Z"), "Africa/Accra"),
    { businessDate: "2026-10-17", workShift: "night" },
  ));
test("summary residual avoids duplicate walk-in records", () => {
  const r = reconcile(
    {
      mode: "summary",
      closedAt: new Date(),
      segments: [{ grossMl: 100000, saleValueCents: 100000 }],
      collections: { cash: 70000 },
    },
    [
      {
        litresMl: 30000,
        amountCents: 30000,
        creditCents: 20000,
        prepaidCents: 10000,
        paidCents: 0,
      },
    ],
    [],
  );
  assert.equal(r.derivedMl, 70000);
  assert.equal(r.moneyVarianceCents, 0);
  assert.deepEqual(r.flags, []);
});
test("individual mode flags unexplained litres", () => {
  const r = reconcile(
    {
      mode: "individual",
      closedAt: new Date(),
      segments: [{ grossMl: 100000 }],
      collections: { cash: 5000 },
    },
    [{ litresMl: 90000, amountCents: 5000, paidCents: 5000 }],
    [],
  );
  assert.equal(r.litresVarianceMl, 10000);
  assert.equal(r.derivedMl, 0);
});
test("debt ageing boundaries", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  assert.deepEqual(
    ageing(
      [0, 1, 30, 31, 60, 61, 90, 91].map((d) => ({
        dueAt: new Date(+now - d * 86400000),
        dueCents: 100,
      })),
      now,
    ),
    {
      notDue: 100,
      days1to30: 200,
      days31to60: 200,
      days61to90: 200,
      over90: 100,
    },
  );
});
