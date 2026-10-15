import ConnectorHub from "@/components/connectors/ConnectorHub";
import { getConnectorData } from "@/lib/connectorStore";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; id?: string; tab?: string }>;
}) {
  const [data, params] = await Promise.all([getConnectorData(), searchParams]);
  const lang = params.lang === "ko" ? "ko" : params.lang === "both" ? "both" : "zh";
  return <ConnectorHub data={data} initialLang={lang} initialId={params.id} initialTab={params.tab === "practice" ? "practice" : "learn"} />;
}
