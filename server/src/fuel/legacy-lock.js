import Outlet from "../models/Outlet.js";
import { fail } from "./domain.js";
// Cutover and in-flight legacy writes share an atomic guard on the existing outlet.
// A crashed worker leaves a conservative nonzero count; never expire a lease while a write may still run.
export async function acquireLegacyFuelLease(request, outletId) {
  if (!outletId) return;
  const outlet = await Outlet.findOneAndUpdate(
    { _id: outletId, fuelCutoverAt: { $exists: false } },
    { $inc: { fuelLegacyWrites: 1 } },
    { new: true },
  );
  fail(
    outlet,
    "This outlet has cut over to Fuel Operations; legacy fuel writes are locked",
    409,
  );
  request.fuelLegacyLeases ||= [];
  request.fuelLegacyLeases.push(outlet._id);
}
export async function releaseLegacyFuelLeases(request) {
  const leases = request.fuelLegacyLeases || [];
  request.fuelLegacyLeases = [];
  for (const outlet of leases)
    await Outlet.updateOne(
      { _id: outlet, fuelLegacyWrites: { $gt: 0 } },
      { $inc: { fuelLegacyWrites: -1 } },
    );
}
