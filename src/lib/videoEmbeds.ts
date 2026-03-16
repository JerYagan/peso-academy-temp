const HOSTED_VIDEO_FILE_PATTERN = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

export type VideoProvider = "file" | "youtube" | "vimeo" | "loom" | "other";

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeHostname = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");

const extractYouTubeId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHostname(parsedUrl.hostname);

  if (hostname === "youtu.be") {
    const [videoId] = parsedUrl.pathname.split("/").filter(Boolean);
    return videoId || null;
  }

  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") {
    return null;
  }

  if (parsedUrl.pathname === "/watch") {
    return parsedUrl.searchParams.get("v");
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathSegments.length >= 2 && ["embed", "shorts", "live"].includes(pathSegments[0])) {
    return pathSegments[1] || null;
  }

  return null;
};

const extractVimeoId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHostname(parsedUrl.hostname);
  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
    return null;
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    if (/^\d+$/.test(pathSegments[index])) {
      return pathSegments[index];
    }
  }

  return null;
};

const extractLoomId = (parsedUrl: URL): string | null => {
  const hostname = normalizeHostname(parsedUrl.hostname);
  if (hostname !== "loom.com") {
    return null;
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathSegments.length >= 2 && ["share", "embed"].includes(pathSegments[0])) {
    return pathSegments[1] || null;
  }

  return null;
};

export const isHostedVideoFile = (value: string) => HOSTED_VIDEO_FILE_PATTERN.test(value);

export const getVideoProvider = (value?: string | null): VideoProvider => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "other";
  }

  if (isHostedVideoFile(trimmedValue)) {
    return "file";
  }

  const parsedUrl = parseUrl(trimmedValue);
  if (!parsedUrl) {
    return "other";
  }

  if (extractYouTubeId(parsedUrl)) {
    return "youtube";
  }

  if (extractVimeoId(parsedUrl)) {
    return "vimeo";
  }

  if (extractLoomId(parsedUrl)) {
    return "loom";
  }

  return "other";
};

export const buildEmbedVideoUrl = (value?: string | null): string | null => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  const parsedUrl = parseUrl(trimmedValue);
  if (!parsedUrl) {
    return null;
  }

  const youtubeId = extractYouTubeId(parsedUrl);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
  }

  const vimeoId = extractVimeoId(parsedUrl);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`;
  }

  const loomId = extractLoomId(parsedUrl);
  if (loomId) {
    return `https://www.loom.com/embed/${loomId}`;
  }

  return null;
};

export const isSupportedCourseVideoUrl = (value?: string | null) => getVideoProvider(value) !== "other";