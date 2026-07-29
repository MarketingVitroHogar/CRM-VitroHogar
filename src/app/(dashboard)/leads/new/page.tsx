import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadForm } from "@/components/leads/LeadForm";

export default async function NewLeadPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "coord") redirect("/leads");

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Nuevo lead</h1>
      <LeadForm mode="create" role="coord" />
    </div>
  );
}
