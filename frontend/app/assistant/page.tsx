import { AssistantView } from "@/components/assistant/assistant-view";

export default async function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  const raw = (await searchParams).supplier_id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return <AssistantView initialSupplierId={Number.isInteger(id) && id > 0 ? id : null} />;
}
