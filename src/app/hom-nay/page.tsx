import Link from "next/link";
import { loadPersonalCollections } from "@/lib/personalCollectionsStore";
import { groupKindBasePath } from "@/types/personal";
import {
  getLanguages,
  getShapeLanguages,
  getFalseFriendLanguages,
  getInitialLanguages,
} from "@/lib/vocabStore";
import { flattenWords } from "@/lib/wordTree";
import {
  computeStreak,
  localDayKey,
  pickDailySlots,
  type RitualCandidate,
} from "@/lib/dailyRitual";
import type { GroupKind, LanguageData } from "@/types/vocab";
import RitualRestDays from "@/components/RitualRestDays";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧", es: "🇪🇸" };
const KIND_LABEL: Record<GroupKind, string> = {
  sound: "Đồng âm",
  shape: "Hình chữ",
  "false-friend": "Bẫy nghĩa",
  initial: "Âm đầu",
};

const SLOT_STYLE: Record<string, string> = {
  comfort: "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/25",
  growth: "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/25",
  stretch: "border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/25",
};

function toCandidates(datasets: LanguageData[], groupKind: GroupKind): RitualCandidate[] {
  return datasets.flatMap((d) =>
    d.groups.map((g) => ({
      language: d.language,
      groupKind,
      groupId: g.id,
      reading: g.reading,
      chars: g.roots.map((r) => r.character),
      rootCount: g.roots.length,
      wordCount: g.roots.reduce((sum, r) => sum + flattenWords(r.words).length, 0),
    })),
  );
}

export default async function TodayPage() {
  const [collections, sound, shape, falseFriend, initial] = await Promise.all([
    loadPersonalCollections(),
    getLanguages(),
    getShapeLanguages(),
    getFalseFriendLanguages(),
    getInitialLanguages(),
  ]);

  const learned = collections.learned ?? [];
  const restDays = collections.ritual?.restDays ?? [];
  const learnedKeys = new Set(learned.map((l) => `${l.language}:${l.groupKind}:${l.groupId}`));

  const all: RitualCandidate[] = [
    ...toCandidates(sound, "sound"),
    ...toCandidates(shape, "shape"),
    ...toCandidates(falseFriend, "false-friend"),
    ...toCandidates(initial, "initial"),
  ];
  // Bỏ nhóm rỗng (không có từ thì chẳng học được gì) và nhóm đã đánh dấu học xong.
  const pool = all.filter(
    (c) => c.wordCount > 0 && !learnedKeys.has(`${c.language}:${c.groupKind}:${c.groupId}`),
  );

  const dayKey = localDayKey();
  const slots = pickDailySlots(pool, dayKey);
  const streak = computeStreak(
    learned.map((l) => l.learnedAt),
    restDays,
  );
  const totalMinutes = slots.reduce((s, x) => s + x.minutes, 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 p-6 text-white shadow-lg">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Nghi thức học hàng ngày
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">☕ Hôm nay học gì</h1>
            <p className="mt-2 text-sm text-white/90">
              {slots.length > 0 ? (
                <>
                  Ba mindmap cho bạn hôm nay — dễ thở, vừa sức, thử thách ·{" "}
                  <span className="font-semibold">~{totalMinutes} phút</span>
                </>
              ) : (
                "Bạn đã đánh dấu học xong toàn bộ kho mindmap. Không còn gì để gợi ý hôm nay."
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-2xl bg-white/15 px-4 py-2 text-center">
              <div className="text-xl font-bold">🔥 {streak.current}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Chuỗi ngày
              </div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-2 text-center">
              <div className="text-xl font-bold">{streak.longest}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Dài nhất
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_17rem]">
          <div className="flex flex-col gap-4">
            {slots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong bg-surface-2 px-5 py-10 text-center text-sm text-ink-muted">
                Không còn mindmap nào chưa học. Bỏ dấu “đã học xong” ở{" "}
                <Link href="/learned" className="font-semibold text-brand-600 hover:underline">
                  trang Đã học
                </Link>{" "}
                nếu bạn muốn ôn lại.
              </div>
            ) : (
              slots.map((slot) => {
                const c = slot.pick;
                const href = `${groupKindBasePath(c.groupKind)}/${c.language}/${c.groupId}`;
                return (
                  <section
                    key={slot.id}
                    className={`rounded-2xl border-2 px-5 py-4 shadow-sm ${SLOT_STYLE[slot.id] ?? ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{slot.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-ink">
                        {slot.label}
                      </span>
                      <span className="text-xs text-ink-muted">· {slot.minutes} phút</span>
                      <span className="ml-auto text-xs text-ink-muted">
                        {LANG_ICON[c.language] ?? "🌐"} {KIND_LABEL[c.groupKind]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs italic text-ink-muted">{slot.rationale}</p>

                    <h2 className="mt-2 text-xl font-bold text-ink">{c.reading}</h2>
                    <p className="mt-0.5 text-xs font-medium text-accent-600">
                      {c.rootCount} chữ · {c.wordCount} từ
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.chars.slice(0, 8).map((ch, i) => (
                        <span
                          key={`${ch}-${i}`}
                          className="rounded-lg bg-surface-3 px-2 py-0.5 text-sm text-ink"
                        >
                          {ch}
                        </span>
                      ))}
                      {c.rootCount > 8 && (
                        <span className="px-1 text-sm text-ink-muted">+{c.rootCount - 8}</span>
                      )}
                    </div>

                    <Link
                      href={href}
                      className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface transition hover:opacity-90"
                    >
                      Học ngay →
                    </Link>
                  </section>
                );
              })
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-4">
              <RitualRestDays initial={restDays} />
            </div>

            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Vì sao lại ba ô?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                <span className="font-semibold text-amber-600">Dễ thở</span> giữ cho việc học vẫn dễ
                chịu để bạn còn quay lại.{" "}
                <span className="font-semibold text-emerald-600">Vừa sức</span> là chỗ thật sự tiến bộ
                — khó hơn hiện tại đúng một bậc.{" "}
                <span className="font-semibold text-sky-600">Thử thách</span> giữ cho bạn còn tham vọng
                — nhiều khả năng bạn không học hết, và thế là ổn.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Cách tính chuỗi ngày
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Mỗi ngày bạn đánh dấu <span className="font-semibold text-ink">đã học xong</span> ít
                nhất một mindmap là chuỗi tăng thêm 1.{" "}
                {streak.doneToday ? (
                  <span className="font-semibold text-emerald-600">Hôm nay bạn làm được rồi 🎉</span>
                ) : (
                  <span className="font-semibold text-ink">Hôm nay thì chưa.</span>
                )}
              </p>
            </div>
          </aside>
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Bộ ba hôm nay cố định cho ngày {dayKey} — tải lại trang không đổi bài, sang ngày mới mới đổi.
          Chọn từ {pool.length} mindmap chưa học.
        </p>
      </div>
    </main>
  );
}
