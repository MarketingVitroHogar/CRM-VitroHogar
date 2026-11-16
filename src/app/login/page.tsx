"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PW_NOTICE_DISMISSED_KEY } from "@/lib/accountEvents";
import { LOCK_MINUTES, LOGIN_INACTIVE, LOGIN_LOCKED, LOGIN_REMAINING_PREFIX } from "@/lib/loginLimits";

function loginErrorMessage(code: string): string {
  if (code === LOGIN_LOCKED) {
    return `Demasiados intentos fallidos. Por seguridad, el acceso a esta cuenta se bloqueó ${LOCK_MINUTES} minutos. Intenta de nuevo más tarde o pide ayuda a Coordinación.`;
  }
  if (code === LOGIN_INACTIVE) return "Tu cuenta está desactivada. Contacta a Coordinación para que la reactive.";
  if (code.startsWith(LOGIN_REMAINING_PREFIX)) {
    const left = Number(code.slice(LOGIN_REMAINING_PREFIX.length));
    return `Usuario o contraseña incorrectos. Te quedan ${left} intento${left === 1 ? "" : "s"} antes de un bloqueo temporal.`;
  }
  return "Usuario o contraseña incorrectos";
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(loginErrorMessage(result.error));
      return;
    }

    // Nueva sesión: el aviso de "cambiar contraseña" vuelve a mostrarse si aún no la ha cambiado.
    try {
      sessionStorage.removeItem(PW_NOTICE_DISMISSED_KEY);
    } catch {
      /* ignorar */
    }
    router.push("/leads");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 border-t-4 border-t-brand bg-white p-8 shadow-sm">
        <Image
          src="/logo-vitrohogar.png"
          alt="Vitro Hogar — Pisos, Azulejos, Baños"
          width={900}
          height={176}
          priority
          className="mx-auto mb-3 h-auto w-64 max-w-full"
        />
        <h1 className="mb-6 text-center text-sm font-medium text-slate-500">CRM de seguimiento de leads</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
