"use client";

import { useState } from "react";
import { FileText, FileUp, LoaderCircle } from "lucide-react";
import type { SupplierDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DOC_LABEL } from "./shared";

export function DocumentPanel({
  supplier,
  uploading,
  locked,
  onFiles,
}: {
  supplier: SupplierDetail;
  uploading: boolean;
  /** an analysis is running: the input is disabled (the run already picked its documents) */
  locked: boolean;
  onFiles: (files: FileList) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="space-y-3">
      <label
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center transition-all duration-300 focus-within:ring-3 focus-within:ring-ring/50 hover:border-sky-600 hover:bg-sky-50/60",
          dragOver && "scale-[1.02] border-sky-600 bg-sky-50 shadow-lg shadow-sky-900/10",
          (uploading || locked) && "cursor-progress",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={uploading || locked}
          onChange={(event) => {
            if (event.target.files) onFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <span
          className={cn(
            "grid size-12 place-items-center rounded-full bg-white text-sky-800 shadow-sm ring-1 ring-slate-200 transition-transform duration-300 group-hover:-translate-y-0.5",
            dragOver && "-translate-y-1 bg-primary text-white motion-safe:animate-bounce",
          )}
          aria-hidden
        >
          {uploading ? <LoaderCircle className="size-6 animate-spin" /> : <FileUp className="size-6" />}
        </span>
        <span className="text-sm font-medium text-slate-800">
          {uploading
            ? "Uploading…"
            : dragOver
              ? "Release to upload and analyze"
              : locked
                ? "Analysis running…"
                : "Drop PDFs here, or click to browse."}
        </span>
        <span className="text-xs text-muted-foreground">PDF · up to 10 files · 20 MB each · starts analysis</span>
        {uploading ? (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-sky-600 motion-safe:animate-pulse" aria-hidden />
        ) : null}
      </label>

      {supplier.missing_documents.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-slate-600">Missing documents:</span>
          {supplier.missing_documents.map((type) => (
            <span key={type} className="rounded-full border border-dashed border-slate-400 px-2 py-0.5 text-slate-600">
              {DOC_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      ) : null}

      {supplier.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded.</p>
      ) : (
        <ul className="grid gap-1.5">
          {supplier.documents.map((document) => (
            <li
              key={document.id}
              className="flex animate-in items-center gap-2.5 rounded-lg px-2 py-1.5 fade-in slide-in-from-top-1 hover:bg-muted"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md",
                  document.status === "processed" && "bg-emerald-50 text-emerald-700",
                  document.status === "failed" && "bg-red-50 text-red-700",
                  document.status !== "processed" && document.status !== "failed" && "bg-amber-50 text-amber-700",
                )}
                aria-hidden
              >
                {document.status === "processing" || document.status === "uploaded" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={document.filename}>
                  {document.filename}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {DOC_LABEL[document.doc_type] ?? document.doc_type}
                  {document.page_count ? ` · ${document.page_count} ${document.page_count === 1 ? "page" : "pages"}` : ""}
                </span>
                {document.error ? <span className="block text-[11px] text-red-700">{document.error}</span> : null}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                  document.status === "failed" && "bg-red-50 text-red-700",
                  document.status === "processed" && "bg-emerald-50 text-emerald-800",
                  document.status !== "failed" && document.status !== "processed" && "bg-amber-50 text-amber-800",
                )}
              >
                {document.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
