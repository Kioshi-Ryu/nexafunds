import { describe, expect, it } from "vitest";
import { budgetSchema, categorySchema, transactionSchema } from "./api";

describe("finance API validation", () => {
  it("accepts an income transaction and rejects zero amounts", () => {
    expect(transactionSchema.safeParse({ type: "income", amount: 1250, category: "Salary", description: "Paycheck", date: "2026-08-01" }).success).toBe(true);
    expect(transactionSchema.safeParse({ type: "expense", amount: 0, category: "Food", description: "Lunch", date: "2026-08-01" }).success).toBe(false);
  });
  it("validates user categories", () => {
    expect(categorySchema.safeParse({ name: "Travel", type: "expense" }).success).toBe(true);
    expect(categorySchema.safeParse({ name: "", type: "other" }).success).toBe(false);
  });
  it("validates monthly budgets", () => {
    expect(budgetSchema.safeParse({ category: "Housing", amount: 1800, month: 8, year: 2026 }).success).toBe(true);
    expect(budgetSchema.safeParse({ category: "Housing", amount: -1, month: 13, year: 2026 }).success).toBe(false);
  });
});
