import { SuppliersView } from "@/components/suppliers/suppliers-view";

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-sky-800">Directory</p>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="max-w-xl text-sm text-muted-foreground">Search the workspace and add a supplier.</p>
      </header>
      <SuppliersView />
    </div>
  );
}
