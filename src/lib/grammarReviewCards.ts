import type { GrammarConfusionGroup, GrammarLanguageData, GrammarPoint } from "@/types/grammar";
import { getGrammarStories, resolveStory, type ResolvedGrammarStory } from "@/lib/grammarStories";

/** Thẻ ôn tập CHUẨN — lật để xem nghĩa/sắc thái/ví dụ/mẹo nhớ rồi tự chấm điểm, giống hệt cơ chế
 * thẻ từ vựng hiện có (`ReviewSession.tsx`). Bao phủ MỌI điểm ngữ pháp trong Trục A. */
export interface StandardGrammarCard {
  kind: "standard";
  id: string;
  point: GrammarPoint;
}

/** Thẻ trắc nghiệm giữa CỤM DỄ NHẦM (Trục C) — loại thẻ quan trọng nhất theo Features.md mục 4: cho
 * 1 câu ví dụ, người học phải chọn ĐÚNG cấu trúc nào trong cụm đang minh hoạ, thay vì chỉ ôn nghĩa. */
export interface ConfusionGrammarCard {
  kind: "confusion";
  id: string;
  group: GrammarConfusionGroup;
  points: GrammarPoint[];
  quizExample: { sentence: string; translationVn: string; correctPointId: string };
}

/** Thẻ "chuỗi ngữ cảnh" (Features.md — soạn tay, hiển thị dạng chuỗi tuyến tính rồi chấm điểm 1 lần
 * cho cả chuỗi, dùng lại đúng SRS/progress đang có, không phải hệ thống ôn tập riêng). */
export interface StoryGrammarCard {
  kind: "story";
  id: string;
  story: ResolvedGrammarStory;
}

export type GrammarCardInfo = StandardGrammarCard | ConfusionGrammarCard | StoryGrammarCard;

export function confusionCardId(groupId: string): string {
  return `confusion:${groupId}`;
}

export function storyCardId(storyId: string): string {
  return `story:${storyId}`;
}

/** Xây toàn bộ danh sách thẻ ôn tập (chuẩn + trắc nghiệm) từ dữ liệu Trục A/C của 1 ngôn ngữ. Chạy
 * được ở cả server lẫn client (thuần hàm biến đổi dữ liệu, không đụng Redis/fs).
 *
 * `categoryId`: khi truyền vào, CHỈ lấy thẻ thuộc 1 nhóm chức năng cụ thể — người dùng phản hồi bấm
 * "Luyện tập" ở trang ngữ pháp là luyện HẾT toàn bộ điểm (mọi nhóm trộn lẫn), muốn mỗi nhóm có phần
 * luyện tập riêng. Thẻ "standard" lọc thẳng theo category của điểm; thẻ "confusion"/"story" chỉ giữ
 * lại nếu TOÀN BỘ điểm liên quan đều thuộc category đó (không lộ điểm nhóm khác vào 1 phiên luyện
 * đang cố ý thu hẹp phạm vi) — không truyền `categoryId` thì giữ nguyên hành vi cũ (luyện tất cả). */
export function buildGrammarCards(data: GrammarLanguageData, categoryId?: string): GrammarCardInfo[] {
  const allPoints = data.categories.flatMap((c) => c.points);
  const pointById = new Map(allPoints.map((p) => [p.id, p]));
  const categoryByPointId = new Map<string, string>();
  for (const c of data.categories) for (const p of c.points) categoryByPointId.set(p.id, c.id);
  const inScope = (pointId: string) => !categoryId || categoryByPointId.get(pointId) === categoryId;

  const scopedPoints = categoryId ? allPoints.filter((p) => inScope(p.id)) : allPoints;
  const standardCards: StandardGrammarCard[] = scopedPoints.map((p) => ({
    kind: "standard",
    id: p.id,
    point: p,
  }));

  const confusionCards: ConfusionGrammarCard[] = [];
  for (const group of data.confusionGroups) {
    if (!group.pointIds.every(inScope)) continue;
    const points = group.pointIds.map((id) => pointById.get(id)).filter((p): p is GrammarPoint => !!p);
    if (points.length < 2) continue;
    const source = points.find((p) => p.examples[0]);
    if (!source?.examples[0]) continue;
    confusionCards.push({
      kind: "confusion",
      id: confusionCardId(group.id),
      group,
      points,
      quizExample: {
        sentence: source.examples[0].sentence,
        translationVn: source.examples[0].translationVn,
        correctPointId: source.id,
      },
    });
  }

  const storyCards: StoryGrammarCard[] = getGrammarStories(data.language)
    .map((story) => resolveStory(data, story))
    .filter((story) => story.steps.length >= 2)
    .filter((story) => story.steps.every((step) => inScope(step.point.id)))
    .map((story) => ({ kind: "story", id: storyCardId(story.id), story }));

  return [...standardCards, ...confusionCards, ...storyCards];
}
