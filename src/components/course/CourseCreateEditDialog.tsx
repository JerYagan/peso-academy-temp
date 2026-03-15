import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Info } from "lucide-react";
import { Course, CourseTraineeAudience } from "@/types";
import { courseService } from "@/services/supabaseDatabaseService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";
import { TaxonomyTagField } from "@/components/course/TaxonomyTagField";
import { TaxonomySingleField } from "@/components/course/TaxonomySingleField";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildCanonicalCourseTaxonomy,
  TAXONOMY_CAREER_PATHS,
  TAXONOMY_COURSE_CATEGORIES,
  TAXONOMY_INDUSTRY_TAGS,
  TAXONOMY_SKILL_TAGS,
  TAXONOMY_TOPIC_TAGS,
} from "@/lib/taxonomy";

type CourseSaveMode = "draft" | "finalized";

interface CourseCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSuccess?: () => void;
}

const COURSE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const COURSE_PREVIEW_STORAGE_PREFIX = "peso-course-preview:";
const COURSE_MANAGER_PROFILE_ROLES = ["admin", "trainer"] as const;
const PRIMARY_COURSE_CATEGORIES = TAXONOMY_COURSE_CATEGORIES;
const COURSE_AUDIENCE_OPTIONS: Array<{ value: CourseTraineeAudience; label: string }> = [
  { value: "general_public", label: "All / General Public" },
  { value: "peso_client", label: "PESO Clients" },
  { value: "peso_employee", label: "PESO Employees" },
];

const getCourseAudienceLabel = (audience: CourseTraineeAudience) =>
  COURSE_AUDIENCE_OPTIONS.find((option) => option.value === audience)?.label || "All / General Public";

const mapUserRoleToProfileRole = (role: UserRole): "admin" | "trainer" | "trainee" => {
  switch (role) {
    case "admin":
      return "admin";
    case "trainer":
      return "trainer";
    default:
      return "trainee";
  }
};

export const CourseCreateEditDialog = ({
  open,
  onOpenChange,
  course,
  onSuccess,
}: CourseCreateEditDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    level: "Beginner" as Course["level"],
    traineeAudience: "general_public" as CourseTraineeAudience,
    duration: "",
    isTESDAAccredited: false,
    skills: [] as string[],
    topicTags: [] as string[],
    industryTags: [] as string[],
    careerPaths: [] as string[],
    thumbnail: "",
  });
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const courseSkillOptions = TAXONOMY_SKILL_TAGS as unknown as string[];
  const courseTopicOptions = TAXONOMY_TOPIC_TAGS as unknown as string[];

  const resolveCourseOwnerId = async () => {
    if (!user) {
      throw new Error("You must be logged in to create/edit courses");
    }

    if (!supabase || !user.email) {
      throw new Error("Your account is missing a usable course manager profile. Refresh your account or contact an administrator before creating a course.");
    }

    const { data: exactUserProfile, error: exactUserProfileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!exactUserProfileError && exactUserProfile?.id) {
      return exactUserProfile.id;
    }

    const { data: matchedProfilesByEmail, error: emailLookupError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", user.email)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!emailLookupError && matchedProfilesByEmail && matchedProfilesByEmail.length > 0) {
      return matchedProfilesByEmail[0].id;
    }

    const preferredProfileRoles = Array.from(new Set([
      mapUserRoleToProfileRole(user.role),
      ...COURSE_MANAGER_PROFILE_ROLES,
    ]));

    const { data: managerProfiles, error: managerProfilesError } = await supabase
      .from("users")
      .select("id, role, created_at")
      .in("role", preferredProfileRoles)
      .order("created_at", { ascending: true });

    if (!managerProfilesError && managerProfiles && managerProfiles.length > 0) {
      const sortedManagerProfiles = [...managerProfiles].sort((left, right) => {
        const leftRoleRank = preferredProfileRoles.indexOf(String(left.role));
        const rightRoleRank = preferredProfileRoles.indexOf(String(right.role));

        if (leftRoleRank !== rightRoleRank) {
          return leftRoleRank - rightRoleRank;
        }

        return String(left.created_at || "").localeCompare(String(right.created_at || ""));
      });

      if (sortedManagerProfiles[0]?.id) {
        return sortedManagerProfiles[0].id;
      }
    }

    const now = new Date().toISOString();
    const fallbackProfile = {
      id: user.id,
      email: user.email,
      name: user.name || user.email,
      role: mapUserRoleToProfileRole(user.role),
      created_at: now,
      updated_at: now,
    };

    const { data: insertedProfile, error: insertError } = await supabase
      .from("users")
      .upsert(fallbackProfile, { onConflict: "id" })
      .select("id")
      .single();

    if (!insertError && insertedProfile?.id) {
      return insertedProfile.id;
    }

    throw new Error("No usable course manager profile is available yet. Refresh your account or contact an administrator before creating a course.");
  };

  const buildCoursePayload = async (published: boolean) => {
    if (!user) {
      throw new Error("You must be logged in to create/edit courses");
    }

    const ownerId = await resolveCourseOwnerId();
    const canonicalTaxonomy = buildCanonicalCourseTaxonomy({
      category: formData.category,
      skills: formData.skills,
      topicTags: formData.topicTags,
    });

    if (!canonicalTaxonomy.category) {
      throw new Error("Please select a valid course category from the approved taxonomy.");
    }

    if (canonicalTaxonomy.skillTags.length === 0 || canonicalTaxonomy.topicTags.length === 0) {
      throw new Error("Courses must include at least one approved skill tag and one approved topic tag.");
    }

    return {
      title: formData.title,
      description: formData.description,
      category: canonicalTaxonomy.category,
      level: formData.level,
      duration: parseInt(formData.duration, 10),
      traineeAudience: formData.traineeAudience,
      instructorId: ownerId,
      instructor: user.name || user.email,
      thumbnail: thumbnailPreviewUrl || formData.thumbnail || undefined,
      courseDocument: course?.courseDocument || undefined,
      isTESDAAccredited: formData.isTESDAAccredited,
      skills: canonicalTaxonomy.skillTags,
      topicTags: canonicalTaxonomy.topicTags,
      industryTags: formData.industryTags,
      careerPaths: formData.careerPaths,
      published,
    };
  };

  const handlePreview = async () => {
    if (!formData.title || !formData.description || !formData.category || !formData.duration) {
      toast.error("Complete the required course fields before previewing");
      return;
    }

    if (formData.skills.length === 0 || formData.topicTags.length === 0) {
      toast.error("Add at least one approved skill tag and one approved topic tag before previewing");
      return;
    }

    try {
      const payload = await buildCoursePayload(course?.published ?? false);
      const previewKey = `course-preview-${course?.id || "new"}-${Date.now()}`;
      const previewPayload = {
        ...payload,
        id: course?.id || "__preview__",
        createdAt: course?.createdAt || new Date().toISOString(),
        enrolledCount: course?.enrolledCount || 0,
        rating: course?.rating || 0,
        previewSourceCourseId: course?.id || null,
      };

      if (typeof window === "undefined") {
        return;
      }

      window.sessionStorage.setItem(previewKey, JSON.stringify(previewPayload));
      window.localStorage.setItem(`${COURSE_PREVIEW_STORAGE_PREFIX}${previewKey}`, JSON.stringify(previewPayload));
      const previewTargetId = course?.id || "__preview__";
      const previewUrl = new URL(
        `/courses/preview/${previewTargetId}?preview=course-draft&previewKey=${encodeURIComponent(previewKey)}`,
        window.location.origin,
      );
      window.open(previewUrl.toString(), "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error preparing course preview:", error);
      toast.error("Failed to open course preview");
    }
  };

  const ensureCourseStorageReady = async () => {
    if (!supabase) {
      throw new Error("Supabase is not initialized. Check your environment variables first.");
    }

    const { error } = await supabase.storage.from("course-materials").list("", { limit: 1 });

    if (!error) return;

    const message = error.message?.toLowerCase() || "";
    if (message.includes("bucket not found")) {
      throw new Error(
        "Storage bucket 'course-materials' is missing. Create it in Supabase Storage, then apply the course-materials storage policies from STORAGE_SETUP.md or migration 022_add_course_materials_storage_policies.sql.",
      );
    }

    if (message.includes("row-level security") || message.includes("permission") || message.includes("unauthorized")) {
      throw new Error(
        "Storage is reachable, but this account cannot access the 'course-materials' bucket. Confirm the course-materials storage policies are applied for admin, trainer, SPD, or training officer roles, including migration 028_fix_course_and_storage_rls_roles.sql.",
      );
    }
  };

  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title,
        description: course.description,
        category: course.category,
        level: course.level,
        traineeAudience: course.traineeAudience || "general_public",
        duration: course.duration.toString(),
        isTESDAAccredited: course.isTESDAAccredited || false,
        skills: course.skills || [],
        topicTags: course.topicTags || [],
        industryTags: course.industryTags || [],
        careerPaths: course.careerPaths || [],
        thumbnail: course.thumbnail || "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        category: "",
        level: "Beginner",
        traineeAudience: "general_public",
        duration: "",
        isTESDAAccredited: false,
        skills: [],
        topicTags: [],
        industryTags: [],
        careerPaths: [],
        thumbnail: "",
      });
    }
    setSelectedThumbnailFile(null);
    setThumbnailPreviewUrl(null);
  }, [course, open]);

  // Preview URLs for selected files (revoke on unmount/change)
  useEffect(() => {
    if (selectedThumbnailFile) {
      const url = URL.createObjectURL(selectedThumbnailFile);
      setThumbnailPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setThumbnailPreviewUrl(formData.thumbnail || null);
    return () => {};
  }, [selectedThumbnailFile, formData.thumbnail]);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    const imgTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const imgExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    if (!imgTypes.includes(file.type) && !imgExt.includes(ext)) {
      toast.error("Please upload an image (JPG, PNG, WebP, or GIF)");
      return;
    }
    setSelectedThumbnailFile(file);
    if (!file.name) setFormData((prev) => ({ ...prev, thumbnail: "" }));
  };

  const saveCourse = async (mode: CourseSaveMode) => {
    if (!user) {
      toast.error("You must be logged in to create/edit courses");
      return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.duration) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (formData.skills.length === 0 || formData.topicTags.length === 0) {
      toast.error("Please add at least one approved skill tag and one approved topic tag");
      return;
    }

    setLoading(true);
    let thumbnailUrl = formData.thumbnail || undefined;

    const uploadToStorage = async (file: File, folder: string): Promise<string> => {
      if (!supabase) throw new Error("Supabase not initialized");
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `courses/${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        const msg = uploadError.message?.toLowerCase().includes("bucket not found")
          ? "Storage bucket 'course-materials' not found. Create it in Supabase: Dashboard → Storage → New bucket → name: course-materials (see STORAGE_SETUP.md)."
          : uploadError.message;
        throw new Error(msg);
      }
      const { data: urlData } = supabase.storage.from("course-materials").getPublicUrl(filePath);
      return urlData.publicUrl;
    };

    try {
      if (selectedThumbnailFile) {
        await ensureCourseStorageReady();
      }
      if (selectedThumbnailFile && supabase) {
        thumbnailUrl = await uploadToStorage(selectedThumbnailFile, "thumb");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload thumbnail");
      setLoading(false);
      return;
    }

    try {
      const courseData = {
        ...(await buildCoursePayload(mode === "finalized")),
        thumbnail: thumbnailUrl,
      };

      if (course) {
        await courseService.updateCourse(course.id, courseData);
        toast.success(mode === "finalized" ? "Course finalized successfully" : "Course saved as draft");
      } else {
        await courseService.createCourse(courseData);
        toast.success(mode === "finalized" ? "Course created successfully" : "Course draft created successfully");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving course:", error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("row-level security") || message.includes("permission denied")) {
        toast.error(
          course
            ? "Failed to update course due to Supabase RLS. Apply migration 028_fix_course_and_storage_rls_roles.sql."
            : "Failed to create course due to Supabase RLS. Apply migration 028_fix_course_and_storage_rls_roles.sql.",
        );
      } else if (message.includes("foreign key") || message.includes("course owner profile") || message.includes("trainer profile is not linked") || message.includes("course manager profile")) {
        toast.error("Course creation failed because no usable course manager profile could be resolved.");
      } else {
        toast.error(course ? "Failed to save course" : "Failed to create course");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Edit Course" : "Create New Course"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCourse("finalized");
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter course title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter course description"
              rows={4}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <TaxonomySingleField
                label="Category *"
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                placeholder="Select managed category"
                termType="course_category"
                fallbackOptions={PRIMARY_COURSE_CATEGORIES}
                allowCreate={false}
              />
              <p className="text-xs text-muted-foreground">
                Choose a taxonomy-managed category so course analytics, reporting, and recommendations stay aligned.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level *</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData({ ...formData, level: value as Course["level"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="traineeAudience">Audience *</Label>
              <Select
                value={formData.traineeAudience}
                onValueChange={(value) => setFormData({ ...formData, traineeAudience: value as CourseTraineeAudience })}
              >
                <SelectTrigger id="traineeAudience">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_AUDIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 md:col-span-2 lg:col-span-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="tesda-accredited"
                  checked={formData.isTESDAAccredited}
                  onCheckedChange={(checked) => setFormData((current) => ({ ...current, isTESDAAccredited: Boolean(checked) }))}
                />
                <div className="space-y-1">
                  <Label htmlFor="tesda-accredited" className="flex items-center gap-2">
                    TESDA Accredited
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Marks the course as TESDA-recognized or TESDA-aligned. Learners will see that label and certificate messaging will follow the TESDA path.
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn this on only when the course should visibly carry TESDA accreditation or TESDA-style certificate wording.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (hours) *</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 40"
                required
              />
            </div>
          </div>

          <TaxonomyTagField
            label="Skill Tags"
            options={courseSkillOptions}
            values={formData.skills}
            onChange={(skills) => setFormData((current) => ({ ...current, skills }))}
            placeholder="Select approved skill tags"
            description="Managed skill tags are global course metadata and are not restricted by category. Update the available vocabulary from Taxonomy Management when needed."
            allowCreate={false}
            termType="skill_tag"
            maxVisibleOptions={5}
            restrictToOptions={false}
          />

          <TaxonomyTagField
            label="Topic Tags"
            options={courseTopicOptions}
            values={formData.topicTags}
            onChange={(topicTags) => setFormData((current) => ({ ...current, topicTags }))}
            placeholder="Select approved topic tags"
            description="Managed topic tags are global course metadata and are not restricted by category. Update the available vocabulary from Taxonomy Management when needed."
            termType="topic_tag"
            allowCreate={false}
            maxVisibleOptions={5}
            restrictToOptions={false}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TaxonomyTagField
              label="Industry Tags"
              options={TAXONOMY_INDUSTRY_TAGS as unknown as string[]}
              values={formData.industryTags}
              onChange={(industryTags) => setFormData((current) => ({ ...current, industryTags }))}
              placeholder="Select relevant industries"
              description="Optional recommendation metadata. Industry tags are global managed terms and are not restricted by category."
              termType="industry_tag"
              allowCreate={false}
              maxVisibleOptions={6}
            />

            <TaxonomyTagField
              label="Career Path Tags"
              options={TAXONOMY_CAREER_PATHS as unknown as string[]}
              values={formData.careerPaths}
              onChange={(careerPaths) => setFormData((current) => ({ ...current, careerPaths }))}
              placeholder="Select relevant career paths"
              description="Optional recommendation metadata. Career path tags are global managed terms and are not restricted by category."
              termType="career_path"
              allowCreate={false}
              maxVisibleOptions={6}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail (image)</Label>
              <Input
                id="thumbnail"
                value={formData.thumbnail}
                onChange={(e) => {
                  setFormData({ ...formData, thumbnail: e.target.value });
                  setSelectedThumbnailFile(null);
                }}
                placeholder="URL or upload image below"
              />
              <Input
                id="thumbnailFile"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                onChange={handleThumbnailSelect}
                className="flex-1"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Thumbnail is optional and can be added after the core course details and taxonomy are in place.
              </p>
              {selectedThumbnailFile && (
                <Badge variant="secondary" className="gap-1 mt-1">
                  {selectedThumbnailFile.name}
                </Badge>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Eye className="w-4 h-4" />
                Preview
              </div>
              <div className="space-y-3">
                <div className="aspect-video rounded-md border bg-muted flex items-center justify-center overflow-hidden min-h-[80px]">
                  {thumbnailPreviewUrl ? (
                    <img
                      src={thumbnailPreviewUrl}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Thumbnail</span>
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold truncate">
                    {formData.title || "Course title"}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {formData.description || "Description"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.category ? (
                      <Badge variant="outline" className="text-xs">
                        {formData.category}
                      </Badge>
                    ) : null}
                    <Badge variant={formData.isTESDAAccredited ? "default" : "secondary"} className="text-xs">
                      {formData.isTESDAAccredited ? "TESDA Accredited" : "Standard Certificate"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {getCourseAudienceLabel(formData.traineeAudience)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview as Trainee
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" disabled={loading} onClick={() => void saveCourse("draft")}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save as Draft"
              )}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Finalize"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

