import Link from "next/link";
import { getCognateData } from "@/lib/cognateStore";
import CognateBrowser from "@/components/cognates/CognateBrowser";

export default function CognatesPage() {
  const data = getCognateData();
  const totalPairs = data.groups.reduce((sum, g) => sum + g.pairs.length, 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🇬🇧↔🇪🇸 {data.label}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tiếng Anh và Tây Ban Nha cùng mượn rất nhiều gốc từ Latin — học 1 gốc, nhớ được cả cặp từ ở 2 ngôn
          ngữ. {data.groups.length} nhóm gốc từ · {totalPairs} cặp từ. Bấm vào 1 cặp để xem chi tiết + nghe đọc.
        </p>

        <div className="mt-5">
          <CognateBrowser data={data} />
        </div>
      </div>
    </main>
  );
}
