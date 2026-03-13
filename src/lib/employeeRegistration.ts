export const DEFAULT_EMPLOYEE_REGISTRATION_ALLOWED_DOMAINS = ["peso.academy"];

export const normalizeEmployeeRegistrationDomain = (value: string): string | null => {
  const normalizedValue = value.trim().toLowerCase().replace(/^@+/, "");
  return normalizedValue.length > 0 ? normalizedValue : null;
};

export const normalizeEmployeeRegistrationDomains = (values: string[]): string[] => {
  const normalizedValues = values
    .map((value) => normalizeEmployeeRegistrationDomain(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalizedValues));
};

export const resolveEmployeeRegistrationAllowedDomains = (values: string[] | undefined): string[] => {
  const normalizedValues = normalizeEmployeeRegistrationDomains(values ?? []);
  return normalizedValues.length > 0 ? normalizedValues : [...DEFAULT_EMPLOYEE_REGISTRATION_ALLOWED_DOMAINS];
};

export const isAllowedEmployeeRegistrationEmail = (email: string, allowedDomains: string[]): boolean => {
  const normalizedEmail = email.trim().toLowerCase();
  const domainPart = normalizedEmail.includes("@") ? normalizedEmail.split("@").at(-1) ?? "" : "";
  if (!domainPart) {
    return false;
  }

  return resolveEmployeeRegistrationAllowedDomains(allowedDomains).includes(domainPart);
};

export const formatAllowedEmployeeDomains = (allowedDomains: string[]): string =>
  resolveEmployeeRegistrationAllowedDomains(allowedDomains)
    .map((domain) => `@${domain}`)
    .join(", ");