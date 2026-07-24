export interface BranchColor {
  stroke: string;
  border: string;
  bg: string;
  text: string;
}

export const BRANCH_COLORS: BranchColor[] = [
  { stroke: "#16a34a", border: "border-green-500", bg: "bg-green-100 dark:bg-green-950/50", text: "text-green-800 dark:text-green-400" },
  { stroke: "#ca8a04", border: "border-amber-500", bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-800 dark:text-amber-400" },
  { stroke: "#2563eb", border: "border-blue-500", bg: "bg-blue-100 dark:bg-blue-950/50", text: "text-blue-800 dark:text-blue-400" },
  { stroke: "#ea580c", border: "border-orange-500", bg: "bg-orange-100 dark:bg-orange-950/50", text: "text-orange-800 dark:text-orange-400" },
  { stroke: "#7c3aed", border: "border-violet-500", bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-800 dark:text-violet-400" },
  { stroke: "#dc2626", border: "border-red-500", bg: "bg-red-100 dark:bg-red-950/50", text: "text-red-800 dark:text-red-400" },
];

export function branchColor(index: number): BranchColor {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}
