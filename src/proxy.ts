import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-token";

// Fast, optimistic redirects only (reads the signed cookie, no database).
// Every protected page still calls requireRole() — that's the real check.
const AREAS: { prefix: string; roles: string[] }[] = [
  { prefix: "/dashboard", roles: ["customer"] },
  { prefix: "/driver-dashboard", roles: ["driver"] },
  { prefix: "/backoffice", roles: ["staff", "admin"] },
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/"));
  if (!area) return NextResponse.next();

  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    // Drivers log in from their own sign-up page, as in WordPress.
    const login = area.prefix === "/driver-dashboard" ? "/delivery-man-account-set-up" : "/user-account-creation";
    const url = new URL(login, request.url);
    url.searchParams.set("tab", "login");
    url.searchParams.set("redirect_to", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/driver-dashboard/:path*", "/backoffice/:path*"],
};
