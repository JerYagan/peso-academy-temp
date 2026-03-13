const LETTERS_AND_NAME_SYMBOLS_REGEX = /[^A-Za-z\s.'-]/g;
const DIGITS_ONLY_REGEX = /\D+/g;
const ADDRESS_ALLOWED_REGEX = /[^A-Za-z0-9\s.,#/'-]/g;
const FREE_TEXT_ALLOWED_REGEX = /[^A-Za-z0-9\s.,'()\-\/]/g;

export const sanitizeNameInput = (value: string) => value.replace(LETTERS_AND_NAME_SYMBOLS_REGEX, "").replace(/\s{2,}/g, " ");

export const sanitizeDigitsOnlyInput = (value: string) => value.replace(DIGITS_ONLY_REGEX, "");

export const sanitizeAddressInput = (value: string) => value.replace(ADDRESS_ALLOWED_REGEX, "").replace(/\s{2,}/g, " ");

export const sanitizeGeneralTextInput = (value: string) => value.replace(FREE_TEXT_ALLOWED_REGEX, "").replace(/\s{2,}/g, " ");

export const validateHumanName = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Full name is required before continuing.";
  }

  if (/\d/.test(trimmedValue)) {
    return "Full name cannot contain numbers.";
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