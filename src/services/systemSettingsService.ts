import { supabase } from "@/lib/supabase";
import { resolveEmployeeRegistrationAllowedDomains } from "@/lib/employeeRegistration";

const EMPLOYEE_REGISTRATION_ALLOWED_DOMAINS_KEY = "employee_registration_allowed_domains";

const extractStringArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (value && typeof value === "object") {
    const recordValue = value as { domains?: unknown; allowedDomains?: unknown };

    if (Array.isArray(recordValue.domains)) {
      return recordValue.domains.filter((entry): entry is string => typeof entry === "string");
    }

    if (Array.isArray(recordValue.allowedDomains)) {
      return recordValue.allowedDomains.filter((entry): entry is string => typeof entry === "string");
    }
  }

  return [];
};

export const systemSettingsService = {
  getEmployeeRegistrationAllowedDomains: async (): Promise<string[]> => {
    if (!supabase) {
      return resolveEmployeeRegistrationAllowedDomains(undefined);
    }

    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value_json")
        .eq("key", EMPLOYEE_REGISTRATION_ALLOWED_DOMAINS_KEY)
        .maybeSingle();

      if (error) {
        console.warn("Failed to load employee registration domains:", error);
        return resolveEmployeeRegistrationAllowedDomains(undefined);
      }

      return resolveEmployeeRegistrationAllowedDomains(extractStringArrayValue(data?.value_json));
    } catch (error) {
      console.warn("Failed to load employee registration domains:", error);
      return resolveEmployeeRegistrationAllowedDomains(undefined);
    }
  },
};