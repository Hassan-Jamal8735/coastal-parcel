import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readSession, type Role } from "./session";

/** Home page for each role — where login lands, and where a wrong-role visitor is sent. */
export function homeFor(role: Role) {
  if (role === "driver") return "/driver-dashboard";
  if (role === "staff" || role === "admin") return "/backoffice";
  return "/dashboard";
}

/**
 * The account behind the session cookie (fresh from the database), verified
 * or not. Only /verify-email should need this — everything else uses
 * getCurrentUser(). Cached per request.
 */
export const getSessionUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      role: users.role,
      vehicleType: users.vehicleType,
      driverStatus: users.driverStatus,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return user ?? null;
});

/**
 * The signed-in user, or null. An account that hasn't verified its email yet
 * counts as signed out, so it can't use anything until the code is entered.
 */
export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();
  return user?.emailVerifiedAt ? user : null;
});

/**
 * Authorization check for pages and server actions — the real gate (proxy.ts
 * only does a fast optimistic redirect). Redirects to login when signed out,
 * to email verification when unverified, and to the user's own area when
 * signed in with the wrong role.
 */
export async function requireRole(...allowed: Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/user-account-creation?tab=login");
  if (!user.emailVerifiedAt) redirect("/verify-email");
  if (!allowed.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
