"use client";

import React from 'react';
import { useNavigation } from '@/lib/contexts/navigation-context';
import { ArrowLeft, BookOpen, GraduationCap, User, Download } from 'lucide-react';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePLERecord, usePLEResultsWithCurrentData } from '@/lib/hooks/use-ple-results';
import { usePupil } from '@/lib/hooks/use-pupils';
import { Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import CertificatePDFDocument from '@/components/certificates/PLECertificatePDF';
import QRCode from 'qrcode';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { PDFViewer } from '@/components/pdf/pdf-viewer';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';

const PLE_SUBJECTS = [
  { id: 'english', name: 'English', code: 'ENG' },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH' },
  { id: 'science', name: 'Science', code: 'SCI' },
  { id: 'social_studies', name: 'Social Studies', code: 'SST' },
];

const getDivisionColor = (division: string) => {
  switch (division) {
    case 'I': return 'bg-green-100 text-green-800 border-green-200';
    case 'II': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'III': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'IV': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getAggregateColor = (aggregate: string) => {
  if (aggregate.startsWith('D')) return 'bg-green-100 text-green-800';
  if (aggregate.startsWith('C')) return 'bg-blue-100 text-blue-800';
  if (aggregate.startsWith('P')) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

const getPerformanceLevel = (aggregate: string) => {
  if (aggregate.startsWith('D')) return 'Distinction';
  if (aggregate.startsWith('C')) return 'Credit';
  if (aggregate.startsWith('P')) return 'Pass';
  return 'Fail';
};

export default function IndividualPLEPerformancePage({ 
  params 
}: { 
  params: Promise<{ pupilId: string; pleId: string }> 
}) {
  const { goBack } = useNavigation();
  const { toast } = useToast();
  
  // PDF Viewer hook
  const pdfViewer = usePDFViewer();
  
  // Unwrap params using React.use()
  const { pupilId, pleId } = React.use(params);
  
  // Hooks
  const { data: pleRecord, isLoading: recordLoading } = usePLERecord(pleId);
  const { data: allResults = [], isLoading: resultsLoading } = usePLEResultsWithCurrentData(pleId);
  const { data: pupilData, isLoading: pupilLoading } = usePupil(pupilId);
  const { data: schoolSettings } = useSchoolSettings();
  
  // Find the specific pupil's result
  const pupilResult = React.useMemo(() => {
    return allResults.find(result => result.pupilId === pupilId);
  }, [allResults, pupilId]);
  
  const isLoading = recordLoading || resultsLoading || pupilLoading;

  // Handle certificate generation - using same logic as View Results page
  const handlePrintCertificate = async () => {
    try {
      // Check if pupil has complete results
      if (pupilResult?.status === 'missed') {
        toast({
          variant: "destructive",
          title: "Cannot Print Certificate",
          description: "Cannot generate certificate for pupils who missed the exam.",
        });
        return;
      }

      if (!pupilResult?.division || pupilResult.totalAggregate === 0) {
        toast({
          variant: "destructive",
          title: "Incomplete Results",
          description: "Cannot generate certificate. Pupil results are incomplete.",
        });
        return;
      }

      // Prepare subjects data for certificate
      const subjects = PLE_SUBJECTS.map(subject => ({
        name: subject.name,
        grade: pupilResult.subjects[subject.id] || '--'
      }));

      // Get school information from settings
      const schoolName = schoolSettings?.generalInfo?.name || 'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL';
      const schoolLogo = schoolSettings?.generalInfo?.logo;
      const schoolMotto = schoolSettings?.generalInfo?.motto || 'STRIVE TO EXCEL';
      const headTeacherSignature = schoolSettings?.headTeacher?.signature;

      // Prepare school contact information
      const schoolContact = {
        phone: schoolSettings?.contact?.phone,
        alternativePhone: schoolSettings?.contact?.alternativePhone,
        email: schoolSettings?.contact?.email,
        website: schoolSettings?.contact?.website,
        address: schoolSettings?.address?.physical,
        postal: schoolSettings?.address?.postal,
        poBox: schoolSettings?.address?.poBox,
        city: schoolSettings?.address?.city
      };

      // Generate QR code with pupil data
      const qrData = `Name: ${formatPupilDisplayName(pupilResult)}
Index: ${pupilResult.indexNumber || 'N/A'}
LIN: ${pupilResult.learnerIdentificationNumber || 'N/A'}
Total: ${pupilResult.totalAggregate}
Division: ${pupilResult.division}`;

      // Generate a compact, scannable QR code (keep it square for readability)
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 80,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'L',
        type: 'image/png'
      });

      // Generate PDF
      const doc = (
        <CertificatePDFDocument
          pupilName={formatPupilDisplayName(pupilResult)}
          admissionNumber={pupilResult.admissionNumber}
          indexNumber={pupilResult.indexNumber}
          learnerIdentificationNumber={pupilResult.learnerIdentificationNumber}
          additionalIdentifiers={pupilResult.additionalIdentifiers}
          schoolName={schoolName}
          division={pupilResult.division}
          subjects={subjects}
          totalMarks={pupilResult.totalAggregate.toString()}
          conduct="GOOD"
          date={new Date().toLocaleDateString()}
          schoolLogo={schoolLogo}
          motto={schoolMotto}
          signatureUrl={headTeacherSignature}
          pupilPhoto={pupilResult.photo}
          qrCodeDataUrl={qrCodeDataUrl}
          schoolContact={schoolContact}
        />
      );

      const fileName = `PLE_Certificate_${formatPupilDisplayName(pupilResult).replace(/[^a-zA-Z0-9]/g, '_')}_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      const title = 'PLE Certificate';
      await pdfViewer.runPDFJob(
        { fileName, title, initialMessage: `Rendering ${formatPupilDisplayName(pupilResult)}'s certificate…` },
        async ({ updateProgress }) => {
          updateProgress(24, 'Preparing certificate layout…');
          const blob = await pdf(doc).toBlob();
          updateProgress(96, 'Finalizing certificate…');
          return blob;
        },
      );

      toast({
        title: "Certificate Generated",
        description: `Certificate for ${formatPupilDisplayName(pupilResult)} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate certificate. Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <GlassPageTopBar
          title="PLE Performance"
          subtitle="Loading pupil performance..."
          backHref={`/exams/ple-results/${pleId}/view-results`}
          backLabel="Back to results"
        />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading pupil performance...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pupilResult || !pleRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <GlassPageTopBar
          title="PLE Performance"
          subtitle="PLE Performance Not Found"
          backHref={`/exams/ple-results/${pleId}/view-results`}
          backLabel="Back to results"
        />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-8">
            <p className="text-muted-foreground">No PLE performance data found for this pupil.</p>
            <Button onClick={() => goBack(`/exams/ple-results/${pleId}/view-results`)} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-in fade-in duration-500">
      <GlassPageTopBar
        title={`PLE Performance - ${pleRecord.year}`}
        className="mb-3 sm:mb-4"
        recordDetails={pleRecord.examName}
        backHref={`/exams/ple-results/${pleId}/view-results`}
        backLabel="Back to results"
        actions={
          pupilResult.status !== 'missed' ? (
            <GlassActionDock>
              <GlassActionButton
                label="Certificate"
                aria-label="Download Certificate"
                title="Download Certificate"
                icon={<Download className="h-4 w-4" />}
                tone="blue"
                onClick={handlePrintCertificate}
              />
            </GlassActionDock>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-7xl pb-4 sm:pb-6">
        <section aria-label="Pupil and PLE results summary" className="mb-3 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm sm:mb-4">
          <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600" aria-hidden="true">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-base font-bold leading-snug text-gray-900 sm:text-lg">{formatPupilDisplayName(pupilResult)}</h2>
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 sm:text-sm">
                <div className="flex min-w-0 gap-1"><dt>Admission:</dt><dd className="break-all font-medium text-gray-900">{pupilResult.admissionNumber}</dd></div>
                <div className="flex gap-1"><dt>Gender:</dt><dd className="font-medium text-gray-900">{pupilResult.gender}</dd></div>
                {pupilResult.indexNumber && <div className="flex min-w-0 gap-1"><dt>Index:</dt><dd className="break-all font-medium text-gray-900">{pupilResult.indexNumber}</dd></div>}
                {pupilResult.learnerIdentificationNumber && <div className="flex min-w-0 gap-1"><dt>LIN:</dt><dd className="break-all font-medium text-gray-900">{pupilResult.learnerIdentificationNumber}</dd></div>}
              </dl>
            </div>
          </div>

          {pupilResult.status === 'missed' ? (
            <div className="border-t border-indigo-100 px-3 py-3 sm:px-4">
              <Badge variant="destructive" className="border-0 px-2 py-0.5 text-xs">Missed Examination</Badge>
              <p className="mt-1.5 text-xs text-gray-600">This pupil did not participate in the {pleRecord.year} PLE examination.</p>
            </div>
          ) : (
            <dl className="grid grid-cols-2 border-t border-indigo-100 bg-indigo-50/40">
              <div className="min-w-0 border-r border-indigo-100 px-3 py-2.5 sm:px-4">
                <dt className="text-xs font-medium text-gray-600">Total aggregate</dt>
                <dd className="mt-0.5">
                  <span className="block text-2xl font-bold leading-tight tabular-nums text-purple-700">{pupilResult.totalAggregate}</span>
                  <span className="mt-0.5 block text-[11px] text-gray-500">Lower is better</span>
                </dd>
              </div>
              <div className="min-w-0 px-3 py-2.5 sm:px-4">
                <dt className="text-xs font-medium text-gray-600">Division</dt>
                <dd className="mt-1">
                  <Badge className={`${getDivisionColor(pupilResult.division)} border-0 px-2 py-0.5 text-sm font-bold`}>Division {pupilResult.division}</Badge>
                  <span className="mt-1 block text-[11px] text-gray-500">
                    {pupilResult.division === 'I' && 'Excellent Performance'}
                    {pupilResult.division === 'II' && 'Very Good Performance'}
                    {pupilResult.division === 'III' && 'Good Performance'}
                    {pupilResult.division === 'IV' && 'Satisfactory Performance'}
                  </span>
                </dd>
              </div>
            </dl>
          )}
        </section>

        {pupilResult.status !== 'missed' && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <Tabs defaultValue="results" className="w-full">
              <div className="border-b border-gray-200 bg-gray-50/80 p-1">
                <TabsList aria-label="PLE results" className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0">
                  <TabsTrigger value="results" className="min-h-11 min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:text-sm">
                    <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Subject Results
                  </TabsTrigger>
                  <TabsTrigger value="grading" className="min-h-11 min-w-0 gap-1.5 rounded-lg px-2 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:text-sm">
                    <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Grading Guide
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="results" className="mt-0 p-0">
                <table className="w-full table-fixed text-sm">
                  <caption className="sr-only">PLE subject grades and performance for {formatPupilDisplayName(pupilResult)}.</caption>
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-xs text-gray-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium sm:px-4">Subject</th>
                      <th scope="col" className="w-20 px-2 py-2 text-right font-medium sm:w-28 sm:px-4">Grade</th>
                      <th scope="col" className="hidden w-40 px-4 py-2 text-left font-medium md:table-cell">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {PLE_SUBJECTS.map(subject => {
                      const grade = pupilResult.subjects[subject.id];
                      return (
                        <tr key={subject.id} className="hover:bg-indigo-50/40">
                          <th scope="row" className="px-3 py-2.5 text-left font-normal sm:px-4">
                            <span className="block break-words font-semibold leading-snug text-gray-900">{subject.name}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{subject.code}<span className="md:hidden"> · {grade ? getPerformanceLevel(grade) : 'Not recorded'}</span></span>
                          </th>
                          <td className="px-2 py-2.5 text-right align-middle sm:px-4">
                            {grade ? <Badge className={`${getAggregateColor(grade)} border-0 px-2 py-0.5 text-xs font-bold`}>{grade}</Badge> : <Badge variant="outline" className="px-2 py-0.5 text-xs text-gray-500" aria-label="Not recorded">--</Badge>}
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs text-gray-600 md:table-cell">{grade ? getPerformanceLevel(grade) : 'Not recorded'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="grading" className="mt-0 p-3 sm:p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">PLE Grading System</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs sm:text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Distinctions</h4>
                    <div className="space-y-1">
                      <Badge className="bg-green-100 text-green-800 w-full justify-center">D1 (1 point)</Badge>
                      <Badge className="bg-green-100 text-green-800 w-full justify-center">D2 (2 points)</Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Credits</h4>
                    <div className="space-y-1">
                      <Badge className="bg-blue-100 text-blue-800 w-full justify-center">C3 (3 points)</Badge>
                      <Badge className="bg-blue-100 text-blue-800 w-full justify-center">C4 (4 points)</Badge>
                      <Badge className="bg-blue-100 text-blue-800 w-full justify-center">C5 (5 points)</Badge>
                      <Badge className="bg-blue-100 text-blue-800 w-full justify-center">C6 (6 points)</Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Passes</h4>
                    <div className="space-y-1">
                      <Badge className="bg-yellow-100 text-yellow-800 w-full justify-center">P7 (7 points)</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800 w-full justify-center">P8 (8 points)</Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Fail</h4>
                    <div className="space-y-1">
                      <Badge className="bg-red-100 text-red-800 w-full justify-center">F9 (9 points)</Badge>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div>
                  <h4 className="font-medium mb-2">Division Classification</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs sm:text-sm">
                    <Badge className="bg-green-100 text-green-800 justify-center">Div I: 4-12 points</Badge>
                    <Badge className="bg-blue-100 text-blue-800 justify-center">Div II: 13-23 points</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 justify-center">Div III: 24-29 points</Badge>
                    <Badge className="bg-orange-100 text-orange-800 justify-center">Div IV: 30+ points</Badge>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* PDF Viewer */}
      <PDFViewer
        isOpen={pdfViewer.isOpen}
        onClose={pdfViewer.closePDF}
        pdfBlob={pdfViewer.pdfBlob}
        fileName={pdfViewer.fileName}
        title={pdfViewer.title}
        showDownload={true}
        showPrint={true}
      />
    </div>
  );
}
