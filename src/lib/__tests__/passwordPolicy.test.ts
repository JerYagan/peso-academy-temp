import { describe, expect, it } from "vitest";

import {
  getPasswordRequirementChecks,
  getPasswordStrengthLevel,
  isPasswordPolicySatisfied,
} from "@/lib/passwordPolicy";

describe("passwordPolicy", () => {
  it("rejects passwords that do not meet all required character classes", () => {
    expect(isPasswordPolicySatisfied("password")).toBe(false);
    expect(isPasswordPolicySatisfied("Password1")).toBe(false);
    expect(isPasswordPolicySatisfied("Password!")).toBe(false);
  });

  it("accepts passwords that meet the full policy", () => {
    expect(isPasswordPolicySatisfied("PesoAcademy1!")).toBe(true);
  });

  it("reports the unmet requirements for weak passwords", () => {
    const checks = getPasswordRequirementChecks("Peso");
    expect(checks.find((check) => check.id === "length")?.met).toBe(false);
    expect(checks.find((check) => check.id === "number")?.met).toBe(false);
    expect(checks.find((check) => check.id === "special")?.met).toBe(false);
  });

  it("maps satisfied requirements to a strong strength level", () => {
    expect(getPasswordStrengthLevel("")).toBe("empty");
    expect(getPasswordStrengthLevel("Peso")).toBe("weak");
    expect(getPasswordStrengthLevel("PesoAcademy")).toBe("fair");
    expect(getPasswordStrengthLevel("PesoAcademy1")).toBe("good");
    expect(getPasswordStrengthLevel("PesoAcademy1!")).toBe("strong");
  });
});