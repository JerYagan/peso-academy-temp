import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, MapPin, DollarSign } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Job } from "@/types";

const EmployerJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (user) {
      setJobs(dataService.getJobs().filter((j) => j.postedBy === user.id));
    }
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Job Postings</h1>
            <p className="text-muted-foreground mt-2">Manage your job postings</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
          </Button>
        </div>

        {jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2">{job.title}</CardTitle>
                      <CardContent className="p-0">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <Badge variant={job.status === "open" ? "default" : "secondary"}>
                            {job.status}
                          </Badge>
                          <Badge variant="outline">{job.type}</Badge>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </span>
                          {job.salary && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {job.salary}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
                  <div className="flex gap-2">
                    <Button variant="outline">Edit</Button>
                    <Button variant="outline">View Applications</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">You haven't posted any jobs yet</p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Post Your First Job
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EmployerJobs;

