import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

interface TaxonomyTagFieldProps {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  description?: string;
}

export const TaxonomyTagField = ({
  label,
  options,
  values,
  onChange,
  placeholder,
  description,
}: TaxonomyTagFieldProps) => {
  const [selectedValue, setSelectedValue] = useState("");

  const remainingOptions = options.filter((option) => !values.includes(option));

  useEffect(() => {
    if (selectedValue && values.includes(selectedValue)) {
      setSelectedValue("");
    }
  }, [selectedValue, values]);

  const addValue = () => {
    if (!selectedValue || values.includes(selectedValue)) return;
    onChange([...values, selectedValue]);
    setSelectedValue("");
  };

  const removeValue = (value: string) => {
    onChange(values.filter((candidate) => candidate !== value));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex gap-2">
        <Select value={selectedValue} onValueChange={setSelectedValue}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {remainingOptions.length > 0 ? (
              remainingOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__none__" disabled>
                No more options
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={addValue} disabled={!selectedValue || selectedValue === "__none__"}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
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