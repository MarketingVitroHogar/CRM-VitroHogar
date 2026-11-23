"use client";

import { useState } from "react";
import clsx from "clsx";

/**
 * Campo de contraseña con "ojito" para ver lo que se escribe y aviso cuando está activado Bloq Mayús
 * (una causa común de contraseñas incorrectas y cuentas bloqueadas).
 */
export function PasswordInput({ className, onKeyDown, onKeyUp, onBlur, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [ver, setVer] = useState(false);
  const [mayus, setMayus] = useState(false);
  const detectar = (e: React.KeyboardEvent<HTMLInputElement>) => setMayus(e.getModifierState("CapsLock"));
  return (
    <div>
      <div className="relative">
        <input
          {...props}
          type={ver ? "text" : "password"}
          className={clsx(className, "pr-11")}
          onKeyDown={(e) => {
            detectar(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            detectar(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setMayus(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          onMouseDown={(e) => e.preventDefault()} // no le quita el cursor al campo
          aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={ver}
          title={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-slate-500 hover:text-slate-800"
        >
          {ver ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17.94 17.94A10.4 10.4 0 0 1 12 20c-6.5 0-10-8-10-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <path d="M1 1l22 22" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {mayus && (
        <p role="status" className="mt-1 text-xs font-medium text-amber-700">
          ⚠ Bloq Mayús está activado
        </p>
      )}
    </div>
  );
}
