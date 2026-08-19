import Link from "next/link";
import { notFound } from "next/navigation";
import { getScenarioLanguageData } from "@/lib/scenarioStore";
import ScenarioBrowser from "@/components/scenarios/ScenarioBrowser";
import type { Language } from "@/types/vocab";

export default async function ScenariosLanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const data = getScenarioLanguageData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href="/scenarios" className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🎬 Chuỗi kịch bản</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Bấm vào 1 chuỗi để xem toàn màn hình + nghe đọc từng bước. Mỗi bước là 1 từ/cụm từ trong cùng
          mạch tình huống, tô màu theo từ loại.
        </p>

        <div className="mt-5">
          <ScenarioBrowser language={lang as Language} data={data} />
        </div>
      </div>
    </main>
  );
}
