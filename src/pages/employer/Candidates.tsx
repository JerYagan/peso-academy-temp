import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Award, BookOpen } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useState, useEffect } from "react";

const EmployerCandidates = () => {
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    // Get all job seekers with their certificates
    const stored = localStorage.getItem("peso_academy_users");
    const users = stored ? JSON.parse(stored) : [];
    const jobSeekers = users.filter((u: any) => u.role === "jobseeker");
    
    const candidatesWithData = jobSeekers.map((user: any) => {
      const certificates = dataService.getCertificates(user.id);
      const enrollments = dataService.getEnrollments(user.id);
      return {
        ...user,
        certificates,
        enrollments,
      };
    });
    
    setCandidates(candidatesWithData);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Candidates</h1>
          <p className="text-muted-foreground mt-2">Browse skill-verified candidates</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Candidates ({candidates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {candidates.length > 0 ? (
              <div className="space-y-4">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{candidate.name}</p>
                        <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <BookOpen className="w-4 h-4" />
                            {candidate.enrollments.length} courses
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Award className="w-4 h-4" />
                            {candidate.certificates.length} certificates
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Available</Badge>
                      <Button variant="outline">View Profile</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No candidates available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EmployerCandidates;

