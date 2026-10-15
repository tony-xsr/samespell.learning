import Link from "next/link";
import StrokeDemoCard from "@/components/writing/StrokeDemoCard";
import WritingPractice from "@/components/writing/WritingPractice";

/** 8 nét cơ bản. 捺 / 提 / 折 không có dữ liệu đứng riêng nên mượn chữ mẫu và chỉ tô đúng nét đó. */
const BASIC_STROKES: { char: string; strokeIndex?: number; title: string; subtitle: string }[] = [
  { char: "一", title: "横 héng", subtitle: "Ngang · trái → phải" },
  { char: "丨", title: "竖 shù", subtitle: "Sổ · trên → dưới" },
  { char: "丿", title: "撇 piě", subtitle: "Phẩy · xuống trái" },
  { char: "丶", title: "点 diǎn", subtitle: "Chấm" },
  { char: "人", strokeIndex: 1, title: "捺 nà", subtitle: "Mác · xuống phải" },
  { char: "打", strokeIndex: 2, title: "提 tí", subtitle: "Hất · lên phải" },
  { char: "口", strokeIndex: 1, title: "折 zhé", subtitle: "Gập · ngang rồi xuống" },
  { char: "亅", title: "钩 gōu", subtitle: "Móc · sổ rồi móc" },
];

/** Quy tắc thứ tự nét — chữ ví dụ animate cả chữ để thấy rõ nét nào trước nét nào sau. */
const ORDER_RULES: { char: string; title: string; subtitle: string }[] = [
  { char: "十", title: "Ngang trước, sổ sau", subtitle: "先横后竖" },
  { char: "人", title: "Phẩy trước, mác sau", subtitle: "先撇后捺" },
  { char: "三", title: "Trên trước, dưới sau", subtitle: "从上到下" },
  { char: "川", title: "Trái trước, phải sau", subtitle: "从左到右" },
  { char: "月", title: "Ngoài trước, trong sau", subtitle: "从外到内" },
  { char: "国", title: "Vào nhà rồi đóng cửa", subtitle: "先里头后封口" },
  { char: "小", title: "Giữa trước, hai bên sau", subtitle: "先中间后两边" },
];

/** Điện thoại: 1 hàng cuộn ngang (khỏi phải cuộn dọc qua 15 thẻ); màn rộng: lưới 4 cột. */
const STRIP = "-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0";

export default function WritingPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">✍️ Luyện viết chữ Hán</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Xem thứ tự nét, rồi tự viết bằng chuột / ngón tay — mỗi nét được chấm đúng sai ngay.
        </p>

        <section className="mt-5">
          <WritingPractice />
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Nét cơ bản</h2>
          <p className="mb-2 text-xs text-ink-muted">Mọi chữ Hán đều ghép từ các nét này. Bấm thẻ để xem lại.</p>
          <div className={STRIP}>
            {BASIC_STROKES.map((s) => (
              <StrokeDemoCard key={s.title} {...s} />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Nét nào trước, nét nào sau</h2>
          <p className="mb-2 text-xs text-ink-muted">7 quy tắc thứ tự nét — gặp chữ lạ cứ theo các quy tắc này.</p>
          <div className={STRIP}>
            {ORDER_RULES.map((r) => (
              <StrokeDemoCard key={r.subtitle} {...r} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
