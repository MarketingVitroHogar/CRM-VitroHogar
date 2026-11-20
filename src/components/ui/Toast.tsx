"use client";

import { useCallback, useRef, useState } from "react";

/** Aviso breve en la parte baja de la pantalla. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  const node = msg ? (
    <div role="status" className="fixed bottom-5 left-1/2 z-[60] max-w-[92vw] -translate-x-1/2 rounded-lg bg-[#1e293b] px-4 py-2.5 text-sm text-white shadow-lg ring-1 ring-white/20">
      {msg}
    </div>
  ) : null;
  return { toast: show, toastNode: node };
}
