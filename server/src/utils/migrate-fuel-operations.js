import "dotenv/config";
import mongoose from "mongoose";
import { models } from "../fuel/models.js";
import FuelTank from "../models/FuelTank.js";
import FuelPump from "../models/FuelPump.js";
import FuelShift from "../models/FuelShift.js";
import Outlet from "../models/Outlet.js";
import Customer from "../models/Customer.js";
const apply = process.argv.includes("--apply");
if (!process.env.MONGODB_URI)
  throw new Error(
    "Set MONGODB_URI explicitly; migration never creates a fallback database",
  );
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const unfinished = await FuelShift.countDocuments({
    status: { $in: ["open", "submitted", "queried"] },
  });
  const summary = {
    migration: "fuel-operations-v2-additive-1",
    mode: apply ? "APPLY ADDITIVE INDEXES" : "READ-ONLY REVIEW",
    transactionsSupported: Boolean(hello.setName || hello.msg === "isdbgrid"),
    legacyTanks: await FuelTank.countDocuments(),
    legacyPumps: await FuelPump.countDocuments(),
    unfinishedLegacyShifts: unfinished,
    legacyInFlightOutlets: await Outlet.find({ fuelLegacyWrites: { $gt: 0 } })
      .select("code fuelLegacyWrites")
      .lean(),
    existingCustomers: await Customer.countDocuments(),
    collections: Object.values(models).map((m) => ({
      collection: m.collection.name,
      indexes: m.schema.indexes(),
    })),
    openingBalancesCopied: false,
    historicalRecordsChanged: false,
  };
  if (apply) {
    if (!summary.transactionsSupported)
      throw new Error(
        "Replica set / mongos required. No indexes or balances changed.",
      );
    for (const Model of Object.values(models)) {
      await Model.createCollection();
      await Model.createIndexes();
    }
    // No syncIndexes: never drop indexes. No seed/import/legacy balance overwrite.
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await mongoose.disconnect();
}
