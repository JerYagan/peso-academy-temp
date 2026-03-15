export const TAXONOMY_COURSE_CATEGORIES = [
  "Digital Skills",
  "Technical Skills",
  "Employability Skills",
  "Business & Management",
  "Entrepreneurship",
  "Personal Development",
  "Hospitality & Tourism",
  "Construction & Trades",
  "Creative & Design",
  "Others",
] as const;

export const TAXONOMY_SKILL_TAGS = [
  "Computer Basics",
  "Digital Literacy",
  "Internet Navigation",
  "Microsoft Office",
  "Email Etiquette",
  "Online Collaboration",
  "Data Entry",
  "Office Administration",
  "Communication",
  "Customer Service",
  "Problem Solving",
  "Professional Communication",
  "Resume Writing",
  "Interview Skills",
  "Work Ethics",
  "HTML",
  "CSS",
  "JavaScript",
  "Web Development",
  "Mobile Development",
  "React Native",
  "API Integration",
  "Business Planning",
  "Marketing",
  "Financial Management",
  "Project Coordination",
  "Entrepreneurship",
  "Graphic Design",
  "Hospitality Service",
  "Construction Safety",
] as const;

export const TAXONOMY_TOPIC_TAGS = [
  "Digital Literacy",
  "Office Productivity",
  "Data Management",
  "Customer Relations",
  "Career Readiness",
  "Professional Communication",
  "Web Development",
  "Mobile Development",
  "Entrepreneurship Fundamentals",
  "Marketing Strategy",
  "Financial Literacy",
  "Project Management",
  "Hospitality Service",
  "Construction Safety",
  "Creative Design",
] as const;

export const TAXONOMY_INDUSTRY_TAGS = [
  "Digital Services",
  "Office Administration",
  "Customer Service",
  "Retail and Sales",
  "Entrepreneurship",
  "Hospitality and Tourism",
  "Construction and Trades",
  "Creative and Design",
] as const;

export const TAXONOMY_CAREER_PATHS = [
  "Administrative Assistant",
  "Office Staff",
  "Customer Service Associate",
  "Retail Sales Associate",
  "Digital Support Associate",
  "Marketing Assistant",
  "Graphic Designer",
  "Web Developer",
  "Mobile App Developer",
  "Entrepreneur",
  "Hospitality Service Associate",
  "Construction Support Technician",
] as const;

export type TaxonomyCourseCategory = string;
export type TaxonomySkillTag = string;
export type TaxonomyTopicTag = string;

type RuntimeTaxonomyConfig = {
  courseCategories: string[];
  skillTags: string[];
  topicTags: string[];
};

export const TAXONOMY_EDITOR_RULES = {
  owners: ["admin", "trainer"],
  note: "Only admin and trainer users should add or edit course, module, and assessment taxonomy tags. Learner onboarding may select preferred course categories only from the approved list.",
} as const;

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDisplayValue = (value: string | null | undefined) =>
  value
    ?.trim()
    .replace(/\s+/g, " ") || "";

const dedupeByToken = <T extends string>(values: readonly T[]) => {
  const seen = new Set<string>();

  return values.reduce<T[]>((result, value) => {
    const displayValue = normalizeDisplayValue(value) as T;
    if (!displayValue) {
      return result;
    }

    const token = normalizeToken(displayValue);
    if (!token || seen.has(token)) {
      return result;
    }

    seen.add(token);
    result.push(displayValue);
    return result;
  }, []);
};

let runtimeTaxonomyConfig: RuntimeTaxonomyConfig = {
  courseCategories: dedupeByToken([...TAXONOMY_COURSE_CATEGORIES]),
  skillTags: dedupeByToken([...TAXONOMY_SKILL_TAGS]),
  topicTags: dedupeByToken([...TAXONOMY_TOPIC_TAGS]),
};

export const getRuntimeTaxonomyConfig = (): RuntimeTaxonomyConfig => ({
  courseCategories: [...runtimeTaxonomyConfig.courseCategories],
  skillTags: [...runtimeTaxonomyConfig.skillTags],
  topicTags: [...runtimeTaxonomyConfig.topicTags],
});

export const setRuntimeTaxonomyConfig = (config: Partial<RuntimeTaxonomyConfig>) => {
  runtimeTaxonomyConfig = {
    courseCategories: config.courseCategories ? dedupeByToken(config.courseCategories) : runtimeTaxonomyConfig.courseCategories,
    skillTags: config.skillTags ? dedupeByToken(config.skillTags) : runtimeTaxonomyConfig.skillTags,
    topicTags: config.topicTags ? dedupeByToken(config.topicTags) : runtimeTaxonomyConfig.topicTags,
  };
};

const buildCanonicalLookup = <T extends readonly string[]>(values: T) => {
  return values.reduce<Record<string, T[number]>>((lookup, value) => {
    lookup[normalizeToken(value)] = value;
    return lookup;
  }, {});
};

const getCategoryLookup = () => buildCanonicalLookup(runtimeTaxonomyConfig.courseCategories);
const getSkillLookup = () => buildCanonicalLookup(runtimeTaxonomyConfig.skillTags);
const getTopicLookup = () => buildCanonicalLookup(runtimeTaxonomyConfig.topicTags);

const CATEGORY_ALIASES: Record<string, TaxonomyCourseCategory> = {
  "soft skills": "Employability Skills",
  "career development": "Employability Skills",
  "employability": "Employability Skills",
  "digital literacy": "Digital Skills",
  "digital skills fundamentals": "Digital Skills",
  "vocational training": "Technical Skills",
  "technical": "Technical Skills",
  "business management": "Business & Management",
  "business and management": "Business & Management",
  "personal growth": "Personal Development",
  "creative and design": "Creative & Design",
  "construction and trades": "Construction & Trades",
  "hospitality and tourism": "Hospitality & Tourism",
  other: "Others",
  others: "Others",
};

const SKILL_ALIASES: Record<string, TaxonomySkillTag> = {
  "basic computer skills": "Computer Basics",
  "computer literacy": "Digital Literacy",
  "internet basics": "Internet Navigation",
  "office productivity": "Microsoft Office",
  "microsoft office suite": "Microsoft Office",
  "workplace communication": "Professional Communication",
  "communication skills": "Communication",
  "customer relations": "Customer Service",
  "resume preparation": "Resume Writing",
  "job interview skills": "Interview Skills",
  "professional ethics": "Work Ethics",
  "web design": "Web Development",
  "mobile app development": "Mobile Development",
  "business startup": "Entrepreneurship",
  "business basics": "Business Planning",
  "financial literacy": "Financial Management",
  organization: "Project Coordination",
};

const TOPIC_ALIASES: Record<string, TaxonomyTopicTag> = {
  "office administration": "Office Productivity",
  "microsoft office": "Office Productivity",
  "data entry": "Data Management",
  communication: "Professional Communication",
  "customer service": "Customer Relations",
  "resume writing": "Career Readiness",
  "interview skills": "Career Readiness",
  "work ethics": "Career Readiness",
  html: "Web Development",
  css: "Web Development",
  javascript: "Web Development",
  "react native": "Mobile Development",
  marketing: "Marketing Strategy",
  "financial management": "Financial Literacy",
  entrepreneurship: "Entrepreneurship Fundamentals",
  "graphic design": "Creative Design",
};

const CATEGORY_SKILL_MAP: Record<string, readonly string[]> = {
  "Digital Skills": ["Computer Basics", "Digital Literacy", "Internet Navigation", "Microsoft Office", "Email Etiquette", "Online Collaboration"],
  "Technical Skills": ["HTML", "CSS", "JavaScript", "Web Development", "Mobile Development", "React Native", "API Integration", "Construction Safety"],
  "Employability Skills": ["Communication", "Customer Service", "Problem Solving", "Professional Communication", "Resume Writing", "Interview Skills", "Work Ethics"],
  "Business & Management": ["Office Administration", "Data Entry", "Project Coordination", "Microsoft Office", "Communication"],
  Entrepreneurship: ["Business Planning", "Marketing", "Financial Management", "Entrepreneurship", "Project Coordination"],
  "Personal Development": ["Communication", "Problem Solving", "Professional Communication", "Work Ethics"],
  "Hospitality & Tourism": ["Customer Service", "Professional Communication", "Hospitality Service", "Problem Solving"],
  "Construction & Trades": ["Construction Safety", "Problem Solving", "Project Coordination"],
  "Creative & Design": ["Graphic Design", "Professional Communication", "Marketing"],
  Others: [...TAXONOMY_SKILL_TAGS],
};

const CATEGORY_TOPIC_MAP: Record<string, readonly string[]> = {
  "Digital Skills": ["Digital Literacy", "Office Productivity", "Data Management"],
  "Technical Skills": ["Web Development", "Mobile Development", "Construction Safety"],
  "Employability Skills": ["Career Readiness", "Professional Communication", "Customer Relations"],
  "Business & Management": ["Office Productivity", "Project Management", "Data Management"],
  Entrepreneurship: ["Entrepreneurship Fundamentals", "Marketing Strategy", "Financial Literacy"],
  "Personal Development": ["Professional Communication", "Career Readiness"],
  "Hospitality & Tourism": ["Hospitality Service", "Customer Relations", "Professional Communication"],
  "Construction & Trades": ["Construction Safety", "Project Management"],
  "Creative & Design": ["Creative Design", "Marketing Strategy"],
  Others: [...TAXONOMY_TOPIC_TAGS],
};

const SKILL_TO_TOPICS: Partial<Record<string, readonly string[]>> = {
  "Computer Basics": ["Digital Literacy"],
  "Digital Literacy": ["Digital Literacy"],
  "Internet Navigation": ["Digital Literacy"],
  "Microsoft Office": ["Office Productivity"],
  "Email Etiquette": ["Professional Communication"],
  "Online Collaboration": ["Professional Communication"],
  "Data Entry": ["Data Management"],
  "Office Administration": ["Office Productivity", "Project Management"],
  Communication: ["Professional Communication"],
  "Customer Service": ["Customer Relations"],
  "Problem Solving": ["Project Management"],
  "Professional Communication": ["Professional Communication"],
  "Resume Writing": ["Career Readiness"],
  "Interview Skills": ["Career Readiness"],
  "Work Ethics": ["Career Readiness"],
  HTML: ["Web Development"],
  CSS: ["Web Development"],
  JavaScript: ["Web Development"],
  "Web Development": ["Web Development"],
  "Mobile Development": ["Mobile Development"],
  "React Native": ["Mobile Development"],
  "API Integration": ["Web Development", "Mobile Development"],
  "Business Planning": ["Entrepreneurship Fundamentals"],
  Marketing: ["Marketing Strategy"],
  "Financial Management": ["Financial Literacy"],
  "Project Coordination": ["Project Management"],
  Entrepreneurship: ["Entrepreneurship Fundamentals"],
  "Graphic Design": ["Creative Design"],
  "Hospitality Service": ["Hospitality Service"],
  "Construction Safety": ["Construction Safety"],
};

const dedupe = <T extends string>(values: T[]) => dedupeByToken(values);

const canonicalizeWithLookup = <T extends string>(
  value: string | null | undefined,
  lookup: Record<string, T>,
  aliases: Record<string, T>,
): T | null => {
  if (!value) return null;
  const normalized = normalizeToken(value);
  return aliases[normalized] || lookup[normalized] || null;
};

export const canonicalizeCourseCategory = (value: string | null | undefined): TaxonomyCourseCategory | null => {
  const direct = canonicalizeWithLookup(value, getCategoryLookup(), CATEGORY_ALIASES);
  if (direct) return direct;

  const normalized = normalizeToken(value || "");
  if (!normalized) return null;
  if (normalized.includes("digital")) return "Digital Skills";
  if (normalized.includes("technical") || normalized.includes("web") || normalized.includes("mobile") || normalized.includes("trade") || normalized.includes("vocational")) return "Technical Skills";
  if (normalized.includes("career") || normalized.includes("employ") || normalized.includes("soft")) return "Employability Skills";
  if (normalized.includes("business") || normalized.includes("management") || normalized.includes("office")) return "Business & Management";
  if (normalized.includes("entrepreneur")) return "Entrepreneurship";
  if (normalized.includes("personal")) return "Personal Development";
  if (normalized.includes("hospitality") || normalized.includes("tourism")) return "Hospitality & Tourism";
  if (normalized.includes("construction") || normalized.includes("safety")) return "Construction & Trades";
  if (normalized.includes("creative") || normalized.includes("design")) return "Creative & Design";
  if (normalized === "other" || normalized === "others") return "Others";
  return null;
};

export const canonicalizeSkillTag = (value: string | null | undefined): TaxonomySkillTag | null =>
  canonicalizeWithLookup(value, getSkillLookup(), SKILL_ALIASES);

export const canonicalizeTopicTag = (value: string | null | undefined): TaxonomyTopicTag | null =>
  canonicalizeWithLookup(value, getTopicLookup(), TOPIC_ALIASES);

export const normalizeSkillTags = (values?: readonly string[] | null): TaxonomySkillTag[] =>
  dedupe((values || []).map((value) => canonicalizeSkillTag(value)).filter(Boolean) as TaxonomySkillTag[]);

export const normalizeTopicTags = (values?: readonly string[] | null): TaxonomyTopicTag[] =>
  dedupe((values || []).map((value) => canonicalizeTopicTag(value)).filter(Boolean) as TaxonomyTopicTag[]);

export const normalizeCourseCategories = (values?: readonly string[] | null): TaxonomyCourseCategory[] =>
  dedupe((values || []).map((value) => canonicalizeCourseCategory(value)).filter(Boolean) as TaxonomyCourseCategory[]);

export const getAllowedSkillTagsForCategory = (category?: string | null): TaxonomySkillTag[] => {
  const canonicalCategory = canonicalizeCourseCategory(category);
  if (canonicalCategory && CATEGORY_SKILL_MAP[canonicalCategory]) {
    return dedupe([...CATEGORY_SKILL_MAP[canonicalCategory]]);
  }

  return [...runtimeTaxonomyConfig.skillTags];
};

export const getAllowedTopicTagsForCategory = (category?: string | null): TaxonomyTopicTag[] => {
  const canonicalCategory = canonicalizeCourseCategory(category);
  if (canonicalCategory && CATEGORY_TOPIC_MAP[canonicalCategory]) {
    return dedupe([...CATEGORY_TOPIC_MAP[canonicalCategory]]);
  }

  return [...runtimeTaxonomyConfig.topicTags];
};

export const deriveTopicTags = (category?: string | null, skillTags?: readonly string[] | null, explicitTopicTags?: readonly string[] | null): TaxonomyTopicTag[] => {
  const directTopics = normalizeTopicTags(explicitTopicTags);
  if (directTopics.length > 0) return directTopics;

  const normalizedSkills = normalizeSkillTags(skillTags);
  const inferredFromSkills = normalizedSkills.flatMap((skill) => SKILL_TO_TOPICS[skill] || []);
  const inferredFromCategory = getAllowedTopicTagsForCategory(category).slice(0, 3);
  return dedupe([...inferredFromSkills, ...inferredFromCategory]);
};

export const deriveSkillTags = (category?: string | null, explicitSkillTags?: readonly string[] | null): TaxonomySkillTag[] => {
  const directSkills = normalizeSkillTags(explicitSkillTags);
  if (directSkills.length > 0) return directSkills;
  return getAllowedSkillTagsForCategory(category).slice(0, 4);
};

export const buildCanonicalCourseTaxonomy = (input: {
  category?: string | null;
  skills?: readonly string[] | null;
  topicTags?: readonly string[] | null;
}) => {
  const category = canonicalizeCourseCategory(input.category);
  const skillTags = deriveSkillTags(category, input.skills);
  const topicTags = deriveTopicTags(category, skillTags, input.topicTags);

  return {
    category,
    skillTags,
    topicTags,
  };
};

export const hasCanonicalTopicMatch = (candidate: string | null | undefined, allowedTopics: readonly string[] | null | undefined) => {
  const canonicalCandidate = canonicalizeTopicTag(candidate);
  if (!canonicalCandidate) return false;
  return normalizeTopicTags(allowedTopics).includes(canonicalCandidate);
};

export const hasCanonicalSkillMatch = (candidate: string | null | undefined, allowedSkills: readonly string[] | null | undefined) => {
  const canonicalCandidate = canonicalizeSkillTag(candidate);
  if (!canonicalCandidate) return false;
  return normalizeSkillTags(allowedSkills).includes(canonicalCandidate);
};