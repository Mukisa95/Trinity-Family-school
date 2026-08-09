"use client";

import { FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type IndividualReportPrintDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onPrintMini: () => void;
  onPrintFull: () => void;
  onPrintFullReport2: () => void;
  isGenerating: boolean;
  generationStatus: string;
  generationProgress: number;
  eta: string;
  pupilName?: string;
};

export function IndividualReportPrintDialog({
  isOpen,
  onClose,
  onPrintMini,
  onPrintFull,
  onPrintFullReport2,
  isGenerating,
  generationStatus,
  generationProgress,
  eta,
  pupilName,
}: IndividualReportPrintDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isGenerating) onClose();
    }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(event) => {
        if (isGenerating) event.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5 text-blue-600" />
            Print Reports{pupilName ? ` - ${pupilName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {isGenerating ? "Generating report PDF..." : "Select the type of report to generate"}
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <h3 className="mb-2 text-lg font-bold text-gray-900">Generating Report</h3>
            <p className="mb-4 text-sm font-medium text-blue-600">{generationStatus}</p>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full border bg-gray-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">{generationProgress}% Complete</span>
              <span className="font-medium text-blue-600">{eta}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={onPrintMini} className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2"><FileText className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Mini Report</h3>
                  <p className="text-sm text-gray-600">Professional primary report cards</p>
                </div>
              </div>
            </button>
            <button onClick={onPrintFull} className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2"><FileText className="h-5 w-5 text-orange-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Full Report</h3>
                  <p className="text-sm text-gray-600">Individual pupil report cards (Comprehensive design)</p>
                </div>
              </div>
            </button>
            <button onClick={onPrintFullReport2} className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2"><FileText className="h-5 w-5 text-indigo-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Bespoke Report</h3>
                  <p className="text-sm text-gray-600">Individual pupil report cards (fully customisable Trinity blue-and-gold design)</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {!isGenerating && <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
