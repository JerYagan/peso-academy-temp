import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin } from "lucide-react";
import { dataService } from "@/services/mockData";
import { useState, useEffect } from "react";
import { Job } from "@/types";

const AdminJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    setJobs(dataService.getJobs());
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Job Management</h1>
          <p className="text-muted-foreground mt-2">Monitor all job postings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Job Postings ({jobs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{job.title}</h3>
                      <Badge variant={job.status === "open" ? "default" : "secondary"}>
                        {job.status}
                      </Badge>
                      <Badge variant="outline">{job.type}</Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">{job.company}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      {job.salary && <span>{job.salary}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminJobs;

