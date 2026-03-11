import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { taxonomyService, type TaxonomyTermType } from "@/services/taxonomyService";
import { cn } from "@/lib/utils";

interface TaxonomyTagFieldProps {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  description?: string;
  termType?: TaxonomyTermType;
}

export const TaxonomyTagField = ({
  label,
  options,
  values,
  onChange,
  placeholder,
  description,
  termType,
}: TaxonomyTagFieldProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [availableOptions, setAvailableOptions] = useState<string[]>([...options]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [creatingOption, setCreatingOption] = useState(false);

  const remainingOptions = useMemo(
    () => availableOptions.filter((option) => !values.includes(option)),
    [availableOptions, values],
  );

  const normalizedSearch = searchValue.trim().replace(/\s+/g, " ");
  const hasExactMatch = remainingOptions.some((option) => option.toLowerCase() === normalizedSearch.toLowerCase());

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      if (!termType) {
        setAvailableOptions([...options]);
        return;
      }

      setLoadingOptions(true);
      try {
        const taxonomyOptions = await taxonomyService.getOptions();
        if (!active) {
          return;
        }

        if (termType === "skill_tag") {
          setAvailableOptions(taxonomyOptions.skillTags);
        } else if (termType === "topic_tag") {
          setAvailableOptions(taxonomyOptions.topicTags);
        } else {
          setAvailableOptions(taxonomyOptions.courseCategories);
        }
      } catch (error) {
        console.warn("Failed to load taxonomy options for field:", error);
        if (active) {
          setAvailableOptions([...options]);
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
  }, [options, termType]);

  const addValue = (value: string) => {
    if (!value || values.includes(value)) return;
    onChange([...values, value]);
    setSearchValue("");
    setOpen(false);
  };

  const handleCreateValue = async () => {
    if (!normalizedSearch || hasExactMatch) {
      return;
    }

    if (!termType) {
      addValue(normalizedSearch);
      setAvailableOptions((current) => [...current, normalizedSearch]);
      return;
    }

    setCreatingOption(true);
    try {
      const created = await taxonomyService.ensureTerm(termType, normalizedSearch);
      setAvailableOptions((current) => {
        if (current.includes(created.name)) {
          return current;
        }

        return [...current, created.name].sort((left, right) => left.localeCompare(right));
      });
      addValue(created.name);
    } catch (error) {
      console.error("Failed to create taxonomy option:", error);
    } finally {
      setCreatingOption(false);
    }
  };

  const removeValue = (value: string) => {
    onChange(values.filter((candidate) => candidate !== value));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            <span className="truncate text-left text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} value={searchValue} onValueChange={setSearchValue} />
            <CommandList>
              <CommandEmpty>
                {creatingOption ? "Creating option..." : "No matching options found."}
              </CommandEmpty>
              {remainingOptions.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => addValue(option)}>
                  <Check className={cn("mr-2 h-4 w-4", values.includes(option) ? "opacity-100" : "opacity-0")} />
                  {option}
                </CommandItem>
              ))}
              {normalizedSearch && !hasExactMatch ? (
                <CommandItem onSelect={() => void handleCreateValue()} disabled={creatingOption}>
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
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {value}
              <button type="button" onClick={() => removeValue(value)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
};