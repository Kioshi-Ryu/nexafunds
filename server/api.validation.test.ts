import { describe, expect, it } from "vitest";
import { accountSchema, parseProfileImageDataUrl, profileImageSchema, profileSchema } from "./api";

describe("REST account validation", () => {
  it("rejects weak passwords and malformed emails", () => {
    const result = accountSchema.safeParse({ name: "A", email: "not-an-email", password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid registration payload", () => {
    const result = accountSchema.safeParse({ name: "Alex Morgan", email: "alex@example.com", password: "secure-pass-123" });
    expect(result.success).toBe(true);
  });

  it("accepts editable profile details and validates ISO currency codes", () => {
    expect(profileSchema.safeParse({ name: "Alex Morgan", email: "alex@example.com", currency: "EUR" }).success).toBe(true);
    expect(profileSchema.safeParse({ name: "Alex Morgan", email: "alex@example.com", currency: "EURO" }).success).toBe(false);
  });

  it("requires a non-empty image data URL for profile pictures", () => {
    expect(profileImageSchema.safeParse({ dataUrl: "data:image/png;base64,AAAAABBBBBCCCCCDDDD" }).success).toBe(true);
    expect(profileImageSchema.safeParse({ dataUrl: "too-short" }).success).toBe(false);
  });

  it("accepts PNG, JPEG, and WebP payloads while rejecting unsupported image types", () => {
    expect(parseProfileImageDataUrl("data:image/png;base64,aGVsbG8=")?.contentType).toBe("image/png");
    expect(parseProfileImageDataUrl("data:image/jpeg;base64,aGVsbG8=")?.contentType).toBe("image/jpeg");
    expect(parseProfileImageDataUrl("data:image/webp;base64,aGVsbG8=")?.contentType).toBe("image/webp");
    expect(parseProfileImageDataUrl("data:image/gif;base64,aGVsbG8=")).toBeNull();
  });
});
