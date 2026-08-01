import type { Language } from "@/types/vocab";
import { useFurigana } from "@/lib/useFurigana";

const DEFAULT_CLASS = "mt-1 text-sm font-semibold text-ink";

/** Hiện câu ví dụ trên node canvas/danh sách — với tiếng Nhật, tự động thêm furigana (đọc hiragana
 * trên chữ Hán) ngay khi tính xong; trước đó (hoặc với ngôn ngữ khác) hiện câu gốc bình thường. */
export default function StoryNodeSentence({
  sentence,
  lang,
  className = DEFAULT_CLASS,
}: {
  sentence: string;
  lang: Language;
  className?: string;
}) {
  const furigana = useFurigana(sentence, lang);
  if (furigana) {
    return (
      <div
        className={`${className} leading-relaxed [&_rt]:text-[9px] [&_rt]:font-normal [&_rt]:text-ink-muted`}
        dangerouslySetInnerHTML={{ __html: furigana }}
      />
    );
  }
  return <div className={className}>{sentence}</div>;
}
