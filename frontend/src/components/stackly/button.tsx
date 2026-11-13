import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  // Primary action: Signature purple background with soft violet hover and crisp warm white text
  default:
    "bg-[#7C3AED] text-[#FAF7FF] border border-[#9B6DFF]/30 hover:bg-[#8B5CF6] hover:border-[#B88CFF]/50 shadow-xs active:scale-[0.98]",
  primary:
    "bg-[#7C3AED] text-[#FAF7FF] border border-[#9B6DFF]/30 hover:bg-[#8B5CF6] hover:border-[#B88CFF]/50 shadow-xs active:scale-[0.98]",
  // Secondary: Dark elevated surface (#15101E) with subtle border & violet glow on hover
  secondary:
    "bg-[#15101E] text-[#FAF7FF] border border-white/8 hover:bg-[#1E172B] hover:border-[#B88CFF]/25 active:scale-[0.98]",
  // Outline: Translucent surface with hairline border
  outline:
    "border border-white/10 bg-[#0F0B16]/60 text-[#FAF7FF] hover:border-[#B88CFF]/30 hover:bg-[#15101E] hover:text-[#FAF7FF] active:scale-[0.98]",
  // Ghost: Transparent with gentle violet hover highlight
  ghost:
    "text-[#D8D1E0] hover:bg-[#15101E] hover:text-[#FAF7FF] active:scale-[0.98]",
  // Destructive: Muted danger red with subtle border
  destructive:
    "bg-[#FF5C70]/15 border border-[#FF5C70]/30 text-[#FF5C70] hover:bg-[#FF5C70]/25 hover:border-[#FF5C70]/50 active:scale-[0.98]",
  link: "text-[#B88CFF] underline-offset-4 hover:underline hover:text-[#FAF7FF]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9.5 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2.5",
  icon: "h-9 w-9 p-0",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "default",
      size = "md",
      type,
      asChild,
      children,
      ...props
    },
    ref,
  ) {
    const classes = cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-[11px] font-medium transition-all duration-150 select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B88CFF]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09070D]",
      "disabled:pointer-events-none disabled:opacity-45",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      variantClasses[variant],
      sizeClasses[size],
      className,
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<
        { className?: string } & Record<string, unknown>
      >;
      const merged = {
        ...props,
        ...(child.props ?? {}),
        className: cn(classes, child.props?.className),
      };
      return React.cloneElement(child, merged as Record<string, unknown>);
    }

    return (
      <button ref={ref} type={type ?? "button"} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
