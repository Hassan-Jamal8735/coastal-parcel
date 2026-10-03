import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readSession, type Role } from "./session";

/** Home page for each role — where login lands, and where a wrong-role visitor is sent. */
export function homeFor(role: Role) {
  if (role === "driver") return "/driver";
  if (role === "staff" || role === "admin") return "/backoffice";
  return "/dashboard";
}

/** The signed-in user (fresh from the database), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
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
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return user ?? null;
});

/**
 * Authorization check for pages and server actions — the real gate (proxy.ts
 * only does a fast optimistic redirect). Redirects to login when signed out,
 * and to the user's own area when signed in with the wrong role.
 */
export async function requireRole(...allowed: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
