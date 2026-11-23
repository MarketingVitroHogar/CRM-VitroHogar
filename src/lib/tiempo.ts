import { mexicoTodayAsUTCDate } from "@/lib/dateOnly";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Cuánto hace que ingresó un lead, en palabras: "hace 25 min", "hace 3 h", "ayer", "hace 5 días", "hace 2 semanas", "hace 3 meses".
 * Los leads de hoy se cuentan por la hora en que se cargaron (createdAt); los demás por su fecha de ingreso (día calendario de México),
 * que es la que ve la gente en el CRM.
 */
export function haceTiempo(fecha: string, createdAt: string, ahora: Date = new Date()): string {
  const dias = Math.round((mexicoTodayAsUTCDate(ahora).getTime() - new Date(fecha).getTime()) / 86_400_000);
  if (dias <= 0) {
    const min = Math.floor((ahora.getTime() - new Date(createdAt).getTime()) / 60_000);
    if (min < 0 || min >= 24 * 60) return "hoy";
    if (min < 2) return "justo ahora";
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.floor(min / 60)} h`;
  }
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 30) return `hace ${plural(Math.floor(dias / 7), "semana", "semanas")}`;
  return `hace ${plural(Math.floor(dias / 30), "mes", "meses")}`;
}
