import { describe, expect, it } from "vitest";

import { normalizeAssessmentQuestionOptions } from "@/services/assessmentService";

describe("normalizeAssessmentQuestionOptions", () => {
  it("dedupes and trims multiple choice options while preserving order", () => {
    expect(
      normalizeAssessmentQuestionOptions("multiple_choice", [" First ", "Second", "First", "", "Second ", "Third"]),
    ).toEqual(["First", "Second", "Third"]);
  });

  it("keeps true false options fixed", () => {
    expect(normalizeAssessmentQuestionOptions("true_false", ["False", "True", "True"])).toEqual(["True", "False"]);
  });
});