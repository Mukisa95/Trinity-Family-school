"use client";

import * as React from "react";
import { ArrowLeft, Download, Search, X, GraduationCap, Users, Trophy, TrendingUp, Star, Medal, Printer } from "lucide-react";
import { pdf } from '@react-pdf/renderer';
import CertificatePDFDocument from '@/components/certificates/PLECertificatePDF';
import PLEBatchCertificatesPDF from '@/components/certificates/PLEBatchCertificatesPDF';
import QRCode from 'qrcode';
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Import Firebase hooks and types
import { 
  usePLERecord, 
  usePLEResultsWithCurrentData 
} from "@/lib/hooks/use-ple-results";
import { useSchoolSettings } from "@/lib/hooks/use-school-settings";
import type { PLEPupilResult, PLERecord } from "@/lib/services/ple-results.service";
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// PLE Subjects
const PLE_SUBJECTS = [
  { id: 'english', name: 'English', code: 'ENG' },
  { id: 'mathematics', name: 'Mathematics', code: 'MATH' },
  { id: 'science', name: 'Science', code: 'SCI' },
  { id: 'social_studies', name: 'Social Studies', code: 'SST' },
];

interface PLEStatistics {
  totalCandidates: number;
  divisionI: number;
  divisionII: number;
  divisionIII: number;
  divisionIV: number;
  maleCount: number;
  femaleCount: number;
  averageAggregate: number;
  bestPerformer: PLEPupilResult | null;
}

// Calculate statistics
const calculateStatistics = (results: PLEPupilResult[]): PLEStatistics => {
  const totalCandidates = results.length;
  const maleCount = results.filter(r => r.gender === 'Male').length;
  const femaleCount = results.filter(r => r.gender === 'Female').length;
  
  // Only count pupils who participated and have complete results for division statistics
  const participatedResults = results.filter(r => r.status !== 'missed');
  const completeResults = participatedResults.filter(r => 
    r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
  );
  
  const divisionI = completeResults.filter(r => r.division === 'I').length;
  const divisionII = completeResults.filter(r => r.division === 'II').length;
  const divisionIII = completeResults.filter(r => r.division === 'III').length;
  const divisionIV = completeResults.filter(r => r.division === 'IV').length;
  
  // Calculate average only for pupils with complete results who participated
  const totalAggregate = completeResults.reduce((sum, r) => sum + r.totalAggregate, 0);
  const averageAggregate = completeResults.length > 0 ? totalAggregate / completeResults.length : 0;
  
  // Find best performer among those with complete results who participated
  const bestPerformer = completeResults.reduce((best, current) => {
    if (!best || (current.totalAggregate > 0 && current.totalAggregate < best.totalAggregate)) {
      return current;
    }
    return best;
  }, null as PLEPupilResult | null);

  return {
    totalCandidates,
    divisionI,
    divisionII,
    divisionIII,
    divisionIV,
    maleCount,
    femaleCount,
    averageAggregate: Math.round(averageAggregate * 10) / 10,
    bestPerformer
  };
};

// Get aggregate badge color
const getAggregateBadgeVariant = (aggregate: string) => {
  if (['D1', 'D2'].includes(aggregate)) return 'default';
  if (['C3', 'C4', 'C5', 'C6'].includes(aggregate)) return 'secondary';
  if (['P7', 'P8'].includes(aggregate)) return 'outline';
  return 'destructive'; // F9
};

// Get division badge color
const getDivisionBadgeVariant = (division: string) => {
  switch (division) {
    case 'I': return 'default';
    case 'II': return 'secondary';
    case 'III': return 'outline';
    case 'IV': return 'destructive';
    default: return 'outline';
  }
};

export default function ViewPLEResultsPage({ params }: { params: Promise<{ pleId: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  
  // Unwrap params using React.use()
  const { pleId } = React.use(params);
  
  // Firebase hooks
  const { data: pleRecord, isLoading: recordLoading, error: recordError } = usePLERecord(pleId);
  const { data: rawPupilResults = [], isLoading: resultsLoading, error: resultsError } = usePLEResultsWithCurrentData(pleId);
  const { data: schoolSettings } = useSchoolSettings();
  
  // Memoize pupil results to prevent unnecessary re-renders
  const pupilResults = React.useMemo(() => {
    return rawPupilResults || [];
  }, [rawPupilResults]);
  
  // State management
  const [mounted, setMounted] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [divisionFilter, setDivisionFilter] = React.useState<string>("all");
  const [genderFilter, setGenderFilter] = React.useState<string>("all");
  const [completionFilter, setCompletionFilter] = React.useState<string>("all");

  // Mount effect
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle error states
  React.useEffect(() => {
    if (recordError || resultsError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load PLE results. Please try again.",
      });
    }
  }, [recordError, resultsError]);

  const isLoading = recordLoading || resultsLoading;

  // Filter results using useMemo instead of useEffect to prevent infinite loops
  const filteredResults = React.useMemo(() => {
    // Only filter if component is mounted and we have data
    if (!mounted || !pupilResults || pupilResults.length === 0) {
      return [];
    }

    let filtered = [...pupilResults]; // Create a copy to avoid mutations

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(pupil => 
        formatPupilDisplayName(pupil).toLowerCase().includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower)
      );
    }

    // Division filter
    if (divisionFilter !== "all") {
      filtered = filtered.filter(pupil => pupil.division === divisionFilter);
    }

    // Gender filter
    if (genderFilter !== "all") {
      filtered = filtered.filter(pupil => pupil.gender === genderFilter);
    }

    // Completion filter
    if (completionFilter !== "all") {
      if (completionFilter === "complete") {
        filtered = filtered.filter(pupil => 
          pupil.status !== 'missed' && pupil.division && pupil.totalAggregate > 0 && Object.values(pupil.subjects).every(aggregate => aggregate)
        );
      } else if (completionFilter === "partial") {
        filtered = filtered.filter(pupil => 
          pupil.status !== 'missed' && 
          (Object.values(pupil.subjects).some(aggregate => aggregate) || pupil.division) &&
          !(pupil.division && pupil.totalAggregate > 0 && Object.values(pupil.subjects).every(aggregate => aggregate))
        );
      } else if (completionFilter === "none") {
        filtered = filtered.filter(pupil => 
          pupil.status !== 'missed' && 
          Object.values(pupil.subjects).every(aggregate => !aggregate) && !pupil.division
        );
      } else if (completionFilter === "missed") {
        filtered = filtered.filter(pupil => pupil.status === 'missed');
      }
    }

    return filtered;
  }, [mounted, pupilResults, searchTerm, divisionFilter, genderFilter, completionFilter]);

  // Calculate statistics using useMemo instead of useEffect to prevent infinite loops
  const statistics = React.useMemo(() => {
    if (!mounted || !pupilResults || pupilResults.length === 0) {
      return null;
    }
    
    // Debug: Log the first pupil to see what data we have
    if (pupilResults.length > 0) {
      console.log('Sample pupil data:', pupilResults[0]);
      console.log('Admission numbers:', pupilResults.map(p => ({ id: p.pupilId, admissionNumber: p.admissionNumber })));
    }
    
    return calculateStatistics(pupilResults);
  }, [mounted, pupilResults]);

  // Export batch certificates
  const handleExportResults = async () => {
    try {
      // Filter pupils with complete results who didn't miss the exam
      const validPupils = pupilResults.filter(pupil => 
        pupil.status !== 'missed' && 
        pupil.division && 
        pupil.totalAggregate > 0
      );

      if (validPupils.length === 0) {
        toast({
          variant: "destructive",
          title: "No Valid Results",
          description: "No pupils with complete results found to generate certificates.",
        });
        return;
      }

      toast({
        title: "Generating Certificates",
        description: `Generating batch certificates for ${validPupils.length} pupils...`,
      });

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

      // Generate QR codes for all valid pupils
      const qrCodes: Record<string, string> = {};
      
      for (const pupil of validPupils) {
        const qrData = `Name: ${formatPupilDisplayName(pupil)}
Index: ${pupil.indexNumber || 'N/A'}
LIN: ${pupil.learnerIdentificationNumber || 'N/A'}
Total: ${pupil.totalAggregate}
Division: ${pupil.division}`;

        try {
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
          qrCodes[pupil.pupilId] = qrCodeDataUrl;
        } catch (qrError) {
          console.warn(`Failed to generate QR code for pupil ${pupil.pupilId}:`, qrError);
        }
      }

      // Generate batch PDF
      const doc = (
        <PLEBatchCertificatesPDF
          pupils={validPupils}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          motto={schoolMotto}
          signatureUrl={headTeacherSignature}
          year={pleRecord?.year || new Date().getFullYear()}
          examName={pleRecord?.examName || 'PLE'}
          schoolContact={schoolContact}
          qrCodes={qrCodes}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PLE_Batch_Certificates_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Certificates Generated",
        description: `Batch certificates for ${validPupils.length} pupils have been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error generating batch certificates:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate batch certificates. Please try again.",
      });
    }
  };

  // Print certificate function
  const handlePrintCertificate = async (pupil: PLEPupilResult) => {
    try {
      // Check if pupil has complete results
      if (pupil.status === 'missed') {
        toast({
          variant: "destructive",
          title: "Cannot Print Certificate",
          description: "Cannot generate certificate for pupils who missed the exam.",
        });
        return;
      }

      if (!pupil.division || pupil.totalAggregate === 0) {
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
        grade: pupil.subjects[subject.id] || '--'
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
      const qrData = `Name: ${formatPupilDisplayName(pupil)}
Index: ${pupil.indexNumber || 'N/A'}
LIN: ${pupil.learnerIdentificationNumber || 'N/A'}
Total: ${pupil.totalAggregate}
Division: ${pupil.division}`;

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
          pupilName={formatPupilDisplayName(pupil)}
          admissionNumber={pupil.admissionNumber}
          indexNumber={pupil.indexNumber}
          learnerIdentificationNumber={pupil.learnerIdentificationNumber}
          schoolName={schoolName}
          division={pupil.division}
          subjects={subjects}
          totalMarks={pupil.totalAggregate.toString()}
          conduct="GOOD"
          date={new Date().toLocaleDateString()}
          schoolLogo={schoolLogo}
          motto={schoolMotto}
          signatureUrl={headTeacherSignature}
          pupilPhoto={pupil.photo}
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
      link.download = `PLE_Certificate_${formatPupilDisplayName(pupil).replace(/[^a-zA-Z0-9]/g, '_')}_${pleRecord?.year || new Date().getFullYear()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Certificate Generated",
        description: `Certificate for ${formatPupilDisplayName(pupil)} has been downloaded.`,
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

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <PageHeader title="View PLE Results" />
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading PLE results...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pleRecord) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <PageHeader title="View PLE Results" />
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-red-600 mb-2">PLE record not found</p>
              <Button onClick={() => router.push('/exams/ple-results')}>
                Back to PLE Results
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <PageHeader
          title={`View Results - ${pleRecord.examName}`}
          description="View PLE examination results and statistics."
          actions={
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => router.push('/exams/ple-results')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleExportResults}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Batch Certificates
              </Button>
            </div>
          }
        />

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.totalCandidates}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.maleCount} Male, {statistics.femaleCount} Female
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Division I</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{statistics.divisionI}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.totalCandidates > 0 ? 
                    `${((statistics.divisionI / statistics.totalCandidates) * 100).toFixed(1)}% of candidates` :
                    'No complete results yet'
                  }
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Aggregate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.averageAggregate}</div>
                <p className="text-xs text-muted-foreground">
                  Lower is better in PLE
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
                <Star className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-bold">
                  {statistics.bestPerformer ? 
                    formatPupilDisplayName(statistics.bestPerformer) : 
                    'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics.bestPerformer ? `${statistics.bestPerformer.totalAggregate} aggregate` : 'No complete results yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Status</CardTitle>
                <GraduationCap className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {pupilResults.filter(r => 
                    r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
                  ).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {statistics.totalCandidates} complete
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Division Breakdown */}
        {statistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-purple-600" />
                Division Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{statistics.divisionI}</div>
                  <Badge variant="default" className="mt-1">Division I</Badge>
                  <p className="text-xs text-muted-foreground mt-1">4-12 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statistics.divisionII}</div>
                  <Badge variant="secondary" className="mt-1">Division II</Badge>
                  <p className="text-xs text-muted-foreground mt-1">13-23 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{statistics.divisionIII}</div>
                  <Badge variant="outline" className="mt-1">Division III</Badge>
                  <p className="text-xs text-muted-foreground mt-1">24-29 points</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statistics.divisionIV}</div>
                  <Badge variant="destructive" className="mt-1">Division IV</Badge>
                  <p className="text-xs text-muted-foreground mt-1">30+ points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search candidates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  {searchTerm && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0" 
                      onClick={() => setSearchTerm('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="w-full sm:w-48">
                <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    <SelectItem value="I">Division I</SelectItem>
                    <SelectItem value="II">Division II</SelectItem>
                    <SelectItem value="III">Division III</SelectItem>
                    <SelectItem value="IV">Division IV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-48">
                <Select value={completionFilter} onValueChange={setCompletionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by completion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="complete">Complete Results</SelectItem>
                    <SelectItem value="partial">Partial Results</SelectItem>
                    <SelectItem value="none">No Results</SelectItem>
                    <SelectItem value="missed">Missed Exam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <div className="rounded-lg border shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Candidate</TableHead>
                  <TableHead className="w-40">PIN / Index No.</TableHead>
                  {PLE_SUBJECTS.map(subject => (
                    <TableHead key={subject.id} className="text-center w-24">
                      {subject.code}
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-32">Total Agg</TableHead>
                  <TableHead className="text-center w-32">Division</TableHead>
                  <TableHead className="text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <GraduationCap className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500">No results found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((pupil) => (
                    <TableRow key={pupil.pupilId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            <button
                              onClick={() => router.push(`/pupil-detail?id=${pupil.pupilId}`)}
                              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer text-left"
                            >
                              {formatPupilDisplayName(pupil)}
                            </button>
                          </div>
                          <div className="text-sm text-gray-500">
                            {pupil.gender}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            PIN: {pupil.admissionNumber || 'N/A'}
                          </Badge>
                          {pupil.indexNumber && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              Index: {pupil.indexNumber}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {PLE_SUBJECTS.map(subject => (
                        <TableCell key={subject.id} className="text-center">
                          {pupil.status === 'missed' ? (
                            <Badge variant="destructive" className="text-xs">
                              Missed
                            </Badge>
                          ) : pupil.subjects[subject.id] ? (
                            <Badge 
                              variant={getAggregateBadgeVariant(pupil.subjects[subject.id])}
                              className="font-mono"
                            >
                              {pupil.subjects[subject.id]}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-gray-400">
                              --
                            </Badge>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {pupil.status === 'missed' ? (
                          <Badge variant="destructive" className="text-xs">
                            Missed
                          </Badge>
                        ) : pupil.totalAggregate > 0 ? (
                          <Badge 
                            variant="default"
                            className="font-mono font-bold"
                          >
                            {pupil.totalAggregate}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-gray-400">
                            --
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {pupil.status === 'missed' ? (
                          <Badge variant="destructive" className="text-xs">
                            Missed
                          </Badge>
                        ) : pupil.division ? (
                          <Badge 
                            variant={getDivisionBadgeVariant(pupil.division)}
                            className="font-bold"
                          >
                            Div {pupil.division}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handlePrintCertificate(pupil)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Results Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Showing {filteredResults.length} of {pupilResults.length} candidates. 
              {searchTerm && ` Search: "${searchTerm}"`}
              {divisionFilter !== "all" && ` | Division: ${divisionFilter}`}
              {genderFilter !== "all" && ` | Gender: ${genderFilter}`}
              {completionFilter !== "all" && ` | Status: ${completionFilter}`}
            </p>
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>
                Complete: {pupilResults.filter(r => 
                  r.status !== 'missed' && r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate)
                ).length}
              </span>
              <span>
                Partial: {pupilResults.filter(r => 
                  r.status !== 'missed' && 
                  (Object.values(r.subjects).some(aggregate => aggregate) || r.division) &&
                  !(r.division && r.totalAggregate > 0 && Object.values(r.subjects).every(aggregate => aggregate))
                ).length}
              </span>
              <span>
                No Results: {pupilResults.filter(r => 
                  r.status !== 'missed' && 
                  Object.values(r.subjects).every(aggregate => !aggregate) && !r.division
                ).length}
              </span>
              <span>
                Missed: {pupilResults.filter(r => r.status === 'missed').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 