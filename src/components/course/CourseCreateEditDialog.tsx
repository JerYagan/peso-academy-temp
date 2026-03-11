import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, Eye } from "lucide-react";
import { Course } from "@/types";
import { courseService } from "@/services/supabaseDatabaseService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";

type CourseSaveMode = "draft" | "finalized";

interface CourseCreateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSuccess?: () => void;
}

const COURSE_CATEGORIES = [
  "Technical Skills",
  "Soft Skills",
  "Entrepreneurship",
  "Digital Literacy",
  "Vocational Training",
  "Career Development",
  "Other",
];

const COURSE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const COURSE_PREVIEW_STORAGE_PREFIX = "peso-course-preview:";
const COURSE_MANAGER_PROFILE_ROLES = ["admin", "trainer", "spd", "training_officer"] as const;

const mapUserRoleToProfileRole = (role: UserRole): "admin" | "trainer" | "validator" | "spd" | "employer" | "jobseeker" => {
  switch (role) {
    case "admin":
      return "admin";
    case "trainer":
    case "training_officer":
      return "trainer";
    case "spd":
      return "spd";
    case "validator":
      return "validator";
    case "employer":
      return "employer";
    default:
      return "jobseeker";
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
    duration: "",
    skills: [] as string[],
    industryTags: [] as string[],
    careerPaths: [] as string[],
    thumbnail: "",
  });
  const [categoryOther, setCategoryOther] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newIndustryTag, setNewIndustryTag] = useState("");
  const [newCareerPath, setNewCareerPath] = useState("");
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);

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
    const categoryValue = formData.category === "Other" ? categoryOther.trim() : formData.category;

    return {
      title: formData.title,
      description: formData.description,
      category: categoryValue,
      level: formData.level,
      duration: parseInt(formData.duration, 10),
      instructorId: ownerId,
      instructor: user.name || user.email,
      thumbnail: thumbnailPreviewUrl || formData.thumbnail || undefined,
      courseDocument: course?.courseDocument || undefined,
      isTESDAAccredited: false,
      skills: formData.skills,
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

    if (formData.category === "Other" && !categoryOther.trim()) {
      toast.error("Please specify the category when selecting Other");
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
      const cat = course.category;
      const isOther = !COURSE_CATEGORIES.includes(cat);
      setFormData({
        title: course.title,
        description: course.description,
        category: isOther ? "Other" : cat,
        level: course.level,
        duration: course.duration.toString(),
        skills: course.skills || [],
        industryTags: course.industryTags || [],
        careerPaths: course.careerPaths || [],
        thumbnail: course.thumbnail || "",
      });
      setCategoryOther(isOther ? cat : "");
    } else {
      setFormData({
        title: "",
        description: "",
        category: "",
        level: "Beginner",
        duration: "",
        skills: [],
        industryTags: [],
        careerPaths: [],
        thumbnail: "",
      });
      setCategoryOther("");
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
    if (formData.category === "Other" && !categoryOther.trim()) {
      toast.error("Please specify the category when selecting Other");
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

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const addIndustryTag = () => {
    if (newIndustryTag.trim() && !formData.industryTags.includes(newIndustryTag.trim())) {
      setFormData({ ...formData, industryTags: [...formData.industryTags, newIndustryTag.trim()] });
      setNewIndustryTag("");
    }
  };

  const addCareerPath = () => {
    if (newCareerPath.trim() && !formData.careerPaths.includes(newCareerPath.trim())) {
      setFormData({ ...formData, careerPaths: [...formData.careerPaths, newCareerPath.trim()] });
      setNewCareerPath("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s !== skill) });
  };

  const removeIndustryTag = (tag: string) => {
    setFormData({ ...formData, industryTags: formData.industryTags.filter((value) => value !== tag) });
  };

  const removeCareerPath = (path: string) => {
    setFormData({ ...formData, careerPaths: formData.careerPaths.filter((value) => value !== path) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.category === "Other" && (
                <Input
                  value={categoryOther}
                  onChange={(e) => setCategoryOther(e.target.value)}
                  placeholder="Specify category (e.g. Health & Safety, Language)"
                  className="mt-2"
                />
              )}
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              {selectedThumbnailFile && (
                <Badge variant="secondary" className="gap-1 mt-1">
                  {selectedThumbnailFile.name}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill"
              />
              <Button type="button" onClick={addSkill} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Industry Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newIndustryTag}
                onChange={(e) => setNewIndustryTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIndustryTag();
                  }
                }}
                placeholder="Add an industry tag"
              />
              <Button type="button" onClick={addIndustryTag} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.industryTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.industryTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button type="button" onClick={() => removeIndustryTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Career Paths</Label>
            <div className="flex gap-2">
              <Input
                value={newCareerPath}
                onChange={(e) => setNewCareerPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCareerPath();
                  }
                }}
                placeholder="Add a career path"
              />
              <Button type="button" onClick={addCareerPath} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.careerPaths.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.careerPaths.map((path) => (
                  <Badge key={path} variant="secondary" className="gap-1">
                    {path}
                    <button type="button" onClick={() => removeCareerPath(path)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Preview: see how thumbnail, title, description and uploaded file reflect */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Eye className="w-4 h-4" />
              Preview
            </div>
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
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
                {(formData.category || categoryOther) && (
                  <Badge variant="outline" className="text-xs">
                    {formData.category === "Other" ? categoryOther : formData.category}
                  </Badge>
                )}
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

