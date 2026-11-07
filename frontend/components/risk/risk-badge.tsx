import type { Classification } from "@/lib/types";
import { cn } from "@/lib/utils";

const LABEL: Record<Classification, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  insufficient_data: "Insufficient data",
};

export function RiskBadge({
  classification,
  className,
}: {
  classification: Classification | null;
  className?: string;
}) {
  const unknown = classification == null || classification === "insufficient_data";
  const label = classification == null ? "Not assessed" : LABEL[classification];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        unknown && "border-dashed border-risk-unknown text-slate-600",
        classification === "low" && "border-risk-low/30 bg-risk-low/10 text-emerald-800",
        classification === "medium" && "border-risk-medium/40 bg-risk-medium/15 text-amber-900",
        classification === "high" && "border-risk-high/30 bg-risk-high/10 text-red-800",
        className,
      )}
    >
      {label}
    </span>
  );
}
