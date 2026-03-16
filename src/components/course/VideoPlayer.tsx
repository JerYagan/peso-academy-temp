import { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { progressTrackingService } from "@/services/progressTrackingService";
import { resolveCourseMaterialAccessUrl } from "@/lib/courseAssets";
import { buildEmbedVideoUrl, getVideoProvider, isHostedVideoFile } from "@/lib/videoEmbeds";

type TypedReactPlayerProps = React.ComponentProps<typeof ReactPlayer>;

const TypedReactPlayer = ReactPlayer as React.ComponentType<TypedReactPlayerProps>;
const PLAYER_CONFIG: TypedReactPlayerProps["config"] = {
  youtube: {
    playerVars: {
      modestbranding: 1,
      rel: 0,
    },
  },
  vimeo: {
    controls: true,
    dnt: true,
    responsive: true,
  },
};

interface VideoPlayerProps {
  url: string;
  title?: string;
  enrollmentId?: string;
  moduleId?: string;
  onPlaybackPositionChange?: (seconds: number) => void;
}

const VideoPlayer = ({ url, title, enrollmentId, moduleId, onPlaybackPositionChange }: VideoPlayerProps) => {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactPlayer ref type is complex
  const playerRef = useRef<any>(null);
  const progressSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const timeTrackingInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTime = useRef<number>(Date.now());
  const lastTrackedTime = useRef<number>(0);

  const handlePlaybackPositionUpdate = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }

    setProgress(seconds);
    onPlaybackPositionChange?.(seconds);
  }, [onPlaybackPositionChange]);

  const handleDurationUpdate = useCallback((nextDuration: number) => {
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) {
      return;
    }

    setDuration(nextDuration);
  }, []);

  const seekPlayerTo = useCallback((seconds: number) => {
    if (!playerRef.current || !Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    if (typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(seconds);
      return;
    }

    if ("currentTime" in playerRef.current) {
      playerRef.current.currentTime = seconds;
    }
  }, []);

  const loadVideoProgress = useCallback(async () => {
    if (!supabase || !enrollmentId || !moduleId || !user) return;

    try {
      // Store video progress in a separate table or use localStorage as fallback
      const storageKey = `video_progress_${enrollmentId}_${moduleId}_${url}`;
      const savedProgress = localStorage.getItem(storageKey);
      
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);
        if (parsed.progress && parsed.duration) {
          setProgress(parsed.progress);
          onPlaybackPositionChange?.(parsed.progress);
        }
      }
    } catch (error) {
      console.error("Error loading video progress:", error);
    }
  }, [enrollmentId, moduleId, onPlaybackPositionChange, user, url]);

  const saveVideoProgress = useCallback(async () => {
    if (!enrollmentId || !moduleId || !user || !duration) return;

    try {
      const storageKey = `video_progress_${enrollmentId}_${moduleId}_${url}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          progress,
          duration,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("Error saving video progress:", error);
    }
  }, [enrollmentId, moduleId, user, url, progress, duration]);

  // Load saved progress
  useEffect(() => {
    if (enrollmentId && moduleId && user) {
      loadVideoProgress();
    }
  }, [enrollmentId, moduleId, user, loadVideoProgress]);

  useEffect(() => {
    let isActive = true;

    const resolveUrl = async () => {
      setIsReady(false);
      setLoadError(null);
      setResolvedUrl("");
      const nextUrl = await resolveCourseMaterialAccessUrl(url);
      if (!isActive) {
        return;
      }

      setResolvedUrl(nextUrl || url);
    };

    void resolveUrl();

    return () => {
      isActive = false;
    };
  }, [url]);

  // Save progress periodically
  useEffect(() => {
    if (enrollmentId && moduleId && user && duration > 0) {
      // Save progress every 10 seconds
      progressSaveInterval.current = setInterval(() => {
        saveVideoProgress();
      }, 10000);

      return () => {
        if (progressSaveInterval.current) {
          clearInterval(progressSaveInterval.current);
        }
      };
    }
  }, [enrollmentId, moduleId, user, duration, saveVideoProgress]);

  // Track time spent periodically (every 30 seconds)
  useEffect(() => {
    if (enrollmentId && moduleId && user) {
      sessionStartTime.current = Date.now();
      
      timeTrackingInterval.current = setInterval(async () => {
        const currentTime = Date.now();
        const timeSpentSeconds = Math.floor((currentTime - sessionStartTime.current) / 1000);
        
        // Only track if at least 30 seconds have passed since last tracking
        if (timeSpentSeconds >= 30 && timeSpentSeconds > lastTrackedTime.current) {
          try {
            await progressTrackingService.trackModuleTime(
              enrollmentId,
              moduleId,
              timeSpentSeconds - lastTrackedTime.current
            );
            lastTrackedTime.current = timeSpentSeconds;
            sessionStartTime.current = currentTime; // Reset session start time
          } catch (error) {
            console.error("Error tracking module time:", error);
          }
        }
      }, 30000); // Track every 30 seconds

      return () => {
        if (timeTrackingInterval.current) {
          clearInterval(timeTrackingInterval.current);
          // Track remaining time when component unmounts
          const finalTimeSpent = Math.floor((Date.now() - sessionStartTime.current) / 1000);
          if (finalTimeSpent > lastTrackedTime.current && enrollmentId && moduleId) {
            progressTrackingService
              .trackModuleTime(
                enrollmentId,
                moduleId,
                finalTimeSpent - lastTrackedTime.current
              )
              .catch((error) => console.error("Error tracking final time:", error));
          }
        }
      };
    }
  }, [enrollmentId, moduleId, user]);

  const handleNativeLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsReady(true);
    handleDurationUpdate(event.currentTarget.duration);
    if (progress > 0) {
      event.currentTarget.currentTime = progress;
      handlePlaybackPositionUpdate(progress);
    }
  };

  const handleNativeTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    handlePlaybackPositionUpdate(event.currentTarget.currentTime);
  };

  const handleReactPlayerReady = useCallback(() => {
    setIsReady(true);
    if (progress > 0) {
      seekPlayerTo(progress);
    }
  }, [progress, seekPlayerTo]);

  const handleReactPlayerTimeUpdate = useCallback((event: React.SyntheticEvent<Element>) => {
    const mediaElement = event.currentTarget as HTMLMediaElement | null;
    const nextTime = mediaElement?.currentTime ?? (playerRef.current && "currentTime" in playerRef.current ? playerRef.current.currentTime : NaN);
    handlePlaybackPositionUpdate(nextTime);
  }, [handlePlaybackPositionUpdate]);

  const handleReactPlayerDurationChange = useCallback((event: React.SyntheticEvent<Element>) => {
    const mediaElement = event.currentTarget as HTMLMediaElement | null;
    const nextDuration = mediaElement?.duration ?? (playerRef.current && "duration" in playerRef.current ? playerRef.current.duration : NaN);
    handleDurationUpdate(nextDuration);
  }, [handleDurationUpdate]);

  const handleExternalPlayerError = useCallback(() => {
    setLoadError("Unable to load this video.");
    setIsReady(true);
  }, []);

  // Check if URL is valid
  if (!url || url.trim() === "") {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Invalid video URL</p>
      </Card>
    );
  }

  if (!resolvedUrl) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  const provider = getVideoProvider(resolvedUrl);
  const loomEmbedUrl = provider === "loom" ? buildEmbedVideoUrl(resolvedUrl) : null;

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}> {/* 16:9 aspect ratio */}
        <div className="absolute top-0 left-0 w-full h-full bg-black rounded-lg overflow-hidden">
          {!isReady && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {loadError ? (
            <div className="flex h-full items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground">
              {loadError}
            </div>
          ) : isHostedVideoFile(resolvedUrl) ? (
            <video
              src={resolvedUrl}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full"
              onLoadedMetadata={handleNativeLoadedMetadata}
              onTimeUpdate={handleNativeTimeUpdate}
            >
              Your browser does not support the video tag.
            </video>
          ) : loomEmbedUrl ? (
            <iframe
              src={loomEmbedUrl}
              title={title || "Loom video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
              onLoad={() => setIsReady(true)}
            />
          ) : (
            <TypedReactPlayer
              ref={playerRef}
              src={resolvedUrl}
              width="100%"
              height="100%"
              controls
              playsInline
              onReady={handleReactPlayerReady}
              onTimeUpdate={handleReactPlayerTimeUpdate}
              onDurationChange={handleReactPlayerDurationChange}
              onError={handleExternalPlayerError}
              config={PLAYER_CONFIG}
            />
          )}
        </div>
      </div>
      {title && (
        <p className="mt-2 text-sm font-medium text-center">{title}</p>
      )}
    </div>
  );
};

export default VideoPlayer;

