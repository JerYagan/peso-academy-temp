import { describe, expect, it } from "vitest";

import { buildEmbedVideoUrl, getVideoProvider, isSupportedCourseVideoUrl } from "@/lib/videoEmbeds";

describe("videoEmbeds", () => {
  it("detects supported providers", () => {
    expect(getVideoProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
    expect(getVideoProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(getVideoProvider("https://vimeo.com/148751763")).toBe("vimeo");
    expect(getVideoProvider("https://www.loom.com/share/1234567890abcdef1234567890abcdef")).toBe("loom");
    expect(getVideoProvider("https://cdn.example.com/video.mp4")).toBe("file");
  });

  it("builds stable embed urls", () => {
    expect(buildEmbedVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1",
    );
    expect(buildEmbedVideoUrl("https://player.vimeo.com/video/148751763")).toBe(
      "https://player.vimeo.com/video/148751763",
    );
    expect(buildEmbedVideoUrl("https://www.loom.com/share/1234567890abcdef1234567890abcdef")).toBe(
      "https://www.loom.com/embed/1234567890abcdef1234567890abcdef",
    );
  });

  it("marks loom links as supported course videos", () => {
    expect(isSupportedCourseVideoUrl("https://www.loom.com/share/1234567890abcdef1234567890abcdef")).toBe(true);
    expect(isSupportedCourseVideoUrl("https://example.com/resource.pdf")).toBe(false);
  });
});