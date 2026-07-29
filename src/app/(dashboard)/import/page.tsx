import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ImportView } from "@/components/import/ImportView";

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "coord") redirect("/leads");

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Importar leads desde Excel</h1>
      <ImportView />
    </div>
  );
}
