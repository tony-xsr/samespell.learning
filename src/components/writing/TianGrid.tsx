/** Ô 田字格 (khung ô vuông có đường kẻ giữa + chéo nét đứt) — giấy tập viết chữ Hán, giúp ước lượng vị
 * trí và tỉ lệ từng nét. Đặt tuyệt đối phía sau vùng vẽ của hanzi-writer. */
export default function TianGrid({ size }: { size: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 text-ink-muted"
    >
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <g stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" strokeWidth="0.6">
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="0" y1="50" x2="100" y2="50" />
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </g>
    </svg>
  );
}
