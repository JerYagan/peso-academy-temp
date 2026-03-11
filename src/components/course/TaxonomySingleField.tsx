import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { taxonomyService, type TaxonomyTermType } from "@/services/taxonomyService";

interface TaxonomySingleFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  description?: string;
  termType: TaxonomyTermType;
  fallbackOptions?: readonly string[];
}

export const TaxonomySingleField = ({
  label,
  value,
  onChange,
  placeholder,
  description,
  termType,
  fallbackOptions = [],
}: TaxonomySingleFieldProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [options, setOptions] = useState<string[]>([...fallbackOptions]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creatingOption, setCreatingOption] = useState(false);

  const normalizedSearch = searchValue.trim().replace(/\s+/g, " ");
  const hasExactMatch = useMemo(
    () => options.some((option) => option.toLowerCase() === normalizedSearch.toLowerCase()),
    [normalizedSearch, options],
  );

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const taxonomyOptions = await taxonomyService.getOptions();
        if (!active) {
          return;
        }

        if (termType === "course_category") {
          setOptions(taxonomyOptions.courseCategories);
        } else if (termType === "skill_tag") {
          setOptions(taxonomyOptions.skillTags);
        } else {
          setOptions(taxonomyOptions.topicTags);
        }
      } catch (error) {
        console.warn("Failed to load taxonomy options:", error);
        if (active) {
          setOptions([...fallbackOptions]);
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [fallbackOptions, termType]);

  const handleSelect = (selected: string) => {
    onChange(selected);
    setSearchValue("");
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!normalizedSearch || hasExactMatch) {
      return;
    }

    setCreatingOption(true);
    try {
      const created = await taxonomyService.ensureTerm(termType, normalizedSearch);
      setOptions((current) => [...current, created.name].sort((left, right) => left.localeCompare(right)));
      handleSelect(created.name);
    } catch (error) {
      console.error("Failed to create taxonomy option:", error);
    } finally {
      setCreatingOption(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            <span className={cn("truncate text-left", value ? "text-foreground" : "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>{creatingOption ? "Creating option..." : "No matching options found."}</CommandEmpty>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => handleSelect(option)}>
                  <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                  {option}
                </CommandItem>
              ))}
              {normalizedSearch && !hasExactMatch ? (
                <CommandItem onSelect={() => void handleCreate()} disabled={creatingOption}>
                  {creatingOption ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create "{normalizedSearch}"
                </CommandItem>
              ) : null}
              {loadingOptions ? (
                <CommandItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading options...
                </CommandItem>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};