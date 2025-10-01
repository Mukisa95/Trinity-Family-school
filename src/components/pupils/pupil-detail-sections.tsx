"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  UserSquare, 
  CalendarDays, 
  MapPin, 
  Home, 
  Phone, 
  Mail, 
  HeartPulse, 
  BookOpen, 
  Receipt, 
  Shirt, 
  BarChart3,
  TrendingUp,
  Award,
  GraduationCap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { RMQRCode } from '@/components/ui/rmqr-code';

interface DetailItemProps {
  icon?: React.ReactNode;
  label: string;
  value: string | React.ReactNode | undefined | null;
  multiline?: boolean;
  highlight?: boolean;
}

const DetailItem = React.memo(function DetailItem({ icon, label, value, multiline = false, highlight = false }: DetailItemProps) {
  if (!value || value === "N/A" || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  return (
    <div className={`flex ${multiline ? 'flex-col items-start' : 'items-center justify-between'} py-2 border-b border-gray-200/50 last:border-b-0`}>
      <div className="flex items-center">
        {icon && <span className="mr-2 text-gray-500">{icon}</span>}
        <span className="font-medium text-gray-600">{label}:</span>
      </div>
      <span className={`text-right ${multiline ? 'mt-1 ml-0 sm:ml-6 text-left sm:text-right' : ''} ${highlight ? 'font-semibold text-blue-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
});

const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

export function InformationSection({ pupil, classes }: { pupil: any; classes: any[] }) {
  const getClassName = (classId: string | undefined) => {
    if (!classId) return "N/A";
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : "N/A";
  };

  const emergencyContactGuardian = pupil?.emergencyContactGuardianId
    ? pupil.guardians.find((g: any) => g.id === pupil.emergencyContactGuardianId)
    : null;

  return (
    <div className="space-y-6">
      {/* Personal Details */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <UserSquare className="mr-2 h-5 w-5 text-blue-600" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <DetailItem icon={<CalendarDays />} label="Date of Birth" value={formatDate(pupil.dateOfBirth)} />
          <DetailItem icon={<MapPin />} label="Place of Birth" value={pupil.placeOfBirth} />
          <DetailItem icon={<UserSquare />} label="Gender" value={pupil.gender} />
          <DetailItem icon={<Home />} label="Address" value={pupil.address} />
          <DetailItem label="Nationality" value={pupil.nationality} />
          <DetailItem label="Religion" value={pupil.religion} />
          <DetailItem label="Registration Date" value={formatDate(pupil.registrationDate)} />
        </CardContent>
      </Card>

      {/* Academic Information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <BookOpen className="mr-2 h-5 w-5 text-green-600" />
            Academic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <DetailItem label="Admission Number" value={pupil.admissionNumber} highlight />
          <DetailItem label="Class" value={getClassName(pupil.classId)} />
          <DetailItem label="Section" value={pupil.section} />
          <DetailItem label="Status" value={pupil.status} />
        </CardContent>
      </Card>

      {/* Guardian Information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <UserSquare className="mr-2 h-5 w-5 text-purple-600" />
            Guardian Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pupil.guardians?.map((guardian: any, index: number) => (
            <div key={guardian.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{guardian.name}</h4>
                <Badge variant={guardian.relationship === 'Parent' ? 'default' : 'secondary'}>
                  {guardian.relationship}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <DetailItem icon={<Phone />} label="Phone" value={guardian.phone} />
                <DetailItem icon={<Mail />} label="Email" value={guardian.email} />
                <DetailItem icon={<Home />} label="Address" value={guardian.address} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Medical Information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <HeartPulse className="mr-2 h-5 w-5 text-red-600" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <DetailItem label="Blood Group" value={pupil.bloodGroup} />
          <DetailItem label="Allergies" value={pupil.allergies} multiline />
          <DetailItem label="Medical Conditions" value={pupil.medicalConditions} multiline />
          <DetailItem label="Emergency Contact" value={emergencyContactGuardian?.phone} />
        </CardContent>
      </Card>

      {/* ID Card QR Code */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Pupil ID Card</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <RMQRCode
            data={`Name: ${formatPupilDisplayName(pupil)}
DOB: ${formatDate(pupil.dateOfBirth)}
Admission #: ${pupil.admissionNumber || 'N/A'}
Registration: ${formatDate(pupil.registrationDate)}
Gender: ${pupil.gender || 'N/A'}
Emergency Contact: ${emergencyContactGuardian ? emergencyContactGuardian.phone : 'N/A'}`}
            pixelSize={4}
          />
          <p className="text-xs text-gray-500 text-center mt-2">
            Rectangular Micro QR Code (rMQR)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function FeesSection({ pupil }: { pupil: any }) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Receipt className="mr-2 h-5 w-5 text-green-600" />
            Fee Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Fee Management</h3>
            <p className="text-gray-600 mb-4">
              View and manage {pupil.firstName}'s fee information, payments, and outstanding balances.
            </p>
            <Button className="bg-green-600 hover:bg-green-700">
              View Fee Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RequirementsSection({ pupil }: { pupil: any }) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Shirt className="mr-2 h-5 w-5 text-purple-600" />
            Requirements & Uniforms
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shirt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Requirements Tracking</h3>
            <p className="text-gray-600 mb-4">
              Track {pupil.firstName}'s uniform requirements, books, and other school supplies.
            </p>
            <Button className="bg-purple-600 hover:bg-purple-700">
              View Requirements
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AttendanceSection({ pupil }: { pupil: any }) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <BarChart3 className="mr-2 h-5 w-5 text-orange-600" />
            Attendance Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Attendance Tracking</h3>
            <p className="text-gray-600 mb-4">
              View {pupil.firstName}'s attendance records, patterns, and statistics.
            </p>
            <Button className="bg-orange-600 hover:bg-orange-700">
              View Attendance
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ResultsSection({ pupil, examHistory }: { pupil: any; examHistory: any[] }) {
  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <BookOpen className="mr-2 h-5 w-5 text-indigo-600" />
            Examination Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {examHistory && examHistory.length > 0 ? (
            <div className="space-y-4">
              {examHistory.slice(0, 5).map((exam: any) => (
                <div key={exam.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{exam.name}</h4>
                      <p className="text-sm text-gray-600">{formatDate(exam.startDate)}</p>
                    </div>
                    <Badge variant="outline">View Results</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
              <p className="text-gray-600 mb-4">
                {pupil.firstName} hasn't taken any exams yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
