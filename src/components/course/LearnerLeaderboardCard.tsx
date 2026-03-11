import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LearnerLeaderboard } from "@/services/reportingService";
import { formatDistanceToNow } from "date-fns";
import { Clock3, Medal, Shield, Trophy } from "lucide-react";

type LearnerLeaderboardCardProps = {
  leaderboard: LearnerLeaderboard | null;
  loading?: boolean;
  emptyMessage?: string;
};

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
};

const formatLastActivity = (value: string | null) => {
  if (!value) return "No recent activity";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No recent activity";
  return formatDistanceToNow(parsed, { addSuffix: true });
};

const getStatusBadgeVariant = (status: string) => {
  if (status === "completed") return "default" as const;
  if (status === "in-progress") return "secondary" as const;
  return "outline" as const;
};

export const LearnerLeaderboardCard = ({
  leaderboard,
  loading = false,
  emptyMessage = "Select a course to view the leaderboard.",
}: LearnerLeaderboardCardProps) => {
  const isProgramScope = leaderboard?.scope === "program";
  const topLearner = leaderboard?.entries[0] || null;
  const averageCompositeScore = leaderboard && leaderboard.entries.length > 0
    ? (leaderboard.entries.reduce((sum, entry) => sum + entry.compositeScore, 0) / leaderboard.entries.length).toFixed(1)
    : "0.0";
  const completedCount = leaderboard?.entries.filter((entry) => entry.status === "completed").length || 0;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">Learner Leaderboard</CardTitle>
            <CardDescription>
              Ranked by completion, assessment score, tracked learning time, certificate status, and recency.
            </CardDescription>
          </div>
          {leaderboard ? (
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs font-medium">
              Staff-only masked view
            </Badge>
          ) : null}
        </div>

        {leaderboard ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Trophy className="h-4 w-4" />
                Top learner
              </div>
              <p className="mt-2 text-lg font-semibold">{topLearner?.learnerName || "No learners yet"}</p>
              <p className="text-sm opacity-80">{topLearner ? `${topLearner.compositeScore.toFixed(1)} points` : "Waiting for activity"}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Medal className="h-4 w-4" />
                Ranked learners
              </div>
              <p className="mt-2 text-2xl font-semibold">{leaderboard.entries.length}</p>
              <p className="text-sm text-muted-foreground">Completed: {completedCount}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Average score
              </div>
              <p className="mt-2 text-2xl font-semibold">{averageCompositeScore}</p>
              <p className="text-sm text-muted-foreground">Composite leaderboard points</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                Scope boundary
              </div>
              <p className="mt-2 text-sm font-medium">{isProgramScope ? "Program leaderboard" : "Course leaderboard"}</p>
              <p className="text-sm text-muted-foreground">
                {isProgramScope
                  ? "Learner standings are aggregated across all courses linked to this program."
                  : "Learner standings are ranked within this single course."}
              </p>
            </div>
          </div>
        ) : null}

        {leaderboard ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Completion {leaderboard.weights.completion}%</Badge>
            <Badge variant="secondary">Assessment {leaderboard.weights.assessment}%</Badge>
            <Badge variant="secondary">Learning time {leaderboard.weights.learningTime}%</Badge>
            <Badge variant="secondary">Certificate {leaderboard.weights.certificate}%</Badge>
            <Badge variant="secondary">Recency {leaderboard.weights.recency}%</Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Loading leaderboard...
          </div>
        ) : !leaderboard ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            {emptyMessage}
          </div>
        ) : leaderboard.entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No eligible learners found for this {leaderboard.scope} yet.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-2xl border p-4">
                <p className="text-sm font-medium">Fairness rules</p>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {leaderboard.fairnessNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-sm font-medium">Tie-break order</p>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {leaderboard.tieBreakerRules.map((rule) => (
                    <p key={rule}>{rule}</p>
                  ))}
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Assessments</TableHead>
                  <TableHead>Learning time</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.entries.map((entry) => (
                  <TableRow key={entry.entryId}>
                    <TableCell className="font-semibold">#{entry.rank}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.learnerName}</p>
                        <p className="text-xs text-muted-foreground">{entry.learnerEmailMasked || "Email hidden"}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {entry.scoringExplanation.join(" ")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                      {entry.certificatesEarned > 0 ? (
                        <Badge variant="outline" className="ml-2">
                          {entry.certificatesEarned}/{entry.expectedCertificates} certificates
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entry.progress}%</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.completedUnits}/{entry.totalUnits} {entry.unitsLabel}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {entry.averageAssessmentScore !== null ? `${entry.averageAssessmentScore}%` : "No score"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.assessmentAttempts} latest attempts
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatMinutes(entry.learningMinutes)}</div>
                      <div className="text-xs text-muted-foreground">
                        target {formatMinutes(entry.expectedLearningMinutes)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatLastActivity(entry.lastActivityAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.recencyDays === null ? "No recency score" : `${entry.recencyDays} day${entry.recencyDays === 1 ? "" : "s"} ago`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold">{entry.compositeScore.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">
                        C {entry.factorScores.completion.weightedScore.toFixed(1)} | A {entry.factorScores.assessment.weightedScore.toFixed(1)} | T {entry.factorScores.learningTime.weightedScore.toFixed(1)} | R {entry.factorScores.recency.weightedScore.toFixed(1)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
};