// Leads de EJEMPLO para el preview local (solo corre contra una base local de prueba).
require("dotenv").config({ path: ".env.local" });
const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("ABORTADO: DATABASE_URL no es una base local.");
  process.exit(1);
}
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

let seed = 4242;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const NOM = ["María", "José", "Ana", "Luis", "Carmen", "Jorge", "Patricia", "Ricardo", "Verónica", "Fernando", "Gabriela", "Alejandro", "Lucía", "Roberto", "Elena", "Mauricio", "Paola", "Iván", "Claudia", "Héctor"];
const APE = ["López", "Ruiz", "Estrada", "Salas", "Núñez", "Soto", "Ibarra", "Delgado", "Medina", "Orozco", "Salazar", "Castañeda", "Ortiz", "Prieto", "Camacho", "Quintero"];
const INT = ["Porcelanato 60x60 sala", "Piso laminado recámaras", "Muebles de baño", "Azulejo cocina", "Piso vinílico local", "Porcelanato exterior", "Recubrimiento baño completo", "Piso madera ingeniería", "Mosaico cocina", "Regadera y mezcladoras"];
const FUENTES = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "WHATSAPP", "SITIO_WEB", "REFERIDO", "OTRO"];
const SUCS = [["BLVD_ZACATECAS", 22], ["HACIENDAS", 8], ["UNIVERSIDAD", 6], ["AYUNTAMIENTO", 6], ["GUADALUPE", 5], ["PASEO_DE_LA_CRUZ", 5], ["COLON", 5], ["TLI", 5], ["GONZALEZ_GALLO", 4]];
const ESTADOS = [["NUEVO", 9], ["CONTACTADO", 14], ["COTIZACION", 14], ["SEGUIMIENTO", 9], ["NO_RESPONDIO", 5], ["VENTA", 12], ["PERDIDO", 8]];
const ASESORES = { BLVD_ZACATECAS: ["Genaro Samuel Alvarado Melesio", "Yuridia Marlenne Moreno Cruz", "Raul Esparza Gonzalez"], HACIENDAS: ["Saray Salgado", "Miguel Torres"], COLON: [] };
const wp = (items) => { let r = rnd() * items.reduce((s, x) => s + x[1], 0); for (const [k, w] of items) if ((r -= w) <= 0) return k; return items[0][0]; };

const DAY = 864e5, HOUR = 36e5;
const now = Date.now();
const mexToday = () => { const s = new Date(now - 6 * HOUR); return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()); };

(async () => {
  await prisma.lead.deleteMany();
  const rows = [];
  const mk = (o) => {
    const daysAgo = o.daysAgo ?? Math.floor(rnd() * 24);
    const estado = o.estado ?? wp(ESTADOS);
    const sucursal = o.sucursal ?? wp(SUCS);
    const fecha = new Date(mexToday() - daysAgo * DAY);
    const createdAt = o.hoursOld != null ? new Date(now - o.hoursOld * HOUR) : new Date(fecha.getTime() + 18 * HOUR);
    const cerrado = estado === "VENTA" || estado === "PERDIDO";
    const ases = ASESORES[sucursal] ?? [];
    rows.push({
      fecha, createdAt,
      nombre: o.nombre ?? `${pick(NOM)} ${pick(APE)} ${pick(APE)}`,
      telefono: `492 ${100 + Math.floor(rnd() * 899)} ${1000 + Math.floor(rnd() * 8999)}`,
      sucursal, interes: o.interes ?? pick(INT), fuente: o.fuente ?? pick(FUENTES), estado,
      responsable: `Gerente ${sucursal === "BLVD_ZACATECAS" ? "Blvd. Zacatecas" : sucursal}`,
      asesor: o.asesor !== undefined ? o.asesor : ases.length && rnd() < 0.8 ? pick(ases) : null,
      proximoSeguimiento: ["NUEVO", "VENTA", "PERDIDO"].includes(estado) ? null : new Date(mexToday() + Math.round(rnd() * 6 - 2) * DAY),
      notas: "", folioCotizacion: estado === "COTIZACION" ? `COT-${2200 + rows.length}` : null,
      folioFactura: estado === "VENTA" ? `FAC-${8800 + rows.length}` : null,
      montoVenta: estado === "VENTA" ? String(Math.round((3000 + rnd() * 30000) / 50) * 50) : null,
      fechaCierre: cerrado ? new Date(Math.min(mexToday(), fecha.getTime() + 3 * DAY)) : null,
    });
  };
  for (let i = 0; i < 110; i++) mk({});
  // Casos para ver avisos: nuevos sin atender (algunos de más de 24 h)
  mk({ sucursal: "COLON", estado: "NUEVO", daysAgo: 0, hoursOld: 2, nombre: "Valeria Cortés Haro", interes: "Piso vinílico para oficina", fuente: "FACEBOOK" });
  mk({ sucursal: "COLON", estado: "NUEVO", daysAgo: 2, hoursOld: 52, nombre: "Ismael Duarte Vega", interes: "Azulejo para cocina", fuente: "WHATSAPP" });
  mk({ sucursal: "BLVD_ZACATECAS", estado: "NUEVO", daysAgo: 1, hoursOld: 30, nombre: "Karen Solís Duarte", interes: "Muebles de baño", fuente: "INSTAGRAM", asesor: null });
  mk({ sucursal: "BLVD_ZACATECAS", estado: "NUEVO", daysAgo: 0, hoursOld: 3, nombre: "Rodrigo Aguilar Mena", interes: "Porcelanato 60x60", fuente: "FACEBOOK", asesor: null });
  await prisma.lead.createMany({ data: rows });
  console.log("Leads de ejemplo:", rows.length);
  await prisma.$disconnect();
})();
