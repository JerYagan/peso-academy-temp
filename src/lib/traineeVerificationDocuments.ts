import { supabase } from "@/lib/supabase";

export const TRAINEE_VERIFICATION_DOCUMENTS_BUCKET = "trainee-verification-documents";
const MAX_PHYSICAL_ID_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHYSICAL_ID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const getFileExtension = (file: File) => {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();

  if (extensionFromName) {
    return extensionFromName;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

export const validatePhysicalIdFile = (file: File): string | null => {
  if (!ALLOWED_PHYSICAL_ID_MIME_TYPES.includes(file.type as (typeof ALLOWED_PHYSICAL_ID_MIME_TYPES)[number])) {
    return "Upload a JPG, PNG, or WebP image for the physical ID.";
  }

  if (file.size > MAX_PHYSICAL_ID_FILE_SIZE_BYTES) {
    return "Physical ID images must be 5 MB or smaller.";
  }

  return null;
};

export const uploadTraineePhysicalIdDocument = async (userId: string, file: File) => {
  const validationError = validatePhysicalIdFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const fileExtension = getFileExtension(file);
  const filePath = `${userId}/physical-id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExtension}`;

  const { error } = await supabase.storage
    .from(TRAINEE_VERIFICATION_DOCUMENTS_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Failed to upload physical ID image: ${error.message}`);
  }

  return filePath;
};

const normalizeStoredDocumentPath = (storedValue: string) => {
  const trimmedValue = storedValue.trim();
  if (!trimmedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const pathname = parsedUrl.pathname;
    if (pathname) {
      const normalizedPathname = pathname.replace(/\\/g, "/");
      const bucketIndex = normalizedPathname.indexOf(`/${TRAINEE_VERIFICATION_DOCUMENTS_BUCKET}/`);
      if (bucketIndex >= 0) {
        return normalizedPathname.slice(bucketIndex + TRAINEE_VERIFICATION_DOCUMENTS_BUCKET.length + 2).split("?")[0];
      }
    }
  } catch {
    // Ignore non-URL values and continue with path normalization.
  }

  const bucketMarkerPatterns = [
    `/storage/v1/object/authenticated/${TRAINEE_VERIFICATION_DOCUMENTS_BUCKET}/`,
    `/storage/v1/object/sign/${TRAINEE_VERIFICATION_DOCUMENTS_BUCKET}/`,
    `/storage/v1/object/public/${TRAINEE_VERIFICATION_DOCUMENTS_BUCKET}/`,
    `${TRAINEE_VERIFICATION_DOCUMENTS_BUCKET}/`,
  ];

  for (const marker of bucketMarkerPatterns) {
    const markerIndex = trimmedValue.indexOf(marker);
    if (markerIndex >= 0) {
      return trimmedValue.slice(markerIndex + marker.length).split("?")[0];
    }
  }

  return trimmedValue.replace(/^\/+/, "").split("?")[0];
};

export const downloadPhysicalIdDocument = async (storedValue: string, userId?: string) => {
  const normalizedValue = normalizeStoredDocumentPath(storedValue);
  const baseName = normalizedValue.split("/").pop() || normalizedValue;

  if (userId && baseName) {
    const { data: allFiles, error: allFilesError } = await supabase.storage
      .from(TRAINEE_VERIFICATION_DOCUMENTS_BUCKET)
      .list(userId, { limit: 100 });

    if (!allFilesError && allFiles && allFiles.length > 0) {
      const likelyMatch = allFiles.find((file) => file.name === baseName)
        || allFiles.find((file) => file.name === normalizedValue)
        || allFiles.find((file) => file.name.includes(baseName))
        || allFiles.find((file) => file.name.startsWith("physical-id-"))
        || null;

      if (likelyMatch) {
        const recoveredPath = `${userId}/${likelyMatch.name}`;
        const { data, error } = await supabase.storage
          .from(TRAINEE_VERIFICATION_DOCUMENTS_BUCKET)
          .download(recoveredPath);

        if (!error && data) {
          return data;
        }
      }
    }
  }

  const candidatePaths = Array.from(
    new Set(
      [
        normalizedValue,
        userId && normalizedValue && !normalizedValue.includes("/") ? `${userId}/${normalizedValue}` : "",
        userId && baseName ? `${userId}/${baseName}` : "",
      ].filter(Boolean),
    ),
  );

  for (const candidatePath of candidatePaths) {
    const { data, error } = await supabase.storage
      .from(TRAINEE_VERIFICATION_DOCUMENTS_BUCKET)
      .download(candidatePath);

    if (!error && data) {
      return data;
    }
  }

  throw new Error("Failed to load the uploaded physical ID image.");
};

export const getPhysicalIdDocumentName = (filePath: string) => filePath.split("/").pop() || "Uploaded ID image";