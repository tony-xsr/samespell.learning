import type { Language, VocabWord } from "@/types/vocab";

/** "Mindmap chủ đề" — trục tổ chức từ vựng THEO CHỦ ĐỀ/CẢM XÚC/HOẠT ĐỘNG LIÊN QUAN (vd "Ngoại hình
 * và tính cách", "Thời tiết và mùa"), khác với trục đồng âm/đồng hình ở `SoundGroup`. Mỗi nhánh
 * (branch) là 1 nhóm con trong chủ đề (vd "긍정적/Tích cực"), chứa các từ lõi — mỗi từ lõi có thể có
 * `children` (tái dùng `VocabWord.children`) là các từ đồng nghĩa/liên quan mở rộng ra, vẽ bằng nét
 * đứt trên mindmap để phân biệt với quan hệ cha-con chính (nét liền chủ đề → nhánh → từ lõi). */
export interface TopicBranch {
  id: string;
  /** Tên nhánh bằng tiếng gốc, vd "긍정적". */
  titleNative: string;
  titleVn: string;
  words: VocabWord[];
}

export interface TopicGroup {
  id: string;
  language: Language;
  /** Tên chủ đề bằng tiếng gốc, vd "외모와 성격". */
  titleNative: string;
  titleVn: string;
  branches: TopicBranch[];
}

export interface TopicLanguageData {
  language: Language;
  label: string;
  topics: TopicGroup[];
}
