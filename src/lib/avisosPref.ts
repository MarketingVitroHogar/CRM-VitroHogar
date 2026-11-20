/**
 * Preferencias de los avisos de la campana (por persona, en su navegador):
 *  - notif: aviso del sistema (notificación del navegador) cuando llega un lead y la pestaña no está a la vista.
 *  - sonido: un tono corto cuando llega un lead.
 * Los avisos solo funcionan mientras el CRM esté abierto en alguna pestaña (no son notificaciones "push").
 */
export type AvisosPref = { notif: boolean; sonido: boolean };
export type PermisoNotif = "granted" | "denied" | "default" | "unsupported";

const prefKey = (username: string) => `crm:avisos-pref:${username}`;

export function leerPref(username: string): AvisosPref {
  try {
    const p = JSON.parse(localStorage.getItem(prefKey(username)) ?? "null");
    return { notif: !!p?.notif, sonido: !!p?.sonido };
  } catch {
    return { notif: false, sonido: false };
  }
}

export function guardarPref(username: string, p: AvisosPref) {
  try {
    localStorage.setItem(prefKey(username), JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

export function permisoNotif(): PermisoNotif {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermisoNotif;
}

/** Pide permiso al navegador (debe llamarse desde un clic de la persona). */
export async function pedirPermiso(): Promise<PermisoNotif> {
  if (!("Notification" in window)) return "unsupported";
  try {
    return (await Notification.requestPermission()) as PermisoNotif;
  } catch {
    return permisoNotif();
  }
}

let ctx: AudioContext | null = null;

/** Dos tonos cortos. La primera vez se llama desde un clic (al activar el sonido) para que el navegador lo permita. */
export function sonar() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      const t = t0 + i * 0.18;
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.18);
    });
  } catch {
    /* sin audio: no pasa nada */
  }
}

/** Notificación del sistema. Solo si ya dio permiso y la pestaña no está a la vista (si la está viendo, basta el aviso en pantalla). */
export function notificar(titulo: string, cuerpo: string) {
  try {
    if (permisoNotif() !== "granted") return;
    if (!document.hidden && document.hasFocus()) return;
    const n = new Notification(titulo, { body: cuerpo, tag: "crm-avisos", icon: "/icon.png" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* algunos navegadores solo permiten notificaciones desde un service worker */
  }
}
