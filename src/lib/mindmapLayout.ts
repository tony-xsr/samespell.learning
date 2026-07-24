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

/** Recursively lays out a chain of (possibly nested) words, advancing a shared cursor
 * so a word with children reserves exactly as much vertical space as its descendants need. */
function placeWords(words: VocabWord[], x: number, side: -1 | 1, cursor: { y: number }): PositionedWord[] {
  return words.map((word) => {
    const children = word.children ?? [];
    if (children.length === 0) {
      const y = cursor.y;
      cursor.y += WORD_STEP;
      return { word, x, y, children: [] };
    }
    const childX = x + side * WORD_H_GAP;
    const positionedChildren = placeWords(children, childX, side, cursor);
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

export function buildMindmapLayout(group: SoundGroup): MindmapLayout {
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

export function curvePath(x1: number, y1: number, x2: number, y2: number, side: -1 | 1): string {
  const dx = Math.abs(x2 - x1) * 0.5 * side;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
