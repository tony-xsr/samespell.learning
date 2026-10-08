"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language, SoundGroup } from "@/types/vocab";
import type { TopicGroup } from "@/types/topic";
import { flattenWords } from "@/lib/wordTree";
import { speak } from "@/lib/tts";

export interface MatchItem {
  id: string;
  headword: string;
  reading?: string;
  meaningVn: string;
  /** Hai trường dưới đây trò chơi KHÔNG dùng — chúng có mặt để chế độ "Danh sách" dùng chung đúng
   * bộ trích dữ liệu này thay vì viết lại một bộ thứ hai dễ lệch nhau. */
  hanViet?: string;
  example?: string;
  /** Chữ gốc / tên nhánh (true) hay từ ghép (false) — danh sách cần phân cấp, trò chơi thì không. */
  isRoot?: boolean;
  /** Do chính người học thêm vào (xem `ContentSource`). */
  userAdded?: boolean;
  /** Loại từ + nhãn trình độ — chỉ Danh sách dùng, trò chơi bỏ qua. */
  wordClass?: string;
  level?: string;
  /** Mẹo nhớ soạn sẵn. Trước đây chỉ hiện trong popup "i" của từng thẻ, tức gần như vô hình; các màn
   * Danh sách / Tập trung / Trang giấy đều hiện nó để công sức soạn mẹo thực sự đến được người học. */
  mnemonicVn?: string;
}

/** Gom cả CHỮ GỐC lẫn TỪ của 1 mindmap thành danh sách để ghép — chữ gốc cũng là một ô phải nhớ
 * nghĩa, không riêng gì từ ghép. */
export function matchItemsFromGroup(group: SoundGroup): MatchItem[] {
  const items: MatchItem[] = [];
  for (const root of group.roots) {
    items.push({
      id: root.id,
      headword: root.character,
      reading: root.reading ?? root.hanViet,
      meaningVn: root.meaningVn,
      hanViet: root.hanViet,
      isRoot: true,
      userAdded: root.source === "user",
    });
    for (const w of flattenWords(root.words)) {
      items.push({
        id: w.id,
        headword: w.headword,
        reading: w.reading,
        meaningVn: w.meaningVn,
        hanViet: w.hanViet,
        example: w.example,
        userAdded: w.source === "user",
        wordClass: w.wordClass,
        level: w.level,
        mnemonicVn: w.mnemonicVn,
      });
    }
  }
  return items;
}

/** Mindmap chủ đề: tên nhánh cũng là một ô phải nhớ nghĩa, giống chữ gốc ở mindmap âm/hình. */
export function matchItemsFromTopic(topic: TopicGroup): MatchItem[] {
  const items: MatchItem[] = [];
  for (const br of topic.branches) {
    items.push({ id: br.id, headword: br.titleNative, meaningVn: br.titleVn, isRoot: true });
    for (const w of flattenWords(br.words)) {
      items.push({
        id: w.id,
        headword: w.headword,
        reading: w.reading,
        meaningVn: w.meaningVn,
        hanViet: w.hanViet,
        example: w.example,
        wordClass: w.wordClass,
        level: w.level,
        mnemonicVn: w.mnemonicVn,
      });
    }
  }
  return items;
}

const ROUND_SIZE = 8;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** So khớp theo NỘI DUNG nghĩa, không theo id: một mindmap có thể có hai mục mang nghĩa tiếng Việt
 * trùng nhau (vd chữ gốc và một từ ghép cùng dịch là "mãn tính") — thả vào ô nào cũng phải tính đúng,
 * nếu không người học bị báo sai dù đọc hiểu hoàn toàn chính xác. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

export default function MeaningMatchGame({
  items,
  language,
  onClose,
}: {
  items: MatchItem[];
  language: Language;
  onClose: () => void;
}) {
  const [seed, setSeed] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => shuffle(items).slice(0, ROUND_SIZE), [items, seed]);
  const pool = useMemo(() => shuffle(round), [round]);

  /** targetId -> id của chip đã ghép đúng vào ô đó. */
  const [solved, setSolved] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [showReading, setShowReading] = useState(true);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const usedChipIds = useMemo(() => new Set(Object.values(solved)), [solved]);
  const doneCount = Object.keys(solved).length;
  const finished = doneCount === round.length && round.length > 0;

  function tryPlace(chipId: string, targetId: string) {
    if (solved[targetId]) return;
    if (usedChipIds.has(chipId)) return;
    const chip = round.find((i) => i.id === chipId);
    const target = round.find((i) => i.id === targetId);
    if (!chip || !target) return;

    if (norm(chip.meaningVn) === norm(target.meaningVn)) {
      setSolved((s) => ({ ...s, [targetId]: chipId }));
      setSelected(null);
      void speak(target.headword, language);
    } else {
      setSelected(null);
      setMisses((m) => m + 1);
      setWrongId(targetId);
      window.setTimeout(() => setWrongId((w) => (w === targetId ? null : w)), 600);
    }
  }

  function replay() {
    setSolved({});
    setSelected(null);
    setWrongId(null);
    setMisses(0);
    setSeed((s) => s + 1);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ghép nghĩa"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">🎮 Ghép nghĩa — bạn nhớ được bao nhiêu?</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Kéo một nghĩa tiếng Việt thả vào đúng từ — hoặc chạm vào nghĩa rồi chạm vào từ.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-sm text-ink-muted hover:bg-surface-3"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={showReading}
              onChange={(e) => setShowReading(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            phiên âm
          </label>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {doneCount}/{round.length}
          </span>
          {misses > 0 && (
            <span className="text-xs text-ink-muted">
              sai <span className="font-semibold text-rose-500">{misses}</span>
            </span>
          )}
          <button
            onClick={replay}
            className="ml-auto rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-ink hover:bg-surface-3"
          >
            🔄 Chơi lại
          </button>
        </div>

        {finished && (
          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            🎉 Xong! Ghép đúng cả {round.length} ô{misses === 0 ? " và không sai lần nào." : `, sai ${misses} lần.`}
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_minmax(0,16rem)]">
          {/* Ô đích: từ cần nhớ nghĩa */}
          <div className="flex flex-col gap-2">
            {round.map((t) => {
              const placedChipId = solved[t.id];
              const placed = placedChipId ? round.find((i) => i.id === placedChipId) : undefined;
              const isWrong = wrongId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Ô ghép nghĩa cho ${t.headword}`}
                  onClick={() => selected && tryPlace(selected, t.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const chipId = e.dataTransfer.getData("text/plain");
                    if (chipId) tryPlace(chipId, t.id);
                  }}
                  className={`rounded-xl border-2 px-3 py-2 text-left transition ${
                    placed
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                      : isWrong
                        ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                        : "border-dashed border-border-strong bg-surface-2 hover:border-brand-300"
                  }`}
                >
                  <span className="font-semibold text-ink">{t.headword}</span>
                  {showReading && t.reading && (
                    <span className="ml-1.5 text-xs text-ink-muted italic">{t.reading}</span>
                  )}
                  <span className="mt-0.5 block text-xs">
                    {placed ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        ✓ {placed.meaningVn}
                      </span>
                    ) : (
                      <span className="text-ink-muted italic">thả nghĩa vào đây</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kho nghĩa chưa dùng. Trên điện thoại phải nằm TRÊN và dính theo khi cuộn: 8 ô đích cao
              hơn một màn hình, nếu để kho nghĩa dưới đáy thì mỗi lần ghép phải cuộn xuống chọn nghĩa
              rồi cuộn ngược lên chạm ô. Từ sm trở lên quay về cột phải như cũ. */}
          <div className="sticky top-0 z-10 -mx-1 order-first flex flex-wrap content-start gap-2 bg-surface px-1 py-2 sm:static sm:order-none sm:mx-0 sm:px-0 sm:py-0">
            {pool.map((c) => {
              if (usedChipIds.has(c.id)) return null;
              const isSelected = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  draggable
                  aria-label={`Nghĩa: ${c.meaningVn}`}
                  aria-pressed={isSelected}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", c.id);
                    setSelected(c.id);
                  }}
                  onClick={() => setSelected((s) => (s === c.id ? null : c.id))}
                  className={`cursor-grab rounded-full border px-3 py-1.5 text-xs font-medium transition active:cursor-grabbing ${
                    isSelected
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-amber-300 bg-amber-50 text-ink hover:border-brand-300 dark:bg-amber-950/30"
                  }`}
                >
                  {c.meaningVn}
                </button>
              );
            })}
            {round.length > 0 && usedChipIds.size === round.length && (
              <p className="text-xs text-ink-muted">Hết nghĩa để ghép.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
