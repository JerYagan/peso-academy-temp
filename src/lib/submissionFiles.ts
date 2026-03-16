import { supabase } from "@/lib/supabase";

export const SUBMISSIONS_BUCKET = "submissions";

const SUBMISSION_URL_SEGMENTS = [
  `/storage/v1/object/public/${SUBMISSIONS_BUCKET}/`,
  `/storage/v1/object/sign/${SUBMISSIONS_BUCKET}/`,
  `/storage/v1/object/authenticated/${SUBMISSIONS_BUCKET}/`,
];

const stripLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const decodePath = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const extractSubmissionStoragePath = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^(blob:|data:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    for (const segment of SUBMISSION_URL_SEGMENTS) {
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

  if (trimmedValue.startsWith(`${SUBMISSIONS_BUCKET}/`)) {
    return stripLeadingSlashes(trimmedValue.slice(SUBMISSIONS_BUCKET.length + 1));
  }

  return stripLeadingSlashes(trimmedValue);
};

export const getSubmissionAttachmentName = (value?: string | null, fallback = "submission") => {
  const storagePath = extractSubmissionStoragePath(value);
  if (!storagePath) {
    return fallback;
  }

  return decodePath(storagePath.split("/").pop() || fallback);
};

export const createSubmissionAccessUrl = async (value?: string | null, expiresInSeconds = 60 * 60) => {
  if (!value) {
    return undefined;
  }

  const storagePath = extractSubmissionStoragePath(value);
  if (!storagePath) {
    return value;
  }

  if (/^(blob:|data:)/i.test(storagePath)) {
    return storagePath;
  }

  if (!supabase) {
    return value;
  }

  const normalizedPath = decodePath(storagePath);
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return value;
  }

  return data.signedUrl;
};

export const downloadSubmissionFile = async (value?: string | null, fileName?: string) => {
  const storagePath = extractSubmissionStoragePath(value);
  if (!storagePath || /^(blob:|data:)/i.test(storagePath)) {
    throw new Error("No submission file is available for download.");
  }

  if (!supabase) {
    throw new Error("Storage client is not available.");
  }

  const normalizedPath = decodePath(storagePath);
  const { data, error } = await supabase.storage.from(SUBMISSIONS_BUCKET).download(normalizedPath);

  if (error || !data) {
    throw error || new Error("Failed to download file");
  }

  const downloadUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName || getSubmissionAttachmentName(normalizedPath);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
};