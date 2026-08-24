"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Printer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ReportKind = "assessment" | "mini" | "full" | "bespoke";

type ReportCreationDialogProps = {
  open: boolean;
  onClose: () => void;
  onPrintAssessment: () => void;
  onPrintMini: () => void;
  onPrintFull: () => void;
  onPrintBespoke: () => void;
  isNursery?: boolean;
  isIndividual?: boolean;
  scope: string;
  omitNurseryTeacherComment: boolean;
  onOmitNurseryTeacherCommentChange: (omit: boolean) => void;
};

const FLOW_STEPS = ["Report", "Format", "Options", "Review"];

type ReportCreationDialogFrameProps = {
  open: boolean;
  onClose: () => void;
  scope: string;
  step: number;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  icon?: LucideIcon;
  maxWidthClassName?: string;
  bodyClassName?: string;
  flowSteps?: readonly string[];
};

export function ReportCreationDialogFrame({
  open,
  onClose,
  scope,
  step,
  title,
  description,
  children,
  footer,
  icon: Icon = Printer,
  maxWidthClassName = "sm:max-w-2xl",
  bodyClassName,
  flowSteps = FLOW_STEPS,
}: ReportCreationDialogFrameProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className={cn(
        "gap-0 overflow-hidden !rounded-[32px] !border-slate-200 !bg-white !p-0 !text-slate-950 shadow-[0_32px_90px_rgba(15,23,42,0.24)] dark:!border-slate-200 dark:!bg-white dark:!text-slate-950",
        maxWidthClassName,
      )}>
        <DialogHeader className="border-b border-slate-100 px-5 pb-5 pt-7 sm:px-8">
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 ring-4 ring-blue-50/80">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                {title}
              </DialogTitle>
              <DialogDescription className="truncate text-sm font-medium text-slate-600">
                {scope}
              </DialogDescription>
            </div>
          </div>
          <p className="pt-2 text-sm leading-6 text-slate-600">{description}</p>
        </DialogHeader>

        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-8">
          <ol
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${flowSteps.length}, minmax(0, 1fr))` }}
            aria-label="Report creation progress"
          >
            {flowSteps.map((flowStep, index) => {
              const isComplete = index < step;
              const isCurrent = index === step;
              return (
                <li key={flowStep} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        isComplete || isCurrent
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-500",
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    {index < flowSteps.length - 1 && (
                      <span className={cn("hidden h-px flex-1 sm:block", index < step ? "bg-blue-300" : "bg-slate-200")} />
                    )}
                  </div>
                  <span className={cn("mt-1.5 block text-xs font-semibold", isCurrent ? "text-blue-700" : "text-slate-500")}>
                    {flowStep}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={cn("max-h-[min(58dvh,35rem)] overflow-y-auto px-5 py-6 sm:px-8", bodyClassName)}>
          {children}
        </div>

        <DialogFooter className="mt-0 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-8">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportCreationDialog({
  open,
  onClose,
  onPrintAssessment,
  onPrintMini,
  onPrintFull,
  onPrintBespoke,
  isNursery = false,
  isIndividual = false,
  scope,
  omitNurseryTeacherComment,
  onOmitNurseryTeacherCommentChange,
}: ReportCreationDialogProps) {
  const [selectedReport, setSelectedReport] = useState<ReportKind | null>(null);
  const isIndividualReport = isIndividual;

  const options = useMemo(() => {
    const availableOptions: Array<{
      value: ReportKind;
      title: string;
      description: string;
      icon: typeof FileText;
      iconClassName: string;
    }> = [];

    if (!isIndividualReport) {
      availableOptions.push({
        value: "assessment",
        title: "Assessment report",
        description: "A class-wide breakdown of attainment by subject.",
        icon: FileSpreadsheet,
        iconClassName: "bg-sky-50 text-sky-700",
      });
    }

    availableOptions.push({
      value: "mini",
      title: "Mini report",
      description: isIndividualReport
        ? isNursery
          ? "A playful nursery report card for this pupil."
          : "A concise, professional report card for this pupil."
        : isNursery
          ? "Playful nursery report cards, arranged two per page."
          : "Concise, professional report cards, arranged two per page.",
      icon: FileText,
      iconClassName: "bg-teal-50 text-teal-700",
    });

    if (!isNursery) {
      availableOptions.push(
        {
          value: "full",
          title: "Full report",
          description: isIndividualReport
            ? "A comprehensive academic report card for this pupil."
            : "Comprehensive academic report cards for the selected pupils.",
          icon: FileText,
          iconClassName: "bg-blue-50 text-blue-700",
        },
        {
          value: "bespoke",
          title: "Bespoke report",
          description: isIndividualReport
            ? "A fully customisable Trinity blue-and-gold report for this pupil."
            : "A fully customisable Trinity blue-and-gold report design.",
          icon: FileText,
          iconClassName: "bg-indigo-50 text-indigo-700",
        },
      );
    }

    return availableOptions;
  }, [isIndividualReport, isNursery]);

  useEffect(() => {
    if (!open) {
      setSelectedReport(null);
    }
  }, [open]);

  const continueToReport = () => {
    if (!selectedReport) return;

    const actionByReport: Record<ReportKind, () => void> = {
      assessment: onPrintAssessment,
      mini: onPrintMini,
      full: onPrintFull,
      bespoke: onPrintBespoke,
    };

    // Start the existing report route first so an individual report retains its selected pupil.
    actionByReport[selectedReport]();
    onClose();
  };

  return (
    <ReportCreationDialogFrame
      open={open}
      onClose={onClose}
      scope={scope}
      step={0}
      title="Create pupil reports"
      description="Select the report format that best suits this result set. You can adjust its details in the next step."
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="min-h-11 rounded-full px-4 font-semibold text-slate-700 hover:bg-slate-200/70 hover:text-slate-950"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={continueToReport}
            disabled={!selectedReport}
            className="min-h-11 rounded-full bg-blue-600 px-6 font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-600"
          >
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-3" role="radiogroup" aria-label="Report format">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = selectedReport === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedReport(option.value)}
              className={cn(
                "group flex min-h-24 w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                selected
                  ? "border-blue-600 bg-blue-50/70 shadow-[0_8px_24px_rgba(37,99,235,0.10)]"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50 active:scale-[0.99]",
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", option.iconClassName)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-slate-950">{option.title}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-600">{option.description}</span>
              </span>
              {selected ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-label="Selected">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : (
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {isNursery && !isIndividualReport && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <Checkbox
            id="omit-nursery-teacher-comment"
            checked={omitNurseryTeacherComment}
            onCheckedChange={(checked) => onOmitNurseryTeacherCommentChange(checked === true)}
            className="mt-0.5 h-5 w-5 border-blue-300"
          />
          <div className="space-y-1">
            <Label htmlFor="omit-nursery-teacher-comment" className="cursor-pointer text-sm font-semibold text-slate-900">
              Leave the class teacher&apos;s comment blank
            </Label>
            <p className="text-sm leading-5 text-slate-600">
              The report will show two writing lines and place the signature on the second line.
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-slate-600" aria-live="polite">
        {selectedReport
          ? `Selected: ${options.find((option) => option.value === selectedReport)?.title}`
          : "Choose a report format to continue."}
      </p>
    </ReportCreationDialogFrame>
  );
}
