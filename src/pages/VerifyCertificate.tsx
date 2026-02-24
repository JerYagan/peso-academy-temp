import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Search, Download, Shield } from "lucide-react";
import { certificateService } from "@/services/supabaseDatabaseService";
import { Certificate } from "@/types";
import { format } from "date-fns";
import { downloadCertificatePDF } from "@/services/certificatePdfService";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const VerifyCertificate = () => {
  const [searchParams] = useSearchParams();
  const [verificationCode, setVerificationCode] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  const doVerify = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter a verification code");
      return;
    }

    setLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const cert = await certificateService.getCertificateByVerificationCode(trimmed);

      if (!cert) {
        setError("Certificate not found. Please check your verification code.");
        return;
      }

      if (supabase) {
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("id", cert.userId)
          .single();

        if (userData) {
          setUserName(userData.name);
        }
      }

      setCertificate(cert);
    } catch (err: any) {
      console.error("Error verifying certificate:", err);
      setError(err.message || "Failed to verify certificate");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setVerificationCode(codeFromUrl);
      doVerify(codeFromUrl);
    }
  }, [searchParams]);

  const handleVerify = () => doVerify(verificationCode);

  const handleDownload = async () => {
    if (!certificate || !userName) return;

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Certificate Verification</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Verify the authenticity of a certificate by entering its verification code
            </p>
          </div>

          {/* Verification Form */}
          <Card>
            <CardHeader>
              <CardTitle>Enter Verification Code</CardTitle>
              <CardDescription>
                Find the verification code on your certificate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="verification-code"
                    placeholder="VER-1234567890-abc123"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleVerify()}
                    className="flex-1"
                  />
                  <Button onClick={handleVerify} disabled={loading}>
                    {loading ? (
                      <>Verifying...</>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificate Details */}
          {certificate && (
            <Card className="border-green-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <CardTitle className="text-green-700 dark:text-green-400">
                      Certificate Verified
                    </CardTitle>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    Valid
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Certificate Number</Label>
                    <p className="font-medium">{certificate.certificateNumber}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Verification Code</Label>
                    <p className="font-medium font-mono text-sm">{certificate.verificationCode}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Certificate Type</Label>
                    <p className="font-medium">
                      {certificate.certificateType === "completion"
                        ? "Certificate of Completion"
                        : "Certificate of Participation"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Issued Date</Label>
                    <p className="font-medium">
                      {format(new Date(certificate.issuedAt), "MMMM dd, yyyy")}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">Course</Label>
                    <p className="font-medium text-lg">{certificate.courseTitle}</p>
                  </div>
                  {userName && (
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">Recipient</Label>
                      <p className="font-medium text-lg">{userName}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleDownload} className="w-full md:w-auto gap-2">
                    <Download className="w-4 h-4" />
                    Download Certificate PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyCertificate;

