"use client";

import { Check, CircleCheck, X } from "lucide-react";
import type { ActionItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIORITY = {
  high: { bar: "bg-risk-high", chip: "bg-red-50 text-red-700" },
  medium: { bar: "bg-risk-medium", chip: "bg-amber-50 text-amber-900" },
  low: { bar: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
} as const;

const STATUS_CHIP: Record<ActionItem["status"], string> = {
  proposed: "border-dashed border-slate-300 text-slate-600",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-slate-200 bg-slate-100 text-slate-500 line-through",
  done: "border-sky-200 bg-sky-50 text-sky-900",
};

export function ActionCards({
  actions,
  pending,
  onUpdate,
}: {
  actions: ActionItem[];
  pending: number | null;
  onUpdate: (action: ActionItem, status: "approved" | "rejected" | "done") => void;
}) {
  if (actions.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-muted-foreground">No actions yet.</p>;
  }
  const decided = actions.filter((action) => action.status !== "proposed").length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-700"
            style={{ width: `${(decided / actions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {decided} of {actions.length} decided
        </span>
      </div>
      <ul className="grid gap-3">
        {actions.map((action) => (
          <li
            key={action.id}
            className={cn(
              "relative overflow-hidden rounded-xl bg-card p-3 pl-4 ring-1 ring-foreground/10 transition-all",
              (action.status === "rejected" || action.status === "done") && "opacity-70",
              action.status === "approved" && "ring-emerald-300",
            )}
          >
            <span className={cn("absolute inset-y-0 left-0 w-1.5", PRIORITY[action.priority].bar)} aria-hidden />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", PRIORITY[action.priority].chip)}>
                {action.priority} priority
              </span>
              <span
                key={action.status}
                className={cn(
                  "inline-flex animate-in items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium zoom-in-75 duration-300",
                  STATUS_CHIP[action.status],
                )}
              >
                {action.status === "approved" ? <CircleCheck className="size-3" aria-hidden /> : null}
                {action.status}
              </span>
            </div>
            <p className="mt-1.5 font-medium">{action.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{action.rationale}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={pending === action.id || action.status === "approved" || action.status === "done"}
                onClick={() => onUpdate(action, "approved")}
              >
                <Check aria-hidden />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending === action.id || action.status === "rejected" || action.status === "done"}
                onClick={() => onUpdate(action, "rejected")}
              >
                <X aria-hidden />
                Reject
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending === action.id || action.status === "done"}
                onClick={() => onUpdate(action, "done")}
              >
                Done
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
