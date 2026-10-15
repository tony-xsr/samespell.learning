import "server-only";
import type { ConnectorLanguage, ConnectorLanguageData } from "@/types/connector";
import { getHanVietMap } from "@/lib/lookupIndex";
import zhConnectors from "../../data/zh-connectors.json";
import koConnectors from "../../data/ko-connectors.json";

const RAW: Record<ConnectorLanguage, ConnectorLanguageData> = {
  zh: zhConnectors as ConnectorLanguageData,
  ko: koConnectors as ConnectorLanguageData,
};

const HAN = /\p{Script=Han}/u;

/** Âm Hán Việt của 1 chuỗi chữ Hán, vd "虽然…但是…" → "tuy nhiên … đãn thị"; bỏ qua nếu thiếu chữ nào. */
function hanVietOf(text: string, hvMap: Map<string, string>): string | undefined {
  const groups = text.split(/[…\s/]+/).filter((g) => HAN.test(g));
  if (groups.length === 0) return undefined;
  const out: string[] = [];
  for (const g of groups) {
    const chars = Array.from(g).filter((c) => HAN.test(c));
    const hv = chars.map((c) => hvMap.get(c));
    if (hv.some((h) => !h)) return undefined;
    out.push(hv.join(" "));
  }
  return out.join(" … ");
}

let cached: Promise<Record<ConnectorLanguage, ConnectorLanguageData>> | null = null;

async function build(): Promise<Record<ConnectorLanguage, ConnectorLanguageData>> {
  const hvMap = await getHanVietMap();
  const withHv = (data: ConnectorLanguageData): ConnectorLanguageData => ({
    ...data,
    categories: data.categories.map((c) => ({
      ...c,
      entries: c.entries.map((e) => {
        const source = data.language === "zh" ? e.form : e.hanja?.replace(/_/g, "");
        return { ...e, hanViet: source ? hanVietOf(source, hvMap) : undefined };
      }),
    })),
  });
  return { zh: withHv(RAW.zh), ko: withHv(RAW.ko) };
}

export function getConnectorData(): Promise<Record<ConnectorLanguage, ConnectorLanguageData>> {
  cached ??= build();
  cached.catch(() => (cached = null));
  return cached;
}

