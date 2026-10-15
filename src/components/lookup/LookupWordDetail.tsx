"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { speak } from "@/lib/tts";
import type { LookupItem } from "@/components/lookup/types";

// Khung luyện viết + pinyin nặng (hanzi-writer, pinyin-pro) — chỉ tải khi người học thật sự mở
const HanziWordBoard = dynamic(() => import("@/components/writing/HanziWordBoard"), { ssr: false });

const AXIS_ICON: Record<string, string> = {
  sound: "🔊",
  shape: "✍️",
  "false-friend": "🪤",
  initial: "🔤",
  topic: "🧩",
  connector: "🔗",
};

/** Chi tiết 1 từ trong bảng Tra nhanh — gom mọi thứ giúp NHỚ từ: tách Hán Việt từng chữ, mẹo nhớ (thiếu
 * thì nhờ AI tạo), ví dụ, chữ cùng âm dễ nhầm, và nút đưa từ vào ôn tập / luyện viết. */
export default function LookupWordDetail({
  item,
  onChange,
  onNavigate,
  onOpenFamily,
}: {
  item: LookupItem;
  /** Báo cho danh sách khi từ đổi trạng thái (thêm vào ôn tập, có mẹo nhớ mới). */
  onChange: (next: LookupItem) => void;
  /** Bấm link sang trang khác → đóng bảng tra. */
  onNavigate: () => void;
  /** Bấm 1 chữ Hán → mở "họ chữ" của chữ đó (từ Trung + Hàn chứa chữ này). */
  onOpenFamily: (char: string) => void;
}) {
  const [examplePinyin, setExamplePinyin] = useState("");
  const [mnemonicBusy, setMnemonicBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWriting, setShowWriting] = useState(false);

  useEffect(() => {
    setShowWriting(false);
    setError(null);
    if (item.language !== "zh" || !item.example) {
      setExamplePinyin("");
      return;
    }
    let cancelled = false;
    import("@/lib/zhPinyin").then(({ toPinyin }) => {
      if (!cancelled) setExamplePinyin(toPinyin(item.example));
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.language, item.example]);

  async function makeMnemonic() {
    setMnemonicBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mnemonic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: item.language,
          wordId: item.id,
          headword: item.headword,
          reading: item.reading,
          meaningVn: item.meaningVn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI chưa tạo được mẹo nhớ.");
      onChange({ ...item, mnemonicVn: data.mnemonicVn });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setMnemonicBusy(false);
    }
  }

  async function toggleReview() {
    setReviewBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/progress/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được.");
      onChange({ ...item, bookmarked: !!data.progress?.bookmarked, inReview: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setReviewBusy(false);
    }
  }

  const hv = item.hanViet;
  // Âm tiết thuần Hàn (từ lai, vd 사거리) giữ nguyên Hangul trong dòng ghép: "TỨ 거 리"
  const hvJoined =
    hv && !hv.partial && hv.parts.every((p) => p.native || p.hv)
      ? hv.parts.map((p) => (p.native ? p.char : p.hv)).join(" ")
      : "";
  const canWrite = item.language === "zh" && /\p{Script=Han}/u.test(item.headword);
  const section = "mt-3 rounded-xl border border-border bg-surface px-3 py-2.5";
  const sectionTitle = "mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

  return (
    <div className="rounded-2xl border border-brand-600/30 bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl font-bold text-ink">{item.headword}</span>
            <button
              onClick={() => speak(item.headword, item.language)}
              aria-label="Nghe phát âm"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface"
            >
              🔊
            </button>
          </div>
          <div className="mt-0.5 text-sm text-ink-muted">
            {item.reading}
            {item.wordClass ? ` · ${item.wordClass}` : ""}
          </div>
        </div>
        {item.level && (
          <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">{item.level}</span>
        )}
      </div>
      <div className="mt-2 text-lg font-semibold text-brand-600">{item.meaningVn}</div>

      {hv && (
        <div className={section}>
          <div className={sectionTitle}>🧩 Hán Việt — nhớ qua âm quen thuộc</div>
          <div className="flex flex-wrap items-end gap-1.5">
            {hv.parts.map((p, i) =>
              p.native ? (
                <div key={i} className="flex min-w-12 flex-col items-center rounded-lg border border-dashed border-border px-2 py-1">
                  <span className="text-xs text-ink-muted">&nbsp;</span>
                  <span className="text-xl leading-tight text-ink">{p.char}</span>
                  <span className="text-[10px] text-ink-muted">thuần Hàn</span>
                </div>
              ) : (
              <button
                key={i}
                onClick={() => onOpenFamily(p.char)}
                title={`Xem mọi từ Trung / Hàn có chữ ${p.char}`}
                className="flex min-w-12 flex-col items-center rounded-lg bg-surface-3 px-2 py-1 ring-brand-600/50 transition hover:ring-2"
              >
                {p.syllable && <span className="text-xs text-ink-muted">{p.syllable}</span>}
                <span className="text-xl leading-tight text-ink">{p.char}</span>
                <span className="text-xs font-semibold text-brand-600">{p.hv ?? "—"}</span>
              </button>
              ),
            )}
            {hvJoined && (
              <div className="ml-1 text-sm font-bold uppercase tracking-wide text-ink">→ {hvJoined}</div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">Bấm 1 chữ để xem cả họ từ Trung · Hàn có chữ đó.</p>
          {hv.partial && (
            <p className="mt-1 text-[11px] text-ink-muted">
              Âm tiết <b>{hv.parts[0]?.syllable}</b> là chữ gốc {hv.parts[0]?.char} của nhóm. Bấm &ldquo;Nhờ AI tạo mẹo
              nhớ&rdquo; để có Hanja cả từ.
            </p>
          )}
        </div>
      )}

      <div className={section}>
        <div className={sectionTitle}>💡 Mẹo nhớ</div>
        {item.mnemonicVn ? (
          <p className="text-sm text-ink">{item.mnemonicVn}</p>
        ) : (
          <button
            onClick={makeMnemonic}
            disabled={mnemonicBusy}
            className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
          >
            {mnemonicBusy ? "AI đang nghĩ…" : "🧠 Nhờ AI tạo mẹo nhớ"}
          </button>
        )}
      </div>

      {item.example && (
        <div className={section}>
          <div className={sectionTitle}>📝 Ví dụ</div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm">
              <div className="text-ink">{item.example}</div>
              {examplePinyin && <div className="mt-0.5 text-xs italic text-ink-muted">{examplePinyin}</div>}
              <div className="mt-0.5 text-xs italic text-ink-muted">{item.exampleVn}</div>
            </div>
            <button
              onClick={() => speak(item.example, item.language)}
              aria-label="Đọc ví dụ"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-xs hover:bg-surface"
            >
              🔊
            </button>
          </div>
        </div>
      )}

      {item.siblings.length > 0 && (
        <div className={section}>
          <div className={sectionTitle}>⚠️ Dễ nhầm — cùng âm “{item.groupReading}”</div>
          <div className="flex flex-wrap gap-1.5">
            {item.rootChar && (
              <span
                role="button"
                tabIndex={0}
                onClick={() => /\p{Script=Han}/u.test(item.rootChar ?? "") && onOpenFamily(item.rootChar!)}
                className="cursor-pointer rounded-lg border border-brand-600/40 bg-brand-600/10 px-2 py-1 text-xs text-ink"
              >
                <b className="text-base">{item.rootChar}</b> {item.rootHanViet ? `(${item.rootHanViet}) ` : ""}
                {item.rootMeaning} <span className="text-brand-600">← từ này</span>
              </span>
            )}
            {item.siblings.map((s) => (
              <span
                key={s.character}
                role="button"
                tabIndex={0}
                onClick={() => /\p{Script=Han}/u.test(s.character) && onOpenFamily(s.character)}
                className="cursor-pointer rounded-lg bg-surface-3 px-2 py-1 text-xs text-ink-muted hover:text-ink"
              >
                <b className="text-base text-ink">{s.character}</b> {s.hanViet ? `(${s.hanViet}) ` : ""}
                {s.meaningVn}
              </span>
            ))}
          </div>
        </div>
      )}

      {item.appearances.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.appearances.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              onClick={onNavigate}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink-muted hover:text-brand-600"
            >
              {AXIS_ICON[a.axis]} {a.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={toggleReview}
          disabled={reviewBusy}
          className={`rounded-full px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-50 ${
            item.bookmarked
              ? "border border-emerald-500 text-emerald-700 dark:text-emerald-400"
              : "bg-gradient-to-r from-brand-600 to-accent-500 text-white"
          }`}
        >
          {item.bookmarked ? "★ Đã thêm vào ôn tập" : "☆ Thêm vào ôn tập"}
        </button>
        {canWrite && (
          <button
            onClick={() => setShowWriting((v) => !v)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-3"
          >
            {showWriting ? "✕ Đóng luyện viết" : "✍️ Luyện viết"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {showWriting && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <HanziWordBoard text={item.headword} maxSize={260} />
        </div>
      )}
    </div>
  );
}
