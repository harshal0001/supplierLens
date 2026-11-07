import { mockApi } from "@/lib/mocks";
import type { ApiFailure } from "@/lib/types";

function isApiFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.status === "number" && typeof record.code === "string" && typeof record.message === "string";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (process.env.NEXT_PUBLIC_API_MOCK === "1") {
    return mockApi<T>(path, init);
  }

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    const failure: ApiFailure = {
      status: 0,
      code: "network_error",
      message: "Could not reach the SupplierLens API.",
    };
    throw failure;
  }

  if (!response.ok) {
    let code = "request_failed";
    let message = response.statusText || "Request failed.";
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON error bodies still surface as status + code.
    }
    const failure: ApiFailure = { status: response.status, code, message };
    throw failure;
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await response.json()) as T;
  return (await response.blob()) as T;
}

export function asApiFailure(error: unknown): ApiFailure {
  if (isApiFailure(error)) return error;
  return { status: 500, code: "unknown", message: "Something went wrong." };
}
