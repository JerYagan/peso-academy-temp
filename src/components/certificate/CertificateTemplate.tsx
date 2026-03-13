import { format } from "date-fns";

interface CertificateTemplateProps {
  userName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedDate: string;
  certificateType: "completion" | "participation";
  verificationCode?: string;
}

const CertificateTemplate = ({
  userName,
  courseTitle,
  certificateNumber,
  issuedDate,
  certificateType,
  verificationCode,
}: CertificateTemplateProps) => {
  const certificateTypeText =
    certificateType === "completion"
      ? "Certificate of Completion"
      : "Certificate of Participation";

  return (
    <div
      id="certificate-template"
      className="w-full bg-white text-black"
      style={{
        width: "1123px",
        height: "794px",
        padding: "60px",
        fontFamily: "'Times New Roman', serif",
        position: "relative",
        background: "#ffffff",
      }}
    >
      {/* Border */}
      <div
        style={{
          position: "absolute",
          top: "40px",
          left: "40px",
          right: "40px",
          bottom: "40px",
          border: "8px solid #1e40af",
          borderRadius: "4px",
        }}
      />

      {/* Header */}
      <div className="text-center mb-8">
        <div
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            color: "#1e40af",
            marginBottom: "10px",
            letterSpacing: "2px",
          }}
        >
          PESO ACADEMY
        </div>
        <div
          style={{
            fontSize: "18px",
            color: "#4b5563",
            marginBottom: "20px",
          }}
        >
          Public Employment Service Office
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: "#1e40af",
            marginTop: "30px",
            letterSpacing: "1px",
          }}
        >
          {certificateTypeText}
        </div>
      </div>

      {/* Main Content */}
      <div className="text-center" style={{ marginTop: "60px", marginBottom: "40px" }}>
        <div
          style={{
            fontSize: "20px",
            color: "#374151",
            marginBottom: "30px",
            lineHeight: "1.8",
          }}
        >
          This is to certify that
        </div>
        <div
          style={{
            fontSize: "42px",
            fontWeight: "bold",
            color: "#1e40af",
            marginBottom: "30px",
            padding: "0 40px",
            lineHeight: "1.3",
          }}
        >
          {userName.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "#374151",
            marginBottom: "20px",
            lineHeight: "1.8",
          }}
        >
          has successfully {certificateType === "completion" ? "completed" : "participated in"}
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: "#1e40af",
            marginBottom: "30px",
            padding: "0 40px",
            lineHeight: "1.4",
          }}
        >
          {courseTitle}
        </div>
        <div
          style={{
            fontSize: "18px",
            color: "#4b5563",
            marginTop: "40px",
          }}
        >
          Issued on {format(new Date(issuedDate), "MMMM dd, yyyy")}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "72px",
          left: "60px",
          right: "60px",
        }}
      >
        <div className="flex justify-between items-end">
          {/* Signature Left */}
          <div className="text-center" style={{ width: "200px" }}>
            <div
              style={{
                borderTop: "2px solid #1e40af",
                width: "150px",
                margin: "0 auto 10px",
                paddingTop: "10px",
              }}
            />
            <div style={{ fontSize: "14px", color: "#4b5563" }}>
              Training Officer
            </div>
          </div>

          {/* Certificate Number */}
          <div className="text-center" style={{ width: "360px", padding: "0 12px" }}>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                marginBottom: "5px",
                lineHeight: "1.4",
                wordBreak: "break-word",
              }}
            >
              Certificate No: {certificateNumber}
            </div>
            {verificationCode && (
              <div
                style={{
                  fontSize: "9px",
                  color: "#9ca3af",
                  marginTop: "5px",
                  lineHeight: "1.4",
                  wordBreak: "break-word",
                }}
              >
                Verification Code: {verificationCode}
              </div>
            )}
          </div>

          {/* Signature Right */}
          <div className="text-center" style={{ width: "200px" }}>
            <div
              style={{
                borderTop: "2px solid #1e40af",
                width: "150px",
                margin: "0 auto 10px",
                paddingTop: "10px",
              }}
            />
            <div style={{ fontSize: "14px", color: "#4b5563" }}>
              Director
            </div>
          </div>
        </div>
      </div>

      {/* TESDA Badge (if TESDA supported) */}
      <div
        style={{
          position: "absolute",
          top: "100px",
          right: "80px",
          width: "80px",
          height: "80px",
          border: "3px solid #1e40af",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "bold",
          color: "#1e40af",
          textAlign: "center",
          padding: "5px",
        }}
      >
        TESDA
        <br />
        Accredited
      </div>
    </div>
  );
};

export default CertificateTemplate;

