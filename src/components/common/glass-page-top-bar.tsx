"use client";

import Link from "next/link";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { ArrowLeft, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { SmartBackButton } from "@/components/common/SmartBackButton";

type GlassActionTone =
  | "blue"
  | "emerald"
  | "purple"
  | "orange"
  | "violet"
  | "rose"
  | "slate";

const actionToneClasses: Record<GlassActionTone, string> = {
  blue: "text-blue-600 border-blue-400 hover:from-blue-400 hover:via-blue-500 hover:to-blue-600",
  emerald: "text-emerald-600 border-emerald-400 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600",
  purple: "text-purple-600 border-purple-400 hover:from-purple-400 hover:via-violet-500 hover:to-purple-600",
  orange: "text-orange-600 border-orange-400 hover:from-orange-400 hover:via-amber-500 hover:to-orange-600",
  violet: "text-violet-600 border-violet-400 hover:from-violet-500 hover:via-purple-500 hover:to-violet-600",
  rose: "text-rose-600 border-rose-400 hover:from-rose-400 hover:via-pink-500 hover:to-rose-600",
  slate: "text-slate-600 border-slate-300 hover:from-slate-400 hover:via-slate-500 hover:to-slate-600",
};

interface GlassPageTopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: string;
  leading?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  titleControls?: ReactNode;
  center?: ReactNode;
  actionsLeading?: ReactNode;
  actions?: ReactNode;
  below?: ReactNode;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
  inlineActions?: boolean;
  sticky?: boolean;
}

export function GlassPageTopBar({
  title,
  subtitle,
  eyebrow,
  backHref,
  backLabel = "Back",
  leading,
  meta,
  badges,
  titleControls,
  center,
  actionsLeading,
  actions,
  below,
  className,
  contentClassName,
  actionsClassName,
  inlineActions = false,
  sticky = true,
}: GlassPageTopBarProps) {
  return (
    <div
      className={cn(
        "glass-page-topbar-enter -mx-3 mb-4 overflow-visible rounded-b-[18px] border-b border-white/45 bg-white/72 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px] sm:-mx-6",
        sticky && "sticky top-0 z-30",
        className
      )}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
      <div className={cn("w-full px-4 py-2.5 sm:px-6 lg:px-8", contentClassName)}>
        <div className={cn(
          inlineActions ? "flex items-center gap-2.5" : "flex flex-col gap-2.5 lg:flex-row lg:items-center",
        )}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {backHref ? (
              <SmartBackButton
                fallbackHref={backHref}
                label={backLabel}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200/60 bg-blue-50/80 text-blue-600 shadow-sm transition-all duration-300 after:absolute after:-inset-1.5 after:content-[''] hover:scale-105 hover:bg-blue-100 hover:text-blue-700 active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
              </SmartBackButton>
            ) : leading ? (
              <div className="shrink-0">{leading}</div>
            ) : null}

            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                  {eyebrow}
                </div>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-bold leading-tight text-indigo-900 sm:text-lg">
                  {title}
                </h1>
                {meta}
                {badges}
                {titleControls}
              </div>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs font-medium text-gray-500 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {center && (
            <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
              {center}
            </div>
          )}

          {(actionsLeading || actions) && (
            <div className={cn(
              inlineActions
                ? "flex shrink-0 items-center justify-end gap-2"
                : "flex w-full shrink-0 items-center justify-center gap-2 lg:w-auto lg:justify-start",
              actionsClassName,
            )}>
              {actionsLeading}
              {actions}
            </div>
          )}
        </div>

        {below && <div className="mt-2.5">{below}</div>}
      </div>
    </div>
  );
}

interface GlassPageSearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

export function GlassPageSearchInput({
  className,
  containerClassName,
  placeholder = "Search...",
  ...inputProps
}: GlassPageSearchInputProps) {
  const hasValue =
    typeof inputProps.value === "string"
      ? inputProps.value.length > 0
      : typeof inputProps.defaultValue === "string"
        ? inputProps.defaultValue.length > 0
        : false;

  return (
    <div className={cn("group relative min-w-0 shrink-0", containerClassName)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-2.5 text-blue-500/80 transition-colors duration-300 group-hover:text-blue-600">
        <Search className="h-3.5 w-3.5 transition-all duration-300 group-hover:scale-110" />
      </div>
      <input
        type="text"
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        placeholder={placeholder}
        style={{ boxShadow: "0 1px 4px rgba(59, 130, 246, 0.05)" }}
        className={cn(
          "h-[34px] rounded-full border border-blue-200/60 bg-white/90 pl-7 pr-8 text-xs shadow-sm transition-all duration-300 ease-in-out placeholder:text-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/50",
          hasValue
            ? "w-56 lg:w-72"
            : "w-32 group-hover:w-56 focus:w-56 lg:group-hover:w-72 lg:focus:w-72",
          className
        )}
        {...inputProps}
      />
    </div>
  );
}

interface GlassActionDockProps {
  children: ReactNode;
  className?: string;
}

export function GlassActionDock({ children, className }: GlassActionDockProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/60 bg-white/80 px-2 py-1 shadow-sm ring-1 ring-blue-100/60 backdrop-blur-sm sm:justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}

interface GlassActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
  href?: string;
  tone?: GlassActionTone;
  badge?: ReactNode;
  className?: string;
}

export const GlassActionButton = forwardRef<HTMLButtonElement, GlassActionButtonProps>(function GlassActionButton({
  label,
  icon,
  href,
  tone = "blue",
  badge,
  className,
  disabled,
  type = "button",
  ...buttonProps
}, ref) {
  const content = (
    <>
      {badge && (
        <span className="absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-violet-600 px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
      {icon && <span className="mb-0.5 flex h-4 w-4 items-center justify-center">{icon}</span>}
      <span className="text-[7px] font-semibold leading-tight sm:text-[8px]">{label}</span>
    </>
  );

  const classes = cn(
    "relative flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border bg-white shadow-sm transition-all duration-300 hover:scale-105 hover:bg-gradient-to-br hover:text-white hover:shadow-md active:scale-95 sm:h-11 sm:w-11",
    actionToneClasses[tone],
    disabled && "pointer-events-none opacity-50",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={buttonProps.title}>
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={disabled} type={type} {...buttonProps}>
      {content}
    </button>
  );
});

GlassActionButton.displayName = "GlassActionButton";
