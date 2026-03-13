import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuizAssessmentSummary, type ContentBlock } from "@/lib/contentBlocks";

interface DerivedAssessmentSummaryProps {
  contentBlocks: ContentBlock[];
  emptyMessage?: string;
}

export const DerivedAssessmentSummary = ({
  contentBlocks,
  emptyMessage = "Add at least one valid quiz block in the Content tab to generate an assessment.",
}: DerivedAssessmentSummaryProps) => {
  const summary = getQuizAssessmentSummary(contentBlocks);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Derived Quiz Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assessment questions are derived from the module&apos;s quiz blocks. Edit the graded questions in the Content tab instead of managing a second question list here.
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{summary.quizBlockCount} quiz block{summary.quizBlockCount === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">{summary.gradableQuizBlockCount} counted question{summary.gradableQuizBlockCount === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">{summary.totalPoints} total point{summary.totalPoints === 1 ? "" : "s"}</Badge>
          <Badge variant="outline">{summary.questionTypeCounts.multiple_choice} multiple choice</Badge>
          <Badge variant="outline">{summary.questionTypeCounts.true_false} true/false</Badge>
          <Badge variant="outline">{summary.questionTypeCounts.essay} essay</Badge>
        </div>

        {summary.quizBlockCount === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{emptyMessage}</div>
        ) : summary.invalidIssues.length > 0 ? (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Assessment quiz blocks need attention before they can be used as the graded assessment source.</p>
            <div className="space-y-2">
              {summary.invalidIssues.map((issue, index) => (
                <div key={`${issue.blockId}-${index}`}>
                  <span className="font-medium">{issue.blockLabel}:</span> {issue.message}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            Quiz blocks are valid and ready to be used as the module assessment source.
          </div>
        )}
      </CardContent>
    </Card>
  );
};