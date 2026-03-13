import { supabase } from "@/lib/supabase";

const COURSE_MATERIALS_BUCKET = "course-materials";
const COURSE_MATERIALS_URL_SEGMENTS = [
  `/storage/v1/object/public/${COURSE_MATERIALS_BUCKET}/`,
  `/storage/v1/object/sign/${COURSE_MATERIALS_BUCKET}/`,
  `/storage/v1/object/authenticated/${COURSE_MATERIALS_BUCKET}/`,
  `/storage/v1/render/image/public/${COURSE_MATERIALS_BUCKET}/`,
  `/storage/v1/render/image/authenticated/${COURSE_MATERIALS_BUCKET}/`,
];

const stripLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildPublicUrl = (path: string) => {
  const normalizedPath = decodePath(stripLeadingSlashes(path));

  if (!supabase) {
    return normalizedPath;
  }

  const { data } = supabase.storage.from(COURSE_MATERIALS_BUCKET).getPublicUrl(normalizedPath);
  return data.publicUrl;
};

const buildSignedUrl = async (path: string, expiresInSeconds = 60 * 60) => {
  const normalizedPath = decodePath(stripLeadingSlashes(path));

  if (!supabase) {
    return normalizedPath;
  }

  const { data, error } = await supabase.storage
    .from(COURSE_MATERIALS_BUCKET)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return buildPublicUrl(normalizedPath);
  }

  return data.signedUrl;
};

const extractCourseMaterialPath = (value: string): string | null => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (/^(blob:|data:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    for (const segment of COURSE_MATERIALS_URL_SEGMENTS) {
      const segmentIndex = trimmedValue.indexOf(segment);
      if (segmentIndex >= 0) {
        const storagePath = trimmedValue
          .slice(segmentIndex + segment.length)
          .split("#")[0]
          .split("?")[0];

        return stripLeadingSlashes(storagePath);
      }
    }

    return null;
  }

  if (trimmedValue.startsWith(`${COURSE_MATERIALS_BUCKET}/`)) {
    return stripLeadingSlashes(trimmedValue.slice(COURSE_MATERIALS_BUCKET.length + 1));
  }

  return stripLeadingSlashes(trimmedValue);
};

export const resolveCourseMaterialUrl = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  if (/^(blob:|data:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  const storagePath = extractCourseMaterialPath(trimmedValue);
  if (storagePath === null) {
    return trimmedValue;
  }

  if (/^(blob:|data:)/i.test(storagePath)) {
    return storagePath;
  }

  return buildPublicUrl(storagePath);
};

export const resolveCourseMaterialAccessUrl = async (
  value?: string | null,
  expiresInSeconds = 60 * 60,
): Promise<string | undefined> => {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  if (/^(blob:|data:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  const storagePath = extractCourseMaterialPath(trimmedValue);
  if (storagePath === null) {
    return trimmedValue;
  }

  if (/^(blob:|data:)/i.test(storagePath)) {
    return storagePath;
  }

  return buildSignedUrl(storagePath, expiresInSeconds);
};

export const resolveCourseMaterialUrls = (values?: string[] | null): string[] => {
  if (!values?.length) {
    return [];
  }

  return values
    .map((value) => resolveCourseMaterialUrl(value) ?? value)
    .filter((value): value is string => Boolean(value));
};