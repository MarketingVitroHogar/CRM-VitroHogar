import { Role, Sucursal } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      sucursal: Sucursal | null;
    };
  }

  interface User {
    id: string;
    username: string;
    role: Role;
    sucursal: Sucursal | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    sucursal: Sucursal | null;
  }
}
