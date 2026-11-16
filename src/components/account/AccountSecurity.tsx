"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { OPEN_CHANGE_PASSWORD_EVENT, PW_NOTICE_DISMISSED_KEY } from "@/lib/accountEvents";

const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const btnBrand = "rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60";
const btnSoft = "rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200";

/**
 * Aviso al entrar (si todavía no cambió su contraseña) + cuadro "Cambiar contraseña".
 * El aviso NO es obligatorio: "Más tarde" lo cierra y vuelve a salir la próxima vez que entre.
 */
export function AccountSecurity({ passwordChanged }: { passwordChanged: boolean }) {
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [notice, setNotice] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (passwordChanged) return;
    try {
      if (sessionStorage.getItem(PW_NOTICE_DISMISSED_KEY)) return;
    } catch {
      /* sin sessionStorage: se muestra igual */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el aviso depende de sessionStorage (solo cliente)
    setNotice(true);
  }, [passwordChanged]);

  useEffect(() => {
    const h = () => {
      setActual("");
      setNueva("");
      setConfirmar("");
      setError(null);
      setPwOpen(true);
    };
    window.addEventListener(OPEN_CHANGE_PASSWORD_EVENT, h);
    return () => window.removeEventListener(OPEN_CHANGE_PASSWORD_EVENT, h);
  }, []);

  function later() {
    try {
      sessionStorage.setItem(PW_NOTICE_DISMISSED_KEY, "1");
    } catch {
      /* ignorar */
    }
    setNotice(false);
    toast("Te lo recordaremos la próxima vez que entres.");
  }

  function changeNow() {
    setNotice(false);
    window.dispatchEvent(new CustomEvent(OPEN_CHANGE_PASSWORD_EVENT));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actual, nueva, confirmar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "No se pudo cambiar la contraseña");
      setPwOpen(false);
      toast("✓ Contraseña actualizada. Úsala la próxima vez que entres.");
      router.refresh(); // quita el punto rojo y el aviso
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open={notice} onClose={later} title="Ya puedes cambiar tu contraseña" icon="🔑">
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          Ahora puedes elegir tu propia contraseña. Te recomendamos cambiarla para mantener tu cuenta protegida.
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          Lo puedes hacer cuando quieras desde tu nombre de usuario, arriba a la derecha → <b>Cambiar contraseña</b>.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className={btnSoft} onClick={later}>
            Más tarde
          </button>
          <button className={btnBrand} onClick={changeNow}>
            Cambiar contraseña ahora
          </button>
        </div>
      </Modal>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Cambiar contraseña">
        <form onSubmit={submit} className="flex flex-col gap-4" autoComplete="off">
          <p className="text-sm text-slate-600">Escribe tu contraseña actual y elige una nueva.</p>
          <div>
            <label htmlFor="pw-actual" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña actual
            </label>
            <input id="pw-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} className={input} required />
          </div>
          <div>
            <label htmlFor="pw-nueva" className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña nueva
            </label>
            <input id="pw-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={input} required minLength={8} />
            <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres. Debe ser distinta a la actual.</p>
          </div>
          <div>
            <label htmlFor="pw-conf" className="mb-1 block text-sm font-medium text-slate-700">
              Confirmar contraseña nueva
            </label>
            <input id="pw-conf" type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={input} required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSoft} onClick={() => setPwOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className={btnBrand} disabled={saving}>
              {saving ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </form>
      </Modal>
      {toastNode}
    </>
  );
}
