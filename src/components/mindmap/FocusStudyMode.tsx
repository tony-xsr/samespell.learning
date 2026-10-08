"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { StudyBranch } from "@/lib/studyBranches";
import { levelClass, levelRank } from "@/lib/levels";
import type { BgOption } from "@/lib/mindmapSettings";
import { localeForLanguage, speak, speakAndWait } from "@/lib/tts";

/** CHẾ ĐỘ TẬP TRUNG — học mindmap theo TỪNG NHÁNH MỘT.
 *
 * Mindmap đầy đủ rất tốt để thấy quan hệ, nhưng lúc ngồi học thật thì 14 nhánh cùng hiện trên một
 * canvas lại là 14 thứ gây phân tán: mắt nhảy, tay kéo zoom, không biết đã xem tới đâu. Chế độ này
 * phủ kín màn hình, bỏ hết thanh công cụ/nút phụ, mỗi lần chỉ hiện 1 nhánh + các từ của nhánh đó, có
 * thanh tiến độ để biết còn bao nhiêu nhánh nữa.
 *
 * Không dùng `useFullscreen`: bản thân overlay này đã `fixed inset-0` phủ toàn viewport nên không cần
 * Fullscreen API (thứ mà iOS Safari không hỗ trợ cho phần tử thường).
 */
export default function FocusStudyMode({
  branches,
  language,
  title,
  bg,
  masteredIds,
  onToggleMastered,
  favoriteIds,
  onToggleFavorite,
  onClose,
}: {
  branches: StudyBranch[];
  language: Language;
  title: string;
  /** Nền đang chọn trong ⚙ Tuỳ chỉnh — giữ nguyên cảm giác giấy/tối mà người học đã chọn ở canvas. */
  bg: BgOption;
  masteredIds: Set<string>;
  onToggleMastered: (wordId: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (wordId: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [hideMeaning, setHideMeaning] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const [playing, setPlaying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const playTokenRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = branches.length;
  const branch = branches[Math.min(index, total - 1)];

  const stopPlay = useCallback(() => {
    playTokenRef.current += 1;
    setPlaying(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // trình duyệt không có Web Speech API — không có gì phải dừng
    }
  }, []);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      stopPlay();
      setIndex(clamped);
      setVisited((prev) => new Set(prev).add(clamped));
      // Nhánh mới phải bắt đầu đọc từ đầu trang, không giữ vị trí cuộn của nhánh cũ.
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [total, stopPlay],
  );

  /** Đọc lần lượt tiêu đề nhánh rồi từng từ, chờ đọc xong mới sang từ sau (`speakAndWait`) để tiếng
   * không chồng lên nhau. Mỗi lần bấm phát sinh một "token": nếu người học đổi nhánh hay bấm dừng
   * giữa lúc đang đọc, token cũ khác token hiện tại nên vòng lặp tự thoát. */
  async function playBranch() {
    if (playing) {
      stopPlay();
      return;
    }
    const token = ++playTokenRef.current;
    setPlaying(true);
    const locale = localeForLanguage(language);
    const queue = [branch.title, ...branch.words.map((w) => w.headword)];
    for (const text of queue) {
      if (playTokenRef.current !== token) return;
      await speakAndWait(text, locale);
    }
    if (playTokenRef.current === token) setPlaying(false);
  }

  useEffect(() => stopPlay, [stopPlay]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        if (showHelp) setShowHelp(false);
        else onClose();
      } else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") go(index + 1);
      else if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") go(index - 1);
      else if (e.key === "m" || e.key === "M") {
        setHideMeaning((h) => !h);
        setRevealed(new Set());
      } else if (e.key === "?") setShowHelp((s) => !s);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, onClose, showHelp]);

  // Quẹt ngang để đổi nhánh trên điện thoại. Chỉ tính là quẹt khi đi ngang rõ rệt và không đi dọc
  // nhiều — nếu không thì mỗi lần cuộn danh sách từ cũng bị nhận thành đổi nhánh.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    const t = e.changedTouches[0];
    touchRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 50) return;
    go(dx < 0 ? index + 1 : index - 1);
  }

  const doneCount = visited.size;
  const masteredInBranch = useMemo(
    () => branch.words.filter((w) => masteredIds.has(w.id)).length,
    [branch, masteredIds],
  );

  if (!branch) return null;

  // Nền giấy người học chọn CHỈ tô khoảng trống quanh các thẻ; mọi thứ có chữ (thẻ nhánh, thẻ từ,
  // chân trang) vẫn dùng token theo theme và nền ĐỤC.
  //
  // Đã thử cách ngược lại — tô thẻ theo màu giấy — và nó hỏng: các nhãn bên trong như chip trình độ
  // (`levelClass`) tự đảo màu theo theme, nên trên một tấm thẻ trắng cố định ở theme tối, chữ "HSK5"
  // sáng nằm trên nền sáng, tương phản chỉ còn 1.25. Nền thẻ đục cũng chặn luôn chuyện giấy sáng lọt
  // qua thẻ bán trong suốt làm chữ nhoè.
  const inkStrong = "text-ink";
  const inkSoft = "text-ink-muted";
  const cardSkin = "border-border bg-surface-2";
  const headCard = "border-brand-300 bg-brand-50";
  const titleText = "text-brand-700";
  const meaningText = "text-accent-600";
  const hiddenChip = "bg-surface-3 text-ink-muted";
  const trackDone = "bg-brand-300";
  const trackIdle = "bg-surface-3";
  const edge = "border-border";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chế độ tập trung"
      style={bg.style}
      className={`fixed inset-0 z-50 flex h-[100dvh] flex-col ${bg.style.backgroundColor ? "" : "bg-surface"}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Đầu trang: chỉ còn tên mindmap + vị trí nhánh + lối ra. Mọi thứ khác đã được bỏ đi, đó là
          toàn bộ mục đích của chế độ này.
          Thanh này (và chân trang) có NỀN RIÊNG `bg-surface` chứ không để trong suốt trên nền giấy:
          đây là chỗ duy nhất chữ nằm trực tiếp trên giấy, mà màu chữ thì theo theme còn giấy thì
          không — theme tối + giấy sáng cho ra tương phản 2.1, không đọc nổi. */}
      <div className="shrink-0 border-b border-border bg-surface">
      <header className="flex items-center gap-3 px-3 pt-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-semibold uppercase tracking-wider ${inkSoft}`}>
            🎯 Tập trung · {title}
          </p>
          <p className={`mt-0.5 text-xs ${inkSoft}`}>
            Nhánh {index + 1}/{total} · đã xem {doneCount}/{total}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((s) => !s)}
          aria-label="Phím tắt"
          aria-expanded={showHelp}
          className={`hidden h-9 w-9 items-center justify-center rounded-full border text-sm sm:flex ${cardSkin} ${inkStrong}`}
        >
          ?
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Thoát chế độ tập trung"
          className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold ${cardSkin} ${inkStrong}`}
        >
          ✕ Thoát
        </button>
      </header>

      {/* Thanh tiến độ: mỗi nhánh một vạch, vạch đã xem đậm hơn — bấm được để nhảy thẳng tới nhánh đó,
          nhanh hơn bấm "Sau ›" nhiều lần. Dưới 40 nhánh thì vẫn còn đủ rộng để chạm. */}
      <div className="mt-2 flex gap-0.5 px-3 pb-2 sm:px-5" role="tablist" aria-label="Chọn nhánh">
        {branches.map((b, i) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Nhánh ${i + 1}: ${b.title}`}
            title={`${b.title} — ${b.subtitle}`}
            onClick={() => go(i)}
            className={`h-1.5 flex-1 rounded-full transition ${
              i === index ? "bg-brand-500" : visited.has(i) ? trackDone : trackIdle
            }`}
          />
        ))}
      </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto max-w-3xl">
          {/* Thẻ nhánh */}
          <div className={`rounded-3xl border-2 px-5 py-6 text-center shadow-sm ${headCard}`}>
            <button
              type="button"
              onClick={() => void speak(branch.title, language)}
              aria-label={`Đọc ${branch.title}`}
              className={`text-4xl font-bold leading-tight sm:text-5xl ${inkStrong}`}
            >
              {branch.title}
            </button>
            {(branch.reading || branch.hanViet) && (
              <p className={`mt-1 text-sm italic ${inkSoft}`}>
                {[branch.reading, branch.hanViet].filter(Boolean).join(" · ")}
              </p>
            )}
            {hideMeaning && !revealed.has(branch.id) ? (
              <button
                type="button"
                onClick={() => setRevealed((s) => new Set(s).add(branch.id))}
                aria-label={`Hiện nghĩa của ${branch.title}`}
                className={`mx-auto mt-2 block rounded-full px-4 py-1 text-base font-medium ${hiddenChip}`}
              >
                • • •
              </button>
            ) : (
              <p className={`mt-1.5 text-lg font-semibold ${titleText}`}>{branch.subtitle}</p>
            )}
            <p className={`mt-2 text-xs ${inkSoft}`}>
              {branch.words.length} từ · đã thuộc {masteredInBranch}/{branch.words.length}
            </p>
          </div>

          {/* Các từ của nhánh */}
          {branch.words.length === 0 ? (
            <p className={`mt-6 text-center text-sm ${inkSoft}`}>Nhánh này chưa có từ nào.</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {branch.words.map((w) => {
                const isMastered = masteredIds.has(w.id);
                const isFav = favoriteIds.has(w.id);
                return (
                  <li
                    key={w.id}
                    className={`rounded-2xl border px-4 py-3 ${cardSkin} ${isMastered ? "opacity-60 ring-1 ring-emerald-400" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void speak(w.headword, language)}
                        aria-label={`Đọc ${w.headword}`}
                        className={`text-left text-2xl font-bold leading-snug ${inkStrong}`}
                      >
                        {w.headword}
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(w.id)}
                          aria-label={isFav ? `Bỏ yêu thích ${w.headword}` : `Yêu thích ${w.headword}`}
                          aria-pressed={isFav}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                            isFav ? "border-amber-400 bg-amber-100 text-amber-600" : `${cardSkin} ${inkSoft}`
                          }`}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleMastered(w.id)}
                          aria-label={isMastered ? `Bỏ đánh dấu đã thuộc ${w.headword}` : `Đã thuộc ${w.headword}`}
                          aria-pressed={isMastered}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${
                            isMastered
                              ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                              : `${cardSkin} ${inkSoft}`
                          }`}
                        >
                          ✓
                        </button>
                      </div>
                    </div>

                    <div className={`mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs ${inkSoft}`}>
                      {w.reading && <span className="italic">{w.reading}</span>}
                      {w.hanViet && w.hanViet !== w.reading && <span>({w.hanViet})</span>}
                      {w.wordClass && <span className="italic">{w.wordClass}</span>}
                      {levelRank(language, w.level) >= 0 && (
                        <span className={`rounded-full px-1.5 font-bold ${levelClass(language, w.level)}`}>
                          {w.level}
                        </span>
                      )}
                      {w.userAdded && <span className="text-violet-500">✚ tự thêm</span>}
                    </div>

                    {hideMeaning && !revealed.has(w.id) ? (
                      <button
                        type="button"
                        onClick={() => setRevealed((s) => new Set(s).add(w.id))}
                        aria-label={`Hiện nghĩa của ${w.headword}`}
                        className={`mt-1.5 rounded-full px-4 py-1 text-sm font-medium ${hiddenChip}`}
                      >
                        • • •
                      </button>
                    ) : (
                      <p className={`mt-1 text-base font-medium ${meaningText}`}>{w.meaningVn}</p>
                    )}

                    {/* Mẹo nhớ soạn sẵn — chỉ hiện khi đang KHÔNG che nghĩa, vì nhiều mẹo nói thẳng
                        nghĩa tiếng Việt ra thì che nghĩa ở trên thành vô nghĩa. */}
                    {w.mnemonicVn && (!hideMeaning || revealed.has(w.id)) && (
                      <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        💡 {w.mnemonicVn}
                      </p>
                    )}

                    {w.example && (
                      <p className={`mt-1.5 text-sm ${inkSoft}`}>
                        {w.example}{" "}
                        <button
                          type="button"
                          onClick={() => void speak(w.example!, language)}
                          aria-label={`Đọc ví dụ của ${w.headword}`}
                          className="align-middle"
                        >
                          🔊
                        </button>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chân trang điều khiển — để dưới cùng cho ngón tay với tới được trên điện thoại. */}
      <footer className={`shrink-0 border-t bg-surface px-3 py-2.5 sm:px-5 ${edge}`}>
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className={`flex h-11 items-center rounded-full border px-4 text-sm font-semibold disabled:opacity-40 ${cardSkin} ${inkStrong}`}
          >
            ‹ Trước
          </button>
          <button
            type="button"
            onClick={() => void playBranch()}
            aria-label={playing ? "Dừng đọc" : "Đọc cả nhánh"}
            className={`flex h-11 items-center gap-1 rounded-full border px-4 text-sm font-semibold ${
              playing ? "border-brand-500 bg-brand-600 text-white" : `${cardSkin} ${inkStrong}`
            }`}
          >
            {playing ? "⏹ Dừng" : "▶ Đọc"}
          </button>
          <button
            type="button"
            onClick={() => {
              setHideMeaning((h) => !h);
              setRevealed(new Set());
            }}
            aria-pressed={hideMeaning}
            className={`flex h-11 items-center rounded-full border px-4 text-sm font-semibold ${
              hideMeaning
                ? "border-amber-400 bg-amber-100 text-amber-800"
                : `${cardSkin} ${inkStrong}`
            }`}
          >
            {hideMeaning ? "👁" : "🙈"}
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === total - 1}
            className="ml-auto flex h-11 items-center rounded-full border border-brand-500 bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Sau ›
          </button>
        </div>
        <p className={`mx-auto mt-1.5 hidden max-w-3xl text-center text-[11px] sm:block ${inkSoft}`}>
          ← → (hoặc K J) đổi nhánh · M ẩn/hiện nghĩa · Esc thoát · trên điện thoại quẹt ngang để đổi nhánh
        </p>
      </footer>

      {showHelp && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 text-sm text-ink shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold">Phím tắt</h2>
            <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
              <li>
                <b className="text-ink">→ / J</b> — nhánh sau
              </li>
              <li>
                <b className="text-ink">← / K</b> — nhánh trước
              </li>
              <li>
                <b className="text-ink">M</b> — ẩn/hiện nghĩa tiếng Việt
              </li>
              <li>
                <b className="text-ink">?</b> — bảng phím tắt này
              </li>
              <li>
                <b className="text-ink">Esc</b> — thoát
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-3 w-full rounded-full border border-border bg-surface-2 py-2 text-xs font-semibold"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
