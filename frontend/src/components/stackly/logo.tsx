import * as React from "react";

/**
 * Stackly mark — three "stack" rings (rounded slabs), currentColor fill.
 * Used in the sidebar/header as the lightweight brand mark.
 */
export function Logo({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Stackly"
      role="img"
      className={className}
      {...rest}
    >
      <g fill="currentColor">
        <rect x="1" y="10.5" width="14" height="3" rx="1" />
        <rect x="1" y="6.5" width="14" height="3" rx="1" opacity="0.72" />
        <rect x="1" y="2.5" width="14" height="3" rx="1" opacity="0.85" />
      </g>
    </svg>
  );
}
