import Link from "next/link";
import { notFound } from "next/navigation";
import { getCognatePairSet } from "@/lib/cognateStore";
import CognateBrowser from "@/components/cognates/CognateBrowser";

export default async function CognatePairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  const pairSet = getCognatePairSet(pair);
  if (!pairSet) notFound();

  const totalPairs = pairSet.groups.reduce((sum, g) => sum + g.pairs.length, 0);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl">
        <Link href="/cognates" className="text-sm font-medium text-brand-600 hover:underline">
          ← Học chéo ngôn ngữ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          {pairSet.flagA}
          {pairSet.flagB} {pairSet.label}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {pairSet.groups.length} nhóm gốc từ · {totalPairs} cặp từ. Bấm vào 1 cặp để xem chi tiết + nghe đọc.
        </p>

        <div className="mt-5">
          <CognateBrowser pairSet={pairSet} />
        </div>
      </div>
    </main>
  );
}
