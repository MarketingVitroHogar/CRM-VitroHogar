"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import type { Role } from "@prisma/client";
import { openChangePassword } from "@/lib/accountEvents";
import { openNovedades } from "@/lib/novedades";
import { AvisosBell } from "@/components/avisos/AvisosBell";
import { ThemeToggle, useTema } from "@/components/ui/ThemeToggle";

const LINKS = [
  { href: "/inicio", label: "Inicio", roles: ["coord", "gerente"] },
  { href: "/leads", label: "Leads", roles: ["coord", "gerente"] },
  { href: "/reports", label: "Reportes", roles: ["coord", "gerente"] },
  { href: "/import", label: "Importar Excel", roles: ["coord"] },
  { href: "/users", label: "Usuarios", roles: ["coord"] },
];

/** Menú del usuario: "Cambiar contraseña" y "Salir". Punto rojo mientras no haya cambiado su contraseña. */
function UserMenu({ username, subtitle, passwordChanged, auto, onAuto }: { username: string; subtitle: string; passwordChanged: boolean; auto: boolean; onAuto: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        <span className="text-xs">{username}</span>
        {!passwordChanged && <span className="h-2 w-2 rounded-full bg-brand" title="Tienes pendiente cambiar tu contraseña" aria-label="Pendiente: cambiar contraseña" />}
        <span aria-hidden className="text-[10px]">
          ▾
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="border-b border-slate-100 px-2.5 py-2">
            <p className="text-sm font-semibold text-slate-900">{username}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openChangePassword();
            }}
            className="mt-1 flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Cambiar contraseña
            {!passwordChanged && <span className="rounded bg-red-50 px-1.5 text-[11px] font-semibold text-brand">pendiente</span>}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAuto();
            }}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Modo según el dispositivo
            {auto && <span className="rounded bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">activo</span>}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openNovedades();
            }}
            className="flex w-full rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Novedades
          </button>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Salir
          </button>
        </div>
      )}
    </div>
  );
}

export function NavBar({
  role,
  username,
  subtitle,
  passwordChanged,
}: {
  role: Role;
  username: string;
  subtitle: string;
  passwordChanged: boolean;
}) {
  const pathname = usePathname();
  const tema = useTema();

  return (
    <header className="border-b-2 border-brand bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo alt="Vitro Hogar" className="h-8 w-auto sm:h-9" />
          <div className="border-l border-slate-200 pl-3">
            <p className="text-xs font-semibold text-slate-900">CRM</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {LINKS.filter((link) => link.roles.includes(role)).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                pathname?.startsWith(link.href)
                  ? "bg-brand text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
          <AvisosBell role={role} username={username} />
          <ThemeToggle noche={tema.noche} onToggle={() => tema.elegir(tema.noche ? "claro" : "noche")} />
          <UserMenu username={username} subtitle={subtitle} passwordChanged={passwordChanged} auto={tema.pref === "auto"} onAuto={() => tema.elegir("auto")} />
        </nav>
      </div>
    </header>
  );
}
