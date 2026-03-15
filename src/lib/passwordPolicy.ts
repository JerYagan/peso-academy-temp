export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRequirementId = "length" | "uppercase" | "lowercase" | "number" | "special";

export type PasswordRequirementCheck = {
  id: PasswordRequirementId;
  met: boolean;
};

export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export const PASSWORD_POLICY_ERROR_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.";

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;

export const getPasswordRequirementChecks = (password: string): PasswordRequirementCheck[] => [
  { id: "length", met: password.length >= PASSWORD_MIN_LENGTH },
  { id: "uppercase", met: UPPERCASE_REGEX.test(password) },
  { id: "lowercase", met: LOWERCASE_REGEX.test(password) },
  { id: "number", met: NUMBER_REGEX.test(password) },
  { id: "special", met: SPECIAL_CHARACTER_REGEX.test(password) },
];

export const isPasswordPolicySatisfied = (password: string) =>
  getPasswordRequirementChecks(password).every((requirement) => requirement.met);

export const getPasswordStrengthScore = (password: string) =>
  getPasswordRequirementChecks(password).filter((requirement) => requirement.met).length;

export const getPasswordStrengthLevel = (password: string): PasswordStrengthLevel => {
  if (!password) {
    return "empty";
  }

  const score = getPasswordStrengthScore(password);

  if (score <= 2) {
    return "weak";
  }

  if (score === 3) {
    return "fair";
  }

  if (score === 4) {
    return "good";
  }

  return "strong";
};