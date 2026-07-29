import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeadsView } from "@/components/leads/LeadsView";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <LeadsView role={session.user.role} />;
}
