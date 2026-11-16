import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NewLeadForm } from "@/components/leads/NewLeadForm";

export default async function NewLeadPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "coord") redirect("/leads");

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Nuevo lead</h1>
      <p className="mb-5 text-sm text-slate-500">Captura rápida: lo esencial para que el gerente pueda dar seguimiento.</p>
      <NewLeadForm />
    </div>
  );
}
