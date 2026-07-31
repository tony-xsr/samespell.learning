import type { TopicBranch, TopicGroup } from "@/types/topic";
import type { VocabWord } from "@/types/vocab";

/** Layout mindmap cho 1 TopicGroup — cùng thuật toán toả nhánh trái/phải + đệ quy theo
 * `VocabWord.children` như mindmap đồng âm (`mindmapLayout.ts`), chỉ đổi đơn vị "chữ gốc" (RootEntry)
 * thành "nhánh chủ đề" (TopicBranch) ở tầng đầu tiên. */
export interface PositionedWord {
  word: VocabWord;
  x: number;
  y: number;
  children: PositionedWord[];
}

export interface BranchNode {
  branch: TopicBranch;
  x: number;
  y: number;
  side: -1 | 1;
  colorIndex: number;
  words: PositionedWord[];
}

export interface TopicMindmapLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  branches: BranchNode[];
}

const BRANCH_H_GAP = 240;
const WORD_H_GAP = 230;
const WORD_STEP = 88;
const BRANCH_CLUSTER_GAP = 70;
const TOP_MARGIN = 50;
const SIDE_MARGIN = 130;

const V_BRANCH_GAP = 100;
const V_WORD_GAP = 170;
const V_WORD_STEP = 76;
const V_CLUSTER_GAP = 46;
const V_TOP_MARGIN = 110;
const V_SIDE_MARGIN = 110;

export type TopicMindmapOrientation = "horizontal" | "vertical";

function placeWordsWithStep(
  words: VocabWord[],
  x: number,
  side: -1 | 1,
  cursor: { y: number },
  step: number,
  hGap: number,
): PositionedWord[] {
  return words.map((word) => {
    const children = word.children ?? [];
    if (children.length === 0) {
      const y = cursor.y;
      cursor.y += step;
      return { word, x, y, children: [] };
    }
    const childX = x + side * hGap;
    const positionedChildren = placeWordsWithStep(children, childX, side, cursor, step, hGap);
    const ys = positionedChildren.map((c) => c.y);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    return { word, x, y, children: positionedChildren };
  });
}

function shiftWordTree(pw: PositionedWord, offset: number): PositionedWord {
  return { ...pw, y: pw.y + offset, children: pw.children.map((c) => shiftWordTree(c, offset)) };
}

function wordDepth(word: VocabWord): number {
  if (!word.children || word.children.length === 0) return 1;
  return 1 + Math.max(...word.children.map(wordDepth));
}

function topicMaxWordDepth(topic: TopicGroup): number {
  let max = 1;
  for (const branch of topic.branches) {
    for (const word of branch.words) {
      max = Math.max(max, wordDepth(word));
    }
  }
  return max;
}

interface SidePlacement {
  nodes: Omit<BranchNode, "side" | "colorIndex">[];
  totalHeight: number;
}

function placeSide(branches: TopicBranch[], side: -1 | 1, centerX: number, wordHGap: number): SidePlacement {
  let cursorY = TOP_MARGIN;
  const nodes: Omit<BranchNode, "side" | "colorIndex">[] = [];

  for (const branch of branches) {
    const branchX = centerX + side * BRANCH_H_GAP;
    const wordX = branchX + side * wordHGap;
    const startY = cursorY;
    const cursor = { y: cursorY };
    const words = branch.words.length > 0 ? placeWordsWithStep(branch.words, wordX, side, cursor, WORD_STEP, wordHGap) : [];
    cursorY = words.length > 0 ? cursor.y : cursorY + WORD_STEP;
    const clusterHeight = cursorY - startY - WORD_STEP;
    const branchY = startY + clusterHeight / 2;

    nodes.push({ branch, x: branchX, y: branchY, words });
    cursorY += BRANCH_CLUSTER_GAP;
  }

  return { nodes, totalHeight: Math.max(cursorY - BRANCH_CLUSTER_GAP, TOP_MARGIN) };
}

function buildHorizontalLayout(topic: TopicGroup): TopicMindmapLayout {
  const half = Math.ceil(topic.branches.length / 2);
  const rightBranches = topic.branches.slice(0, half);
  const leftBranches = topic.branches.slice(half);

  const centerX = BRANCH_H_GAP + WORD_H_GAP + SIDE_MARGIN;

  const rightPlacement = placeSide(rightBranches, 1, centerX, WORD_H_GAP);
  const leftPlacement = placeSide(leftBranches, -1, centerX, WORD_H_GAP);

  const height = Math.max(rightPlacement.totalHeight, leftPlacement.totalHeight, 260) + TOP_MARGIN;
  const centerY = height / 2;

  function reCenter(placement: SidePlacement, side: -1 | 1, colorOffset: number): BranchNode[] {
    const offset = height / 2 - (TOP_MARGIN + placement.totalHeight) / 2;
    return placement.nodes.map((n, i) => ({
      ...n,
      side,
      colorIndex: i * 2 + colorOffset,
      y: n.y + offset,
      words: n.words.map((w) => shiftWordTree(w, offset)),
    }));
  }

  const branches = [...reCenter(rightPlacement, 1, 0), ...reCenter(leftPlacement, -1, 1)];

  const maxDepth = topicMaxWordDepth(topic);
  const width = centerX + BRANCH_H_GAP + WORD_H_GAP * maxDepth + SIDE_MARGIN;

  return { width, height, centerX, centerY, branches };
}

function buildVerticalLayout(topic: TopicGroup): TopicMindmapLayout {
  const centerX = V_SIDE_MARGIN;
  const branchX = centerX + V_BRANCH_GAP;

  let cursorY = V_TOP_MARGIN;
  const nodes: Omit<BranchNode, "side" | "colorIndex">[] = [];
  for (const branch of topic.branches) {
    const wordX = branchX + V_WORD_GAP;
    const startY = cursorY;
    const cursor = { y: cursorY };
    const words = branch.words.length > 0 ? placeWordsWithStep(branch.words, wordX, 1, cursor, V_WORD_STEP, V_WORD_GAP) : [];
    cursorY = words.length > 0 ? cursor.y : cursorY + V_WORD_STEP;
    const clusterHeight = cursorY - startY - V_WORD_STEP;
    const branchY = startY + clusterHeight / 2;
    nodes.push({ branch, x: branchX, y: branchY, words });
    cursorY += V_CLUSTER_GAP;
  }
  const totalHeight = Math.max(cursorY - V_CLUSTER_GAP, V_TOP_MARGIN);

  const height = totalHeight + V_TOP_MARGIN / 2;
  const centerY = V_TOP_MARGIN / 2;
  const branches: BranchNode[] = nodes.map((n, i) => ({ ...n, side: 1, colorIndex: i }));

  const maxDepth = topicMaxWordDepth(topic);
  const width = branchX + V_WORD_GAP * maxDepth + V_SIDE_MARGIN;

  return { width, height, centerX, centerY, branches };
}

export function buildTopicMindmapLayout(
  topic: TopicGroup,
  orientation: TopicMindmapOrientation = "horizontal",
): TopicMindmapLayout {
  return orientation === "vertical" ? buildVerticalLayout(topic) : buildHorizontalLayout(topic);
}
