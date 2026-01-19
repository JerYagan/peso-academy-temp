import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";

interface DocumentViewerProps {
  url: string;
  title?: string;
}

const DocumentViewer = ({ url, title }: DocumentViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPDF = url.toLowerCase().endsWith(".pdf");

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
      {/* Document Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
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

      {/* PDF Viewer */}
      {isPDF ? (
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
      ) : (
        /* Other Document Types - Show download option */
        <Card className="p-8">
          <div className="text-center space-y-4">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium mb-2">{title || "Document"}</p>
              <p className="text-sm text-muted-foreground mb-4">
                This document type is not previewable. Please download to view.
              </p>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download Document
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DocumentViewer;

