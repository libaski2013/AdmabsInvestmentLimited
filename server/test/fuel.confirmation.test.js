import test from "node:test";
import assert from "node:assert/strict";
import { confirmsFuelTraining } from "../src/fuel/confirmation.js";
test("training confirmation tolerates pasted whitespace but still rejects unrelated or absent consent", () => {
  assert.equal(confirmsFuelTraining("CREATE TEST FUEL DATA"), true);
  assert.equal(confirmsFuelTraining("\u200B create\u00a0test  fuel data \n"), true);
  assert.equal(confirmsFuelTraining("TEST DATA @ADMABS FUEL"), false);
  for (const value of [undefined, null, true, {}, "", "REMOVE TEST FUEL DATA"])
    assert.equal(confirmsFuelTraining(value), false);
});
