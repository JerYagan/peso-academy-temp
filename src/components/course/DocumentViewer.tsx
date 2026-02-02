import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, ExternalLink, Loader2, Image, Video } from "lucide-react";

interface DocumentViewerProps {
  url: string;
  title?: string;
}

/** Get file extension from URL path (ignores query string). */
function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() || "";
    const dot = last.lastIndexOf(".");
    return dot >= 0 ? last.slice(dot).toLowerCase() : "";
  } catch {
    return "";
  }
}

type MediaType = "pdf" | "video" | "image" | "other";

function getMediaType(url: string): MediaType {
  const ext = getExtension(url);
  if (ext === ".pdf") return "pdf";
  if ([".mp4", ".webm"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return "image";
  return "other";
}

const DocumentViewer = ({ url, title }: DocumentViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mediaType = getMediaType(url);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = url;
    link.download = title || "document";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(url, "_blank");
  };

  if (!url || url.trim() === "") {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Invalid document URL</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document label and actions (for non-embedded or as fallback) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mediaType === "image" && <Image className="w-5 h-5 text-muted-foreground" />}
          {mediaType === "video" && <Video className="w-5 h-5 text-muted-foreground" />}
          {(mediaType === "pdf" || mediaType === "other") && <FileText className="w-5 h-5 text-muted-foreground" />}
          <span className="text-sm font-medium">{title || "Document"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Inline preview: PDF */}
      {mediaType === "pdf" && (
        <Card className="overflow-hidden">
          <div className="relative w-full" style={{ minHeight: "600px" }}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <iframe
              src={`${url}#toolbar=1`}
              className="w-full h-full min-h-[600px] border-0"
              title={title || "Document Viewer"}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("Failed to load document");
              }}
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center">
                  <p className="text-muted-foreground mb-2">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Inline preview: Video */}
      {mediaType === "video" && (
        <Card className="overflow-hidden p-0">
          <div className="relative w-full bg-black">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <video
              src={url}
              controls
              className="w-full max-h-[600px]"
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("Failed to load video");
              }}
            >
              Your browser does not support the video tag. Use Open or Download to view.
            </video>
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center p-4">
                  <p className="text-muted-foreground mb-2">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Inline preview: Image */}
      {mediaType === "image" && (
        <Card className="overflow-hidden p-0">
          <div className="relative w-full flex justify-center bg-muted">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={url}
              alt={title || "Document"}
              className="max-w-full max-h-[600px] w-auto object-contain"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError("Failed to load image");
              }}
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="text-center p-4">
                  <p className="text-muted-foreground mb-2">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                    Open in New Tab
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Other types (e.g. PPTX): open or download */}
      {mediaType === "other" && (
        <Card className="p-8">
          <div className="text-center space-y-4">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium mb-2">{title || "Document"}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Open in a new tab to view in your browser, or download the file.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DocumentViewer;

