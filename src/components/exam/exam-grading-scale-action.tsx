"use client";

import { useRef, useState } from "react";
import { Eye, Pencil, Settings } from "lucide-react";
import { GlassActionButton } from "@/components/common/glass-page-top-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NURSERY_COMMENTARY_OPTIONS } from "@/lib/exam-assessment";
import type { GradingScaleItem } from "@/types";

export function ExamGradingScaleAction({ gradingScale, isNursery, canEdit, onEdit }: {
  gradingScale: GradingScaleItem[];
  isNursery: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [isViewOpen, setIsViewOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassActionButton ref={triggerRef} label="Scale" aria-label="Grading scale" icon={<Settings className="h-4 w-4" />} tone="slate" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
          if (openingDialog.current) {
            event.preventDefault();
            openingDialog.current = false;
          }
        }}>
          <DropdownMenuItem onSelect={() => { openingDialog.current = true; setIsViewOpen(true); }}>
            <Eye className="h-4 w-4" /> View grading scale
          </DropdownMenuItem>
          {!isNursery && (
            <DropdownMenuItem disabled={!canEdit} onSelect={() => { openingDialog.current = true; onEdit(); }}>
              <Pencil className="h-4 w-4" /> Edit grading scale
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg" onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>{isNursery ? "Nursery Assessment Scale" : "Grading Scale"}</DialogTitle>
            <DialogDescription>The current scale used to assess this exam.</DialogDescription>
          </DialogHeader>
          {isNursery ? (
            <ul className="space-y-2">
              {NURSERY_COMMENTARY_OPTIONS.map((option) => <li key={option} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{option}</li>)}
            </ul>
          ) : (
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th scope="col" className="py-2">Grade</th><th scope="col" className="py-2">Marks</th><th scope="col" className="py-2 text-right">Aggregates</th></tr></thead>
              <tbody>
                {[...gradingScale].sort((a, b) => a.minMark - b.minMark).map((item, index) => (
                  <tr key={`${item.grade}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                    <th scope="row" className="py-2 font-semibold">{item.grade}</th>
                    <td className="py-2">{item.minMark}–{item.maxMark}</td>
                    <td className="py-2 text-right">{item.aggregates ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setIsViewOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
