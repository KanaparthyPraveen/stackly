import * as React from "react";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";
import { Badge } from "./badge";
import { GithubIcon } from "./icons";

export type ProjectStatus = "live" | "beta" | "archived" | "wip";

export type Project = {
  id: string;
  name: string;
  description: string;
  tech: string[];
  repoUrl?: string;
  liveUrl?: string;
  status: ProjectStatus;
  featured?: boolean;
};

type ProjectCardProps = {
  project: Project;
  mode?: "preview" | "manage";
  className?: string;
  style?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  descStyle?: React.CSSProperties;
  badgeStyle?: React.CSSProperties;
  onEdit?: () => void;
  onDelete?: () => void;
  onFeatureToggle?: () => void;
};

const statusLabel: Record<ProjectStatus, string> = {
  live: "Live",
  beta: "Beta",
  archived: "Archived",
  wip: "In progress",
};

/**
 * ProjectCard — renders a developer project surface.
 * - preview: public portfolio view
 * - manage: dashboard management with feature toggle, edit, delete
 */
export function ProjectCard({
  project,
  mode = "preview",
  className,
  style,
  titleStyle,
  descStyle,
  badgeStyle,
  onEdit,
  onDelete,
  onFeatureToggle,
}: ProjectCardProps) {
  const statusDot =
    project.status === "live" ? (
      <StatusDot variant="pulse" intent="live" />
    ) : project.status === "archived" ? (
      <StatusDot variant="static" intent="offline" />
    ) : (
      <StatusDot variant="static" intent="warning" />
    );

  if (mode === "manage") {
    return (
      <div
        className={cn(
          "rounded-[16px] border border-white/8 bg-[#191321] p-4.5 sm:p-5 transition-all duration-200 hover:border-[#B88CFF]/20",
          project.featured && "border-[#B88CFF]/30 bg-[#7C3AED]/[0.05]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-base font-semibold tracking-tight text-[#FAF7FF]">
                {project.name}
              </h4>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#9C92A8]">
                {statusLabel[project.status]}
              </span>
              {project.featured && (
                <Badge variant="purple" className="px-2 py-0">
                  <Star className="h-3 w-3 fill-[#B88CFF]" />
                  Featured
                </Badge>
              )}
            </div>

            {project.description && (
              <p className="text-sm text-[#B8AFC4] text-pretty leading-relaxed">
                {project.description}
              </p>
            )}

            {project.tech.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {project.tech.map((t) => (
                  <Badge
                    key={t}
                    variant="muted"
                    className="px-2 py-0 font-mono text-[10px] uppercase tracking-wider"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 font-mono text-xs text-[#9C92A8]">
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-[#B8AFC4] transition-colors hover:text-[#FAF7FF]"
                >
                  <GithubIcon className="h-3 w-3" />
                  repo
                </a>
              )}
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-[#B88CFF] transition-colors hover:text-[#FAF7FF]"
                >
                  <ExternalLink className="h-3 w-3" />
                  live
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {statusDot}
            <div className="flex items-center gap-1 mt-1">
              <button
                type="button"
                onClick={onFeatureToggle}
                aria-label={project.featured ? "Unfeature" : "Feature"}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]",
                  project.featured && "text-[#F5B84B]",
                )}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    project.featured && "fill-[#F5B84B] text-[#F5B84B]",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${project.name}`}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${project.name}`}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-[#FF5C70]/15 hover:text-[#FF5C70]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview mode — used on /[username]
  return (
    <article
      style={style}
      className={cn(
        "rounded-[16px] border border-white/8 bg-[#191321] p-5 sm:p-6 transition-all duration-200 hover:border-[#B88CFF]/25 hover:bg-[#1C1526]",
        className,
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            style={titleStyle}
            className="font-display text-lg font-semibold tracking-tight text-[#FAF7FF] text-balance"
          >
            {project.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {statusDot}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${project.name} repository`}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]"
            >
              <GithubIcon className="h-3.5 w-3.5" />
            </a>
          )}
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${project.name} live`}
              className="grid h-7 w-7 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>
      <p
        style={descStyle}
        className="text-sm text-[#B8AFC4] leading-relaxed text-pretty"
      >
        {project.description}
      </p>
      {project.tech.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {project.tech.map((t) => (
            <span
              key={t}
              style={badgeStyle}
              className="rounded-full border border-white/6 bg-[#15101E] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#9C92A8]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
