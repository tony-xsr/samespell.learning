export interface BranchColor {
  stroke: string;
  border: string;
  bg: string;
  text: string;
}

// Nền thẻ ở theme tối cố ý ĐỤC (không "/50"): người học có thể chọn nền canvas màu giấy sáng, nền
// trong mờ sẽ cho giấy lọt qua và biến thẻ thành màu lưng chừng — chữ sáng trên đó chỉ còn tương phản
// 2.7–3.1, dưới ngưỡng đọc được (đã đo). Đục thì thẻ luôn tự đủ tương phản, không phụ thuộc nền.
export const BRANCH_COLORS: BranchColor[] = [
  { stroke: "#16a34a", border: "border-green-500", bg: "bg-green-100 dark:bg-green-950", text: "text-green-800 dark:text-green-400" },
  { stroke: "#ca8a04", border: "border-amber-500", bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-800 dark:text-amber-400" },
  { stroke: "#2563eb", border: "border-blue-500", bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-800 dark:text-blue-400" },
  { stroke: "#ea580c", border: "border-orange-500", bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-800 dark:text-orange-400" },
  { stroke: "#7c3aed", border: "border-violet-500", bg: "bg-violet-100 dark:bg-violet-950", text: "text-violet-800 dark:text-violet-400" },
  { stroke: "#dc2626", border: "border-red-500", bg: "bg-red-100 dark:bg-red-950", text: "text-red-800 dark:text-red-400" },
];

export function branchColor(index: number): BranchColor {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}
