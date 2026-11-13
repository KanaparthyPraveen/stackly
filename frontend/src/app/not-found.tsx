import Link from "next/link";
import { Button } from "@/components/stackly/button";
import { Logo } from "@/components/stackly/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <Logo className="h-6 w-auto" />
          <span>Stackly</span>
        </div>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          404 · not found
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-balance">
          That route doesn&apos;t exist.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Try the homepage, or visit your dashboard.
        </p>
        <div className="mt-8 flex items-center gap-2">
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
