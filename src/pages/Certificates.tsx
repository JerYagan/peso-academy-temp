import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Award, Calendar, ExternalLink, ImageIcon, Link2 } from "lucide-react";
import { certificateService } from "@/services/supabaseDatabaseService";
import { downloadCertificatePDF } from "@/services/certificatePdfService";
import { Certificate } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const Certificates = () => {
  const { user } = useAuth();
  const { t, formatDate } = useLocale();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

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
      toast.error(t("certificates.toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return certificates.filter((c) => new Date(c.issuedAt) >= startOfMonth).length;
  }, [certificates]);

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
      toast.success(t("certificates.toasts.downloadSuccess"));
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error(t("certificates.toasts.downloadFailed"));
    }
  };

  const copyVerificationLink = (certificate: Certificate) => {
    const code = certificate.verificationCode?.trim();
    if (!code) {
      toast.error(t("certificates.toasts.missingVerificationCode"));
      return;
    }
    const url = `${window.location.origin}/verify-certificate?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("certificates.toasts.copySuccess")),
      () => toast.error(t("certificates.toasts.copyFailed"))
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t("certificates.loading")}</p>
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
          <h1 className="text-3xl font-bold">{t("certificates.title")}</h1>
          <p className="text-muted-foreground">
            {t("certificates.subtitle")}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{certificates.length}</p>
                  <p className="text-sm text-muted-foreground">{t("certificates.total")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Calendar className="h-6 w-6 text-green-700 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{thisMonthCount}</p>
                  <p className="text-sm text-muted-foreground">{t("certificates.thisMonth")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Certificate list */}
        {certificates.length > 0 ? (
          <div className="space-y-4">
            {certificates.map((certificate) => (
              <Card key={certificate.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="sm:w-48 shrink-0 bg-muted">
                      {certificate.courseThumbnail ? (
                        <img
                          src={certificate.courseThumbnail}
                          alt=""
                          className="h-40 w-full object-cover sm:h-full sm:min-h-[180px]"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center sm:h-full sm:min-h-[180px]">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-xl font-bold">{certificate.courseTitle}</h2>
                          {certificate.courseCategory && (
                            <p className="text-sm text-primary font-medium mt-0.5">
                              {certificate.courseCategory}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          {t("certificates.badge")}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <span className="text-muted-foreground">{t("certificates.certificateId")}:</span>
                          <p className="font-mono font-medium">{certificate.certificateNumber}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("certificates.issueDate")}:</span>
                          <p className="font-medium">
                            {formatDate(certificate.issuedAt, { year: "numeric", month: "long", day: "numeric" })}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("certificates.completedOn")}:</span>
                          <p className="font-medium">
                            {formatDate(certificate.issuedAt, { year: "numeric", month: "long", day: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleDownload(certificate)}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          {t("certificates.downloadPdf")}
                        </Button>
                        <Button variant="outline" className="gap-2" asChild>
                          <Link to={`/certificates/view/${certificate.id}`}>
                            <ExternalLink className="h-4 w-4" />
                            {t("certificates.viewCertificate")}
                          </Link>
                        </Button>
                        {certificate.verificationCode && (
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => copyVerificationLink(certificate)}
                          >
                            <Link2 className="h-4 w-4" />
                            {t("certificates.copyVerificationLink")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Award className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-2">
                {t("certificates.emptyTitle")}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {t("certificates.emptyBody")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Certificates;
