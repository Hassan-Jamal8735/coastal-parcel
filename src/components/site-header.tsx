import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser, homeFor } from "@/lib/dal";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-[1500] bg-night text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <Link href="/" className="shrink-0">
          <Image src="/img/logo-white.svg" alt="Coastal Parcel" width={190} height={40} priority className="h-10 w-auto" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
          <Link href="/about" className="hover:text-brand">About</Link>
          <Link href="/services" className="hover:text-brand">Services</Link>
          <Link href="/contact" className="hover:text-brand">Contact</Link>
          <Link href="/ship-now" className="hover:text-brand">Get a Quote</Link>
          <Link href="/track" className="hover:text-brand">Track</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm font-bold">
          {user ? (
            <>
              <Link href={homeFor(user.role)} className="hover:text-brand">My Account</Link>
              <form action={logout}>
                <button className="rounded-md border border-white/40 px-4 py-2 hover:border-white">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-brand">Log in</Link>
              <Link href="/signup" className="rounded-md bg-brand px-4 py-2 text-ink hover:bg-brand-dark">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
