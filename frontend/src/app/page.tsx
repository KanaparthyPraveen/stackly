import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Star,
  Sparkles,
  Terminal,
  Palette,
  Check,
} from "lucide-react";
import { Logo } from "@/components/stackly/logo";
import { Button } from "@/components/stackly/button";
import { Badge } from "@/components/stackly/badge";
import {
  GithubIcon,
  XIcon,
  DiscordIcon,
  LinkedinIcon,
} from "@/components/stackly/icons";

export const metadata: Metadata = {
  title: "Stackly — Your Developer Identity, in One Place",
  description:
    "A clean, playful, professional developer profile platform. Showcase your projects, GitHub repositories, links, and technical identity.",
};

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09070D] text-[#D8D1E0]">
      {/* Subtle purple atmospheric lighting system */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-midnight-glow"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[600px] -z-10 h-[600px] bg-violet-atmosphere"
      />

      {/* 1. Header Navigation */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[#FAF7FF] transition-opacity hover:opacity-90"
        >
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#7C3AED]/20 border border-[#B88CFF]/30 text-[#B88CFF]">
            <Logo className="h-4 w-auto text-[#FAF7FF]" />
          </div>
          <span className="font-display text-base tracking-tight">Stackly</span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/test-github"
            className="hidden text-xs font-medium text-[#9C92A8] transition-colors hover:text-[#FAF7FF] sm:inline-block"
          >
            GitHub Explorer
          </Link>
          <Link
            href="/ada"
            className="hidden text-xs font-medium text-[#9C92A8] transition-colors hover:text-[#FAF7FF] sm:inline-block"
          >
            Sample Profile
          </Link>
          <Link
            href="/login"
            className="font-mono text-xs text-[#9C92A8] transition-colors hover:text-[#FAF7FF]"
          >
            Sign in
          </Link>
          <Button size="sm" asChild>
            <Link href="/login">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-8 sm:pt-24 sm:pb-28">
        {/* Playful pill badge */}
        <Link
          href="/test-github"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#15101E]/80 px-3.5 py-1 text-xs text-[#B88CFF] backdrop-blur-md transition-all hover:border-[#B88CFF]/40 hover:bg-[#1E172B]"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#B88CFF]" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#FAF7FF]">
            Stackly Preview · Live GitHub Sync
          </span>
          <ArrowRight className="h-3 w-3 text-[#9C92A8] transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Expressive Headline */}
        <h1 className="mt-8 font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#FAF7FF] leading-[1.08] text-balance">
          Your developer identity,{" "}
          <span className="text-gradient-purple">in one place</span>.
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#B8AFC4] text-pretty">
          A clean, playful, and technical profile for developers. Showcase your
          repositories, live apps, links, and social connections — without the
          generic link-in-bio look.
        </p>

        {/* Hero CTAs */}
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/login">
              Create your profile
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            asChild
            className="w-full sm:w-auto"
          >
            <Link href="/test-github">Explore GitHub Live</Link>
          </Button>
        </div>

        {/* Interactive Hero Preview Teaser */}
        <div className="relative mt-16 w-full max-w-3xl">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[26px] bg-gradient-to-b from-[#7C3AED]/25 via-transparent to-transparent opacity-60 blur-xl"
          />
          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#15101E] p-6 sm:p-8 text-left shadow-2xl shadow-black/70">
            {/* Window bar */}
            <div className="flex items-center justify-between border-b border-white/6 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#FF5C70]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#F5B84B]/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#46D369]/70" />
                <span className="ml-2 font-mono text-xs text-[#9C92A8]">
                  stackly.dev/@ada
                </span>
              </div>
              <Badge variant="purple" className="text-[10px] font-mono">
                Live Portfolio
              </Badge>
            </div>

            {/* Profile Mock Content */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#B88CFF] font-mono text-lg font-bold text-white shadow-md">
                  AL
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-[#FAF7FF]">
                    Ada Lovelace
                  </h3>
                  <p className="font-mono text-xs text-[#B88CFF]">
                    Systems Architect & Open Source Hacker
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/ada">Inspect Profile →</Link>
                </Button>
              </div>
            </div>

            {/* Two Mock Projects */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-white/8 bg-[#191321] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-sm text-[#FAF7FF]">
                    analytical-engine
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs text-[#F5B84B]">
                    <Star className="h-3 w-3 fill-[#F5B84B]" />
                    <span>1.4k</span>
                  </div>
                </div>
                <p className="text-xs text-[#9C92A8] line-clamp-2">
                  First mechanical general-purpose computing program with
                  symbolic computation.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="rounded-full bg-[#15101E] px-2 py-0.5 font-mono text-[10px] text-[#B88CFF] border border-white/6">
                    Rust
                  </span>
                  <span className="rounded-full bg-[#15101E] px-2 py-0.5 font-mono text-[10px] text-[#9C92A8] border border-white/6">
                    WebAssembly
                  </span>
                </div>
              </div>

              <div className="rounded-[14px] border border-white/8 bg-[#191321] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-sm text-[#FAF7FF]">
                    bernoulli-numbers
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs text-[#F5B84B]">
                    <Star className="h-3 w-3 fill-[#F5B84B]" />
                    <span>892</span>
                  </div>
                </div>
                <p className="text-xs text-[#9C92A8] line-clamp-2">
                  High-performance arbitrary precision algorithm implementation.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="rounded-full bg-[#15101E] px-2 py-0.5 font-mono text-[10px] text-[#B88CFF] border border-white/6">
                    TypeScript
                  </span>
                  <span className="rounded-full bg-[#15101E] px-2 py-0.5 font-mono text-[10px] text-[#46D369] border border-white/6">
                    Live Demo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Section 1: Asymmetric Split Screen (Anti-AI-slop narrative) */}
      <section className="border-t border-white/6 bg-[#0F0B16]/60 py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="purple" className="font-mono text-xs">
                Built For Developers
              </Badge>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#FAF7FF] leading-tight">
                Not another link tree. A real engineering portfolio.
              </h2>
              <p className="text-base text-[#B8AFC4] leading-relaxed">
                Generic link organizers flatten everything into repetitive
                rounded buttons. Stackly parses repository metadata, star
                counts, primary languages, commit activity, and live deployments
                into a coherent visual footprint.
              </p>
              <ul className="space-y-3 font-mono text-xs text-[#FAF7FF]">
                <li className="flex items-center gap-3">
                  <div className="grid h-5 w-5 place-items-center rounded-full bg-[#7C3AED]/20 text-[#B88CFF]">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>
                    Instant GitHub sync with real-time star and repo breakdown
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="grid h-5 w-5 place-items-center rounded-full bg-[#7C3AED]/20 text-[#B88CFF]">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>
                    Midnight purple dark surfaces calibrated for OLED &
                    high-contrast
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="grid h-5 w-5 place-items-center rounded-full bg-[#7C3AED]/20 text-[#B88CFF]">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>
                    Customizable themes without compromising developer cred
                  </span>
                </li>
              </ul>
            </div>

            {/* Right: Technical Terminal / Code Preview */}
            <div className="rounded-[20px] border border-white/10 bg-[#15101E] p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/6 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono text-[#9C92A8]">
                  <Terminal className="h-3.5 w-3.5 text-[#B88CFF]" />
                  <span>api/v1/github-test/profile</span>
                </div>
                <span className="font-mono text-[10px] text-[#46D369]">
                  200 OK
                </span>
              </div>
              <pre className="mt-4 overflow-x-auto font-mono text-xs text-[#D8D1E0] leading-relaxed">
                <code>{`{
  "username": "ada",
  "identity": "Ada Lovelace",
  "status": "live",
  "ecosystem": {
    "github": "https://github.com/ada",
    "verified": true,
    "stars": 2292,
    "top_languages": ["Rust", "TypeScript"]
  },
  "theme": "midnight-purple",
  "domain": "stackly.dev/@ada"
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section 2: Varied Bento Grid (Mixed span, no 3 identical cards) */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#FAF7FF] tracking-tight">
              Crafted for your entire developer footprint
            </h2>
            <p className="text-sm text-[#9C92A8]">
              From hobby experiments to enterprise projects — show what you
              actually build.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tile 1: Double Width Hero Tile */}
            <div className="md:col-span-2 rounded-[22px] border border-white/8 bg-[#191321] p-7 sm:p-8 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#7C3AED]/20 text-[#B88CFF] border border-[#B88CFF]/30">
                  <GitBranch className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl font-bold text-[#FAF7FF]">
                  Live GitHub Repository Sync
                </h3>
                <p className="text-sm text-[#B8AFC4] leading-relaxed max-w-xl">
                  Connect your GitHub handle with zero complex OAuth rituals.
                  Stackly pulls your pinned repositories, tech stack badges, and
                  fork status directly.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5">
                <Badge variant="purple">Public API</Badge>
                <Badge variant="outline">Rate-limit Aware</Badge>
                <Badge variant="outline">Multi-Language Detection</Badge>
                <Badge variant="outline">Stars & Forks</Badge>
              </div>
            </div>

            {/* Tile 2: Single Width Aesthetics Tile */}
            <div className="rounded-[22px] border border-white/8 bg-[#191321] p-7 sm:p-8 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#9B6DFF]/20 text-[#B88CFF] border border-[#B88CFF]/30">
                  <Palette className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-[#FAF7FF]">
                  Custom Themes
                </h3>
                <p className="text-sm text-[#9C92A8] leading-relaxed">
                  Tailor buttons, card styles, and atmospheric lighting while
                  keeping the layout solid.
                </p>
              </div>
              <div className="mt-6 font-mono text-xs text-[#B88CFF]">
                Solid · Gradient · Aurora
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Section 3: Call to Action Banner */}
      <section className="relative mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <div className="relative overflow-hidden rounded-[26px] border border-[#B88CFF]/20 bg-gradient-to-b from-[#1F172E] to-[#15101E] p-8 sm:p-14 text-center shadow-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-midnight-glow opacity-70"
          />
          <div className="relative z-10 mx-auto max-w-xl space-y-5">
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#FAF7FF]">
              Claim your developer handle.
            </h2>
            <p className="text-sm sm:text-base text-[#B8AFC4] leading-relaxed">
              Join developers building their personal identity on Stackly today.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/login">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="w-full sm:w-auto"
              >
                <Link href="/test-github">Test GitHub Integration</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-white/6 bg-[#09070D] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-auto text-[#FAF7FF]" />
            <span className="font-display font-semibold text-sm text-[#FAF7FF]">
              Stackly
            </span>
            <span className="font-mono text-xs text-[#81778D]">
              · Developer Identity
            </span>
          </div>

          <ul
            aria-label="Community links"
            className="flex flex-wrap items-center gap-5 font-mono text-xs text-[#9C92A8]"
          >
            <li>
              <a
                href="https://github.com/stackryze"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                GitHub
              </a>
            </li>
            <li className="text-white/20">·</li>
            <li>
              <a
                href="https://discord.gg/wr7s97cfM7"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
              >
                <DiscordIcon className="h-3.5 w-3.5" />
                Discord
              </a>
            </li>
            <li className="text-white/20">·</li>
            <li>
              <a
                href="https://x.com/stackryze"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
              >
                <XIcon className="h-3.5 w-3.5" />X
              </a>
            </li>
            <li className="text-white/20">·</li>
            <li>
              <a
                href="https://linkedin.com/company/stackly"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
              >
                <LinkedinIcon className="h-3.5 w-3.5" />
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </main>
  );
}
