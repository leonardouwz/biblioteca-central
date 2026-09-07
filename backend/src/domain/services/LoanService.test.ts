import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFine } from "./LoanService";

test("calculateFine: sin atraso => 0", () => {
  const due = new Date("2026-01-10");
  assert.equal(calculateFine(due, new Date("2026-01-10")), 0);
  assert.equal(calculateFine(due, new Date("2026-01-05")), 0);
});

test("calculateFine: 3 dias de atraso => 3 * tarifa", () => {
  assert.equal(calculateFine(new Date("2026-01-10"), new Date("2026-01-13"), 500), 1500);
});
