import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UsersView } from "@/components/users/UsersView";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "coord") redirect("/leads"); // solo Coordinación

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Usuarios</h1>
      <p className="mb-4 text-sm text-slate-500">Desde aquí se activa o desactiva el acceso de cada cuenta.</p>
      <UsersView />
    </div>
  );
}
