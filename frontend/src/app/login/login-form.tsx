"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { Logo } from "@/components/stackly/logo";
import { GithubIcon } from "@/components/stackly/icons";
import { Button } from "@/components/stackly/button";
import { StatusDot } from "@/components/stackly/status-dot";
import { Input, Field } from "@/components/stackly/input";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled. You can try again whenever you like.",
  oauth_state_invalid:
    "The sign-in request expired or could not be verified. Please try again.",
  oauth_exchange_failed:
    "We couldn't complete the handshake with the provider. Please try again.",
  oauth_api_failed:
    "We couldn't read your profile from the provider. Please try again.",
  oauth_not_configured:
    "That sign-in method isn't configured on this server yet.",
  oauth_missing_code: "The provider didn't send an authorization code.",
  oauth_unknown_provider: "That sign-in method doesn't exist.",
};

type Provider = { name: string; label: string; configured: boolean };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [providers, setProviders] = React.useState<Provider[]>([]);

  // Surface any error the OAuth callback redirected back with. The value is
  // derived during render rather than stored in state.
  const oauthErrorCode = searchParams.get("error");
  const oauthErrorMessage = oauthErrorCode
    ? (OAUTH_ERROR_MESSAGES[oauthErrorCode] ??
      "Sign-in could not be completed.")
    : null;

  // Ask the backend which OAuth providers are actually configured.
  React.useEffect(() => {
    let mounted = true;
    api
      .getOAuthProviders()
      .then((res) => {
        if (mounted) setProviders(res.providers ?? []);
      })
      .catch(() => {
        if (mounted) setProviders([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const startOAuth = (provider: string) => {
    setStatus("loading");
    setErrorMessage(null);
    window.location.assign(api.oauthLoginUrl(provider));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      if (mode === "signup") {
        await register(email.trim(), password);
        router.push("/claim-username");
        return;
      }

      await login(email.trim(), password);
      try {
        const myProfile = await api.getMyProfile();
        if (
          !myProfile ||
          !myProfile.usernameClaimed ||
          myProfile.username.startsWith("user_")
        ) {
          router.push("/claim-username");
          return;
        }
      } catch {
        router.push("/claim-username");
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn't sign you in. Please try again.",
      );
    }
  };

  const configured = providers.filter((p) => p.configured);

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-16 bg-[#09070D] text-[#D8D1E0]">
      {/* Subtle purple atmospheric lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-midnight-glow"
      />

      <div className="w-full max-w-md space-y-7">
        <header className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[#FAF7FF]">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#7C3AED]/20 border border-[#B88CFF]/30 text-[#B88CFF]">
              <Logo className="h-4.5 w-auto text-[#FAF7FF]" />
            </div>
            <span className="font-display text-lg tracking-tight">Stackly</span>
          </div>

          <div className="mt-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[#15101E] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#B88CFF]">
              <StatusDot variant="pulse" intent="purple" />
              Developer Preview
            </span>
          </div>

          <h1 className="mt-4 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#FAF7FF] text-balance">
            Welcome to <span className="text-gradient-purple">Stackly</span>
          </h1>
          <p className="mt-2.5 max-w-sm text-sm text-[#B8AFC4] text-pretty leading-relaxed">
            Your developer identity, in one place. One link to your projects,
            repositories, and the work you actually ship.
          </p>
        </header>

        {(errorMessage || oauthErrorMessage) && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[12px] border border-[#FF5C70]/30 bg-[#FF5C70]/10 p-3.5 text-sm text-[#FF5C70]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{errorMessage ?? oauthErrorMessage}</span>
          </div>
        )}

        <div className="rounded-[20px] border border-white/8 bg-[#15101E] p-6 sm:p-7 shadow-2xl shadow-black/40">
          {configured.length > 0 && (
            <>
              <div className="space-y-2.5">
                {configured.map((provider) => (
                  <Button
                    key={provider.name}
                    type="button"
                    onClick={() => startOAuth(provider.name)}
                    disabled={status === "loading"}
                    size="lg"
                    className="w-full"
                  >
                    {status === "loading" ? (
                      <Loader2
                        className="h-4 w-4 animate-spin-slow"
                        aria-hidden
                      />
                    ) : provider.name === "github" ? (
                      <GithubIcon className="h-4 w-4" aria-hidden />
                    ) : (
                      <span aria-hidden className="font-display text-sm">
                        G
                      </span>
                    )}
                    Continue with {provider.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                ))}
              </div>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/8" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#81778D]">
                  or
                </span>
                <span className="h-px flex-1 bg-white/8" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={mode === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "••••••••"
                }
              />
            </Field>

            <Button
              type="submit"
              disabled={status === "loading"}
              size="lg"
              className="w-full"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden />
                  Working…
                </>
              ) : mode === "signup" ? (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setErrorMessage(null);
              setStatus("idle");
            }}
            className="mt-4 w-full text-center font-mono text-[11px] uppercase tracking-wider text-[#9C92A8] underline-offset-4 transition-colors hover:text-[#FAF7FF] hover:underline"
          >
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <footer className="text-center text-xs text-[#9C92A8]">
          <a
            href="https://github.com/stackryze"
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono transition-colors hover:text-[#FAF7FF]"
          >
            Open source on GitHub →
          </a>
        </footer>
      </div>
    </main>
  );
}
