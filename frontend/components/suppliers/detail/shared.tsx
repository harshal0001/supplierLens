"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Database, Factory, FileText, Globe, Landmark, ShieldCheck, Sparkles, Truck, type LucideIcon } from "lucide-react";
import type { Category, Classification, RiskIndicator } from "@/lib/types";

export const CATEGORIES: Category[] = ["financial", "operational", "delivery", "compliance", "external"];

export const CATEGORY_LABEL: Record<Category, string> = {
  financial: "Financial",
  operational: "Operational",
  delivery: "Delivery",
  compliance: "Compliance",
  external: "External",
};

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  financial: Landmark,
  operational: Factory,
  delivery: Truck,
  compliance: ShieldCheck,
  external: Globe,
};

export const CLASS_LABEL: Record<Classification, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  insufficient_data: "Insufficient data",
};

export const DOC_LABEL: Record<string, string> = {
  financial_report: "Financial report",
  certification: "Certification",
  delivery_report: "Delivery report",
  contract: "Contract",
  other: "Other",
};

export const BASIS: Record<RiskIndicator["basis"], { label: string; icon: LucideIcon }> = {
  document_fact: { label: "From document", icon: FileText },
  external_signal: { label: "Web signal", icon: Globe },
  ai_interpretation: { label: "AI interpretation", icon: Sparkles },
  reference_data: { label: "Reference data", icon: Database },
};

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Risk band of a 0–100 value, same thresholds as the risk engine (low ≤ 30 < medium ≤ 60 < high). */
export function band(value: number): "low" | "medium" | "high" {
  return value <= 30 ? "low" : value <= 60 ? "medium" : "high";
}

export function riskVar(value: number | null) {
  return value == null ? "var(--risk-unknown)" : `var(--risk-${band(value)})`;
}

export const BAND_TEXT = { low: "text-emerald-800", medium: "text-amber-800", high: "text-red-700" } as const;

const query = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

/** Counts from the previously shown value to `target` (ease-out). Returns `target` directly when motion is reduced. */
export function useAnimatedNumber(target: number | null, duration = 1400) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null || reduced) return;
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const next = t < 1 ? start + (target - start) * (1 - (1 - t) ** 3) : target;
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return target == null || reduced ? target : value;
}
