export { default as proxy } from "next-auth/middleware";

export const config = {
  matcher: [
    "/leads/:path*",
    "/reports/:path*",
    "/import/:path*",
    "/api/leads/:path*",
    "/api/reports/:path*",
    "/api/import/:path*",
  ],
};
