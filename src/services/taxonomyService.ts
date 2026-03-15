import { supabase } from "@/lib/supabase";
import {
  getRuntimeTaxonomyConfig,
  setRuntimeTaxonomyConfig,
  TAXONOMY_CAREER_PATHS,
  TAXONOMY_COURSE_CATEGORIES,
  TAXONOMY_INDUSTRY_TAGS,
  TAXONOMY_SKILL_TAGS,
  TAXONOMY_TOPIC_TAGS,
} from "@/lib/taxonomy";

export type TaxonomyTermType = "course_category" | "skill_tag" | "topic_tag" | "industry_tag" | "career_path";

export interface TaxonomyTerm {
  id: string;
  termType: TaxonomyTermType;
  name: string;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyOptions {
  courseCategories: string[];
  skillTags: string[];
  topicTags: string[];
  industryTags: string[];
  careerPaths: string[];
}

const normalizeDisplayValue = (value: string) => value.trim().replace(/\s+/g, " ");

const normalizeToken = (value: string) =>
  normalizeDisplayValue(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeTerms = (values: readonly string[]) => {
  const seen = new Set<string>();

  return values.reduce<string[]>((result, value) => {
    const displayValue = normalizeDisplayValue(value);
    const token = normalizeToken(displayValue);

    if (!displayValue || !token || seen.has(token)) {
      return result;
    }

    seen.add(token);
    result.push(displayValue);
    return result;
  }, []);
};

const fallbackOptions: TaxonomyOptions = {
  courseCategories: [...TAXONOMY_COURSE_CATEGORIES],
  skillTags: [...TAXONOMY_SKILL_TAGS],
  topicTags: [...TAXONOMY_TOPIC_TAGS],
  industryTags: [...TAXONOMY_INDUSTRY_TAGS],
  careerPaths: [...TAXONOMY_CAREER_PATHS],
};

const mapRow = (row: any): TaxonomyTerm => ({
  id: row.id,
  termType: row.term_type,
  name: row.name,
  isActive: row.is_active ?? true,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const groupTerms = (terms: TaxonomyTerm[]): TaxonomyOptions => ({
  courseCategories: dedupeTerms(
    terms.filter((term) => term.termType === "course_category" && term.isActive).map((term) => term.name),
  ),
  skillTags: dedupeTerms(
    terms.filter((term) => term.termType === "skill_tag" && term.isActive).map((term) => term.name),
  ),
  topicTags: dedupeTerms(
    terms.filter((term) => term.termType === "topic_tag" && term.isActive).map((term) => term.name),
  ),
  industryTags: dedupeTerms(
    terms.filter((term) => term.termType === "industry_tag" && term.isActive).map((term) => term.name),
  ),
  careerPaths: dedupeTerms(
    terms.filter((term) => term.termType === "career_path" && term.isActive).map((term) => term.name),
  ),
});

let taxonomyTermsCache: TaxonomyTerm[] | null = null;

const applyOptionsToRuntimeConfig = (options: TaxonomyOptions) => {
  setRuntimeTaxonomyConfig(options);
  return options;
};

const buildFallbackTerms = (): TaxonomyTerm[] => {
  const now = new Date().toISOString();

  return [
    ...fallbackOptions.courseCategories.map((name) => ({ id: `fallback-course-${normalizeToken(name)}`, termType: "course_category" as const, name, isActive: true, createdAt: now, updatedAt: now })),
    ...fallbackOptions.skillTags.map((name) => ({ id: `fallback-skill-${normalizeToken(name)}`, termType: "skill_tag" as const, name, isActive: true, createdAt: now, updatedAt: now })),
    ...fallbackOptions.topicTags.map((name) => ({ id: `fallback-topic-${normalizeToken(name)}`, termType: "topic_tag" as const, name, isActive: true, createdAt: now, updatedAt: now })),
    ...fallbackOptions.industryTags.map((name) => ({ id: `fallback-industry-${normalizeToken(name)}`, termType: "industry_tag" as const, name, isActive: true, createdAt: now, updatedAt: now })),
    ...fallbackOptions.careerPaths.map((name) => ({ id: `fallback-career-${normalizeToken(name)}`, termType: "career_path" as const, name, isActive: true, createdAt: now, updatedAt: now })),
  ];
};

const resolveCurrentProfileId = async () => {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("get_current_user_profile_id");
    if (error) {
      return null;
    }
    return typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    return null;
  }
};

export const taxonomyService = {
  getTerms: async (includeInactive = false, forceRefresh = false): Promise<TaxonomyTerm[]> => {
    if (!supabase) {
      const fallbackTerms = buildFallbackTerms();
      taxonomyTermsCache = fallbackTerms;
      applyOptionsToRuntimeConfig(groupTerms(fallbackTerms));
      return fallbackTerms;
    }

    if (taxonomyTermsCache && !forceRefresh) {
      return includeInactive ? taxonomyTermsCache : taxonomyTermsCache.filter((term) => term.isActive);
    }

    const { data, error } = await supabase
      .from("taxonomy_terms")
      .select("id, term_type, name, is_active, created_by, created_at, updated_at")
      .order("term_type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.warn("Falling back to static taxonomy options:", error);
      const fallbackTerms = buildFallbackTerms();
      taxonomyTermsCache = fallbackTerms;
      applyOptionsToRuntimeConfig(groupTerms(fallbackTerms));
      return fallbackTerms;
    }

    taxonomyTermsCache = (data || []).map(mapRow);
    applyOptionsToRuntimeConfig(groupTerms(taxonomyTermsCache));
    return includeInactive ? taxonomyTermsCache : taxonomyTermsCache.filter((term) => term.isActive);
  },

  getOptions: async (forceRefresh = false): Promise<TaxonomyOptions> => {
    const terms = await taxonomyService.getTerms(false, forceRefresh);
    const options = groupTerms(terms);
    return applyOptionsToRuntimeConfig(options);
  },

  ensureTerm: async (termType: TaxonomyTermType, rawName: string): Promise<TaxonomyTerm> => {
    const name = normalizeDisplayValue(rawName);
    if (!name) {
      throw new Error("Taxonomy value cannot be empty.");
    }

    const existingTerms = await taxonomyService.getTerms(true);
    const existing = existingTerms.find(
      (term) => term.termType === termType && normalizeToken(term.name) === normalizeToken(name),
    );

    if (existing) {
      if (!existing.isActive && supabase) {
        return taxonomyService.updateTerm(existing.id, { name, isActive: true });
      }
      return existing;
    }

    if (!supabase) {
      throw new Error("Supabase is not initialized.");
    }

    const createdBy = await resolveCurrentProfileId();
    const { data, error } = await supabase
      .from("taxonomy_terms")
      .insert({
        term_type: termType,
        name,
        is_active: true,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      })
      .select("id, term_type, name, is_active, created_by, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    const created = mapRow(data);
    await taxonomyService.getTerms(true, true);
    return created;
  },

  updateTerm: async (id: string, updates: { name?: string; isActive?: boolean }): Promise<TaxonomyTerm> => {
    if (!supabase) {
      throw new Error("Supabase is not initialized.");
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      payload.name = normalizeDisplayValue(updates.name);
    }

    if (updates.isActive !== undefined) {
      payload.is_active = updates.isActive;
    }

    const { data, error } = await supabase
      .from("taxonomy_terms")
      .update(payload)
      .eq("id", id)
      .select("id, term_type, name, is_active, created_by, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    const updated = mapRow(data);
    await taxonomyService.getTerms(true, true);
    return updated;
  },

  deleteTerm: async (id: string): Promise<void> => {
    if (!supabase) {
      throw new Error("Supabase is not initialized.");
    }

    const { error } = await supabase.from("taxonomy_terms").delete().eq("id", id);
    if (error) {
      throw error;
    }

    await taxonomyService.getTerms(true, true);
  },

  primeRuntimeConfig: async () => {
    try {
      return await taxonomyService.getOptions();
    } catch (error) {
      console.warn("Failed to prime runtime taxonomy config, using cached fallback.", error);
      return applyOptionsToRuntimeConfig(getRuntimeTaxonomyConfig());
    }
  },
};