import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SUCURSAL_LABELS } from "@/lib/catalogs";
import { NavBar } from "@/components/ui/NavBar";
import { AccountSecurity } from "@/components/account/AccountSecurity";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, sucursal, asesor, username, passwordChanged } = session.user;
  const subtitle =
    role === "coord"
      ? "Coordinador / Community Manager"
      : role === "asesor"
        ? `Asesor${asesor ? ` ${asesor}` : ""} — ${SUCURSAL_LABELS[sucursal!]}`
        : `Gerente — ${SUCURSAL_LABELS[sucursal!]}`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <NavBar role={role} username={username} subtitle={subtitle} passwordChanged={passwordChanged} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <AccountSecurity passwordChanged={passwordChanged} role={role} username={username} sucursal={sucursal} />
    </div>
  );
}
