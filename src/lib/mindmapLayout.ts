import type { RootEntry, SoundGroup, VocabWord } from "@/types/vocab";

export interface PositionedWord {
  word: VocabWord;
  x: number;
  y: number;
  children: PositionedWord[];
}

export interface RootNode {
  root: RootEntry;
  x: number;
  y: number;
  side: -1 | 1;
  colorIndex: number;
  words: PositionedWord[];
}

export interface MindmapLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  roots: RootNode[];
}

const ROOT_H_GAP = 240;
const WORD_H_GAP = 230;
const WORD_STEP = 88;
const ROOT_CLUSTER_GAP = 70;
const TOP_MARGIN = 50;
const SIDE_MARGIN = 130;

// Layout dọc (điện thoại xoay đứng): chỉ 1 cột chữ gốc xuống dưới trung tâm thay vì tách trái/phải,
// khoảng cách thu hẹp lại để không phải kéo ngang quá nhiều trên màn hình hẹp.
const V_ROOT_GAP = 100;
const V_WORD_GAP = 170;
const V_WORD_STEP = 76;
const V_CLUSTER_GAP = 46;
const V_TOP_MARGIN = 110;
const V_SIDE_MARGIN = 110;

export type MindmapOrientation = "horizontal" | "vertical";

/** Recursively lays out a chain of (possibly nested) words, advancing a shared cursor
 * so a word with children reserves exactly as much vertical space as its descendants need. */
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

function placeWords(words: VocabWord[], x: number, side: -1 | 1, cursor: { y: number }): PositionedWord[] {
  return placeWordsWithStep(words, x, side, cursor, WORD_STEP, WORD_H_GAP);
}

function shiftWordTree(pw: PositionedWord, offset: number): PositionedWord {
  return { ...pw, y: pw.y + offset, children: pw.children.map((c) => shiftWordTree(c, offset)) };
}

function wordDepth(word: VocabWord): number {
  if (!word.children || word.children.length === 0) return 1;
  return 1 + Math.max(...word.children.map(wordDepth));
}

function groupMaxWordDepth(group: SoundGroup): number {
  let max = 1;
  for (const root of group.roots) {
    for (const word of root.words) {
      max = Math.max(max, wordDepth(word));
    }
  }
  return max;
}

interface SidePlacement {
  nodes: Omit<RootNode, "side" | "colorIndex">[];
  totalHeight: number;
}

function placeSide(roots: RootEntry[], side: -1 | 1, centerX: number, wordHGap: number): SidePlacement {
  let cursorY = TOP_MARGIN;
  const nodes: Omit<RootNode, "side" | "colorIndex">[] = [];

  for (const root of roots) {
    const rootX = centerX + side * ROOT_H_GAP;
    const wordX = rootX + side * wordHGap;
    const startY = cursorY;
    const cursor = { y: cursorY };
    const words = root.words.length > 0 ? placeWords(root.words, wordX, side, cursor) : [];
    cursorY = words.length > 0 ? cursor.y : cursorY + WORD_STEP;
    const clusterHeight = cursorY - startY - WORD_STEP;
    const rootY = startY + clusterHeight / 2;

    nodes.push({ root, x: rootX, y: rootY, words });
    cursorY += ROOT_CLUSTER_GAP;
  }

  return { nodes, totalHeight: Math.max(cursorY - ROOT_CLUSTER_GAP, TOP_MARGIN) };
}

function buildHorizontalLayout(group: SoundGroup): MindmapLayout {
  const half = Math.ceil(group.roots.length / 2);
  const rightRoots = group.roots.slice(0, half);
  const leftRoots = group.roots.slice(half);

  const centerX = ROOT_H_GAP + WORD_H_GAP + SIDE_MARGIN;

  const rightPlacement = placeSide(rightRoots, 1, centerX, WORD_H_GAP);
  const leftPlacement = placeSide(leftRoots, -1, centerX, WORD_H_GAP);

  const height = Math.max(rightPlacement.totalHeight, leftPlacement.totalHeight, 260) + TOP_MARGIN;
  const centerY = height / 2;

  function reCenter(placement: SidePlacement, side: -1 | 1, colorOffset: number): RootNode[] {
    const offset = height / 2 - (TOP_MARGIN + placement.totalHeight) / 2;
    return placement.nodes.map((n, i) => ({
      ...n,
      side,
      colorIndex: i * 2 + colorOffset,
      y: n.y + offset,
      words: n.words.map((w) => shiftWordTree(w, offset)),
    }));
  }

  const roots = [...reCenter(rightPlacement, 1, 0), ...reCenter(leftPlacement, -1, 1)];

  const maxDepth = groupMaxWordDepth(group);
  const width = centerX + ROOT_H_GAP + WORD_H_GAP * maxDepth + SIDE_MARGIN;

  return { width, height, centerX, centerY, roots };
}

/** Mọi chữ gốc xếp thành 1 cột dọc xuống dưới trung tâm (không tách trái/phải), mỗi cụm từ của
 * 1 chữ gốc vẫn toả sang phải như cũ nhưng khoảng cách thu hẹp — phù hợp màn hình điện thoại dọc,
 * hướng kéo chính là lên/xuống thay vì phải kéo ngang rộng. */
function buildVerticalLayout(group: SoundGroup): MindmapLayout {
  const centerX = V_SIDE_MARGIN;
  const rootX = centerX + V_ROOT_GAP;

  let cursorY = V_TOP_MARGIN;
  const nodes: Omit<RootNode, "side" | "colorIndex">[] = [];
  for (const root of group.roots) {
    const wordX = rootX + V_WORD_GAP;
    const startY = cursorY;
    const cursor = { y: cursorY };
    const words = root.words.length > 0 ? placeWordsWithStep(root.words, wordX, 1, cursor, V_WORD_STEP, V_WORD_GAP) : [];
    cursorY = words.length > 0 ? cursor.y : cursorY + V_WORD_STEP;
    const clusterHeight = cursorY - startY - V_WORD_STEP;
    const rootY = startY + clusterHeight / 2;
    nodes.push({ root, x: rootX, y: rootY, words });
    cursorY += V_CLUSTER_GAP;
  }
  const totalHeight = Math.max(cursorY - V_CLUSTER_GAP, V_TOP_MARGIN);

  const height = totalHeight + V_TOP_MARGIN / 2;
  const centerY = V_TOP_MARGIN / 2;
  const roots: RootNode[] = nodes.map((n, i) => ({ ...n, side: 1, colorIndex: i }));

  const maxDepth = groupMaxWordDepth(group);
  const width = rootX + V_WORD_GAP * maxDepth + V_SIDE_MARGIN;

  return { width, height, centerX, centerY, roots };
}

export function buildMindmapLayout(
  group: SoundGroup,
  orientation: MindmapOrientation = "horizontal",
): MindmapLayout {
  return orientation === "vertical" ? buildVerticalLayout(group) : buildHorizontalLayout(group);
}

export function curvePath(x1: number, y1: number, x2: number, y2: number, side: -1 | 1): string {
  const dx = Math.abs(x2 - x1) * 0.5 * side;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
