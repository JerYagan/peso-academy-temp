import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Link2 } from "lucide-react";
import { certificateService } from "@/services/supabaseDatabaseService";
import { downloadCertificatePDF } from "@/services/certificatePdfService";
import { Certificate } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import CertificateTemplate from "@/components/certificate/CertificateTemplate";

const CertificateView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      setLoading(true);
      try {
        const cert = await certificateService.getCertificateById(id, user.id);
        if (!cert) {
          toast.error("Certificate not found");
          navigate("/certificates", { replace: true });
          return;
        }
        setCertificate(cert);
        if (supabase && cert.userId) {
          const { data } = await supabase.from("users").select("name").eq("id", cert.userId).single();
          setUserName(data?.name || user.name || "User");
        } else {
          setUserName(user.name || "User");
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load certificate");
        navigate("/certificates", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user, navigate]);

  const handleDownload = async () => {
    if (!certificate) return;
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
      console.error(error);
      toast.error("Failed to download certificate");
    }
  };

  const copyVerificationLink = () => {
    const code = certificate?.verificationCode?.trim();
    if (!code) {
      toast.error("No verification code available");
      return;
    }
    const url = `${window.location.origin}/verify-certificate?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Verification link copied to clipboard"),
      () => toast.error("Failed to copy link")
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (!certificate) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top bar: back + download */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/certificates">
              <ArrowLeft className="h-4 w-4" />
              Back to My Certificates
            </Link>
          </Button>
          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {certificate.verificationCode && (
            <Button variant="outline" onClick={copyVerificationLink} className="gap-2">
              <Link2 className="h-4 w-4" />
              Copy verification link
            </Button>
          )}
        </div>
      </div>

      {/* Certificate: full page, scrollable, responsive scale so whole content is viewable */}
      <div className="w-full px-4 py-6 flex justify-center">
        <div className="w-full overflow-auto rounded-lg border bg-white shadow-lg flex justify-center">
          <div className="origin-top scale-75 md:scale-90 lg:scale-100">
            <CertificateTemplate
              userName={userName}
              courseTitle={certificate.courseTitle}
              certificateNumber={certificate.certificateNumber}
              issuedDate={certificate.issuedAt}
              certificateType={certificate.certificateType || "completion"}
              verificationCode={certificate.verificationCode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateView;
