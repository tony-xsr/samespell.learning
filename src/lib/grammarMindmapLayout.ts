import type { GrammarCategory, GrammarPoint } from "@/types/grammar";

/** Layout mindmap cho 1 GrammarCategory — cùng kiểu toả nhánh trái/phải + đường cong như mindmap từ
 * vựng (`mindmapLayout.ts`), nhưng chỉ có 1 tầng nhánh (mỗi GrammarPoint là 1 nhánh lá, không lồng
 * thêm tầng con như VocabWord.children) vì 1 điểm ngữ pháp đã là đơn vị trọn vẹn — xem chi tiết đầy
 * đủ qua modal khi bấm vào, không cần tách thêm nhánh con. */
export interface PositionedGrammarPoint {
  point: GrammarPoint;
  x: number;
  y: number;
  side: -1 | 1;
  colorIndex: number;
}

export interface GrammarMindmapLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  points: PositionedGrammarPoint[];
}

const POINT_H_GAP = 260;
const POINT_STEP = 92;
const CLUSTER_GAP = 18;
const TOP_MARGIN = 60;
const SIDE_MARGIN = 150;

const V_POINT_GAP = 190;
const V_POINT_STEP = 78;
const V_TOP_MARGIN = 90;
const V_SIDE_MARGIN = 120;

export type GrammarMindmapOrientation = "horizontal" | "vertical";

function buildHorizontalLayout(category: GrammarCategory): GrammarMindmapLayout {
  const half = Math.ceil(category.points.length / 2);
  const rightPoints = category.points.slice(0, half);
  const leftPoints = category.points.slice(half);
  const centerX = POINT_H_GAP + SIDE_MARGIN;

  function placeSide(points: GrammarPoint[], side: -1 | 1, colorOffset: number): PositionedGrammarPoint[] {
    let cursorY = TOP_MARGIN;
    return points.map((point, i) => {
      const y = cursorY;
      cursorY += POINT_STEP + CLUSTER_GAP;
      return { point, x: centerX + side * POINT_H_GAP, y, side, colorIndex: i * 2 + colorOffset };
    });
  }

  const right = placeSide(rightPoints, 1, 0);
  const left = placeSide(leftPoints, -1, 1);

  const rightHeight = right.length > 0 ? right[right.length - 1].y + POINT_STEP : TOP_MARGIN;
  const leftHeight = left.length > 0 ? left[left.length - 1].y + POINT_STEP : TOP_MARGIN;
  const height = Math.max(rightHeight, leftHeight, 260) + TOP_MARGIN;
  const centerY = height / 2;

  function reCenter(nodes: PositionedGrammarPoint[], totalHeight: number): PositionedGrammarPoint[] {
    const offset = height / 2 - (TOP_MARGIN + totalHeight) / 2;
    return nodes.map((n) => ({ ...n, y: n.y + offset }));
  }

  const points = [...reCenter(right, rightHeight - TOP_MARGIN), ...reCenter(left, leftHeight - TOP_MARGIN)];
  const width = centerX + POINT_H_GAP + SIDE_MARGIN;

  return { width, height, centerX, centerY, points };
}

function buildVerticalLayout(category: GrammarCategory): GrammarMindmapLayout {
  const centerX = V_SIDE_MARGIN;
  const pointX = centerX + V_POINT_GAP;

  let cursorY = V_TOP_MARGIN;
  const points: PositionedGrammarPoint[] = category.points.map((point, i) => {
    const y = cursorY;
    cursorY += V_POINT_STEP;
    return { point, x: pointX, y, side: 1, colorIndex: i };
  });
  const height = Math.max(cursorY, V_TOP_MARGIN) + V_TOP_MARGIN / 2;
  const centerY = V_TOP_MARGIN / 2;
  const width = pointX + V_POINT_GAP + V_SIDE_MARGIN;

  return { width, height, centerX, centerY, points };
}

export function buildGrammarMindmapLayout(
  category: GrammarCategory,
  orientation: GrammarMindmapOrientation = "horizontal",
): GrammarMindmapLayout {
  return orientation === "vertical" ? buildVerticalLayout(category) : buildHorizontalLayout(category);
}
