"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, User, Calendar, Trophy, TrendingUp, Printer, Download } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const router = useRouter();
  const { toast } = useToast();
  
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

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PLE_Certificate_${formatPupilDisplayName(pupilResult).replace(/[^a-zA-Z0-9]/g, '_')}_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          <PageHeader title="Loading PLE Performance..." />
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
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          <PageHeader title="PLE Performance Not Found" />
          <div className="text-center py-8">
            <p className="text-muted-foreground">No PLE performance data found for this pupil.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title={`PLE Performance - ${pleRecord.year}`}
          description={`Detailed PLE examination results for ${formatPupilDisplayName(pupilResult)}`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {pupilResult.status !== 'missed' && (
                <Button onClick={handlePrintCertificate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Certificate
                </Button>
              )}
            </div>
          }
        />

        {/* Pupil Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Pupil Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">
                  {formatPupilDisplayName(pupilResult)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-medium">{pupilResult.gender}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admission Number</p>
                <p className="font-medium font-mono">{pupilResult.admissionNumber}</p>
              </div>
              {pupilResult.indexNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">Index Number</p>
                  <p className="font-medium font-mono">{pupilResult.indexNumber}</p>
                </div>
              )}
              {pupilResult.learnerIdentificationNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">LIN</p>
                  <p className="font-medium font-mono">{pupilResult.learnerIdentificationNumber}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Examination Year</p>
                <p className="font-medium">{pleRecord.year}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        {pupilResult.status === 'missed' ? (
          <Card>
            <CardContent className="text-center py-8">
              <Badge variant="destructive" className="text-lg px-4 py-2 mb-4">
                Missed Examination
              </Badge>
              <p className="text-muted-foreground">
                This pupil did not participate in the {pleRecord.year} PLE examination.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overall Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-600" />
                  Overall Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center p-6 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Total Aggregate
                      </span>
                    </div>
                    <p className="text-4xl font-bold text-foreground mb-2">
                      {pupilResult.totalAggregate}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Lower is better in PLE grading
                    </p>
                  </div>
                  
                  <div className="text-center p-6 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <GraduationCap className="h-6 w-6 text-purple-600" />
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Division
                      </span>
                    </div>
                    <div className="mb-2">
                      <Badge className={`${getDivisionColor(pupilResult.division)} text-2xl px-4 py-2 font-bold`}>
                        Division {pupilResult.division}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pupilResult.division === 'I' && 'Excellent Performance'}
                      {pupilResult.division === 'II' && 'Very Good Performance'}
                      {pupilResult.division === 'III' && 'Good Performance'}
                      {pupilResult.division === 'IV' && 'Satisfactory Performance'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subject Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Subject Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PLE_SUBJECTS.map(subject => (
                    <div key={subject.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{subject.name}</h4>
                          <p className="text-sm text-muted-foreground">{subject.code}</p>
                        </div>
                        {pupilResult.subjects[subject.id] ? (
                          <Badge 
                            className={`${getAggregateColor(pupilResult.subjects[subject.id])} text-lg px-3 py-1 font-mono font-bold`}
                          >
                            {pupilResult.subjects[subject.id]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-lg px-3 py-1 text-muted-foreground">
                            --
                          </Badge>
                        )}
                      </div>
                      {pupilResult.subjects[subject.id] && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">
                            Performance Level: <span className="font-medium">
                              {getPerformanceLevel(pupilResult.subjects[subject.id])}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* PLE Grading Information */}
            <Card>
              <CardHeader>
                <CardTitle>PLE Grading System</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <Badge className="bg-green-100 text-green-800 justify-center">Div I: 4-12 points</Badge>
                    <Badge className="bg-blue-100 text-blue-800 justify-center">Div II: 13-23 points</Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 justify-center">Div III: 24-29 points</Badge>
                    <Badge className="bg-orange-100 text-orange-800 justify-center">Div IV: 30+ points</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
} 