import { requireSuperAdmin } from "@/lib/admin/permissions";
import { getOverrides } from "@/lib/i18n";
import { EN_FLAT, AM_FLAT, DICT_SECTIONS } from "@/lib/i18n-data";
import { PageHeader } from "@/components/admin/ui";
import { TranslationsForm } from "@/components/admin/translations-form";

export const metadata = { title: "Admin · Translations" };
export const dynamic = "force-dynamic";

export default async function AdminTranslationsPage() {
  await requireSuperAdmin();
  const overrides = await getOverrides();
  const amOv = overrides.am ?? {};

  const paths = Object.keys(EN_FLAT);
  const sections = DICT_SECTIONS.map((section) => ({
    name: section,
    rows: paths
      .filter((p) => p === section || p.startsWith(`${section}.`))
      .map((path) => ({
        path,
        en: EN_FLAT[path],
        am: amOv[path] ?? AM_FLAT[path] ?? "",
        edited: path in amOv,
      })),
  })).filter((s) => s.rows.length > 0);

  const editedCount = Object.keys(amOv).length;

  return (
    <div>
      <PageHeader
        title="Translations"
        description="Edit the Amharic wording for the whole public site. Changes apply immediately; anything you leave blank keeps the built-in default. English is shown for reference."
      />
      <TranslationsForm sections={sections} editedCount={editedCount} />
    </div>
  );
}
