import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="theme-dark flex min-h-[80svh] items-end bg-ink pb-20 pt-40 text-paper">
      <div className="container-site">
        <p className="meta text-ash">404</p>
        <h1 className="font-display mt-6 text-section">This room isn&rsquo;t built yet.</h1>
        <p className="mt-6 max-w-md text-ash">The page you were looking for does not exist or has moved.</p>
        <Link href="/" className={`${buttonClass.solid} mt-10`}>
          Back to the house
        </Link>
      </div>
    </section>
  );
}
