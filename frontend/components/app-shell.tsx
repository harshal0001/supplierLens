"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/assistant", label: "Assistant", icon: MessagesSquare },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onDark }: { onDark: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 md:flex-col" aria-label="Primary">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
              onDark
                ? active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                : active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-5 py-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo className="size-9" />
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-sidebar-foreground/60 uppercase">Procurement</p>
            <p className="text-lg leading-tight font-semibold tracking-tight">SupplierLens</p>
          </div>
        </Link>
        <div className="px-3">
          <NavLinks onDark />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="size-7" />
            <span className="text-base font-semibold tracking-tight">SupplierLens</span>
          </Link>
        </header>
        <div className="border-b border-border bg-card px-3 py-2 md:hidden">
          <NavLinks onDark={false} />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6">
          Risk assessments are based on available evidence, not financial or legal advice.
        </footer>
      </div>
    </div>
  );
}
