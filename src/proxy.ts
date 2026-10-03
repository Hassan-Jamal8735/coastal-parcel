import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-token";

// Fast, optimistic redirects only (reads the signed cookie, no database).
// Every protected page still calls requireRole() — that's the real check.
const AREAS: { prefix: string; roles: string[] }[] = [
  { prefix: "/dashboard", roles: ["customer"] },
  { prefix: "/driver", roles: ["driver"] },
  { prefix: "/backoffice", roles: ["staff", "admin"] },
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = AREAS.find((a) => pathname === a.prefix || pathname.startsWith(a.prefix + "/"));
  if (!area || pathname.startsWith("/driver/signup")) return NextResponse.next();

  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/driver/:path*", "/backoffice/:path*"],
};
