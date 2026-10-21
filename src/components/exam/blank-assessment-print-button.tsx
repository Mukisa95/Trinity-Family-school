'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer } from 'lucide-react';
import { GlassActionButton } from '@/components/common/glass-page-top-bar';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';
import { useToast } from '@/hooks/use-toast';
import type { ExamRecordPupilInfo, ExamRecordSubjectInfo, GradingScaleItem } from '@/types';
import { BLANK_ASSESSMENT_OPTIONS } from '@/lib/utils/assessment-print-options';

type Props = {
  exam: { name: string; examTypeName?: string; startDate: string; endDate: string };
  className: string;
  pupils: ExamRecordPupilInfo[];
  subjects: ExamRecordSubjectInfo[];
  gradingScale: GradingScaleItem[];
  isNursery: boolean;
};

export function BlankAssessmentPrintButton({ exam, className, pupils, subjects, gradingScale, isNursery }: Props) {
  const [busy, setBusy] = useState(false);
  const viewer = usePDFViewer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const print = async () => {
    if (busy || !pupils.length || !subjects.length) return;
    setBusy(true);
    try {
      await viewer.runPDFJob({
        fileName: `${exam.name.replace(/[^a-z0-9_-]+/gi, '_')}_blank_assessment.pdf`,
        title: 'Blank assessment',
        initialMessage: 'Preparing blank assessment…',
      }, async ({ updateProgress }) => {
        const schoolSettings = await queryClient.fetchQuery({
          queryKey: ['schoolSettings'],
          queryFn: () => SchoolSettingsService.getSchoolSettings(),
          staleTime: 5 * 60 * 1000,
        });
        updateProgress(30, 'Preparing pupil names and empty subject columns…');
        // Only identity snapshots cross this boundary. Recorded/unsaved marks and totals never do.
        const processedResults = [...pupils]
          .sort((a, b) => a.name.localeCompare(b.name) || a.pupilId.localeCompare(b.pupilId))
          .map(pupil => ({
            pupilInfo: { name: pupil.name, pupilId: pupil.pupilId, admissionNumber: '' }, results: {}, totalMarks: 0,
            totalAggregates: 0, division: '', position: 0,
          }));
        const data = {
          examDetails: { ...exam, examTypeName: exam.examTypeName || '' },
          classSnap: { name: className }, subjectSnaps: subjects, processedResults,
          schoolSettings: schoolSettings || undefined, printOptions: BLANK_ASSESSMENT_OPTIONS,
        };
        const blob = isNursery
          ? (await import('./NurseryAssessmentPDF')).generateNurseryAssessmentPDF(data)
          : (await import('./ExamResultsPDF')).generateExamPDF({ ...data,
              gradingScale: gradingScale.map(band => ({ ...band, aggregates: band.aggregates ?? 9 })),
            });
        updateProgress(96, 'Finalizing blank assessment…');
        return blob;
      });
    } catch (error) {
      toast({ title: 'Unable to print assessment', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return <>
    <GlassActionButton label={busy ? 'Preparing' : 'Print'} tone="blue"
      icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
      onClick={() => { void print(); }} disabled={busy || !pupils.length || !subjects.length}
      title="Print a blank portrait assessment for this class or stream" />
    <PDFViewer isOpen={viewer.isOpen} onClose={viewer.closePDF} pdfBlob={viewer.pdfBlob}
      fileName={viewer.fileName} title={viewer.title} showDownload showPrint />
  </>;
}
