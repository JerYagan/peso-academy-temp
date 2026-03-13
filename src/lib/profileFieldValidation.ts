const LETTERS_AND_NAME_SYMBOLS_REGEX = /[^A-Za-z\s.'-]/g;
const DIGITS_ONLY_REGEX = /\D+/g;
const ADDRESS_ALLOWED_REGEX = /[^A-Za-z0-9\s.,#/'-]/g;
const FREE_TEXT_ALLOWED_REGEX = /[^A-Za-z0-9\s.,'()\-\/]/g;
const PHILIPPINE_MOBILE_REGEX = /^09\d{9}$/;
const POSTAL_CODE_REGEX = /^\d{4}$/;

export const PROFILE_FIELD_LIMITS = {
  name: 120,
  employeeId: 32,
  address: 255,
  occupation: 120,
  educationLevel: 120,
  location: 120,
} as const;

export const sanitizeNameInput = (value: string) => value.replace(LETTERS_AND_NAME_SYMBOLS_REGEX, "").replace(/\s{2,}/g, " ");

export const sanitizeDigitsOnlyInput = (value: string) => value.replace(DIGITS_ONLY_REGEX, "");

export const sanitizeAddressInput = (value: string) => value.replace(ADDRESS_ALLOWED_REGEX, "").replace(/\s{2,}/g, " ");

export const sanitizeGeneralTextInput = (value: string) => value.replace(FREE_TEXT_ALLOWED_REGEX, "").replace(/\s{2,}/g, " ");

export const normalizePhoneNumber = (value: string) => {
  const digits = sanitizeDigitsOnlyInput(value);

  if (!digits) {
    return "";
  }

  if (PHILIPPINE_MOBILE_REGEX.test(digits)) {
    return digits;
  }

  if (/^639\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^9\d{9}$/.test(digits)) {
    return `0${digits}`;
  }

  return digits;
};

export const normalizePostalCode = (value: string) => sanitizeDigitsOnlyInput(value).slice(0, 4);

export const validateHumanName = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Full name is required before continuing.";
  }

  if (/\d/.test(trimmedValue)) {
    return "Full name cannot contain numbers.";
  }

  if (trimmedValue.length > PROFILE_FIELD_LIMITS.name) {
    return `Full name must be ${PROFILE_FIELD_LIMITS.name} characters or fewer.`;
  }

  return null;
};

export const validateDigitsOnlyField = (label: string, value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return `${label} must contain numbers only.`;
  }

  return null;
};

export const validateMaxLength = (label: string, value: string, maxLength: number) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }

  return null;
};

export const validatePhoneNumber = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = normalizePhoneNumber(trimmedValue);
  if (!PHILIPPINE_MOBILE_REGEX.test(normalizedValue)) {
    return "Phone number must use the 09XXXXXXXXX format.";
  }

  return null;
};

export const validatePostalCode = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = normalizePostalCode(trimmedValue);
  if (!POSTAL_CODE_REGEX.test(normalizedValue)) {
    return "Postal code must contain exactly 4 digits.";
  }

  return null;
};