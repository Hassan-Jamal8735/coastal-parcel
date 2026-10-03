/**
 * Creates (or resets the password of) a staff/admin account — these can't
 * sign up through the website.
 *
 * Usage: npx tsx scripts/create-user.ts <email> <password> <role: admin|staff> "<Full Name>"
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const [email, password, role = "admin", name = "Administrator"] = process.argv.slice(2);
  if (!email || !password || !["admin", "staff"].includes(role)) {
    console.error('Usage: npx tsx scripts/create-user.ts <email> <password> <admin|staff> "<Full Name>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const bcrypt = (await import("bcryptjs")).default;
  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash, name, role: role as "admin" | "staff", emailVerifiedAt: new Date() })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, role: role as "admin" | "staff", name, emailVerifiedAt: new Date() } });

  console.log(`${role} account ready: ${email}`);
  process.exit(0);
}

main();
