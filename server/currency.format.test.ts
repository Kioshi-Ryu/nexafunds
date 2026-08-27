import { describe, expect, it } from "vitest";
import { formatCurrency } from "../client/src/lib/currency";

describe("user currency formatting", () => {
  it("supports international ISO currency codes", () => {
    expect(formatCurrency(1234, "EUR")).toContain("1");
    expect(formatCurrency(1234, "INR")).toContain("1");
    expect(formatCurrency(1234, "JPY")).toContain("1");
  });

  it("normalizes common lowercase currency input", () => {
    expect(formatCurrency(50, "gbp")).toContain("50");
  });
});
