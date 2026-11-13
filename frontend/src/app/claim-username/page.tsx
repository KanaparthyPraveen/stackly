"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/stackly/logo";
import { Button } from "@/components/stackly/button";
import { Input, Field } from "@/components/stackly/input";
import { useAuth } from "@/context/auth-context";
import { api, type ProfileData } from "@/lib/api";

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

export default function ClaimUsernamePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = React.useState<ProfileData | null>(null);

  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [availability, setAvailability] = React.useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Initialize display name from user profile
  React.useEffect(() => {
    let mounted = true;
    if (user) {
      api
        .getMyProfile()
        .then((p) => {
          if (!mounted) return;
          setProfile(p);
          if (p) {
            if (p.displayName) setDisplayName(p.displayName);
            if (
              p.username &&
              !p.username.startsWith("user_") &&
              p.usernameClaimed
            ) {
              setUsername(p.username);
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [user]);

  // Redirect if not signed in once auth is resolved
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Debounced username availability check
  React.useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/\s+/g, "-");
    const timer = setTimeout(async () => {
      if (!clean || clean.length < 3) {
        setAvailability(null);
        setChecking(false);
        return;
      }

      if (!USERNAME_REGEX.test(clean)) {
        setAvailability({
          available: false,
          reason:
            "Must be 3–30 chars with only lowercase letters, numbers, -, or _",
        });
        setChecking(false);
        return;
      }

      // If it's already the user's current username
      if (profile?.username === clean && profile?.usernameClaimed) {
        setAvailability({ available: true });
        setChecking(false);
        return;
      }

      setChecking(true);
      try {
        const res = await api.checkUsernameAvailability(clean);
        setAvailability(res);
      } catch {
        setAvailability(null);
      } finally {
        setChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, profile]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) {
      setErrorMsg("Please enter a username.");
      return;
    }
    if (!USERNAME_REGEX.test(clean)) {
      setErrorMsg(
        "Username must be 3–30 characters using lowercase letters, numbers, hyphens, or underscores.",
      );
      return;
    }
    if (availability && !availability.available) {
      setErrorMsg(availability.reason || "This username is not available.");
      return;
    }

    setStatus("saving");
    setErrorMsg(null);
    try {
      await api.claimUsername({
        username: clean,
        displayName: displayName.trim() || undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Couldn't claim this username. Please try again.",
      );
    }
  };

  const cleanCandidate = username.trim().toLowerCase().replace(/\s+/g, "-");

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#09070D] text-[#9C92A8]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B88CFF]" />
      </main>
    );
  }

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-16 bg-[#09070D] text-[#D8D1E0]">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[420px] w-[640px] rounded-full bg-[#7C3AED]/12 blur-[140px]" />
        <div className="absolute top-1/3 left-1/3 h-[300px] w-[300px] rounded-full bg-[#B88CFF]/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[440px] space-y-6">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block" aria-label="Stackly home">
            <Logo className="h-8 w-8 text-[#FAF7FF] mx-auto" />
          </Link>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#B88CFF]/20 bg-[#7C3AED]/10 px-3 py-1 text-xs font-medium text-[#B88CFF]">
            <Sparkles className="h-3 w-3" />
            <span>Welcome to Stackly</span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-[#FAF7FF] sm:text-3xl">
            Claim your username
          </h1>
          <p className="mt-2 text-sm text-[#9C92A8] text-balance">
            Your username determines your public portfolio address and page
            route.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[20px] border border-white/8 bg-[#15101E]/80 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          <form onSubmit={handleClaim} className="space-y-5" noValidate>
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[12px] border border-[#FF5C70]/30 bg-[#FF5C70]/10 p-3.5 text-sm text-[#FF5C70]"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{errorMsg}</span>
              </div>
            )}

            <Field
              label="Username"
              htmlFor="claim-username"
              hint="3–30 lowercase letters, numbers, '-' or '_'"
            >
              <div className="space-y-1.5">
                <div className="relative flex items-center rounded-[12px] border border-white/10 bg-[#0D0A12] focus-within:border-[#B88CFF]/60 focus-within:ring-1 focus-within:ring-[#B88CFF]/30 transition-all">
                  <span className="pl-3.5 pr-1 font-mono text-xs text-[#9C92A8] select-none">
                    stackly.app/@
                  </span>
                  <input
                    id="claim-username"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="yourhandle"
                    required
                    className="h-10 w-full bg-transparent pr-9 text-sm text-[#FAF7FF] placeholder:text-[#5E5568] focus:outline-none"
                  />
                  <div className="absolute right-3">
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#9C92A8]" />
                    ) : availability ? (
                      availability.available ? (
                        <CheckCircle2 className="h-4 w-4 text-[#46D369]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[#FF5C70]" />
                      )
                    ) : null}
                  </div>
                </div>

                {/* Live validation feedback */}
                {availability && !checking && (
                  <div
                    className={`text-xs font-mono flex items-center gap-1.5 ${
                      availability.available
                        ? "text-[#46D369]"
                        : "text-[#FF5C70]"
                    }`}
                  >
                    <span>
                      {availability.available
                        ? `✓ @${cleanCandidate} is available!`
                        : availability.reason || "Username is unavailable."}
                    </span>
                  </div>
                )}
              </div>
            </Field>

            <Field
              label="Display Name (optional)"
              htmlFor="claim-display-name"
              hint="The name shown on your public page"
            >
              <Input
                id="claim-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </Field>

            {/* Live Route Preview Pill */}
            {cleanCandidate.length >= 3 && (
              <div className="rounded-[12px] border border-white/6 bg-white/[0.03] p-3 text-center">
                <span className="text-[11px] font-mono text-[#9C92A8]">
                  Your linkcard will live at:
                </span>
                <div className="mt-0.5 font-mono text-xs font-semibold text-[#B88CFF] truncate">
                  stackly.app/{cleanCandidate}
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full justify-center gap-2"
              disabled={
                status === "saving" ||
                checking ||
                cleanCandidate.length < 3 ||
                (availability !== null && !availability.available)
              }
            >
              {status === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming username…
                </>
              ) : (
                <>
                  Claim & Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-[#9C92A8] hover:text-[#FAF7FF] transition-colors"
            >
              Skip for now & customize later →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
