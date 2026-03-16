import { cn } from "@/lib/utils";

export type SecurityCriteriaItem = {
  id: string;
  label: string;
  met?: boolean;
};

type SecurityCriteriaPanelProps = {
  title: string;
  items: SecurityCriteriaItem[];
  columns?: 1 | 2;
  className?: string;
};

const SecurityCriteriaPanel = ({
  title,
  items,
  columns = 1,
  className,
}: SecurityCriteriaPanelProps) => {
  return (
    <div className={cn("space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4", className)}>
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className={cn("grid gap-2 text-xs text-muted-foreground", columns === 2 && "sm:grid-cols-2")}>
        {items.map((item) => {
          const isMet = item.met === true;
          const isUnmet = item.met === false;

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors",
                isMet && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                isUnmet && "bg-muted/40",
                item.met === undefined && "bg-background/60",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isMet && "bg-emerald-500",
                  isUnmet && "bg-muted-foreground/50",
                  item.met === undefined && "bg-sky-500/70",
                )}
              />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SecurityCriteriaPanel;