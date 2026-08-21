import Link from "next/link";
import { notFound } from "next/navigation";
import { getCharAntonymData } from "@/lib/wordClusterStore";
import CharAntonymBrowser from "@/components/clusters/CharAntonymBrowser";
import type { Language } from "@/types/vocab";

export default async function AntonymCharsLanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const data = getCharAntonymData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href="/antonym-chars" className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">⇔ Cặp chữ trái nghĩa</h1>
        <p className="mt-1 text-sm text-ink-muted">Bấm vào 1 dòng để xem chi tiết + nghe đọc.</p>

        <div className="mt-5">
          <CharAntonymBrowser language={lang as Language} data={data} />
        </div>
      </div>
    </main>
  );
}
