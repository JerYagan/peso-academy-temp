import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Award, Calendar, FileText, Shield, Eye } from "lucide-react";
import { certificateService } from "@/services/supabaseDatabaseService";
import { downloadCertificatePDF } from "@/services/certificatePdfService";
import { Certificate } from "@/types";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import CertificateTemplate from "@/components/certificate/CertificateTemplate";

const Certificates = () => {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [previewCertificate, setPreviewCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    if (user) {
      loadCertificates();
    }
  }, [user]);

  const loadCertificates = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const certs = await certificateService.getCertificates(user.id);
      setCertificates(certs);

      // Load user names for certificates
      if (supabase && certs.length > 0) {
        const userIds = [...new Set(certs.map((c) => c.userId))];
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);

        if (usersData) {
          const namesMap: Record<string, string> = {};
          usersData.forEach((u) => {
            namesMap[u.id] = u.name;
          });
          setUserNames(namesMap);
        }
      }
    } catch (error) {
      console.error("Error loading certificates:", error);
      toast.error("Failed to load certificates");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (certificate: Certificate) => {
    const userName = userNames[certificate.userId] || user?.name || "User";
    
    try {
      await downloadCertificatePDF({
        userName,
        courseTitle: certificate.courseTitle,
        certificateNumber: certificate.certificateNumber,
        issuedDate: certificate.issuedAt,
        certificateType: certificate.certificateType || "completion",
        verificationCode: certificate.verificationCode,
      });
      toast.success("Certificate downloaded successfully!");
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error("Failed to download certificate");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading certificates...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Certificates</h1>
          </div>
          <p className="text-muted-foreground">
            View and download your course completion certificates
          </p>
        </div>

        {/* Certificates List */}
        {certificates.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {certificates.map((certificate) => (
              <Card key={certificate.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{certificate.courseTitle}</CardTitle>
                      <CardDescription>
                        {certificate.certificateType === "completion"
                          ? "Certificate of Completion"
                          : "Certificate of Participation"}
                      </CardDescription>
                    </div>
                    <Badge variant="default" className="gap-1">
                      <Award className="w-3 h-3" />
                      Verified
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="font-mono text-xs">
                        {certificate.certificateNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Issued on {format(new Date(certificate.issuedAt), "MMMM dd, yyyy")}
                      </span>
                    </div>
                    {certificate.verificationCode && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="w-4 h-4" />
                        <span className="font-mono text-xs">
                          {certificate.verificationCode}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      onClick={() => setPreviewCertificate(certificate)}
                      className="flex-1 gap-2"
                      variant="outline"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    <Button
                      onClick={() => handleDownload(certificate)}
                      className="flex-1 gap-2"
                      variant="default"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Award className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-2">
                You don't have any certificates yet
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Complete courses to earn certificates
              </p>
            </CardContent>
          </Card>
        )}

        {/* Certificate Preview Dialog */}
        <Dialog open={!!previewCertificate} onOpenChange={() => setPreviewCertificate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Certificate Preview</DialogTitle>
              <DialogDescription>
                {previewCertificate?.certificateType === "completion"
                  ? "Certificate of Completion"
                  : "Certificate of Participation"}
              </DialogDescription>
            </DialogHeader>
            {previewCertificate && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full flex justify-center bg-muted p-4 rounded-lg">
                  <CertificateTemplate
                    userName={userNames[previewCertificate.userId] || user?.name || "User"}
                    courseTitle={previewCertificate.courseTitle}
                    certificateNumber={previewCertificate.certificateNumber}
                    issuedDate={previewCertificate.issuedAt}
                    certificateType={previewCertificate.certificateType || "completion"}
                    verificationCode={previewCertificate.verificationCode}
                  />
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    onClick={() => previewCertificate && handleDownload(previewCertificate)}
                    className="flex-1 gap-2"
                    variant="default"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={() => setPreviewCertificate(null)}
                    className="flex-1"
                    variant="outline"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Certificates;

