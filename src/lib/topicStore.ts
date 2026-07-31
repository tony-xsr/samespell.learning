import "server-only";
import type { Language } from "@/types/vocab";
import type { TopicGroup, TopicLanguageData } from "@/types/topic";
import koTopics from "../../data/ko-topics.json";
import jaTopics from "../../data/ja-topics.json";

// Thử nghiệm: dữ liệu chủ đề tĩnh hoàn toàn (chưa nối AI/KV như vocabStore) — mở rộng thêm ngôn ngữ
// hoặc AI-generate sau khi chốt cấu trúc mindmap chủ đề.
const STATIC_TOPIC_DATA: Partial<Record<Language, TopicLanguageData>> = {
  ko: koTopics as TopicLanguageData,
  ja: jaTopics as TopicLanguageData,
};

export function getTopicLanguageData(lang: string): TopicLanguageData | undefined {
  return STATIC_TOPIC_DATA[lang as Language];
}

export function getTopicGroup(lang: string, topicId: string): TopicGroup | undefined {
  return getTopicLanguageData(lang)?.topics.find((t) => t.id === topicId);
}
