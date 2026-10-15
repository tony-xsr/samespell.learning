"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { speak } from "@/lib/tts";
import { isDue } from "@/lib/srs";
import type { WordProgress } from "@/types/vocab";
import { connectorProgressId, type ConnectorConfusion, type ConnectorLanguage } from "@/types/connector";
import ConnectorCard from "@/components/connectors/ConnectorCard";
import { chipClass, Highlighted, shuffle, SpeakButton, speakable, type FlatEntry } from "@/components/connectors/shared";

type Mode = "cloze" | "meaning" | "flash";
type Level = "easy" | "hard";

const ROUND = 10;
const BLANK = "＿＿＿";

interface Question {
  entry: FlatEntry;
  /** Đề: câu có chỗ trống (cloze) / chữ từ nối / nghĩa tiếng Việt. */
  prompt: string;
  sub?: string;
  options: string[];
  correct: string;
  exampleIndex: number;
  kind: "cloze" | "form-to-meaning" | "meaning-to-form";
}

function rateSrs(entryId: string, rating: 0 | 1 | 2 | 3) {
  fetch("/api/progress/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId: connectorProgressId(entryId), rating }),
  }).catch(() => {});
}

function pickDistinct(candidates: FlatEntry[], exclude: Set<string>, n: number, key: (e: FlatEntry) => string): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const c of candidates) {
    const k = key(c);
    if (exclude.has(k)) continue;
    exclude.add(k);
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

function buildQuestion(
  entry: FlatEntry,
  mode: Exclude<Mode, "flash">,
  level: Level,
  sameLang: FlatEntry[],
  confusionsOf: (id: string) => string[],
  byId: Map<string, FlatEntry>,
): Question {
  if (mode === "cloze") {
    const exampleIndex = Math.floor(Math.random() * entry.examples.length);
    const ex = entry.examples[exampleIndex];
    const confusable = confusionsOf(entry.id)
      .map((id) => byId.get(id))
      .filter((e): e is FlatEntry => !!e && e.id !== entry.id);
    const sameCat = shuffle(sameLang.filter((e) => e.categoryId === entry.categoryId && e.id !== entry.id));
    const others = shuffle(sameLang.filter((e) => e.categoryId !== entry.categoryId));
    // Khó: ưu tiên đúng cụm dễ nhầm rồi cùng chức năng; Dễ: lấy từ chức năng khác hẳn
    const ordered = level === "hard" ? [...shuffle(confusable), ...sameCat, ...others] : [...others, ...sameCat];
    const distractors = pickDistinct(ordered, new Set([entry.form]), 3, (e) => e.form);
    return {
      entry,
      prompt: ex.sentence.replace(ex.answer, BLANK),
      // Bản dịch luôn hiện: thiếu nó, nhiều câu hợp với vài từ nối cùng lúc; độ khó nằm ở đáp án nhiễu
      sub: ex.translationVn,
      options: shuffle([entry.form, ...distractors.map((d) => d.form)]),
      correct: entry.form,
      exampleIndex,
      kind: "cloze",
    };
  }
  // Chọn nghĩa: nhiễu lấy từ chức năng khác (nghĩa cùng nhóm quá sát, dễ thành 2 đáp án đúng)
  const others = shuffle(sameLang.filter((e) => e.categoryId !== entry.categoryId));
  if (Math.random() < 0.5) {
    const distractors = pickDistinct(others, new Set([entry.meaningVn]), 3, (e) => e.meaningVn);
    return {
      entry,
      prompt: entry.form,
      sub: entry.reading,
      options: shuffle([entry.meaningVn, ...distractors.map((d) => d.meaningVn)]),
      correct: entry.meaningVn,
      exampleIndex: 0,
      kind: "form-to-meaning",
    };
  }
  const distractors = pickDistinct(others, new Set([entry.form]), 3, (e) => e.form);
  return {
    entry,
    prompt: entry.meaningVn,
    options: shuffle([entry.form, ...distractors.map((d) => d.form)]),
    correct: entry.form,
    exampleIndex: 0,
    kind: "meaning-to-form",
  };
}

export default function ConnectorPractice({
  pool,
  confusions,
  byId,
}: {
  pool: FlatEntry[];
  confusions: (ConnectorConfusion & { language: ConnectorLanguage })[];
  byId: Map<string, FlatEntry>;
}) {
  const [mode, setMode] = useState<Mode>("cloze");
  const [level, setLevel] = useState<Level>("easy");
  const [progress, setProgress] = useState<Record<string, WordProgress> | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d) => setProgress(d.progress ?? {}))
      .catch(() => setProgress({}));
  }, []);

  const confusionsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cf of confusions) for (const id of cf.entryIds) map.set(id, [...(map.get(id) ?? []), ...cf.entryIds]);
    return (id: string) => map.get(id) ?? [];
  }, [confusions]);

  const allByLang = useMemo(() => {
    const all = [...byId.values()];
    return { zh: all.filter((e) => e.language === "zh"), ko: all.filter((e) => e.language === "ko") };
  }, [byId]);

  const stats = useMemo(() => {
    if (!progress) return null;
    let seen = 0;
    let due = 0;
    for (const e of pool) {
      const p = progress[connectorProgressId(e.id)];
      if (p) {
        seen++;
        if (isDue(p)) due++;
      }
    }
    return { seen, due, fresh: pool.length - seen };
  }, [pool, progress]);

  /** Ưu tiên: đến hạn → chưa học → còn lại; trong mỗi nhóm trộn ngẫu nhiên. */
  const prioritized = useCallback(() => {
    const due: FlatEntry[] = [];
    const fresh: FlatEntry[] = [];
    const rest: FlatEntry[] = [];
    for (const e of pool) {
      const p = progress?.[connectorProgressId(e.id)];
      if (!p) fresh.push(e);
      else if (isDue(p)) due.push(e);
      else rest.push(e);
    }
    return [...shuffle(due), ...shuffle(fresh), ...shuffle(rest)];
  }, [pool, progress]);

  if (pool.length < 4) return <p className="mt-6 text-center text-sm text-ink-muted">Nhóm này quá ít từ để luyện — chọn “Tất cả”.</p>;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["cloze", "✏️ Điền từ nối"],
            ["meaning", "🎯 Chọn nghĩa"],
            ["flash", "🃏 Thẻ nhớ (SRS)"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} className={chipClass(mode === m)}>
            {label}
          </button>
        ))}
        {mode === "cloze" && (
          <span className="ml-auto flex gap-1">
            <button onClick={() => setLevel("easy")} className={chipClass(level === "easy")}>
              Dễ
            </button>
            <button onClick={() => setLevel("hard")} className={chipClass(level === "hard")} title="Đáp án nhiễu lấy từ cụm dễ nhầm / cùng chức năng">
              Khó 🔥
            </button>
          </span>
        )}
      </div>
      {stats && (
        <p className="mt-2 text-xs text-ink-muted">
          {pool.length} từ nối · đã học {stats.seen} · đến hạn ôn {stats.due} · chưa học {stats.fresh}
          {mode === "cloze" && level === "hard" && " · Khó: đáp án nhiễu là các từ dễ nhầm, cùng chức năng"}
        </p>
      )}

      {!progress ? (
        <p className="mt-6 text-center text-sm text-ink-muted">Đang tải…</p>
      ) : mode === "flash" ? (
        <FlashDeck key="flash" deck={prioritized().slice(0, 20)} />
      ) : (
        <QuizRound
          key={`${mode}-${level}`}
          makeRound={() =>
            prioritized()
              .slice(0, ROUND)
              .map((e) => buildQuestion(e, mode, level, allByLang[e.language], confusionsOf, byId))
          }
        />
      )}
    </div>
  );
}

function QuizRound({ makeRound }: { makeRound: () => Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(() => makeRound());
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<Question[]>([]);

  const q = questions[index];
  const done = index >= questions.length;

  const choose = (opt: string) => {
    if (picked || !q) return;
    setPicked(opt);
    const ok = opt === q.correct;
    rateSrs(q.entry.id, ok ? 2 : 0);
    if (!ok) setWrong((w) => [...w, q]);
    // Đọc cả câu đã điền đúng / chữ từ nối để tai nhớ cùng mắt
    const ex = q.entry.examples[q.exampleIndex];
    speak(q.kind === "cloze" ? ex.sentence : speakable(q.entry.form), q.entry.language);
  };

  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (!q) return;
      if (!picked && ["1", "2", "3", "4"].includes(e.key)) choose(q.options[Number(e.key) - 1]);
      else if (picked && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (done) {
    const score = questions.length - wrong.length;
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-center">
        <div className="text-3xl">{score === questions.length ? "🎉" : score >= questions.length * 0.7 ? "👍" : "💪"}</div>
        <p className="mt-2 text-lg font-bold text-ink">
          {score}/{questions.length} đúng
        </p>
        {wrong.length > 0 && (
          <ul className="mt-3 space-y-1 text-left text-sm">
            {wrong.map((w) => (
              <li key={w.entry.id + w.exampleIndex} className="rounded-lg bg-surface px-3 py-2">
                <span className="font-bold text-ink">{w.entry.form}</span> <span className="text-ink-muted">— {w.entry.meaningVn}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <button
              onClick={() => {
                setQuestions(shuffle(wrong));
                setWrong([]);
                setIndex(0);
              }}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink"
            >
              🔁 Làm lại câu sai
            </button>
          )}
          <button
            onClick={() => {
              setQuestions(makeRound());
              setWrong([]);
              setIndex(0);
            }}
            className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white"
          >
            ▶️ Lượt mới
          </button>
        </div>
      </div>
    );
  }

  const ex = q.entry.examples[q.exampleIndex];
  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          Câu {index + 1}/{questions.length} · {q.entry.categoryIcon}
        </span>
        <span>{wrong.length > 0 ? `❌ ${wrong.length}` : ""}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>

      <div className="mt-4 min-h-[4.5rem]">
        {q.kind === "cloze" && <p className="text-xs font-semibold text-ink-muted">Điền từ nối phù hợp:</p>}
        {q.kind === "meaning-to-form" && <p className="text-xs font-semibold text-ink-muted">Từ nối nào mang nghĩa:</p>}
        {q.kind === "form-to-meaning" && <p className="text-xs font-semibold text-ink-muted">Nghĩa của:</p>}
        <div className="mt-1 flex items-start gap-2">
          <p className={`min-w-0 flex-1 font-semibold text-ink ${q.kind === "form-to-meaning" ? "text-3xl" : "text-lg"}`}>
            {picked && q.kind === "cloze" ? <Highlighted sentence={ex.sentence} answer={ex.answer} /> : q.prompt}
          </p>
          {q.kind === "form-to-meaning" && <SpeakButton text={speakable(q.entry.form)} language={q.entry.language} />}
        </div>
        {q.sub && <p className="mt-1 text-sm text-ink-muted">{q.sub}</p>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const state = !picked ? "idle" : opt === q.correct ? "right" : opt === picked ? "wrong" : "dim";
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={!!picked}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                state === "right"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : state === "wrong"
                    ? "border-red-400 bg-red-500/10 text-red-700 dark:text-red-300"
                    : state === "dim"
                      ? "border-border text-ink-muted opacity-60"
                      : "border-border text-ink hover:border-brand-400"
              }`}
            >
              <span className="hidden text-xs text-ink-muted sm:inline">{i + 1}</span>
              <span className="min-w-0 flex-1">{opt}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4 space-y-2">
          <p className={`text-sm font-bold ${picked === q.correct ? "text-emerald-600" : "text-red-600"}`}>
            {picked === q.correct ? "✅ Chính xác!" : `❌ Đáp án: ${q.correct}`}
          </p>
          <ConnectorCard entry={q.entry} open onToggle={() => {}} />
          <button
            onClick={next}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}

const RATINGS = [
  { rating: 0, label: "😕 Quên", key: "1", className: "border-red-400 text-red-600 dark:text-red-400" },
  { rating: 2, label: "🙂 Nhớ", key: "2", className: "border-emerald-500 text-emerald-700 dark:text-emerald-400" },
  { rating: 3, label: "😎 Dễ", key: "3", className: "border-sky-500 text-sky-700 dark:text-sky-400" },
] as const;

/** Thẻ nhớ: mặt trước chữ + cách đọc (+ nghe), gợi ý = câu ví dụ có chỗ trống; lật ra đủ nghĩa, sắc thái,
 * ví dụ, mẹo nhớ → tự chấm, ghi vào SRS (id `conn:<id>`). */
function FlashDeck({ deck: initial }: { deck: FlatEntry[] }) {
  const [deck, setDeck] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [forgotten, setForgotten] = useState<FlatEntry[]>([]);

  const card = deck[index];

  useEffect(() => {
    if (card) speak(speakable(card.form), card.language);
  }, [card]);

  const rate = useCallback(
    (rating: 0 | 2 | 3) => {
      if (!card) return;
      rateSrs(card.id, rating);
      if (rating === 0) setForgotten((f) => [...f, card]);
      setFlipped(false);
      setHint(false);
      setIndex((i) => i + 1);
    },
    [card],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (!card) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) rate(r.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, rate]);

  if (!card) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-center">
        <p className="text-lg font-bold text-ink">🎉 Xong {deck.length} thẻ</p>
        <p className="mt-1 text-sm text-ink-muted">Điểm đã ghi vào ôn tập — từ nối hay quên sẽ quay lại sớm hơn.</p>
        {forgotten.length > 0 && (
          <button
            onClick={() => {
              setDeck(shuffle(forgotten));
              setForgotten([]);
              setIndex(0);
            }}
            className="mt-3 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white"
          >
            🔁 Ôn lại {forgotten.length} thẻ quên
          </button>
        )}
      </div>
    );
  }

  const ex = card.examples[0];
  return (
    <div className="mt-4">
      <p className="text-xs text-ink-muted">
        Thẻ {index + 1}/{deck.length} · Space lật thẻ · 1/2/3 chấm điểm
      </p>
      {!flipped ? (
        <button
          onClick={() => setFlipped(true)}
          className="mt-2 flex min-h-[14rem] w-full flex-col items-center justify-center rounded-2xl border border-border bg-surface p-5 text-center"
        >
          <span className="text-xs text-ink-muted">{card.categoryIcon}</span>
          <span className="mt-1 text-3xl font-bold text-ink">{card.form}</span>
          <span className="mt-1 text-sm text-ink-muted">{card.reading}</span>
          {hint && (
            <span className="mt-4 text-base text-ink">
              <Highlighted sentence={ex.sentence} answer={ex.answer} />
              <span className="mt-1 block text-xs text-ink-muted">(nghĩa câu ẩn — đoán nghĩa từ nối)</span>
              {card.hanViet && <span className="mt-1 block text-xs font-semibold uppercase text-accent-600">{card.hanViet}</span>}
            </span>
          )}
          <span className="mt-4 text-xs text-ink-muted">Bấm để lật</span>
        </button>
      ) : (
        <div className="mt-2">
          <ConnectorCard entry={card} open onToggle={() => setFlipped(false)} />
        </div>
      )}
      {!flipped && !hint && (
        <button onClick={() => setHint(true)} className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-ink-muted">
          💡 Gợi ý (câu ví dụ + Hán Việt)
        </button>
      )}
      {flipped && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {RATINGS.map((r) => (
            <button key={r.rating} onClick={() => rate(r.rating)} className={`rounded-xl border-2 bg-surface px-2 py-2.5 text-sm font-semibold ${r.className}`}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
