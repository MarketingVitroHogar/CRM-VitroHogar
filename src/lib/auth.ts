import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/username";
import { verifyPassword } from "@/lib/password";
import {
  LOCK_MINUTES,
  LOGIN_INACTIVE,
  LOGIN_LOCKED,
  LOGIN_REMAINING_PREFIX,
  MAX_FAILED_LOGINS,
  WARN_FROM_FAILED,
} from "@/lib/loginLimits";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: normalizeUsername(credentials.username) },
        });
        if (!user) return null; // mismo mensaje genérico que una contraseña incorrecta

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) throw new Error(LOGIN_LOCKED);

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) {
          // Conteo atómico de intentos fallidos seguidos.
          const updated = await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginCount: { increment: 1 } },
            select: { failedLoginCount: true },
          });
          if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) },
            });
            throw new Error(LOGIN_LOCKED);
          }
          if (updated.failedLoginCount >= WARN_FROM_FAILED) {
            throw new Error(`${LOGIN_REMAINING_PREFIX}${MAX_FAILED_LOGINS - updated.failedLoginCount}`);
          }
          return null;
        }

        // La cuenta desactivada solo se informa con la contraseña correcta
        // (así no se revela qué usuarios existen).
        if (!user.activo) throw new Error(LOGIN_INACTIVE);

        if (user.failedLoginCount > 0 || user.lockedUntil) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
        }

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          sucursal: user.sucursal,
          asesor: user.asesor,
          passwordChanged: !!user.passwordChangedAt,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Inicio de sesión: ya se validó en authorize().
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.sucursal = user.sucursal;
        token.asesor = user.asesor;
        token.passwordChanged = user.passwordChanged;
        return token;
      }
      // Sesión ya abierta: se revalida contra la base en cada lectura. Si la cuenta se
      // desactivó (o se eliminó), se lanza el error y la sesión deja de existir al instante
      // (las pantallas redirigen al login y las rutas de datos responden 401).
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { activo: true, role: true, sucursal: true, asesor: true, username: true, passwordChangedAt: true },
      });
      if (!current || !current.activo) throw new Error("SESSION_REVOKED");
      token.username = current.username;
      token.role = current.role;
      token.sucursal = current.sucursal;
      token.asesor = current.asesor;
      token.passwordChanged = !!current.passwordChangedAt;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.sucursal = token.sucursal;
      session.user.asesor = token.asesor;
      session.user.passwordChanged = token.passwordChanged;
      return session;
    },
  },
};
