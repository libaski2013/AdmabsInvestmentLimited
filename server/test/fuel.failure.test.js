import test from "node:test";
import assert from "node:assert/strict";
import { fuelFailureResponse } from "../src/fuel/failure.js";

test("owner diagnostics classify a database rejection without exposing secrets or record values", () => {
  const error = Object.assign(new Error("secret mongodb://password@private.example/database Customer PRIVATE"), {
    name: "MongoServerError", code: 121, fuelDemoStep: "configure training station A",
  });
  const response = fuelFailureResponse(error, { user: { role: "ceo" }, id: "req-demo-1" }, 500);
  assert.equal(response.diagnostic.databaseCode, "121");
  assert.equal(response.diagnostic.step, "configure training station A");
  assert.match(response.error, /collection validation rules/);
  assert.doesNotMatch(JSON.stringify(response), /password|private.example|PRIVATE|mongodb:/);
  assert.equal(fuelFailureResponse(error, { user: { role: "fuel" } }, 500).diagnostic, undefined);
  assert.equal(fuelFailureResponse(new Error("Confirm test data creation"), { user: { role: "ceo" } }, 400).error, "Confirm test data creation");
});
