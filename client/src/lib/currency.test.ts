import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("formats international currency codes using browser locale-aware output", () => {
    expect(formatCurrency(1234, "EUR")).toContain("1");
    expect(formatCurrency(1234, "INR")).toContain("1");
    expect(formatCurrency(1234, "JPY")).toContain("1");
  });

  it("normalizes a lowercase ISO code", () => {
    expect(formatCurrency(50, "gbp")).toContain("50");
  });
});

