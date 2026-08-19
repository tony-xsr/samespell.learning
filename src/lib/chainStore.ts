import "server-only";
import type { Language } from "@/types/vocab";
import type { ChainLanguageData, WordChain } from "@/types/chain";
import zhChains from "../../data/zh-chains.json";
import jaChains from "../../data/ja-chains.json";
import koChains from "../../data/ko-chains.json";

// Thử nghiệm: dữ liệu "Nối đuôi" (domino qua chữ Hán dùng chung) tĩnh hoàn toàn, cùng kiểu với
// topicStore — mở rộng thêm chuỗi hoặc AI-generate sau khi chốt schema thật.
const STATIC_CHAIN_DATA: Partial<Record<Language, ChainLanguageData>> = {
  zh: zhChains as ChainLanguageData,
  ja: jaChains as ChainLanguageData,
  ko: koChains as ChainLanguageData,
};

export function getChainLanguageData(lang: string): ChainLanguageData | undefined {
  return STATIC_CHAIN_DATA[lang as Language];
}

export function getWordChain(lang: string, chainId: string): WordChain | undefined {
  return getChainLanguageData(lang)?.chains.find((c) => c.id === chainId);
}
