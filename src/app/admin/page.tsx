import { getLanguages, wordCount } from "@/lib/vocabStore";
import AdminAiConfigForm from "@/components/admin/AdminAiConfigForm";
import AdminExpandTrigger from "@/components/admin/AdminExpandTrigger";
import AdminBackup from "@/components/admin/AdminBackup";
import AdminSnapshots from "@/components/admin/AdminSnapshots";
import AdminSyncToData from "@/components/admin/AdminSyncToData";

export default async function AdminPage() {
  const languages = await getLanguages();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Quản trị</h1>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {languages.map((lang) => (
            <div
              key={lang.language}
              className="rounded-2xl border border-border bg-surface-2 p-4 shadow-sm"
            >
              <div className="text-sm font-semibold text-ink">{lang.label}</div>
              <div className="mt-1 text-xs text-ink-muted">
                {lang.groups.length} nhóm âm ·{" "}
                {lang.groups.reduce((sum, g) => sum + g.roots.length, 0)} chữ gốc ·{" "}
                {lang.groups.reduce((sum, g) => sum + wordCount(g), 0)} từ
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <AdminAiConfigForm />
          <AdminExpandTrigger />
          <AdminSyncToData />
          <AdminBackup />
          <AdminSnapshots />
        </div>
      </div>
    </main>
  );
}
