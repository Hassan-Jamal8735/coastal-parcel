import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

/** Unread inbox count for the Back Office badge (admin only). */
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const [row] = await db
    .select({ n: count() })
    .from(mailMessages)
    .where(and(eq(mailMessages.direction, "in"), isNull(mailMessages.readAt), isNull(mailMessages.trashedAt)));
  return Response.json({ unread: row.n }, { headers: { "Cache-Control": "no-store" } });
}
