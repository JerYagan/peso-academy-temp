import { describe, expect, it } from "vitest";
import {
  normalizePhoneNumber,
  normalizePostalCode,
  validatePhoneNumber,
  validatePostalCode,
} from "@/lib/profileFieldValidation";

describe("profileFieldValidation", () => {
  it("normalizes Philippine mobile numbers into 09 format", () => {
    expect(normalizePhoneNumber("+63 912 345 6789")).toBe("09123456789");
    expect(normalizePhoneNumber("9123456789")).toBe("09123456789");
    expect(normalizePhoneNumber("09123456789")).toBe("09123456789");
  });

  it("validates phone numbers against the 09 format", () => {
    expect(validatePhoneNumber("09123456789")).toBeNull();
    expect(validatePhoneNumber("12345")).toBe("Phone number must use the 09XXXXXXXXX format.");
  });

  it("normalizes and validates postal codes to four digits", () => {
    expect(normalizePostalCode("9800-1")).toBe("9800");
    expect(validatePostalCode("9800")).toBeNull();
    expect(validatePostalCode("980")).toBe("Postal code must contain exactly 4 digits.");
  });
});