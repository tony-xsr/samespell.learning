import Link from "next/link";
import { notFound } from "next/navigation";
import { getChainLanguageData } from "@/lib/chainStore";
import ChainBrowser from "@/components/chains/ChainBrowser";
import type { Language } from "@/types/vocab";

export default async function ChainsLanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const data = getChainLanguageData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href="/chains" className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🔗 Nối đuôi</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Bấm vào 1 ô để xem chi tiết + nghe đọc. Chữ tô màu là chữ dùng để nối sang từ bên cạnh.
        </p>

        <div className="mt-5">
          <ChainBrowser language={lang as Language} data={data} />
        </div>
      </div>
    </main>
  );
}
