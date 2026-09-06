import { notFound } from "next/navigation";
import type { Language } from "@/types/vocab";
import type { QuizMode } from "@/lib/quiz/types";
import QuizSession from "@/components/quiz/QuizSession";

const VALID_LANGS = ["zh", "ja", "ko", "en", "mixed"] as const;
const VALID_MODES: QuizMode[] = ["meaning", "reading", "cloze"];

export default async function TestPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; mode: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang, mode } = await params;
  const query = await searchParams;

  if (!VALID_LANGS.includes(lang as (typeof VALID_LANGS)[number])) notFound();
  if (!VALID_MODES.includes(mode as QuizMode)) notFound();

  const reflex = query.reflex === "1";

  return (
    <QuizSession
      lang={lang as Language | "mixed"}
      mode={mode as QuizMode}
      reflex={reflex}
    />
  );
}
