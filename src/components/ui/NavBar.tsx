"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import type { Role } from "@prisma/client";

const LINKS = [
  { href: "/leads", label: "Leads", roles: ["coord", "gerente"] },
  { href: "/reports", label: "Reportes", roles: ["coord", "gerente"] },
  { href: "/import", label: "Importar Excel", roles: ["coord"] },
];

export function NavBar({
  role,
  username,
  subtitle,
}: {
  role: Role;
  username: string;
  subtitle: string;
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Vitro Hogar CRM</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {LINKS.filter((link) => link.roles.includes(role)).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                pathname?.startsWith(link.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
          <span className="text-xs text-slate-500">{username}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
