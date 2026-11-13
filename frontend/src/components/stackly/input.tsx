import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/**
 * Input — single-line text field.
 * Dark elevated background (#15101E), subtle border, warm white text,
 * muted placeholder, restrained purple focus ring. 11px radius.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "block h-10 w-full rounded-[11px] border border-white/8 bg-[#15101E] px-3.5 py-2 text-sm text-[#FAF7FF] transition-all",
          "placeholder:text-[#9C92A8]/60",
          "focus-visible:outline-none focus-visible:border-[#B88CFF]/40 focus-visible:ring-2 focus-visible:ring-[#B88CFF]/20",
          "disabled:cursor-not-allowed disabled:opacity-45",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          invalid &&
            "border-[#FF5C70]/50 focus-visible:ring-[#FF5C70]/20 focus-visible:border-[#FF5C70]",
          className,
        )}
        {...props}
      />
    );
  },
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[90px] w-full rounded-[11px] border border-white/8 bg-[#15101E] px-3.5 py-2.5 text-sm text-[#FAF7FF] transition-all",
          "placeholder:text-[#9C92A8]/60",
          "focus-visible:outline-none focus-visible:border-[#B88CFF]/40 focus-visible:ring-2 focus-visible:ring-[#B88CFF]/20",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
    );
  },
);

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
};

/**
 * Field — label + control + optional hint/error wrapper.
 * Standardizes form layout across the dashboard.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[11px] font-medium uppercase tracking-wider text-[#9C92A8]"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[#81778D]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-[#FF5C70]">
          {error}
        </p>
      )}
    </div>
  );
}
