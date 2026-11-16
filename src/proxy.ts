export { default as proxy } from "next-auth/middleware";

export const config = {
  matcher: [
    "/inicio/:path*",
    "/leads/:path*",
    "/reports/:path*",
    "/import/:path*",
    "/users/:path*",
    "/api/leads/:path*",
    "/api/reports/:path*",
    "/api/import/:path*",
    "/api/users/:path*",
    "/api/account/:path*",
    "/api/avisos/:path*",
  ],
};
