import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

// bcrypt solo considera los primeros 72 bytes: se limita para que no haya sorpresas.
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(72, "La contraseña nueva es demasiado larga (máximo 72 caracteres)");

/** Las contraseñas SIEMPRE se guardan cifradas (bcrypt), nunca en texto. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const TEMP_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/l/I

/** Contraseña temporal aleatoria de 12 caracteres (criptográficamente segura). */
export function generateTempPassword(): string {
  let out = "";
  for (let i = 0; i < 12; i++) out += TEMP_CHARS[randomInt(TEMP_CHARS.length)];
  return out;
}
