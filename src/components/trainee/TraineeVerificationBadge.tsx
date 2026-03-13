import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/types/auth";

type TraineeVerificationBadgeProps = {
  status: VerificationStatus | undefined;
};

const verificationStatusLabel: Record<VerificationStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

const verificationStatusClassName: Record<VerificationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function TraineeVerificationBadge({ status }: TraineeVerificationBadgeProps) {
  const resolvedStatus = status ?? "pending";

  return (
    <Badge variant="outline" className={verificationStatusClassName[resolvedStatus]}>
      {verificationStatusLabel[resolvedStatus]}
    </Badge>
  );
}