import { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { progressTrackingService } from "@/services/progressTrackingService";
import { resolveCourseMaterialAccessUrl } from "@/lib/courseAssets";

// Type assertion for ReactPlayer to handle type definition issues
const TypedReactPlayer = ReactPlayer as React.ComponentType<any>;

interface VideoPlayerProps {
  url: string;
  title?: string;
  enrollmentId?: string;
  moduleId?: string;
  onPlaybackPositionChange?: (seconds: number) => void;
}

const isHostedVideoFile = (value: string) => /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(value);

const VideoPlayer = ({ url, title, enrollmentId, moduleId, onPlaybackPositionChange }: VideoPlayerProps) => {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactPlayer ref type is complex
  const playerRef = useRef<any>(null);
  const progressSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const timeTrackingInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTime = useRef<number>(Date.now());
  const lastTrackedTime = useRef<number>(0);

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

  const handleProgress = (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => {
    setProgress(state.playedSeconds);
    onPlaybackPositionChange?.(state.playedSeconds);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
    onPlaybackPositionChange?.(seconds);
  };

  const handleNativeLoadedMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsReady(true);
    const nextDuration = event.currentTarget.duration;
    if (Number.isFinite(nextDuration)) {
      setDuration(nextDuration);
    }
    if (progress > 0) {
      event.currentTarget.currentTime = progress;
      onPlaybackPositionChange?.(progress);
    }
  };

  const handleNativeTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setProgress(event.currentTarget.currentTime);
    onPlaybackPositionChange?.(event.currentTarget.currentTime);
  };

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

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}> {/* 16:9 aspect ratio */}
        <div className="absolute top-0 left-0 w-full h-full bg-black rounded-lg overflow-hidden">
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {isHostedVideoFile(resolvedUrl) ? (
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
          ) : (
            <TypedReactPlayer
              ref={playerRef}
              url={resolvedUrl}
              width="100%"
              height="100%"
              controls
              playing={false}
              onReady={() => {
                setIsReady(true);
                if (progress > 0 && duration > 0) {
                  handleSeek(progress);
                }
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactPlayer onProgress type
              onProgress={handleProgress as any}
              onDuration={handleDuration}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactPlayer config types are incomplete
              config={{
                youtube: {
                  playerVars: {
                    modestbranding: 1,
                    rel: 0,
                  },
                },
                vimeo: {
                  playerOptions: {
                    responsive: true,
                  },
                },
              } as any}
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

