import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { taxonomyService, type TaxonomyTerm, type TaxonomyTermType } from "@/services/taxonomyService";
import { toast } from "sonner";

const TERM_META: Record<TaxonomyTermType, { label: string; helper: string }> = {
  course_category: {
    label: "Course Categories",
    helper: "These appear in course creation and editing, and they guide how trainers organize course offerings.",
  },
  skill_tag: {
    label: "Skill Tags",
    helper: "These tags are used across courses, modules, and assessments for matching, analytics, and recommendations.",
  },
  topic_tag: {
    label: "Topic Tags",
    helper: "These tags describe the topics covered and power topic-level reporting and recommendation explanations.",
  },
};

const TaxonomyManagement = () => {
  const [activeTab, setActiveTab] = useState<TaxonomyTermType>("course_category");
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [newTermName, setNewTermName] = useState("");
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingTerm, setDeletingTerm] = useState<TaxonomyTerm | null>(null);

  const loadTerms = async () => {
    setLoading(true);
    try {
      const loadedTerms = await taxonomyService.getTerms(true, true);
      setTerms(loadedTerms);
    } catch (error) {
      console.error("Failed to load taxonomy terms:", error);
      toast.error("Failed to load taxonomy terms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTerms();
  }, []);

  const visibleTerms = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return terms.filter((term) => {
      if (term.termType !== activeTab) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return term.name.toLowerCase().includes(normalizedSearch);
    });
  }, [activeTab, searchValue, terms]);

  const handleCreateTerm = async () => {
    if (!newTermName.trim()) {
      toast.error("Enter a value before adding a taxonomy term.");
      return;
    }

    setSaving(true);
    try {
      await taxonomyService.ensureTerm(activeTab, newTermName);
      toast.success(`${TERM_META[activeTab].label.slice(0, -1)} added`);
      setNewTermName("");
      await loadTerms();
    } catch (error) {
      console.error("Failed to create taxonomy term:", error);
      toast.error("Failed to add taxonomy term");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTermId || !editingName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await taxonomyService.updateTerm(editingTermId, { name: editingName });
      toast.success("Taxonomy term updated");
      setEditingTermId(null);
      setEditingName("");
      await loadTerms();
    } catch (error) {
      console.error("Failed to update taxonomy term:", error);
      toast.error("Failed to update taxonomy term");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTerm = async () => {
    if (!deletingTerm) {
      return;
    }

    setSaving(true);
    try {
      await taxonomyService.deleteTerm(deletingTerm.id);
      toast.success("Taxonomy term deleted");
      setDeletingTerm(null);
      await loadTerms();
    } catch (error) {
      console.error("Failed to delete taxonomy term:", error);
      toast.error("Failed to delete taxonomy term");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Taxonomy Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage course categories, skill tags, and topic tags that appear in course and module authoring.
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaxonomyTermType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="course_category">Course Categories</TabsTrigger>
            <TabsTrigger value="skill_tag">Skill Tags</TabsTrigger>
            <TabsTrigger value="topic_tag">Topic Tags</TabsTrigger>
          </TabsList>

          {(Object.keys(TERM_META) as TaxonomyTermType[]).map((termType) => (
            <TabsContent key={termType} value={termType} className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{TERM_META[termType].label}</CardTitle>
                  <p className="text-sm text-muted-foreground">{TERM_META[termType].helper}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor={`new-${termType}`}>Add new {TERM_META[termType].label.slice(0, -1).toLowerCase()}</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`new-${termType}`}
                          value={termType === activeTab ? newTermName : ""}
                          onChange={(event) => setNewTermName(event.target.value)}
                          placeholder={`Enter ${TERM_META[termType].label.slice(0, -1).toLowerCase()} name`}
                        />
                        <Button type="button" onClick={() => void handleCreateTerm()} disabled={saving || activeTab !== termType}>
                          {saving && activeTab === termType ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`search-${termType}`}>Search existing terms</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id={`search-${termType}`}
                          value={termType === activeTab ? searchValue : ""}
                          onChange={(event) => setSearchValue(event.target.value)}
                          placeholder={`Search ${TERM_META[termType].label.toLowerCase()}`}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border">
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
                      <span>Name</span>
                      <span>Actions</span>
                    </div>
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading taxonomy terms...
                      </div>
                    ) : visibleTerms.filter((term) => term.termType === termType).length > 0 ? (
                      visibleTerms
                        .filter((term) => term.termType === termType)
                        .map((term) => (
                          <div key={term.id} className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-3 last:border-b-0">
                            <div className="min-w-0">
                              {editingTermId === term.id ? (
                                <div className="flex items-center gap-2">
                                  <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                                  <Badge variant="outline">Editing</Badge>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium text-foreground">{term.name}</span>
                                  {!term.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {editingTermId === term.id ? (
                                <>
                                  <Button type="button" size="sm" onClick={() => void handleSaveEdit()} disabled={saving}>
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTermId(null);
                                      setEditingName("");
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingTermId(term.id);
                                      setEditingName(term.name);
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setDeletingTerm(term)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No taxonomy terms match the current search.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AlertDialog open={Boolean(deletingTerm)} onOpenChange={(open) => !open && setDeletingTerm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete taxonomy term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTerm
                ? `This removes "${deletingTerm.name}" from future taxonomy pickers. Existing courses or modules that already reference it will keep their stored value until edited.`
                : "This removes the taxonomy term from future pickers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteTerm()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TaxonomyManagement;