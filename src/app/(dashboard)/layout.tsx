import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SUCURSAL_LABELS } from "@/lib/catalogs";
import { NavBar } from "@/components/ui/NavBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, sucursal, username } = session.user;
  const subtitle =
    role === "coord" ? "Coordinador / Community Manager" : `Gerente — ${SUCURSAL_LABELS[sucursal!]}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <NavBar role={role} username={username} subtitle={subtitle} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
