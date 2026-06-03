import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page } from '@react-pdf/renderer';
import { TransPupilReportCardPDF } from './TransPupilReportPDF';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTermName, calculateAccurateAge } from '@/lib/utils/term-formatter';
import { calculatePromotionStatus } from '@/lib/utils/promotion-ranking';
import { AggregateCommentPicker } from '@/lib/exam-report-commentary';

interface ExamResult {
    pupilInfo: {
        name: string;
        admissionNumber: string;
        pupilId: string;
        age?: number;
        photo?: string;
        dateOfBirth?: string;
    };
    results: Record<string, {
        marks: number;
        grade: string;
        aggregates: number;
    }>;
    totalMarks: number;
    totalAggregates: number;
    division: string;
    position: number;
}

interface Subject {
    subjectId: string;
    code: string;
    name: string;
    fullMarks?: number;
    teacherName?: string;
}

interface TransBatchReportProps {
    examDetails: {
        name: string;
        examTypeName: string;
        startDate: string;
        endDate: string;
        academicYearId?: string;
        termId?: string;
        academicYearName?: string;
        termName?: string;
    };
    classSnap: {
        name: string;
    };
    subjectSnaps: Subject[];
    processedResults: ExamResult[];
    schoolSettings?: {
        generalInfo?: {
            name?: string;
            physicalAddress?: string;
            postalAddress?: string;
            phoneNumber?: string;
            alternativePhoneNumber?: string;
            email?: string;
            motto?: string;
            city?: string;
            country?: string;
            logo?: string;
        };
        address?: {
            physical?: string;
            postal?: string;
            poBox?: string;
            city?: string;
            country?: string;
        };
        contact?: {
            phone?: string;
            alternativePhone?: string;
            email?: string;
        };
    };
    majorSubjects?: string[];
    gradingScale?: Array<{
        minMark: number;
        maxMark?: number;
        grade: string;
        aggregates: number;
    }>;
    nextTermInfo?: {
        startDate: string;
        endDate: string;
    };
    classTeacherInfo?: {
        name: string;
    };
    promotionRankingConfig?: {
        enabled: boolean;
        ranges: {
            promoted: { min: number; max: number };
            probation: { min: number; max: number };
            repeat: { min: number; max: number };
        };
    };
}

// Helper function to generate remarks based on marks
const generateRemarks = (marks: number): string => {
    if (marks >= 95) return 'EXCELLENT';
    if (marks >= 80) return 'VERY GOOD';
    if (marks >= 70) return 'GOOD';
    if (marks >= 60) return 'FAIR GOOD';
    if (marks >= 45) return 'TRIED';
    return 'NEEDS IMPROVEMENT';
};

// Helper function to generate teacher initials from full name
const generateTeacherInitials = (teacherName: string): string => {
    if (!teacherName || teacherName.trim() === '') return 'T.I.';

    return teacherName
        .trim()
        .split(' ')
        .filter(name => name.length > 0)
        .map(name => name.charAt(0).toUpperCase())
        .join('.');
};

// Helper function to calculate age from date of birth using exam date
const calculateAge = (dateOfBirth?: string, examDate?: string, ageAtExam?: number): number => {
    console.log('🔍 calculateAge called with:', { dateOfBirth, examDate, ageAtExam });
    
    // If ageAtExam is already provided and valid, use it
    if (ageAtExam && ageAtExam > 0 && ageAtExam < 100) {
        console.log('✅ Using ageAtExam:', ageAtExam);
        return ageAtExam;
    }
    
    // Otherwise calculate from date of birth
    try {
        const calculatedAge = calculateAccurateAge(dateOfBirth, examDate || new Date());
        console.log('✅ Calculated age:', calculatedAge);
        return calculatedAge;
    } catch (error) {
        console.error('❌ Age calculation failed:', error);
        // As last resort, if we have a date of birth string, try simple year subtraction
        if (dateOfBirth) {
            const year = parseInt(dateOfBirth.substring(0, 4));
            if (year > 1900 && year < 2030) {
                const refYear = examDate ? new Date(examDate).getFullYear() : new Date().getFullYear();
                const simpleAge = refYear - year;
                console.log('⚠️ Using simple age calculation:', simpleAge);
                return simpleAge > 0 ? simpleAge : 0;
            }
        }
        throw error; // Re-throw if all methods fail
    }
};

// Aggregate-based teacher reports shared with Commentary Box ranges
const generateTeacherReports = (result: ExamResult, _examTitle: string, picker: AggregateCommentPicker) => {
    const classTeacherReport = picker.classTeacher(result.pupilInfo.name, result.totalAggregates);
    const headTeacherReport = picker.headTeacher(result.pupilInfo.name, result.totalAggregates);
    return { classTeacherReport, headTeacherReport };
};

export const generateTransBatchReportPDF = async (props: TransBatchReportProps) => {
    const {
        examDetails,
        classSnap,
        subjectSnaps,
        processedResults,
        schoolSettings,
        majorSubjects,
        gradingScale,
        nextTermInfo,
        classTeacherInfo,
        promotionRankingConfig
    } = props;

    // Helper function to generate QR code data URL
    const generateQRCodeDataURL = async (data: string): Promise<string> => {
        try {
            const QRCode = (await import('qrcode')).default;

            const qrDataURL = await QRCode.toDataURL(data, {
                errorCorrectionLevel: 'L',
                margin: 3,
                scale: 25,
                width: 1000,
                color: {
                    dark: '#000000FF',
                    light: '#FFFFFFFF'
                }
            });

            return qrDataURL;
        } catch (error) {
            console.error('QR code generation error:', error);
            return '';
        }
    };

    // Extract school information from settings
    const schoolInfo = {
        name: schoolSettings?.generalInfo?.name || 'School Name',
        logo: schoolSettings?.generalInfo?.logo || '',
        physicalAddress: schoolSettings?.generalInfo?.physicalAddress ||
            schoolSettings?.address?.physical || '',
        postalAddress: schoolSettings?.generalInfo?.postalAddress ||
            schoolSettings?.address?.postal || '',
        poBox: schoolSettings?.address?.poBox || '',
        phone: schoolSettings?.generalInfo?.phoneNumber ||
            schoolSettings?.contact?.phone || '',
        altPhone: schoolSettings?.generalInfo?.alternativePhoneNumber ||
            schoolSettings?.contact?.alternativePhone || '',
        email: schoolSettings?.generalInfo?.email ||
            schoolSettings?.contact?.email || '',
        motto: schoolSettings?.generalInfo?.motto || '',
        city: schoolSettings?.generalInfo?.city ||
            schoolSettings?.address?.city || '',
        country: schoolSettings?.generalInfo?.country ||
            schoolSettings?.address?.country || ''
    };

    // Default grading scale if not provided
    const defaultGradingScale = DEFAULT_GRADING_SCALE.map(item => ({
        minMark: item.minMark,
        maxMark: item.maxMark,
        grade: item.grade,
        aggregates: item.aggregates || 9
    }));

    const actualGradingScale = gradingScale || defaultGradingScale;

    // Generate QR codes for all pupils
    const pupilQRCodes = await Promise.all(
        processedResults.map(async (result) => {
            const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);

            const qrData = `Name: ${result.pupilInfo.name}
Class: ${classSnap.name}
Age: ${age} years
PIN: ${result.pupilInfo.admissionNumber || 'N/A'}
Year: ${examDetails.academicYearName || new Date().getFullYear().toString()}
Term: ${formatTermName(examDetails.termName || 'TERM')}
Exam: ${examDetails.name}
Total Aggregates: ${result.totalAggregates}
Division: ${result.division}
Date: ${new Date().toLocaleDateString()}`;

            const qrCodeDataURL = await generateQRCodeDataURL(qrData);
            return { pupilId: result.pupilInfo.pupilId, qrCodeDataURL };
        })
    );

    const commentPicker = new AggregateCommentPicker();

    // Create PDF document with all pupils
    const BatchReportDocument = () => (
        <Document title={`${examDetails.name} - TRANS Batch Reports`}>
            {processedResults.map((result, index) => {
                // Convert exam results to subject format expected by the template
                const subjects = subjectSnaps.map(subject => {
                    const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
                    const isMajor = majorSubjects?.includes(subject.code) || subjectSnaps.length <= 4;

                    return {
                        name: cleanSubjectName(subject.name),
                        code: subject.code,
                        fullMarks: subject.fullMarks || 100,
                        marksGained: subjectResult.marks,
                        grade: subjectResult.grade,
                        aggregates: subjectResult.aggregates,
                        remarks: generateRemarks(subjectResult.marks),
                        teacherInitials: generateTeacherInitials(subject.teacherName || ''),
                        isMajorSubject: isMajor
                    };
                });

                // Generate teacher reports
                const { classTeacherReport, headTeacherReport } = generateTeacherReports(result, examDetails.name, commentPicker);

                // Calculate age based on exam date
                const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);

                // Find the QR code for this pupil
                const pupilQRCode = pupilQRCodes.find(qr => qr.pupilId === result.pupilInfo.pupilId);

                // Create props for the individual pupil report
                const pupilReportProps = {
                    pupilName: result.pupilInfo.name,
                    className: classSnap.name,
                    classCode: classSnap.code, // Pass class code for compact display
                    year: examDetails.academicYearName || new Date().getFullYear().toString(),
                    term: formatTermName(examDetails.termName || 'TERM'),
                    age: age,
                    date: new Date().toLocaleDateString(),
                    position: result.position,
                    totalPupils: processedResults.length,
                    pupilIdentificationNumber: result.pupilInfo.admissionNumber,
                    subjects: subjects,
                    classTeacherReport: classTeacherReport,
                    headTeacherReport: headTeacherReport,
                    nextTermBegins: nextTermInfo?.startDate ? new Date(nextTermInfo.startDate).toLocaleDateString() : 'TBA',
                    nextTermEnds: nextTermInfo?.endDate ? new Date(nextTermInfo.endDate).toLocaleDateString() : 'TBA',
                    pupilPhoto: result.pupilInfo.photo,
                    schoolLogo: schoolInfo.logo,
                    schoolName: schoolInfo.name,
                    schoolPhysicalAddress: schoolInfo.physicalAddress,
                    schoolPostalAddress: schoolInfo.postalAddress || schoolInfo.poBox,
                    schoolPhone: schoolInfo.phone,
                    examTypeName: examDetails.examTypeName,
                    schoolAltPhone: schoolInfo.altPhone,
                    schoolEmail: schoolInfo.email,
                    schoolMotto: schoolInfo.motto,
                    schoolCity: schoolInfo.city,
                    schoolCountry: schoolInfo.country,
                    gradingScale: actualGradingScale,
                    totalMarks: result.totalMarks,
                    totalAggregates: result.totalAggregates,
                    division: result.division,
                    examTitle: examDetails.name,
                    classTeacherName: classTeacherInfo?.name,
                    promotionStatus: result.division === 'I' || result.division === 'II' ? 'PROMOTED' :
                        result.division === 'III' ? 'PROMOTED ON PROBATION' : 'REPEAT',
                    promotionRanking: promotionRankingConfig ? calculatePromotionStatus(
                        result.totalAggregates,
                        promotionRankingConfig,
                        classSnap.code
                    ) : null,
                    examSnapshot: {
                        academicYearId: examDetails.academicYearId || new Date().getFullYear().toString(),
                        termId: examDetails.termId || 'TERM'
                    },
                    majorSubjects: majorSubjects,
                    pupilDateOfBirth: result.pupilInfo.dateOfBirth,
                    pupilGender: 'N/A',
                    pupilRegistrationDate: 'N/A',
                    emergencyContactPhone: 'N/A',
                    qrCodeDataURL: pupilQRCode?.qrCodeDataURL || ''
                };

                console.log(`TRANS PDF - Pupil: ${result.pupilInfo.name}, Total Marks: ${result.totalMarks}, Total Aggregates: ${result.totalAggregates}, Division: ${result.division}`);

                return (
                    <Page key={result.pupilInfo.pupilId} size="A4">
                        <TransPupilReportCardPDF {...pupilReportProps} />
                    </Page>
                );
            })}
        </Document>
    );

    try {
        // Generate PDF blob
        const blob = await pdf(BatchReportDocument()).toBlob();

        // Return blob instead of downloading
        return blob;
    } catch (error) {
        console.error('Error generating TRANS batch report PDF:', error);
        throw error;
    }
};

export default generateTransBatchReportPDF;
