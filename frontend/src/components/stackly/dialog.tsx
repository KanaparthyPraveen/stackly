"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Modal dialog — dark elevated surface (#15101E), subtle violet border,
 * keyboard accessible (Escape + focus trapping).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-[#09070D]/85 backdrop-blur-md transition-opacity"
      />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-[20px] border border-white/10 bg-[#15101E] p-6 sm:p-7 shadow-2xl shadow-black/60 animate-fade-in-up",
          className,
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="dialog-title"
              className="font-display text-lg tracking-tight text-[#FAF7FF]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-[#9C92A8]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#9C92A8] transition-colors hover:bg-white/8 hover:text-[#FAF7FF]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div>{children}</div>
        {footer && (
          <footer className="mt-6 flex items-center justify-end gap-2.5 border-t border-white/6 pt-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
