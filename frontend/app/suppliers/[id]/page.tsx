"use client";

import { useParams } from "next/navigation";
import { SupplierDetailView } from "@/components/suppliers/supplier-detail";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = Number(params.id);
  if (!Number.isFinite(supplierId)) {
    return <p className="text-sm text-muted-foreground">Supplier not found.</p>;
  }
  return <SupplierDetailView key={supplierId} supplierId={supplierId} />;
}
