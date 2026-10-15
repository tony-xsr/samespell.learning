import WritingSheet from "@/components/writing/WritingSheet";

export default async function WritingPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { text } = await searchParams;
  return <WritingSheet text={typeof text === "string" ? text : ""} />;
}
