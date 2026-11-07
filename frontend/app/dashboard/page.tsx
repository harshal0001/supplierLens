import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-sky-800">Overview</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Workspace risk, expiring certificates, and open actions.
        </p>
      </header>
      <DashboardView />
    </div>
  );
}
