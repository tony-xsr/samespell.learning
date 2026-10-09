"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/types/vocab";
import AnswerCardView from "@/components/AnswerCardView";

/** Theme "kind: group" → API trả về { group, note }, điều hướng tới trang mindmap.
 * Theme "kind: card" → API trả về { card }, hiển thị NGAY tại đây, không điều hướng. */
const HAN_LANGS: Language[] = ["zh", "ko", "ja"];

const THEMES = [
  {
    key: "sound",
    label: "🔊 Đồng âm",
    kind: "group" as const,
    langs: HAN_LANGS,
    description: "Tìm các từ khác nhau nhưng đọc giống nhau (chung chữ Hán/Hanja gốc).",
    example: "Ví dụ: 峰, 风, 疯 đều đọc \"fēng\" — nếu trùng cách đọc với nhóm đã có, tự gộp chung.",
    nhap: "风",
    nhan: "Mindmap cách đọc \"fēng\": 峰 (đỉnh núi), 疯 (điên), 丰 (phong phú)… Nếu đã có nhóm \"fēng\" thì từ mới được gộp vào nhóm đó chứ không tạo thêm.",
  },
  {
    key: "polyphonic",
    label: "🌗 Đa âm Hán Việt",
    kind: "group" as const,
    langs: HAN_LANGS,
    description: "Tìm 1 chữ có NHIỀU cách đọc khác nhau tuỳ nghĩa/từ ghép, sinh từ minh hoạ từng cách đọc.",
    example: "Ví dụ: 乐 đọc \"nhạc\" trong 音乐 (âm nhạc) nhưng đọc \"lạc\" trong 快乐 (vui vẻ).",
    nhap: "乐",
    nhan: "Mindmap 1 chữ – nhiều âm: nhánh \"nhạc\" (音乐, 乐器) và nhánh \"lạc\" (快乐, 乐趣).",
  },
  {
    key: "synonym-family",
    label: "🔗 Họ hàng nghĩa/Đồng-trái nghĩa",
    kind: "group" as const,
    langs: HAN_LANGS,
    description: "Tìm các từ gần nghĩa nhưng sắc thái lệch nhau, dùng chung 1 chữ gốc — kèm thêm từ trái nghĩa.",
    example: "Ví dụ: 递交/提交/上交 đều dùng chữ 交 (nộp/giao) nhưng sắc thái trang trọng khác nhau.",
    nhap: "提交",
    nhan: "Mindmap quanh chữ 交: 递交 / 提交 / 上交 (cùng là \"nộp\", trang trọng tăng dần) kèm một nhánh từ trái nghĩa.",
  },
  {
    key: "word-family",
    label: "🌳 Từ cùng gốc (Latin/Hy Lạp)",
    kind: "group" as const,
    langs: ["en", "es"] as Language[],
    description: "Tìm các từ (tiếng Anh nâng cao hoặc tiếng Tây Ban Nha) cùng gốc từ nguyên Latin/Hy Lạp.",
    example: "Ví dụ: extract, attract, subtract đều chứa gốc \"tract\" (kéo, rút); mantener, sostener, obtener đều chứa gốc \"tener\" (giữ).",
    nhap: "extract",
    nhan: "Mindmap gốc \"tract\" (kéo, rút): extract, attract, subtract, retract… mỗi từ kèm nghĩa và câu ví dụ.",
  },
  {
    key: "quick-dict",
    mode: "quick-explain",
    label: "📖 Giải thích nhanh",
    kind: "card" as const,
    description: "Tra nhanh nghĩa/cách đọc/ví dụ của 1 từ, hiện ngay tại đây.",
    example:
      "Ví dụ gõ 勉強 → nhận: べんきょう · \"học tập\" · 毎日日本語を勉強します (Ngày nào tôi cũng học tiếng Nhật). Không tạo mindmap.",
    nhap: "勉強",
    nhan: "Một thẻ ngay bên dưới: cách đọc, nghĩa tiếng Việt, 1–2 câu ví dụ. Nhanh nhất trong các kiểu.",
  },
  {
    key: "etymology",
    mode: "etymology",
    label: "🀄 Chiết tự Hán",
    kind: "card" as const,
    langs: ["zh", "ja"] as Language[],
    description: "Phân tích chữ Hán/Kanji thành bộ thủ + thành phần cấu tạo, giải thích vì sao ghép ra nghĩa đó.",
    example: "Ví dụ: 好 = 女 (nữ) + 子 (con) — mẹ bên con là điều tốt lành.",
    nhap: "好",
    nhan: "Một thẻ: 好 = 女 (nữ) + 子 (con), kèm lý giải vì sao ghép lại thành nghĩa \"tốt\". Gõ 1 chữ đơn, đừng gõ từ ghép.",
  },
  {
    key: "explain-mnemonic",
    mode: "explain-mnemonic",
    label: "🧠 Giải thích sâu & mẹo nhớ",
    kind: "card" as const,
    description: "AI giải thích sắc thái/ngữ cảnh dùng sâu hơn tra nhanh, kèm mẹo nhớ ngay trong cùng 1 lần.",
    example:
      "Ví dụ gõ 微妙 → nhận: dùng khi tình thế khó gọi tên, hơi tế nhị; khác 复杂 (rắc rối về cấu trúc). Mẹo nhớ: \"vi\" là nhỏ, \"diệu\" là khéo — nhỏ mà khéo nên khó nói ra.",
    nhap: "微妙",
    nhan: "Một thẻ dài hơn \"Giải thích nhanh\": dùng trong hoàn cảnh nào, khác gì từ gần nghĩa, và một mẹo nhớ.",
  },
  {
    key: "examples",
    mode: "examples",
    label: "📝 Thêm ví dụ",
    kind: "card" as const,
    description: "Sinh 3-4 câu ví dụ ở nhiều ngữ cảnh/sắc thái khác nhau cho 1 từ.",
    example:
      "Ví dụ gõ 大丈夫 → nhận: 大丈夫だよ (bạn bè: không sao đâu) · 大丈夫でしょうか (công sở: liệu có ổn không ạ) · ご心配なく、大丈夫です (email).",
    nhap: "大丈夫",
    nhan: "Một thẻ gồm 3–4 câu CÂU HOÀN CHỈNH: một câu thân mật, một câu công sở, một câu viết.",
  },
  {
    key: "synonyms",
    mode: "synonyms",
    label: "🔗 Từ đồng nghĩa",
    kind: "card" as const,
    description: "Tìm các từ gần nghĩa, kèm khác biệt sắc thái so với từ gốc.",
    example:
      "Ví dụ gõ 高兴 → nhận: 快乐 (vui kéo dài, dùng cả lời chúc) · 愉快 (dễ chịu, hơi trang trọng) · 开心 (vui bộc phát, khẩu ngữ). Không tạo mindmap.",
    nhap: "高兴",
    nhan: "Một thẻ: 快乐, 愉快, 开心… kèm chỗ khác nhau với 高兴. Giống \"Họ hàng nghĩa\" nhưng KHÔNG tạo mindmap.",
  },
  {
    key: "idiom",
    mode: "idiom",
    label: "🏮 Phân tích thành ngữ",
    kind: "card" as const,
    description: "Tách nghĩa MẶT CHỮ với nghĩa dùng THẬT của thành ngữ/quán ngữ, kèm chẻ từng chữ, điển tích và sắc thái khen/chê.",
    example:
      "Ví dụ gõ 春心荡漾 → nhận: chūn xīn dàng yàng · thành ngữ · \"lòng yêu đương rạo rực, xao xuyến\" (mặt chữ: lòng xuân dao động) · 看到他的笑容，她不禁春心荡漾。",
    nhap: "春心荡漾",
    nhan: "Một thẻ: nghĩa thật vs nghĩa mặt chữ, chẻ 春/心/荡/漾 từng chữ, điển tích (nếu có), dùng khen hay chê, và 1 câu ví dụ.",
  },
  {
    key: "sentence",
    mode: "sentence",
    label: "✂️ Mổ xẻ câu",
    kind: "card" as const,
    description: "Dán CẢ MỘT CÂU vào — AI chẻ câu thành từng khúc, mỗi khúc kèm cách đọc, nghĩa và vai trong câu.",
    example:
      "Ví dụ gõ 看到他的笑容，她不禁春心荡漾。 → nhận: bản dịch cả câu, rồi từng khúc 看到 (động từ chính) · 他的笑容 (bổ ngữ) · 不禁 (trạng ngữ)… kèm cấu trúc ngữ pháp.",
    nhap: "看到他的笑容，她不禁春心荡漾。",
    nhan: "Một thẻ: dịch cả câu, bảng chẻ câu theo thứ tự kèm vai từng khúc, cấu trúc ngữ pháp và lưu ý. Kiểu DUY NHẤT không chẻ chuỗi nhập theo dấu phẩy.",
  },
  {
    key: "collocations",
    mode: "collocations",
    label: "🧩 Cụm từ đi cùng",
    kind: "card" as const,
    description: "Tìm các cụm từ/tổ hợp ngắn thông dụng thường đi cùng từ này.",
    example:
      "Ví dụ gõ 决定 → nhận: 做决定 (ra quyết định) · 最终决定 (quyết định cuối cùng) · 决定权 (quyền quyết định). Là CỤM ngắn, không phải câu hoàn chỉnh như \"Thêm ví dụ\".",
    nhap: "决定",
    nhan: "Một thẻ các CỤM NGẮN: 做决定 (ra quyết định), 最终决定 (quyết định cuối cùng), 决定权…",
  },
];

const THEME_STORAGE_KEY = "samespell:ai-theme";

interface WordResult {
  word: string;
  note: string;
  groupId?: string;
  card?: Record<string, string>;
  cardTheme?: string;
  /** Nhóm "Từ tự tra" mà từ vừa tra đã được lưu vào (xem Features.md mục 32). Có giá trị thì hiện link
   * "đã lưu" dưới thẻ — trước đây tra xong không có dấu hiệu nào cho biết từ đã vào kho hay chưa. */
  savedGroupId?: string;
  /** true = từ này đã tra trước đó rồi, lần này ghi đè nội dung chứ không thêm bản trùng. */
  savedReplaced?: boolean;
}

/** Tách chuỗi nhập thành nhiều từ nếu người dùng gõ nhiều từ cách nhau bằng dấu phẩy (thường hoặc
 * kiểu Trung/Nhật), dấu gạch chéo, hoặc xuống dòng — vd "峰，风，疯" → ["峰", "风", "疯"]. */
function splitWords(input: string): string[] {
  return input
    .split(/[,，、/\n]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export default function NewGroupPrompt({
  lang,
  existingReadings,
}: {
  lang: Language;
  existingReadings: string[];
}) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const availableThemes = THEMES.filter((t) => !t.langs || t.langs.includes(lang));
  const [theme, setTheme] = useState(() => availableThemes[0]?.key ?? "sound");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES.some((t) => t.key === saved && (!t.langs || t.langs.includes(lang)))) {
      setTheme(saved);
    }
  }, [lang]);

  function selectTheme(key: string) {
    setTheme(key);
    window.localStorage.setItem(THEME_STORAGE_KEY, key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selected = availableThemes.find((t) => t.key === theme) ?? THEMES[0];
    // Theme "✂️ Mổ xẻ câu" nhận CẢ MỘT CÂU — mà câu tiếng Trung/Nhật thì đầy dấu "，" và "、", đúng
    // những dấu splitWords dùng để chẻ nhiều từ. Chẻ câu ra ở đây là gửi từng mẩu vụn cho AI.
    const words = selected.key === "sentence" ? [word.trim()].filter(Boolean) : splitWords(word);
    if (words.length === 0 || loading) return;
    setError(null);
    setResults([]);
    setLoading(true);

    const collected: WordResult[] = [];
    const errors: string[] = [];

    // Gửi TUẦN TỰ (không song song) — để từ thứ 2 trở đi có thể phát hiện nhóm đồng âm vừa được
    // tạo bởi từ ngay trước đó trong CÙNG lượt gửi này (server đọc lại dữ liệu mới nhất mỗi lần).
    for (const w of words) {
      try {
        const body =
          selected.kind === "group"
            ? { mode: "new-group", language: lang, word: w, existingReadings, theme: selected.key }
            : { mode: "mode" in selected ? selected.mode : "quick-explain", language: lang, word: w };
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Không xử lý được "${w}".`);
        if (selected.kind === "group") {
          collected.push({ word: w, groupId: data.group.id, note: data.note ?? `Đã xử lý "${w}".` });
        } else {
          collected.push({
            word: w,
            note: `Đã xử lý "${w}".`,
            card: data.card,
            cardTheme: selected.key,
            savedGroupId: data.saved?.groupId,
            savedReplaced: data.saved?.replaced,
          });
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Có lỗi khi xử lý "${w}".`);
      }
    }

    setResults(collected);
    if (errors.length > 0) setError(errors.join(" "));
    setLoading(false);

    if (collected.length > 0) {
      setWord("");
      if (selected.kind === "group") {
        const uniqueGroupIds = new Set(collected.map((r) => r.groupId));
        if (uniqueGroupIds.size === 1) {
          // Cả (các) từ vừa nhập đều rơi vào cùng 1 nhóm — mở thẳng nhóm đó luôn, giống hành vi cũ.
          router.push(`/${lang}/${collected[0].groupId}`);
        }
      }
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-dashed border-accent-400 bg-surface-2 p-4"
    >
      <label className="text-sm font-semibold text-ink">✨ Hỏi AI / Tạo mindmap mới</label>

      {/* Chia làm HAI nhóm có nhãn. Khác biệt lớn nhất giữa 10 kiểu không phải là nội dung mà là
          CHUYỆN GÌ XẢY RA SAU KHI BẤM GỬI: 4 kiểu tạo một mindmap mới rồi chuyển sang trang đó,
          6 kiểu chỉ hiện một thẻ ngay bên dưới ô nhập. Dải nút phẳng cũ không hề nói ra điều này,
          nên nhìn tên kiểu ("Đa âm Hán Việt", "Họ hàng nghĩa") thì không đoán được nên chọn gì. */}
      {(["group", "card"] as const).map((kind) => {
        const ds = availableThemes.filter((t) => t.kind === kind);
        if (ds.length === 0) return null;
        return (
          <div key={kind} className="mt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {kind === "group"
                ? "Tạo mindmap mới · bấm Gửi là mở sang trang mindmap"
                : "Tra 1 từ · thẻ hiện ngay bên dưới, không rời trang"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ds.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectTheme(t.key)}
                  disabled={loading}
                  // Chú giải khi trỏ chuột: xem được kiểu khác làm gì mà KHÔNG phải bấm vào nó
                  // (bấm vào là đổi lựa chọn, và lựa chọn được ghi vào localStorage).
                  title={`${t.description}

Gõ: ${t.nhap}
Nhận: ${t.nhan}`}
                  className={`max-w-full rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    theme === t.key
                      ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-sm"
                      : "border border-border bg-surface text-ink-muted hover:bg-surface-3"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {(() => {
        const selectedTheme = availableThemes.find((t) => t.key === theme);
        if (!selectedTheme) return null;
        return (
          <div className="mt-2 rounded-xl bg-surface-3 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">{selectedTheme.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  selectedTheme.kind === "group"
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
                    : "bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300"
                }`}
              >
                {selectedTheme.kind === "group" ? "→ mở mindmap mới" : "→ thẻ tra cứu tại đây"}
              </span>
            </div>
            <p className="mt-1 text-ink-muted">{selectedTheme.description}</p>
            {/* Hai dòng dưới đây là phần người dùng thật sự cần: gõ gì vào, và nhận lại cái gì.
                Để cỡ chữ thân bài và màu mực thường — mô tả cũ bị đẩy xuống `text-ink-muted`
                nhạt nên bị bỏ qua. */}
            <p className="mt-1.5 break-words text-ink">
              <span className="font-semibold">Bạn gõ: </span>
              <code className="rounded bg-surface px-1 py-0.5">{selectedTheme.nhap}</code>
            </p>
            <p className="mt-0.5 break-words text-ink">
              <span className="font-semibold">Nhận được: </span>
              {selectedTheme.nhan}
            </p>
            <p className="mt-1 break-words italic text-ink-muted">{selectedTheme.example}</p>

            {/* Trước đây muốn biết một kiểu khác làm gì thì chỉ có hai cách: rê chuột lên chip để
                xem `title` (điện thoại không rê được), hoặc BẤM vào nó — mà bấm là đổi luôn lựa
                chọn và ghi vào localStorage. Nên thực tế không có cách nào so sánh các kiểu trước
                khi chọn. Bảng dưới đây mở ra tại chỗ, liệt kê gõ-gì-nhận-gì của MỌI kiểu, và không
                đụng tới lựa chọn hiện tại. */}
            <details className="mt-2 border-t border-border pt-1.5">
              <summary className="cursor-pointer list-none font-semibold text-brand-600 hover:underline">
                ❓ Các kiểu khác làm gì? — xem hết, không đổi lựa chọn
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {availableThemes.map((t) => (
                  <li
                    key={t.key}
                    className={`rounded-lg px-2 py-1.5 ${
                      t.key === selectedTheme.key ? "bg-brand-50 dark:bg-brand-950/40" : "bg-surface-2"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-1.5">
                      <span className="font-semibold text-ink">{t.label}</span>
                      <span className="text-[10px] font-bold text-ink-muted">
                        {t.kind === "group" ? "→ mindmap" : "→ thẻ tra cứu"}
                      </span>
                    </div>
                    <p className="break-words text-ink-muted">
                      Gõ <code className="rounded bg-surface px-1">{t.nhap}</code> → {t.nhan}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      })()}

      <p className="mt-2 text-xs text-ink-muted">
        {theme === "sentence" ? (
          <>Dán nguyên MỘT CÂU (giữ cả dấu phẩy, dấu chấm) — kiểu này không chẻ chuỗi nhập theo dấu phẩy.</>
        ) : (
          <>
            Nhập 1 từ, hoặc nhiều từ cách nhau bằng dấu phẩy (vd{" "}
            {lang === "en" ? "extract, attract" : lang === "es" ? "mantener, obtener" : "峰，风，疯"}) — AI sẽ xử lý
            theo kiểu đã chọn ở trên.
          </>
        )}{" "}
        Mọi từ bạn tra đều tự động được lưu vào nhóm “Từ tự tra” của bạn.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={
            theme === "sentence"
              ? "Dán cả câu, vd: 看到他的笑容，她不禁春心荡漾。"
              : theme === "idiom"
                ? "Ví dụ: 春心荡漾, 画蛇添足..."
                : lang === "en"
                  ? "Ví dụ: extract, portable, inspect..."
                  : lang === "es"
                    ? "Ví dụ: mantener, proponer, convertir..."
                    : "Ví dụ: 木头, 학교, 勉強 hoặc 峰，风，疯..."
          }
          disabled={loading}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !word.trim()}
          className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {loading ? "Đang tạo…" : "Gửi"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((r, i) =>
            r.card ? (
              <div key={`${r.word}-${i}`} className="rounded-xl border border-border bg-surface p-3">
                <AnswerCardView theme={r.cardTheme ?? "quick-dict"} card={r.card} />
                {/* Mọi lần tra giờ đều được lưu thành từ vựng thật — nói ra để người học biết mình
                    không phải chép tay lại, và bấm được sang chỗ ôn tập nó. */}
                {r.savedGroupId && (
                  <button
                    type="button"
                    onClick={() => router.push(`/${lang}/${r.savedGroupId}`)}
                    className="mt-2 block text-left text-xs font-medium text-brand-600 hover:underline"
                  >
                    {r.savedReplaced
                      ? "✚ Đã có trong “Từ tự tra” — vừa cập nhật lại. Mở nhóm →"
                      : "✚ Đã lưu vào “Từ tự tra” (lọc được bằng ✚ Tự thêm, ôn được như từ thường). Mở nhóm →"}
                  </button>
                )}
              </div>
            ) : (
              <button
                key={`${r.word}-${i}`}
                type="button"
                onClick={() => router.push(`/${lang}/${r.groupId}`)}
                className="block text-left text-xs text-brand-600 hover:underline"
              >
                {r.note}
              </button>
            ),
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
