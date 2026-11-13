import * as React from "react";
import NextLink from "next/link";
import { MessageCircle, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_APPEARANCE,
  resolveAccent,
  resolveButton,
  resolveCanvas,
  resolvePageBackground,
  resolveSurface,
  resolveTypography,
  type AppearanceConfig,
  type ThemeAccent,
} from "@/lib/appearance";
import { ProfileAvatar } from "./profile-avatar";
import { GithubIcon, XIcon, LinkedinIcon } from "./icons";
import { ProfileLinkCard, type ProfileLink } from "./profile-link-card";
import { ProjectCard, type Project } from "./project-card";

export type { AppearanceConfig, ThemeAccent };
export { resolveAccent, DEFAULT_APPEARANCE };

export type ProfileSocial = {
  github?: string;
  x?: string;
  linkedin?: string;
  discord?: string;
  website?: string;
};

export type Profile = {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  social?: ProfileSocial;
  live?: boolean;
  usernameClaimed?: boolean;
};

type ProfilePreviewProps = {
  profile: Profile;
  links?: ProfileLink[];
  projects?: Project[];
  appearance?: AppearanceConfig;
  className?: string;
  variant?: "full" | "compact";
  emptyMessages?: { links?: string; projects?: string };
};

/**
 * ProfilePreview — expressive developer identity card.
 * Elevated midnight purple surface (#0F0B16), subtle violet atmospheric lighting,
 * high-contrast warm white typography, and distinct personal identity feel.
 */
export function ProfilePreview({
  profile,
  links = [],
  projects = [],
  appearance = DEFAULT_APPEARANCE,
  className,
  variant = "full",
  emptyMessages,
}: ProfilePreviewProps) {
  const accent = resolveAccent(appearance.accent, appearance.colors);
  const button = resolveButton(appearance);
  const canvas = resolveCanvas(appearance);
  const type = resolveTypography(appearance);

  const buttonRadius = button.radiusClass;

  const maxW = appearance.layout === "compact" ? "max-w-3xl" : "max-w-[44rem]";

  const surfaceStyle = resolveSurface(appearance);
  // The outer wrapper uses the page-level background (aurora / gradient / solid),
  // which is the same resolver the actual public profile page uses.  The surface
  // style (glass, elevated, etc.) is applied only to inner cards / panels below.
  const pageBg = resolvePageBackground(appearance, accent);

  return (
    <div
      className={cn(
        "relative overflow-hidden text-[#FAF7FF] shadow-2xl shadow-black/50",
        className,
      )}
      style={{
        maxWidth: canvas.maxWidth ? `${canvas.maxWidth}px` : undefined,
        margin: "0 auto",
        ...pageBg,
        border: `${surfaceStyle.borderWidth}px solid ${surfaceStyle.borderColor}`,
        borderRadius: `${surfaceStyle.radius}px`,
        color: appearance.colors?.text ?? undefined,
      }}
    >
      {/* Themed top edge atmospheric glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-transparent to-transparent"
        style={{
          background: `linear-gradient(to bottom, ${accent.glow.replace("0.18", "0.22")} 0%, transparent 100%)`,
        }}
      />

      <div
        className="relative"
        style={{
          padding: `${canvas.padding}px`,
        }}
      >
        <header
          className={cn(
            "mx-auto flex max-w-2xl flex-col items-center text-center",
          )}
          style={{
            textAlign: canvas.align === "left" ? "left" : "center",
            alignItems: canvas.align === "left" ? "flex-start" : "center",
          }}
        >
          {/* Avatar with themed ring via wrapper box-shadow */}
          <div
            className="relative rounded-full p-1"
            style={{
              boxShadow: `0 0 0 3px ${accent.primary}44, 0 0 18px 0px ${accent.glow}`,
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
            className={cn(
              "font-display mt-5 tracking-tight text-[#FAF7FF] text-balance",
              appearance.typography === "compact" && "font-bold",
              appearance.typography === "editorial" && "font-extrabold",
            )}
            style={{
              fontSize: `${type.headingPx}px`,
              fontWeight: type.headingWeight,
              color: appearance.colors?.text ?? undefined,
            }}
          >
            {profile.displayName || profile.username}
          </h1>

          <div
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[#15101E] px-3 py-0.5 font-mono"
            style={{ color: accent.primary, fontSize: `${type.smallPx}px` }}
          >
            <span>@{profile.username}</span>
          </div>

          {profile.bio && (
            <p
              className="mt-4 max-w-md leading-relaxed text-[#B8AFC4] text-pretty"
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

          {(profile.location || hasAnySocial(profile.social)) && (
            <div
              className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-mono text-[#9C92A8]"
              style={{ fontSize: `${type.smallPx}px` }}
            >
              {profile.location && <span>{profile.location}</span>}
              {profile.location && hasAnySocial(profile.social) && (
                <span className="text-white/20">·</span>
              )}
              <SocialRow social={profile.social} />
            </div>
          )}

          {variant === "full" && links.length > 0 && (
            <div
              className={cn(
                "mt-10 w-full",
                appearance.layout === "compact"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5 space-y-0"
                  : "space-y-2.5",
              )}
              style={{ marginTop: `${canvas.spacing}px` }}
            >
              {links.map((link) => (
                <ProfileLinkCard
                  key={link.id}
                  link={link}
                  mode="preview"
                  className={buttonRadius}
                  style={{
                    borderRadius: `${button.radiusPx}px`,
                    padding:
                      button.heightClass === "py-2.5"
                        ? "10px 16px"
                        : button.heightClass === "py-4"
                          ? "16px 24px"
                          : "14px 20px",
                  }}
                  titleStyle={{
                    fontSize: `${type.bodyPx}px`,
                    color: appearance.colors?.text ?? undefined,
                  }}
                  descStyle={{
                    fontSize: `${type.smallPx}px`,
                    color: appearance.colors?.text
                      ? `${appearance.colors.text}aa`
                      : undefined,
                  }}
                  iconStyle={{
                    borderRadius: `${Math.max(4, Math.min(button.radiusPx - 4, 12))}px`,
                    color: accent.primary,
                  }}
                />
              ))}
            </div>
          )}
        </header>

        {variant === "full" && projects.length > 0 && (
          <section
            className={cn("mt-12 mx-auto w-full", maxW)}
            style={{ marginTop: `${canvas.spacing}px` }}
          >
            <div className="mb-3.5 flex items-center justify-between">
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
              <span
                className="font-mono text-xs text-[#81778D]"
                style={{
                  fontSize: `${type.smallPx}px`,
                  color: appearance.colors?.text
                    ? `${appearance.colors.text}88`
                    : undefined,
                }}
              >
                {projects.length}{" "}
                {projects.length === 1 ? "project" : "projects"}
              </span>
            </div>
            <div
              className={cn(
                appearance.layout === "compact"
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-3 space-y-0"
                  : "space-y-3",
              )}
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  mode="preview"
                  style={{
                    borderRadius: `${surfaceStyle.radius}px`,
                    borderWidth: `${surfaceStyle.borderWidth}px`,
                    borderColor: surfaceStyle.borderColor,
                    background: surfaceStyle.background,
                  }}
                  titleStyle={{
                    fontSize: `${Math.max(type.bodyPx + 2, type.subheadingPx)}px`,
                    color: appearance.colors?.text ?? undefined,
                  }}
                  descStyle={{
                    fontSize: `${type.bodyPx}px`,
                    color: appearance.colors?.text
                      ? `${appearance.colors.text}cc`
                      : undefined,
                  }}
                  badgeStyle={{
                    fontSize: `${type.smallPx}px`,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty hints */}
        {variant === "full" && links.length === 0 && emptyMessages?.links && (
          <p className="mt-8 text-center font-mono text-xs text-[#9C92A8]">
            {emptyMessages.links}
          </p>
        )}
        {variant === "full" &&
          projects.length === 0 &&
          emptyMessages?.projects && (
            <p className="mt-4 text-center font-mono text-xs text-[#9C92A8]">
              {emptyMessages.projects}
            </p>
          )}
      </div>

      {variant === "full" && (
        <footer className="border-t border-white/6 px-6 py-4 text-center bg-[#09070D]/40">
          <NextLink
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#9C92A8] transition-colors hover:text-[#FAF7FF]"
          >
            <span>Built with</span>
            <span className="font-display font-semibold text-sm normal-case tracking-tight text-[#FAF7FF] hover:text-[#B88CFF] transition-colors">
              Stackly
            </span>
          </NextLink>
        </footer>
      )}
    </div>
  );
}

function hasAnySocial(s: ProfileSocial | undefined): boolean {
  if (!s) return false;
  return Boolean(s.github || s.x || s.linkedin || s.discord || s.website);
}

function SocialRow({ social }: { social?: ProfileSocial }) {
  if (!social) return null;
  const items: Array<{ href: string; label: string; icon: React.ReactNode }> =
    [];
  if (social.github)
    items.push({
      href: social.github,
      label: "GitHub",
      icon: <GithubIcon className="h-3.5 w-3.5" />,
    });
  if (social.x)
    items.push({
      href: social.x,
      label: "X",
      icon: <XIcon className="h-3.5 w-3.5" />,
    });
  if (social.linkedin)
    items.push({
      href: social.linkedin,
      label: "LinkedIn",
      icon: <LinkedinIcon className="h-3.5 w-3.5" />,
    });
  if (social.discord)
    items.push({
      href: social.discord,
      label: "Discord",
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    });
  if (social.website)
    items.push({
      href: social.website,
      label: "Website",
      icon: <LinkIcon className="h-3.5 w-3.5" />,
    });
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 && <span className="text-white/20">·</span>}
          <a
            href={it.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[#B8AFC4] transition-colors hover:text-[#FAF7FF]"
          >
            {it.icon}
            {it.label}
          </a>
        </React.Fragment>
      ))}
    </div>
  );
}
