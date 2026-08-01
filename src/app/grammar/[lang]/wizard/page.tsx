import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";
import { resolveWizardForLanguage } from "@/lib/grammarWizard";
import GrammarWizard from "@/components/grammar/GrammarWizard";
import type { Language } from "@/types/vocab";

export default async function GrammarWizardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  const root = resolveWizardForLanguage(data, lang as Language);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">🧭 Tôi muốn nói...</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Trả lời vài câu hỏi để tìm đúng cấu trúc ngữ pháp cần dùng — thay vì tra cứu ngược từ tên cấu
            trúc.
          </p>
        </div>

        <div className="mt-6">
          <GrammarWizard root={root} lang={lang} />
        </div>
      </div>
    </main>
  );
}
