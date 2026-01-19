import jsPDF from "jspdf";
import { Certificate } from "@/types";
import { format } from "date-fns";

/**
 * Certificate PDF Generation Service
 * Generates PDF certificates using jsPDF
 */

export interface CertificateData {
  userName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedDate: string;
  certificateType: "completion" | "participation";
  verificationCode?: string;
}

/**
 * Generate PDF certificate from certificate data using jsPDF directly
 */
export const generateCertificatePDF = async (
  certificateData: CertificateData
): Promise<Blob> => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Colors (RGB values)
  const primaryColorR = 30;
  const primaryColorG = 64;
  const primaryColorB = 175;
  const textColorR = 55;
  const textColorG = 65;
  const textColorB = 81;
  const mutedColorR = 75;
  const mutedColorG = 85;
  const mutedColorB = 99;

  // Background border
  pdf.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setLineWidth(2);
  pdf.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  // Header - PESO ACADEMY
  pdf.setFontSize(36);
  pdf.setTextColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setFont("helvetica", "bold");
  const headerText = "PESO ACADEMY";
  const headerWidth = pdf.getTextWidth(headerText);
  pdf.text(headerText, (pageWidth - headerWidth) / 2, margin + 20);

  // Subtitle
  pdf.setFontSize(12);
  pdf.setTextColor(mutedColorR, mutedColorG, mutedColorB);
  pdf.setFont("helvetica", "normal");
  const subtitleText = "Public Employment Service Office";
  const subtitleWidth = pdf.getTextWidth(subtitleText);
  pdf.text(subtitleText, (pageWidth - subtitleWidth) / 2, margin + 30);

  // Certificate Type
  const certificateTypeText =
    certificateData.certificateType === "completion"
      ? "Certificate of Completion"
      : "Certificate of Participation";
  pdf.setFontSize(24);
  pdf.setTextColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setFont("helvetica", "bold");
  const typeWidth = pdf.getTextWidth(certificateTypeText);
  pdf.text(certificateTypeText, (pageWidth - typeWidth) / 2, margin + 50);

  // Main content
  pdf.setFontSize(14);
  pdf.setTextColor(textColorR, textColorG, textColorB);
  pdf.setFont("helvetica", "normal");
  pdf.text("This is to certify that", pageWidth / 2, margin + 80, {
    align: "center",
  });

  // User name
  pdf.setFontSize(32);
  pdf.setTextColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setFont("helvetica", "bold");
  const userName = certificateData.userName.toUpperCase();
  pdf.text(userName, pageWidth / 2, margin + 100, {
    align: "center",
    maxWidth: pageWidth - margin * 4,
  });

  // Course description
  pdf.setFontSize(14);
  pdf.setTextColor(textColorR, textColorG, textColorB);
  pdf.setFont("helvetica", "normal");
  const hasText =
    certificateData.certificateType === "completion"
      ? "has successfully completed"
      : "has successfully participated in";
  pdf.text(hasText, pageWidth / 2, margin + 120, { align: "center" });

  // Course title
  pdf.setFontSize(20);
  pdf.setTextColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setFont("helvetica", "bold");
  pdf.text(certificateData.courseTitle, pageWidth / 2, margin + 140, {
    align: "center",
    maxWidth: pageWidth - margin * 4,
  });

  // Issued date
  pdf.setFontSize(12);
  pdf.setTextColor(mutedColorR, mutedColorG, mutedColorB);
  pdf.setFont("helvetica", "normal");
  const dateText = `Issued on ${format(
    new Date(certificateData.issuedDate),
    "MMMM dd, yyyy"
  )}`;
  pdf.text(dateText, pageWidth / 2, margin + 160, { align: "center" });

  // Footer - Signatures and certificate number
  const footerY = pageHeight - margin - 40;

  // Left signature
  pdf.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setLineWidth(0.5);
  pdf.line(margin + 20, footerY, margin + 70, footerY);
  pdf.setFontSize(10);
  pdf.setTextColor(mutedColorR, mutedColorG, mutedColorB);
  pdf.text("Training Officer", margin + 45, footerY + 8, { align: "center" });

  // Certificate number (center)
  pdf.setFontSize(9);
  pdf.setTextColor(mutedColorR, mutedColorG, mutedColorB);
  pdf.text(
    `Certificate No: ${certificateData.certificateNumber}`,
    pageWidth / 2,
    footerY - 5,
    { align: "center" }
  );
  if (certificateData.verificationCode) {
    pdf.setFontSize(8);
    pdf.text(
      `Verification Code: ${certificateData.verificationCode}`,
      pageWidth / 2,
      footerY + 5,
      { align: "center" }
    );
  }

  // Right signature
  pdf.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.line(pageWidth - margin - 70, footerY, pageWidth - margin - 20, footerY);
  pdf.setFontSize(10);
  pdf.setTextColor(mutedColorR, mutedColorG, mutedColorB);
  pdf.text("Director", pageWidth - margin - 45, footerY + 8, {
    align: "center",
  });

  // TESDA Badge (top right)
  pdf.setDrawColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setLineWidth(1);
  pdf.circle(pageWidth - margin - 20, margin + 30, 15, "S");
  pdf.setFontSize(8);
  pdf.setTextColor(primaryColorR, primaryColorG, primaryColorB);
  pdf.setFont("helvetica", "bold");
  pdf.text("TESDA", pageWidth - margin - 20, margin + 28, { align: "center" });
  pdf.text("Accredited", pageWidth - margin - 20, margin + 33, {
    align: "center",
  });

  return pdf.output("blob");
};

/**
 * Download certificate as PDF
 */
export const downloadCertificatePDF = async (
  certificateData: CertificateData
): Promise<void> => {
  try {
    const blob = await generateCertificatePDF(certificateData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Certificate_${certificateData.certificateNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading certificate:", error);
    throw error;
  }
};

/**
 * Generate certificate PDF from Certificate object
 */
export const generateCertificatePDFFromCert = async (
  certificate: Certificate,
  userName: string
): Promise<Blob> => {
  const certificateData: CertificateData = {
    userName,
    courseTitle: certificate.courseTitle,
    certificateNumber: certificate.certificateNumber,
    issuedDate: certificate.issuedAt,
    certificateType: certificate.certificateType || "completion",
    verificationCode: certificate.verificationCode,
  };

  return generateCertificatePDF(certificateData);
};

