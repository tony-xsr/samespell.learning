"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/types/vocab";
import type { StudyBranch } from "@/lib/studyBranches";
import { levelRank } from "@/lib/levels";
import { speak } from "@/lib/tts";

/** CHẾ ĐỘ TRANG GIẤY — đổ cả mindmap xuống một trang giấy để đọc/chép/in.
 *
 * Khác với "Danh sách" (bảng tra cứu có ô lọc, nền giao diện app): đây là một TỜ GIẤY — canh giữa, có
 * dòng kẻ, có lề đỏ, chữ serif, mỗi nhánh là một mục đánh số. Mục đích là đọc liền mạch và in ra chép
 * tay, nên không có ô lọc/tìm kiếm chen vào giữa nội dung.
 */

type PaperStyle = "ruled" | "plain" | "grid" | "cream" | "dark";

const FONT_STEPS = [15, 17, 19, 22] as const;

/** Mỗi kiểu giấy: màu giấy + hoa văn. Dòng kẻ vẽ bằng `repeating-linear-gradient` với bước đúng bằng
 * `--rule` (line-height của phần nội dung), nhờ vậy chữ nằm ĐÚNG trên dòng kẻ ở mọi cỡ chữ.
 *
 * Luôn tách `backgroundColor` / `backgroundImage` / `backgroundSize`, không dùng shorthand `background`:
 * trong shorthand, màu nền chỉ được phép ở lớp cuối cùng — viết sai thì trình duyệt vứt cả khai báo và
 * hoa văn mất sạch mà không báo lỗi.
 */
const PAPER_STYLES: Record<
  PaperStyle,
  { label: string; dark: boolean; paper: string; ink: string; ruleColor?: string; gridColor?: string }
> = {
  ruled: { label: "Kẻ ngang", dark: false, paper: "#fffdf7", ink: "#2b2a26", ruleColor: "#cfe0ee" },
  plain: { label: "Trơn", dark: false, paper: "#ffffff", ink: "#24242a" },
  grid: { label: "Ô ly", dark: false, paper: "#fffef9", ink: "#2b2a26", gridColor: "#dbe7d7" },
  cream: { label: "Giấy ngà", dark: false, paper: "#f6ecd9", ink: "#3b3328", ruleColor: "#ddcdaf" },
  dark: { label: "Giấy tối", dark: true, paper: "#211f1c", ink: "#ece6da", ruleColor: "#3b3733" },
};

function sheetBackground(style: PaperStyle, rule: number): React.CSSProperties {
  const s = PAPER_STYLES[style];
  if (s.gridColor) {
    return {
      backgroundColor: s.paper,
      backgroundImage: `linear-gradient(${s.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${s.gridColor} 1px, transparent 1px)`,
      backgroundSize: `${rule}px ${rule}px`,
    };
  }
  if (s.ruleColor) {
    return {
      backgroundColor: s.paper,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${rule - 1}px, ${s.ruleColor} ${rule - 1}px, ${s.ruleColor} ${rule}px)`,
    };
  }
  return { backgroundColor: s.paper };
}

const PRINT_CSS = `
@media print {
  /* Overlay này nằm trong cùng document với cả trang web — khi in phải ẩn mọi thứ khác đi, nếu không
     tờ giấy sẽ bị in kèm thanh điều hướng và cả canvas mindmap phía sau. */
  body { visibility: hidden !important; background: #fff !important; }
  .paper-sheet-root { visibility: visible !important; position: absolute !important; inset: 0 auto auto 0 !important;
    width: 100% !important; height: auto !important; overflow: visible !important; padding: 0 !important;
    background: #fff !important; }
  .paper-sheet-root * { visibility: visible !important; }
  .paper-sheet-root .paper-no-print { display: none !important; }
  .paper-sheet-root .paper-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important;
    max-width: none !important; width: 100% !important; background-color: #fff !important; }
  .paper-entry { break-inside: avoid; page-break-inside: avoid; }
  .paper-section { break-inside: avoid-page; }
}
`;

export default function PaperSheetView({
  branches,
  language,
  title,
  subtitle,
  onClose,
}: {
  branches: StudyBranch[];
  language: Language;
  title: string;
  /** Dòng mô tả dưới tiêu đề, vd "14 chữ đồng âm · 42 từ". */
  subtitle: string;
  onClose: () => void;
}) {
  const [style, setStyle] = useState<PaperStyle>("ruled");
  const [fontStep, setFontStep] = useState(1);
  const [hideMeaning, setHideMeaning] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const skin = PAPER_STYLES[style];
  const fontSize = FONT_STEPS[fontStep];
  // Dòng kẻ thưa hơn chữ một chút cho dễ đọc; chữ và dòng kẻ dùng CÙNG con số này nên luôn khớp nhau.
  const rule = Math.round(fontSize * 1.75);
  // Chữ phụ (phiên âm, loại từ, câu ví dụ) chiếm phần lớn trang giấy, nên không được mờ quá: ở mức
  // 0.6 đo ra tương phản chỉ 3.3–3.6, dưới ngưỡng đọc được 4.5 của WCAG — và trang này còn để IN ra
  // giấy, in mực nhạt còn khó đọc hơn trên màn hình.
  const muted = skin.dark ? "rgba(236,230,218,0.68)" : "rgba(55,51,44,0.78)";
  const accent = skin.dark ? "#e4b96b" : "#8a5a2b";

  const totalWords = branches.reduce((s, b) => s + b.words.length, 0);

  return (
    <div
      className="paper-sheet-root fixed inset-0 z-50 overflow-y-auto bg-black/60 p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Trang giấy"
    >
      <style>{PRINT_CSS}</style>

      {/* Thanh công cụ nổi — `paper-no-print` để không bị in ra giấy. */}
      <div className="paper-no-print sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-1.5 bg-black/40 px-3 py-2 backdrop-blur sm:rounded-full">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-white/70">📄 Giấy</span>
        {(Object.keys(PAPER_STYLES) as PaperStyle[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setStyle(id)}
            aria-pressed={style === id}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              style === id
                ? "border-white bg-white text-black"
                : "border-white/30 text-white/80 hover:bg-white/10"
            }`}
          >
            {PAPER_STYLES[id].label}
          </button>
        ))}

        <span className="ml-2 flex items-center gap-1 rounded-full border border-white/30 px-1">
          <button
            type="button"
            onClick={() => setFontStep((s) => Math.max(0, s - 1))}
            disabled={fontStep === 0}
            aria-label="Chữ nhỏ hơn"
            className="h-7 w-7 rounded-full text-xs font-bold text-white disabled:opacity-40"
          >
            A−
          </button>
          <span className="text-[11px] text-white/70">{fontSize}px</span>
          <button
            type="button"
            onClick={() => setFontStep((s) => Math.min(FONT_STEPS.length - 1, s + 1))}
            disabled={fontStep === FONT_STEPS.length - 1}
            aria-label="Chữ to hơn"
            className="h-7 w-7 rounded-full text-sm font-bold text-white disabled:opacity-40"
          >
            A+
          </button>
        </span>

        <button
          type="button"
          onClick={() => {
            setHideMeaning((h) => !h);
            setRevealed(new Set());
          }}
          aria-pressed={hideMeaning}
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
            hideMeaning ? "border-amber-300 bg-amber-200 text-amber-900" : "border-white/30 text-white/80 hover:bg-white/10"
          }`}
        >
          {hideMeaning ? "👁 Hiện nghĩa" : "🙈 Ẩn nghĩa"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-white/30 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          🖨 In
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng trang giấy"
          className="ml-auto rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
        >
          ✕ Đóng
        </button>
      </div>

      {/* Tờ giấy. `--rule` dùng cho cả line-height của nội dung lẫn bước dòng kẻ ở nền. */}
      <article
        className="paper-sheet mx-auto max-w-[820px] shadow-2xl sm:rounded-sm"
        style={
          {
            ...sheetBackground(style, rule),
            color: skin.ink,
            // KHÔNG dùng Georgia đứng đầu: bản Georgia trên Windows thiếu các ký tự tiếng Việt có hai
            // dấu (ồ, ắ, ấ, ể…), trình duyệt phải ghép dấu rời từ font khác nên chữ hiện ra kiểu
            // "đồ`ng âm", "nâ´m mèo" — đã thấy tận mắt khi chụp màn hình. Times New Roman / Cambria /
            // Noto Serif đều phủ đủ tiếng Việt trên Windows, macOS/iOS và Android.
            fontFamily: "'Times New Roman', Cambria, 'Noto Serif', 'Liberation Serif', serif",
            fontSize,
            lineHeight: `${rule}px`,
            "--rule": `${rule}px`,
          } as React.CSSProperties
        }
      >
        {/* Lề đỏ bên trái như vở viết — THỤT VÀO khỏi mép giấy (`ml`), không nằm sát mép, đúng kiểu
            vở học sinh; nội dung bắt đầu sau vạch lề. */}
        <div
          className="ml-6 border-l-2 py-8 pl-4 pr-5 sm:ml-10 sm:pl-8 sm:pr-12"
          style={{ borderLeftColor: skin.dark ? "#7a4040" : "#e09a9a" }}
        >
          <header className="text-center" style={{ marginBottom: rule }}>
            <h1 className="font-bold" style={{ fontSize: fontSize * 2, lineHeight: `${rule * 2}px` }}>
              {title}
            </h1>
            <p style={{ color: muted, fontStyle: "italic" }}>{subtitle}</p>
            <hr className="mx-auto mt-1 w-24" style={{ borderColor: muted }} />
          </header>

          {branches.map((b, bi) => (
            <section key={b.id} className="paper-section" style={{ marginBottom: rule }}>
              <h2 className="font-bold" style={{ fontSize: fontSize * 1.3 }}>
                <span style={{ color: accent }}>{bi + 1}.</span>{" "}
                <button
                  type="button"
                  onClick={() => void speak(b.title, language)}
                  aria-label={`Đọc ${b.title}`}
                  style={{ font: "inherit", color: "inherit" }}
                >
                  {b.title}
                </button>
                {(b.reading || b.hanViet) && (
                  <span style={{ color: muted, fontStyle: "italic", fontWeight: 400, fontSize }}>
                    {" "}
                    {[b.reading, b.hanViet].filter(Boolean).join(" · ")}
                  </span>
                )}
                {hideMeaning && !revealed.has(b.id) ? (
                  <button
                    type="button"
                    onClick={() => setRevealed((s) => new Set(s).add(b.id))}
                    aria-label={`Hiện nghĩa của ${b.title}`}
                    style={{ color: muted, fontWeight: 400, fontSize }}
                  >
                    {" "}
                    — • • •
                  </button>
                ) : (
                  <span style={{ fontWeight: 400, fontSize }}> — {b.subtitle}</span>
                )}
              </h2>

              {b.words.length === 0 ? (
                <p style={{ color: muted, fontStyle: "italic", paddingLeft: fontSize * 1.5 }}>
                  (chưa có từ)
                </p>
              ) : (
                <ul style={{ paddingLeft: fontSize * 1.5 }}>
                  {b.words.map((w) => (
                    <li key={w.id} className="paper-entry">
                      <span className="font-bold">
                        <button
                          type="button"
                          onClick={() => void speak(w.headword, language)}
                          aria-label={`Đọc ${w.headword}`}
                          style={{ font: "inherit", color: "inherit" }}
                        >
                          {w.headword}
                        </button>
                      </span>
                      {w.reading && (
                        <span style={{ color: muted, fontStyle: "italic" }}> /{w.reading}/</span>
                      )}
                      {w.hanViet && w.hanViet !== w.reading && (
                        <span style={{ color: muted }}> ({w.hanViet})</span>
                      )}
                      {w.wordClass && (
                        <span style={{ color: muted, fontStyle: "italic" }}> {w.wordClass}.</span>
                      )}
                      {levelRank(language, w.level) >= 0 && (
                        <span style={{ color: accent, fontWeight: 700 }}> [{w.level}]</span>
                      )}
                      {hideMeaning && !revealed.has(w.id) ? (
                        <button
                          type="button"
                          onClick={() => setRevealed((s) => new Set(s).add(w.id))}
                          aria-label={`Hiện nghĩa của ${w.headword}`}
                          style={{ color: muted }}
                        >
                          {" "}
                          — • • •
                        </button>
                      ) : (
                        <span> — {w.meaningVn}</span>
                      )}
                      {w.example && (
                        <span style={{ color: muted, fontStyle: "italic" }}> ▸ {w.example}</span>
                      )}
                      {/* Mẹo nhớ nằm trên DÒNG RIÊNG, thụt vào: để nối tiếp sau nghĩa thì dòng đầu
                          của mỗi mục bị đẩy dài ra 2–3 dòng và mất hẳn khả năng quét mắt theo cột
                          chữ đậm. Giấu đi khi đang che nghĩa, vì mẹo thường nói thẳng nghĩa ra. */}
                      {w.mnemonicVn && (!hideMeaning || revealed.has(w.id)) && (
                        <span style={{ display: "block", paddingLeft: fontSize, color: accent }}>
                          💡 {w.mnemonicVn}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <footer
            className="text-center"
            style={{ color: muted, fontStyle: "italic", borderTop: `1px solid ${muted}`, paddingTop: 4 }}
          >
            {branches.length} nhánh · {totalWords} từ
          </footer>
        </div>
      </article>
    </div>
  );
}
