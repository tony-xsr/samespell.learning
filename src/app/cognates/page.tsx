import Link from "next/link";
import { getCognatePairConfigs, getCognatePairSet } from "@/lib/cognateStore";

export default function CognatesHubPage() {
  const configs = getCognatePairConfigs();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Học chéo ngôn ngữ — học 1 được 2</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Các ngôn ngữ gốc Latin dùng chung rất nhiều gốc từ — học 1 gốc, nhớ được cả cặp từ ở 2 ngôn ngữ.
          Chọn 1 cặp ngôn ngữ bên dưới để bắt đầu.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {configs.map((config) => {
            const pairSet = getCognatePairSet(config.key);
            const totalPairs = pairSet?.groups.reduce((sum, g) => sum + g.pairs.length, 0) ?? 0;
            return (
              <Link
                key={config.key}
                href={`/cognates/${config.key}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                  {config.flagA}
                  {config.flagB}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">{config.label}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {pairSet && pairSet.groups.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                        {pairSet.groups.length} nhóm gốc từ · {totalPairs} cặp từ
                      </span>
                    ) : (
                      "Sắp ra mắt"
                    )}
                  </div>
                </div>
                <span className="text-brand-500">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
