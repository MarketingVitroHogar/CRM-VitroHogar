import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertCanAccessLead, ForbiddenError } from "@/lib/permissions";
import { LeadForm } from "@/components/leads/LeadForm";
import type { LeadDTO } from "@/lib/types";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) notFound();

  try {
    assertCanAccessLead(session.user, lead);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const leadDTO: LeadDTO = JSON.parse(JSON.stringify(lead));

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Editar lead</h1>
      <LeadForm
        mode="edit"
        role={session.user.role}
        gerenteSucursal={session.user.sucursal}
        lead={leadDTO}
      />
    </div>
  );
}
