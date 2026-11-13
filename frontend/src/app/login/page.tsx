import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Stackly.",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#09070D] text-[#9C92A8]">
          <span className="font-mono text-xs uppercase tracking-widest">
            Loading sign-in…
          </span>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
