import { cn } from "@/lib/utils";

/** SupplierLens mark: a lens over rising risk bars. Decorative; the product name is always shown next to it. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#EA7A34" />
      <circle cx="14" cy="14" r="8" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
      <line x1="20" y1="20" x2="25.5" y2="25.5" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <rect x="10" y="15" width="2" height="4" rx="0.5" fill="#FFFFFF" />
      <rect x="13" y="12.5" width="2" height="6.5" rx="0.5" fill="#FFFFFF" />
      <rect x="16" y="10" width="2" height="9" rx="0.5" fill="#FFFFFF" />
    </svg>
  );
}
