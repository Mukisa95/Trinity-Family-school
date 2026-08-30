"use client";

import Link from "next/link";
import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

function useSmallScreen() {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const updateScreenSize = () => setIsSmallScreen(mediaQuery.matches);

    updateScreenSize();
    mediaQuery.addEventListener("change", updateScreenSize);
    return () => mediaQuery.removeEventListener("change", updateScreenSize);
  }, []);

  return isSmallScreen;
}

const actionToneClasses: Record<GlassActionTone, string> = {
  blue: "text-blue-600 sm:border-blue-400 sm:hover:from-blue-400 sm:hover:via-blue-500 sm:hover:to-blue-600",
  emerald: "text-emerald-600 sm:border-emerald-400 sm:hover:from-emerald-400 sm:hover:via-emerald-500 sm:hover:to-emerald-600",
  purple: "text-purple-600 sm:border-purple-400 sm:hover:from-purple-400 sm:hover:via-violet-500 sm:hover:to-purple-600",
  orange: "text-orange-600 sm:border-orange-400 sm:hover:from-orange-400 sm:hover:via-amber-500 sm:hover:to-orange-600",
  violet: "text-violet-600 sm:border-violet-400 sm:hover:from-violet-500 sm:hover:via-purple-500 sm:hover:to-violet-600",
  rose: "text-rose-600 sm:border-rose-400 sm:hover:from-rose-400 sm:hover:via-pink-500 sm:hover:to-rose-600",
  slate: "text-slate-600 sm:border-slate-300 sm:hover:from-slate-400 sm:hover:via-slate-500 sm:hover:to-slate-600",
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
  const isSmallScreen = useSmallScreen();
  const prefersReducedMotion = useReducedMotion();
  const topBarRef = useRef<HTMLDivElement>(null);
  const [mobileControlsFloating, setMobileControlsFloating] = useState(false);
  const hasMobileUtilityControls = Boolean(backHref || leading || titleControls || actionsLeading);
  const actionsAlreadyUseDock = isValidElement(actions) && actions.type === GlassActionDock;

  useEffect(() => {
    if (!isSmallScreen || !hasMobileUtilityControls) {
      setMobileControlsFloating(false);
      return;
    }

    let animationFrame = 0;
    const updateFloatingState = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const barBottom = topBarRef.current?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
        setMobileControlsFloating(barBottom <= 52);
      });
    };

    updateFloatingState();
    window.addEventListener("scroll", updateFloatingState, { passive: true });
    window.addEventListener("resize", updateFloatingState);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateFloatingState);
      window.removeEventListener("resize", updateFloatingState);
    };
  }, [hasMobileUtilityControls, isSmallScreen]);

  const backControl = backHref ? (
    <SmartBackButton
      fallbackHref={backHref}
      label={backLabel}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300/65 bg-white/72 text-blue-600 shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-blue-200/45 backdrop-blur-[20px] transition-all duration-200 after:absolute after:-inset-1 after:content-[''] hover:scale-[1.03] hover:bg-white/90 hover:text-blue-700 active:scale-95"
    >
      <ArrowLeft className="h-4 w-4" />
    </SmartBackButton>
  ) : leading ? (
    <div className="shrink-0">{leading}</div>
  ) : null;

  const mobileFloatingControls = (
    <>
      <div className="flex w-full min-w-0 items-center gap-1.5">
        {backControl && (
          <div className="pointer-events-auto shrink-0">
            {backControl}
          </div>
        )}
        {actionsLeading && (
          <div className="pointer-events-auto ml-auto min-w-0 shrink-0">
            {actionsLeading}
          </div>
        )}
      </div>
      {titleControls && (
        <div className="pointer-events-auto flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-full border border-indigo-300/65 bg-white/72 p-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-indigo-200/45 backdrop-blur-[20px] [&>select]:!border-white/45 [&>select]:!bg-transparent [&>select]:!shadow-none">
          {titleControls}
        </div>
      )}
    </>
  );

  return (
    <>
      <div
        ref={topBarRef}
        className={cn(
          "glass-page-topbar-enter -mx-3 mb-4 overflow-visible rounded-b-[18px] border-b border-white/45 bg-white/72 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px] sm:-mx-6",
          sticky && "sm:sticky sm:top-0 sm:z-30",
          className
        )}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
        <div className={cn("w-full px-4 py-2.5 sm:px-6 lg:px-8", contentClassName)}>
          <div className={cn(
            inlineActions ? "flex items-center gap-2.5" : "flex flex-col gap-2.5 lg:flex-row lg:items-center",
          )}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {!isSmallScreen && (
                <div className="hidden sm:contents">
                  {backControl}
                </div>
              )}

              {isSmallScreen && !mobileControlsFloating && backControl}

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
                  {!isSmallScreen && (
                    <div className="hidden sm:contents">
                      {titleControls}
                    </div>
                  )}
                </div>
              </div>

              {isSmallScreen && !mobileControlsFloating && actionsLeading && (
                <div className="pointer-events-auto min-w-0 shrink-0">
                  {actionsLeading}
                </div>
              )}
            </div>

            {center && (
              <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
                {center}
              </div>
            )}

            {(actionsLeading || actions) && (
              <div className={cn(
                inlineActions
                  ? "hidden sm:flex sm:shrink-0 sm:items-center sm:justify-end sm:gap-2"
                  : "hidden sm:flex sm:w-full sm:shrink-0 sm:items-center sm:justify-center sm:gap-2 lg:w-auto lg:justify-start",
                actionsClassName,
              )}>
                {!isSmallScreen && actionsLeading}
                {actions}
              </div>
            )}
          </div>

          {isSmallScreen && titleControls && hasMobileUtilityControls && (
            <div className="mt-2 min-h-9 min-w-0 sm:hidden">
              <AnimatePresence initial={false}>
                {!mobileControlsFloating && (
                  <motion.div
                    key="glass-topbar-inline-controls"
                    initial={{
                      opacity: 0,
                      transform: prefersReducedMotion ? "none" : "translateY(-8px) scale(0.98)",
                    }}
                    animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
                    exit={{
                      opacity: 0,
                      transform: prefersReducedMotion ? "none" : "translateY(-8px) scale(0.98)",
                    }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="flex min-h-9 min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="pointer-events-auto flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-full border border-indigo-300/65 bg-white/72 p-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-indigo-200/45 backdrop-blur-[20px] [&>select]:!border-white/45 [&>select]:!bg-transparent [&>select]:!shadow-none">
                      {titleControls}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {below && <div className="mt-2.5">{below}</div>}
        </div>
      </div>

      {isSmallScreen && hasMobileUtilityControls && createPortal(
        <AnimatePresence initial={false}>
          {mobileControlsFloating && (
            <motion.div
              key="glass-topbar-floating-controls"
              initial={{
                opacity: 0,
                transform: prefersReducedMotion ? "none" : "translateY(8px) scale(0.98)",
              }}
              animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
              exit={{
                opacity: 0,
                transform: prefersReducedMotion ? "none" : "translateY(8px) scale(0.98)",
              }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-none fixed inset-x-3 top-[calc(3.25rem+env(safe-area-inset-top))] z-[35] flex min-w-0 flex-col items-start gap-1.5 sm:hidden"
            >
              {mobileFloatingControls}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {isSmallScreen && actions && !actionsAlreadyUseDock && (
        <GlassActionDock>{actions}</GlassActionDock>
      )}
    </>
  );
}

interface GlassPageSearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

export function GlassPageSearchInput({
  className,
  containerClassName,
  placeholder = "Search...",
  onFocus,
  onBlur,
  ...inputProps
}: GlassPageSearchInputProps) {
  const isSmallScreen = useSmallScreen();
  const [isFocused, setIsFocused] = useState(false);
  const hasValue =
    typeof inputProps.value === "string"
      ? inputProps.value.length > 0
      : typeof inputProps.defaultValue === "string"
        ? inputProps.defaultValue.length > 0
        : false;
  const isMobileExpanded = !isSmallScreen || hasValue || isFocused;

  return (
    <div
      className={cn(
        "glass-page-search-input group relative min-w-0 shrink-0 transition-[width,flex-basis] duration-200 ease-out",
        containerClassName,
      )}
      style={isSmallScreen ? {
        width: isMobileExpanded ? "min(50vw, 14rem)" : "2.25rem",
        flex: "none",
      } : undefined}
    >
      <div className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex items-center text-blue-500/80 transition-all duration-200 group-hover:text-blue-600",
        isSmallScreen && !isMobileExpanded ? "inset-x-0 justify-center pl-0" : "left-0 pl-2.5",
      )}>
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
          "h-[34px] rounded-full border border-blue-200/60 bg-white/90 text-xs shadow-sm transition-all duration-200 ease-out placeholder:text-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400/50",
          isSmallScreen
            ? (isMobileExpanded ? "w-full pl-7 pr-3" : "w-full px-0 placeholder:text-transparent")
            : (hasValue
              ? "w-56 pl-7 pr-8 lg:w-72"
              : "w-32 pl-7 pr-8 group-hover:w-56 focus:w-56 lg:group-hover:w-72 lg:focus:w-72"),
          className
        )}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...inputProps}
      />
    </div>
  );
}

interface GlassActionDockProps {
  children: ReactNode;
  className?: string;
}

function getVisibleMobileActionChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return getVisibleMobileActionChildren(child.props.children);
    }

    if (
      isValidElement<{ "data-mobile-action-hidden"?: boolean }>(child) &&
      child.props["data-mobile-action-hidden"]
    ) {
      return [];
    }

    return typeof child === "boolean" ? [] : [child];
  });
}

export function GlassActionDock({ children, className }: GlassActionDockProps) {
  const isSmallScreen = useSmallScreen();
  const actionCount = Math.max(1, getVisibleMobileActionChildren(children).length);
  const compactWidth = actionCount > 1 ? Math.min(360, actionCount * 58 + 8) : undefined;

  const dock = (
    <div
      className={cn(
        "glass-action-island flex max-w-full flex-nowrap items-center justify-center gap-0 overflow-x-auto rounded-full border border-indigo-300/65 bg-white/72 p-1 shadow-[0_4px_20px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] ring-1 ring-indigo-200/55 backdrop-blur-[20px] sm:w-auto sm:flex-wrap sm:justify-start sm:gap-1 sm:border-indigo-300/60 sm:bg-white/72 sm:px-2 sm:py-1 sm:shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:ring-1 sm:ring-indigo-200/45",
        className
      )}
      style={isSmallScreen ? { width: compactWidth } : undefined}
    >
      {children}
    </div>
  );

  if (isSmallScreen) {
    return createPortal(
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex justify-center sm:hidden">
        <div className="pointer-events-auto max-w-full">{dock}</div>
      </div>,
      document.body
    );
  }

  return (
    <div
      className={cn(
        "hidden sm:flex"
      )}
    >
      {dock}
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
      {icon && <span className="mb-0.5 flex h-5 w-5 items-center justify-center sm:h-4 sm:w-4">{icon}</span>}
      <span className="max-w-[52px] truncate text-[9px] font-semibold leading-none sm:max-w-none sm:text-[8px]">{label}</span>
    </>
  );

  const classes = cn(
    "relative flex h-11 min-w-11 max-w-[58px] flex-1 basis-0 flex-col items-center justify-center rounded-[18px] border border-transparent bg-transparent px-1 shadow-none transition-[color,background-color,box-shadow,transform] duration-200 hover:scale-[1.01] hover:bg-white/60 active:scale-95 active:bg-white/75 focus-visible:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:h-11 sm:w-11 sm:max-w-none sm:flex-none sm:rounded-full sm:border sm:bg-white sm:px-0 sm:shadow-sm sm:hover:scale-105 sm:hover:bg-gradient-to-br sm:hover:text-white sm:hover:shadow-md",
    actionToneClasses[tone],
    disabled && "pointer-events-none opacity-50",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={buttonProps.title || label} aria-label={buttonProps['aria-label'] || label}>
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
