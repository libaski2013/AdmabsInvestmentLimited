import mongoose from "mongoose";
import { models } from "./models.js";
const canonical = value => JSON.stringify(value, function (key, item) {
  return item && !Array.isArray(item) && typeof item === "object"
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
});
export async function fuelSchemaStatus() {
  const missing = [];
  for (const Model of Object.values(models)) {
    try {
      const actual = await Model.collection.indexes();
      for (const [keys, opts] of Model.schema.indexes()) {
        if (!actual.some(index => JSON.stringify(index.key) === JSON.stringify(keys) &&
          (!opts.unique || index.unique) && (!opts.partialFilterExpression ||
            canonical(index.partialFilterExpression) === canonical(opts.partialFilterExpression))))
          missing.push(Model.collection.name + ": " + Object.keys(keys).join(", "));
      }
    } catch { missing.push(Model.collection.name + ": collection unavailable"); }
  }
  return { ready: missing.length === 0, missing };
}
export async function prepareFuelSchema() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    const error = new Error("Fuel operations require a MongoDB replica set. No indexes or balances changed.");
    error.statusCode = 503; throw error;
  }
  for (const Model of Object.values(models)) {
    await Model.createCollection();
    await Model.createIndexes();
  }
  return fuelSchemaStatus();
}
