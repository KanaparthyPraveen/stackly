import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  ExternalLink,
  MapPin,
  Globe,
  MessageCircle,
  Download,
  Mail,
  Star,
} from "lucide-react";
import { GithubIcon, XIcon, LinkedinIcon } from "@/components/stackly/icons";
import { ProfileAvatar } from "@/components/stackly/profile-avatar";
import { cn } from "@/lib/utils";
import {
  normalizeAppearance,
  resolveAccent,
  resolveButton,
  resolveCanvas,
  resolvePageBackground,
  resolveSurface,
  resolveTypography,
  type AppearanceConfig,
} from "@/lib/appearance";
import {
  api,
  type ComponentItem,
  type IntegrationItem,
  type LinkItem,
  type ProjectItem,
} from "@/lib/api";

type Params = { username: string };

type PublicProfile = {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  social?: Record<string, string | undefined>;
  live: boolean;
  appearance: AppearanceConfig;
};

async function loadProfile(username: string, cookie?: string) {
  try {
    return await api.getPublicProfile(username, cookie);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const headerList = await headers();
  const cookie = headerList.get("cookie") ?? undefined;
  const profile = await loadProfile(username, cookie);

  const displayName = profile?.displayName || username;
  const bio = profile?.bio || `Stackly linkcard for @${username}`;

  return {
    title: `${displayName} (@${username}) — Stackly`,
    description: bio,
    openGraph: {
      title: `${displayName} (@${username})`,
      description: bio,
      type: "profile",
    },
  };
}

export default async function PublicLinkcardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const headerList = await headers();
  const cookie = headerList.get("cookie") ?? undefined;

  const remoteProfile = await loadProfile(username, cookie);

  // A ghosted profile is indistinguishable from a missing one.
  if (!remoteProfile) notFound();

  const profile: PublicProfile = {
    username: remoteProfile.username,
    displayName: remoteProfile.displayName || remoteProfile.username,
    bio: remoteProfile.bio,
    avatarUrl: remoteProfile.avatarUrl,
    location: remoteProfile.location,
    website: remoteProfile.website,
    social: remoteProfile.social as Record<string, string | undefined>,
    live: remoteProfile.live ?? false,
    appearance: normalizeAppearance(remoteProfile.appearance),
  };

  const appearance = profile.appearance;
  const accent = resolveAccent(appearance.accent, appearance.colors);
  const button = resolveButton(appearance);
  const canvas = resolveCanvas(appearance);
  const type = resolveTypography(appearance);
  const surfaceStyle = resolveSurface(appearance);

  // Real content only — pass caller's cookie so unpublished owner previews links/projects.
  const [remoteLinks, remoteProjects, remoteComponents, remoteIntegrations] =
    await Promise.all([
      api.getPublicLinks(username, cookie).catch(() => [] as LinkItem[]),
      api.getPublicProjects(username, cookie).catch(() => [] as ProjectItem[]),
      api
        .getPublicComponents(username, cookie)
        .catch(() => [] as ComponentItem[]),
      api
        .getPublicIntegrations(username, cookie)
        .catch(() => [] as IntegrationItem[]),
    ]);

  const enabledLinks = (remoteLinks ?? [])
    .filter((l) => l.enabled !== false)
    .map((l) => ({
      id: l.id || l._id || "",
      title: l.title,
      url: l.url,
      description: l.description,
      icon: l.icon,
    }));

  const visibleProjects = (remoteProjects ?? []).map((p) => ({
    id: p.id || p._id || "",
    name: p.name,
    description: p.description ?? "",
    tech: p.tech ?? [],
    repoUrl: p.repoUrl,
    liveUrl: p.liveUrl,
    status: p.status ?? "live",
    featured: p.featured ?? false,
  }));

  // `links` and `projects` components are rendered by the dedicated sections.
  const extraComponents = (remoteComponents ?? []).filter(
    (c) => c.type !== "links" && c.type !== "projects",
  );

  const githubIntegration = (remoteIntegrations ?? []).find(
    (i) => i.integrationId === "github" && i.status === "connected",
  );
  const githubData = githubIntegration?.data as
    Record<string, unknown> | undefined;
  const githubRepos = (githubData?.repos ?? []) as Array<{
    name: string;
    url: string;
    description?: string;
    stars: number;
    forks: number;
    language?: string;
    pushedAt?: string;
  }>;
  const hasCustomGithubComponent = extraComponents.some(
    (c) => c.type === "github",
  );

  const socialItems: Array<{
    href: string;
    label: string;
    icon: React.ReactNode;
  }> = [];
  if (profile.social?.github)
    socialItems.push({
      href: profile.social.github,
      label: "GitHub",
      icon: <GithubIcon className="h-4 w-4" />,
    });
  if (profile.social?.x)
    socialItems.push({
      href: profile.social.x,
      label: "X",
      icon: <XIcon className="h-4 w-4" />,
    });
  if (profile.social?.linkedin)
    socialItems.push({
      href: profile.social.linkedin,
      label: "LinkedIn",
      icon: <LinkedinIcon className="h-4 w-4" />,
    });
  if (profile.social?.discord)
    socialItems.push({
      href: profile.social.discord,
      label: "Discord",
      icon: <MessageCircle className="h-4 w-4" />,
    });
  if (profile.website)
    socialItems.push({
      href: profile.website,
      label: "Website",
      icon: <Globe className="h-4 w-4" />,
    });

  // Background track profile view
  api.trackProfileView(username).catch(() => {});

  const maxWidth = canvas.maxWidth ? `${canvas.maxWidth}px` : "100%";

  return (
    <div
      className="relative min-h-screen text-[#FAF7FF]"
      style={resolvePageBackground(appearance, accent)}
    >
      {/* Ambient top glow */}
      {!appearance.colors?.background && appearance.background === "aurora" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[480px]"
          style={{
            background: `radial-gradient(ellipse 90% 55% at 50% -5%, ${accent.glow.replace("0.18", "0.32")} 0%, transparent 70%)`,
          }}
        />
      )}

      <main
        className="relative z-10 mx-auto flex min-h-screen flex-col items-center px-5 pt-16 pb-20"
        style={{
          maxWidth,
          paddingLeft: `${canvas.padding / 2}px`,
          paddingRight: `${canvas.padding / 2}px`,
          backgroundColor: canvas.background ?? undefined,
        }}
      >
        {/* ── Avatar + identity ── */}
        <div
          className="flex flex-col items-center text-center"
          style={{
            textAlign: canvas.align === "left" ? "left" : "center",
            alignItems: canvas.align === "left" ? "flex-start" : "center",
          }}
        >
          <div
            className="relative rounded-full p-[3px]"
            style={{
              boxShadow: `0 0 0 3px ${accent.primary}55, 0 0 28px 0px ${accent.glow}`,
            }}
          >
            <ProfileAvatar
              src={profile.avatarUrl}
              name={profile.displayName}
              live={profile.live}
              size="2xl"
              className="ring-0"
            />
          </div>

          <h1
            className={`mt-5 font-display tracking-tight text-[#FAF7FF] text-balance ${
              appearance.typography === "editorial"
                ? "font-extrabold"
                : "font-bold"
            }`}
            style={{
              fontSize: `${type.headingPx}px`,
              color: appearance.colors?.text ?? undefined,
            }}
          >
            {profile.displayName}
          </h1>

          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono"
            style={{ color: accent.primary, fontSize: `${type.smallPx}px` }}
          >
            @{profile.username}
          </div>

          {profile.bio && (
            <p
              className="mt-4 max-w-xs leading-relaxed text-[#B8AFC4] text-pretty"
              style={{
                fontSize: `${type.bodyPx}px`,
                color: appearance.colors?.text
                  ? `${appearance.colors.text}cc`
                  : undefined,
              }}
            >
              {profile.bio}
            </p>
          )}

          {/* Location + social icons */}
          {(profile.location || socialItems.length > 0) && (
            <div
              className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 font-mono text-[#9C92A8]"
              style={{ fontSize: `${type.smallPx}px` }}
            >
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profile.location}
                </span>
              )}
              {profile.location && socialItems.length > 0 && (
                <span className="text-white/20">·</span>
              )}
              {socialItems.map((item, i) => (
                <span key={item.label} className="inline-flex items-center">
                  {i > 0 && <span className="mr-2 text-white/20">·</span>}
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={item.label}
                    className="inline-flex items-center transition-colors hover:text-[#FAF7FF]"
                  >
                    {item.icon}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Link buttons ── */}
        {enabledLinks.length > 0 && (
          <div
            className={cn(
              "w-full",
              appearance.layout === "compact"
                ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5 space-y-0"
                : "space-y-2.5",
            )}
            style={{ marginTop: `${canvas.spacing}px` }}
          >
            {enabledLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className={`lc-link-hover-${appearance.accent} group flex items-center gap-3.5 border border-white/8 bg-white/[0.05] transition-all duration-200 hover:-translate-y-[2px] ${button.radiusClass} backdrop-blur-sm`}
                style={{
                  borderRadius: `${button.radiusPx}px`,
                  padding: `${button.heightClass === "py-2.5" ? 10 : button.heightClass === "py-4" ? 16 : 14}px 20px`,
                }}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-white/5 text-base transition-colors ${button.radiusClass}`}
                  style={{
                    color: accent.primary,
                    borderRadius: `${Math.max(4, Math.min(button.radiusPx - 4, 12))}px`,
                  }}
                >
                  <span aria-hidden>{link.icon ?? "↗"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate font-semibold text-[#FAF7FF]"
                    style={{
                      fontSize: `${type.bodyPx}px`,
                      color: appearance.colors?.text ?? undefined,
                    }}
                  >
                    {link.title}
                  </div>
                  {link.description && (
                    <div
                      className="truncate text-[#9C92A8]"
                      style={{
                        fontSize: `${type.smallPx}px`,
                        color: appearance.colors?.text
                          ? `${appearance.colors.text}aa`
                          : undefined,
                      }}
                    >
                      {link.description}
                    </div>
                  )}
                </div>
                <ExternalLink
                  className="h-4 w-4 shrink-0 text-[#9C92A8] transition-colors group-hover:text-[#FAF7FF]"
                  aria-hidden
                />
              </a>
            ))}
          </div>
        )}

        {/* ── Projects ── */}
        {visibleProjects.length > 0 && (
          <section
            className="w-full"
            style={{ marginTop: `${canvas.spacing}px` }}
          >
            <h2
              className="font-display font-semibold tracking-wider uppercase text-[#9C92A8]"
              style={{
                fontSize: `${type.subheadingPx}px`,
                color: appearance.colors?.text
                  ? `${appearance.colors.text}bb`
                  : undefined,
              }}
            >
              Projects & Work
            </h2>
            <div
              className={cn(
                "mt-3.5",
                appearance.layout === "compact"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-3 space-y-0"
                  : "space-y-3",
              )}
            >
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className={`border border-white/8 p-4 backdrop-blur-sm ${button.radiusClass}`}
                  style={{
                    borderRadius: `${surfaceStyle.radius}px`,
                    borderWidth: `${surfaceStyle.borderWidth}px`,
                    borderColor: surfaceStyle.borderColor,
                    background: surfaceStyle.background,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className="truncate font-semibold text-[#FAF7FF]"
                        style={{
                          fontSize: `${Math.max(type.bodyPx + 2, type.subheadingPx)}px`,
                          color: appearance.colors?.text ?? undefined,
                        }}
                      >
                        {project.name}
                      </div>
                      {project.description && (
                        <p
                          className="mt-1 leading-relaxed text-[#9C92A8]"
                          style={{
                            fontSize: `${type.bodyPx}px`,
                            color: appearance.colors?.text
                              ? `${appearance.colors.text}cc`
                              : undefined,
                          }}
                        >
                          {project.description}
                        </p>
                      )}
                    </div>
                    {(project.repoUrl || project.liveUrl) && (
                      <a
                        href={project.repoUrl || project.liveUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Open ${project.name}`}
                        className="shrink-0 text-[#9C92A8] transition-colors hover:text-[#FAF7FF]"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                  {project.tech.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {project.tech.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[#B8AFC4]"
                          style={{ fontSize: `${type.smallPx}px` }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Connected GitHub Activity & Repositories ── */}
        {githubIntegration &&
          !hasCustomGithubComponent &&
          githubRepos.length > 0 && (
            <SectionShell
              title="GitHub Activity"
              accent={accent.primary}
              subheadingSize={type.subheadingPx}
              radiusClass={button.radiusClass}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/6 pb-2.5 font-mono text-xs text-[#9C92A8]">
                  <a
                    href={
                      githubIntegration.profileUrl ||
                      `https://github.com/${(githubIntegration.handle || "").replace(/^@/, "")}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
                  >
                    <GithubIcon className="h-3.5 w-3.5" />
                    <span>{githubIntegration.handle || "GitHub"}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="flex items-center gap-2">
                    {Number(githubData?.totalStars ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" />
                        {Number(githubData?.totalStars)}
                      </span>
                    )}
                    {Number(githubData?.followers ?? 0) > 0 && (
                      <span>{Number(githubData?.followers)} followers</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {githubRepos.slice(0, 6).map((repo) => (
                    <a
                      key={repo.url}
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`group flex flex-col justify-between border border-white/8 bg-white/[0.03] p-3 transition-all hover:border-white/15 ${button.radiusClass}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-semibold text-[#FAF7FF] transition-colors group-hover:text-[#B88CFF]">
                            {repo.name}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-[#9C92A8]" />
                        </div>
                        {repo.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9C92A8]">
                            {repo.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] text-[#9C92A8]">
                        {repo.language && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[#B8AFC4]">
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 text-amber-400" />
                          {repo.stars}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </SectionShell>
          )}

        {/* ── Profile components ── */}
        {extraComponents.map((component) => (
          <ProfileComponent
            key={component.id}
            component={component}
            accent={accent.primary}
            bodySize={type.bodyPx}
            subheadingSize={type.subheadingPx}
            radiusClass={button.radiusClass}
          />
        ))}

        {/* ── Stackly watermark ── */}
        <div
          className="flex flex-col items-center gap-1"
          style={{ marginTop: `${canvas.spacing + 20}px` }}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#9C92A8] transition-all hover:border-white/16 hover:text-[#FAF7FF]"
          >
            <span>Built with</span>
            <span
              className="font-display text-sm font-semibold normal-case tracking-tight"
              style={{ color: accent.primary }}
            >
              Stackly
            </span>
          </Link>
          <p className="mt-1 font-mono text-[10px] text-[#9C92A8]/60">
            stackly.dev/@{profile.username}
          </p>
        </div>
      </main>
    </div>
  );
}

/* ─── Component renderer ──────────────────────────────────────────── */

function SectionShell({
  title,
  children,
  accent,
  subheadingSize,
  radiusClass,
}: {
  title: string;
  children: React.ReactNode;
  accent: string;
  subheadingSize: number;
  radiusClass: string;
}) {
  return (
    <section className="w-full" style={{ marginTop: 40 }}>
      <h2
        className="font-display font-semibold tracking-wider uppercase text-[#9C92A8]"
        style={{ fontSize: `${subheadingSize}px` }}
      >
        {title}
      </h2>
      <div
        className={`mt-3.5 rounded-[16px] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm ${radiusClass}`}
        style={{ borderColor: `${accent}22` }}
      >
        {children}
      </div>
    </section>
  );
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate =
      obj.title ?? obj.name ?? obj.label ?? obj.text ?? obj.value;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

function ProfileComponent({
  component,
  accent,
  bodySize,
  subheadingSize,
  radiusClass,
}: {
  component: ComponentItem;
  accent: string;
  bodySize: number;
  subheadingSize: number;
  radiusClass: string;
}) {
  const config = (component.config ?? {}) as Record<string, unknown>;

  switch (component.type) {
    case "about": {
      const content = asText(config.content);
      const highlights = Array.isArray(config.highlights)
        ? config.highlights.map(asText).filter((v): v is string => Boolean(v))
        : [];
      if (!content && highlights.length === 0) return null;
      return (
        <SectionShell
          title={component.title || "About"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          {content && (
            <p
              className="text-sm leading-relaxed text-[#B8AFC4]"
              style={{ fontSize: `${bodySize}px` }}
            >
              {content}
            </p>
          )}
          {highlights.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {highlights.map((h) => (
                <li
                  key={h}
                  className="flex items-start gap-2 text-sm text-[#B8AFC4]"
                >
                  <span style={{ color: accent }} aria-hidden>
                    ▸
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </SectionShell>
      );
    }

    case "skills": {
      const categories = Array.isArray(config.categories)
        ? config.categories
            .map((c) => {
              if (typeof c === "string")
                return { name: c, items: [] as string[] };
              const obj = (c ?? {}) as Record<string, unknown>;
              const name = asText(obj.name ?? obj.title ?? obj.category);
              const items = Array.isArray(obj.items)
                ? obj.items.map(asText).filter((v): v is string => Boolean(v))
                : [];
              return name ? { name, items } : null;
            })
            .filter((c): c is { name: string; items: string[] } => c !== null)
        : [];
      if (categories.length === 0) return null;
      return (
        <SectionShell
          title={component.title || "Skills"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="font-mono text-[11px] uppercase tracking-wider text-[#9C92A8]">
                  {cat.name}
                </div>
                {cat.items.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {cat.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-[#B8AFC4]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionShell>
      );
    }

    case "experience":
    case "timeline": {
      const key = component.type === "experience" ? "items" : "events";
      const entries = Array.isArray(config[key])
        ? config[key]
            .map((entry) => {
              const obj = (entry ?? {}) as Record<string, unknown>;
              const title =
                asText(obj.title ?? obj.role ?? obj.name ?? obj.headline) ?? "";
              const subtitle =
                asText(
                  obj.company ?? obj.organization ?? obj.place ?? obj.date,
                ) ?? "";
              const description = asText(
                obj.description ?? obj.body ?? obj.summary,
              );
              return title || subtitle || description
                ? { title, subtitle, description }
                : null;
            })
            .filter(
              (
                e,
              ): e is {
                title: string;
                subtitle: string;
                description: string | null;
              } => e !== null,
            )
        : [];
      if (entries.length === 0) return null;
      return (
        <SectionShell
          title={
            component.title ||
            (component.type === "experience" ? "Experience" : "Timeline")
          }
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <ol className="space-y-3">
            {entries.map((entry, i) => (
              <li
                key={`${entry.title}-${i}`}
                className="border-l border-white/10 pl-3.5"
              >
                <div className="font-medium text-[#FAF7FF]">{entry.title}</div>
                {entry.subtitle && (
                  <div className="font-mono text-[11px] text-[#9C92A8]">
                    {entry.subtitle}
                  </div>
                )}
                {entry.description && (
                  <p className="mt-1 text-sm text-[#B8AFC4]">
                    {entry.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </SectionShell>
      );
    }

    case "gallery": {
      const images = Array.isArray(config.images)
        ? config.images
            .map((img) => {
              if (typeof img === "string") return { url: img, caption: "" };
              const obj = (img ?? {}) as Record<string, unknown>;
              const url = asText(obj.url ?? obj.src);
              return url
                ? { url, caption: asText(obj.caption ?? obj.alt) ?? "" }
                : null;
            })
            .filter((i): i is { url: string; caption: string } => i !== null)
        : [];
      if (images.length === 0) return null;
      return (
        <SectionShell
          title={component.title || "Gallery"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((img) => (
              <a
                key={img.url}
                href={img.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group relative aspect-square overflow-hidden rounded-[10px] border border-white/8 bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || "Gallery image"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        </SectionShell>
      );
    }

    case "resume": {
      const resumeUrl = asText(config.resumeUrl);
      const downloadEnabled = config.downloadEnabled !== false;
      const label = asText(config.buttonLabel) ?? "Download Resume";
      if (!resumeUrl || !downloadEnabled) return null;
      return (
        <SectionShell
          title={component.title || "Resume"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={`inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#FAF7FF] transition-colors hover:border-white/20 ${radiusClass}`}
            style={{ color: accent }}
          >
            <Download className="h-4 w-4" aria-hidden />
            {label}
          </a>
        </SectionShell>
      );
    }

    case "github": {
      const repos = Array.isArray(config.repos)
        ? (config.repos as Array<{
            name: string;
            url: string;
            description?: string;
            stars?: number;
            language?: string;
          }>)
        : [];
      const handle =
        asText(config.handle) || (config.username as string | undefined);
      const totalStars = Number(config.totalStars ?? config.stars ?? 0);
      const followers = Number(config.followers ?? 0);

      return (
        <SectionShell
          title={component.title || "GitHub"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <div className="space-y-3">
            {handle && (
              <div className="flex items-center justify-between border-b border-white/6 pb-2.5 font-mono text-xs text-[#9C92A8]">
                <a
                  href={`https://github.com/${handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1.5 transition-colors hover:text-[#FAF7FF]"
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  <span>{handle.startsWith("@") ? handle : `@${handle}`}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <div className="flex items-center gap-2">
                  {totalStars > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400" />
                      {totalStars}
                    </span>
                  )}
                  {followers > 0 && <span>{followers} followers</span>}
                </div>
              </div>
            )}

            {repos.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {repos.slice(0, 6).map((repo) => (
                  <a
                    key={repo.url || repo.name}
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`group flex flex-col justify-between border border-white/8 bg-white/[0.03] p-3 transition-all hover:border-white/15 ${radiusClass}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-[#FAF7FF] transition-colors group-hover:text-[#B88CFF]">
                          {repo.name}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-[#9C92A8]" />
                      </div>
                      {repo.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#9C92A8]">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 font-mono text-[10px] text-[#9C92A8]">
                      {repo.language && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[#B8AFC4]">
                          {repo.language}
                        </span>
                      )}
                      {repo.stars !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 text-amber-400" />
                          {repo.stars}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </SectionShell>
      );
    }

    case "contact": {
      const email = asText(config.email);
      if (!email) return null;
      return (
        <SectionShell
          title={component.title || "Get in Touch"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <a
            href={`mailto:${email}`}
            className={`inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#FAF7FF] transition-colors hover:border-white/20 ${radiusClass}`}
            style={{ color: accent }}
          >
            <Mail className="h-4 w-4" aria-hidden />
            {email}
          </a>
        </SectionShell>
      );
    }

    case "social_cards": {
      const platforms = Array.isArray(config.platforms)
        ? config.platforms.map(asText).filter((v): v is string => Boolean(v))
        : [];
      if (platforms.length === 0) return null;
      return (
        <SectionShell
          title={component.title || "Socials"}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((platform) => (
              <span
                key={platform}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#B8AFC4]"
              >
                {platform}
              </span>
            ))}
          </div>
        </SectionShell>
      );
    }

    case "custom_section": {
      const heading = asText(config.heading) || component.title;
      const bodyText = asText(config.bodyText);
      const ctaLabel = asText(config.ctaLabel);
      const ctaUrl = asText(config.ctaUrl);
      if (!bodyText && !ctaLabel) return null;
      return (
        <SectionShell
          title={heading}
          accent={accent}
          subheadingSize={subheadingSize}
          radiusClass={radiusClass}
        >
          {bodyText && (
            <p
              className="text-sm leading-relaxed text-[#B8AFC4]"
              style={{ fontSize: `${bodySize}px` }}
            >
              {bodyText}
            </p>
          )}
          {ctaLabel && ctaUrl && (
            <a
              href={ctaUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={`mt-3 inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#FAF7FF] transition-colors hover:border-white/20 ${radiusClass}`}
              style={{ color: accent }}
            >
              {ctaLabel}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
        </SectionShell>
      );
    }

    default:
      return null;
  }
}
