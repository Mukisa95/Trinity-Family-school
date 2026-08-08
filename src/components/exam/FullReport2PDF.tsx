import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTermName, calculateAccurateAge } from '@/lib/utils/term-formatter';
import { AggregateCommentPicker } from '@/lib/exam-report-commentary';

type ReportPaletteName = 'blue' | 'purple' | 'orange';

type ReportConfig = {
  pupilAge: { show: boolean; fill: boolean };
  className: { show: boolean; fill: boolean };
  pin: { show: boolean; fill: boolean };
  year: { show: boolean; fill: boolean };
  term: { show: boolean; fill: boolean };
  promoted: { show: boolean; fill: boolean };
  schoolPayCode: { show: boolean; fill: boolean };
  createdOn: { show: boolean; fill: boolean; useCustom?: boolean };
  nextTermBegins: { show: boolean; fill: boolean; useCustom?: boolean };
  nextTermEnds: { show: boolean; fill: boolean; useCustom?: boolean };
  palette?: ReportPaletteName;
};

interface FullReport2Props {
  examDetails: {
    name: string;
    examTypeName: string;
    startDate: string;
    endDate: string;
    academicYearName?: string;
    termName?: string;
  };
  classSnap: { name: string; code?: string };
  subjectSnaps: Array<{ code: string; name: string; fullMarks?: number; teacherName?: string }>;
  processedResults: Array<{
    pupilInfo: {
      name: string;
      admissionNumber: string;
      pupilId: string;
      age?: number;
      ageAtExam?: number;
      photo?: string;
      dateOfBirth?: string;
      schoolPayCode?: string;
    };
    results: Record<string, { marks: number; grade: string; aggregates: number }>;
    totalMarks: number;
    totalAggregates: number;
    division: string;
    comparisonDataArray?: Array<{
      exam: { name: string; examTypeName?: string; startDate?: string; endDate?: string };
      results: Record<string, { marks: number; grade: string; aggregates: number }>;
      totalMarks: number;
      totalAggregates: number;
      division: string;
      subjectSnaps?: Array<{ code: string; name: string }>;
      subjects?: Array<{ code: string; name: string }>;
    }>;
  }>;
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
    address?: { physical?: string; postal?: string; poBox?: string; city?: string; country?: string };
    contact?: { phone?: string; alternativePhone?: string; email?: string };
  };
  gradingScale?: Array<{ minMark: number; maxMark?: number; grade: string; aggregates: number }>;
  isProgressReport?: boolean;
  comparisonExams?: Array<{ name: string; examTypeName?: string; startDate?: string; endDate?: string }>;
  nextTermInfo?: { startDate: string; endDate: string };
  classTeacherInfo?: { name: string };
  reportConfig?: ReportConfig;
  customDates?: { createdOn?: string; nextTermBegins?: string; nextTermEnds?: string };
  onProgress?: (progress: number, status: string) => void;
}

const assetPath = (fileName: string) => {
  if (typeof window !== 'undefined') return `/Full%20Upp/${encodeURIComponent(fileName)}`;
  if (process.env.FULL_REPORT_2_ASSET_BASE_URL) {
    return `${process.env.FULL_REPORT_2_ASSET_BASE_URL.replace(/\/$/, '')}/Full%20Upp/${encodeURIComponent(fileName)}`;
  }
  return `${process.cwd()}/public/Full Upp/${fileName}`;
};

const ASSETS = {
  background: assetPath('background.png'),
  heading: assetPath('a87590a5-f340-418d-b28d-e776347aac2d.png'),
  aggregate: assetPath('f37cbfce-2a15-4b59-ad8e-52e96ed5856d.png'),
  division: {
    I: assetPath('D1.png'),
    II: assetPath('D2.png'),
    III: assetPath('D3.png'),
    IV: assetPath('D4.png'),
    U: assetPath('DU.png'),
  },
};

const TABLE_BODY_HEIGHT = 158;

const REPORT_PALETTES: Record<ReportPaletteName, {
  primary: string;
  primaryDark: string;
  border: string;
  softBorder: string;
  softBackground: string;
  cardColors: [string, string, string];
}> = {
  blue: {
    primary: '#244291',
    primaryDark: '#1e3a8a',
    border: '#244291',
    softBorder: '#d7dee8',
    softBackground: '#ffffff',
    cardColors: ['#244291', '#7c3aed', '#2563eb'],
  },
  purple: {
    primary: '#6b21a8',
    primaryDark: '#581c87',
    border: '#7e22ce',
    softBorder: '#d8b4fe',
    softBackground: '#faf5ff',
    cardColors: ['#6b21a8', '#d35ac7', '#5b21b6'],
  },
  orange: {
    primary: '#f4510b',
    primaryDark: '#c2410c',
    border: '#f97316',
    softBorder: '#fdba74',
    softBackground: '#fff7ed',
    cardColors: ['#ea2f0b', '#ff3d14', '#f59e0b'],
  },
};

const isRealPhoto = (photo?: string) => {
  const trimmedPhoto = photo?.trim();
  return !!(trimmedPhoto
    && trimmedPhoto !== 'NO PHOTO'
    && trimmedPhoto !== 'https://placehold.co/128x128.png'
    && !trimmedPhoto.includes('ui-avatars.com')
    && (trimmedPhoto.startsWith('http')
      || trimmedPhoto.startsWith('data:')
      || trimmedPhoto.startsWith('blob:')
      || trimmedPhoto.startsWith('/uploads/')));
};

const normalizePdfImageSrc = (photo?: string) => {
  const trimmedPhoto = photo?.trim() || '';
  if (trimmedPhoto.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${trimmedPhoto}`;
  }
  return trimmedPhoto;
};

const createCircularPhotoDataUrl = async (photo?: string) => {
  const source = normalizePdfImageSrc(photo);
  if (!isRealPhoto(photo) || typeof document === 'undefined') return source;

  return new Promise<string>((resolve) => {
    const imageElement = document.createElement('img');
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
    };
    const timeoutId = window.setTimeout(() => finish(source), 8000);

    imageElement.crossOrigin = 'anonymous';
    imageElement.onload = () => {
      try {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context || !imageElement.naturalWidth || !imageElement.naturalHeight) {
          finish(source);
          return;
        }

        const scale = Math.max(size / imageElement.naturalWidth, size / imageElement.naturalHeight);
        const drawWidth = imageElement.naturalWidth * scale;
        const drawHeight = imageElement.naturalHeight * scale;
        const drawX = (size - drawWidth) / 2;
        const drawY = (size - drawHeight) / 2;

        context.clearRect(0, 0, size, size);
        context.save();
        context.beginPath();
        context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);
        context.restore();
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish(source);
      }
    };
    imageElement.onerror = () => finish(source);
    imageElement.src = source;
  });
};

const styles = StyleSheet.create({
  page: { position: 'relative', width: 595.28, height: 841.89, fontFamily: 'Helvetica', color: '#334155', backgroundColor: '#ffffff' },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  content: { position: 'absolute', top: 26, left: 30, width: 535, height: 790, overflow: 'hidden' },

  header: { height: 95, flexDirection: 'row', alignItems: 'center' },
  logoWrap: { width: 78, height: 78, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 72, height: 72, objectFit: 'contain' },
  school: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  schoolName: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: '#1f2937', textAlign: 'center', lineHeight: 1.08 },
  schoolAddress: { fontSize: 8.9, color: '#6b7280', textAlign: 'center', marginTop: 5 },
  schoolDetails: { fontSize: 7.6, color: '#6b7280', textAlign: 'center', marginTop: 2, lineHeight: 1.25 },
  photoSection: { width: 75, flexShrink: 0, alignItems: 'flex-end', position: 'relative' },
  photoFrame: { width: 75, height: 75, position: 'relative', backgroundColor: '#ffffff', borderRadius: 37.5, padding: 3, borderWidth: 2, borderColor: '#1e3a8a' },
  pupilPhoto: { width: '100%', height: '100%', borderRadius: 35, objectFit: 'cover', borderWidth: 1, borderColor: '#f1f5f9' },

  titleRegion: { height: 60, position: 'relative', borderBottomWidth: 0.8, borderBottomColor: '#d7dee8' },
  headingImage: { position: 'absolute', top: 6, height: 48, objectFit: 'fill' },
  headingTextBox: { position: 'absolute', top: 8, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  headingText: { fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'center', letterSpacing: 0.55 },
  qr: { position: 'absolute', right: 8, top: 3, width: 54, height: 54, backgroundColor: '#ffffff', padding: 2 },

  infoBox: { height: 56, marginTop: 8, borderWidth: 1, borderColor: '#1e3a8a', borderRadius: 7, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff' },
  infoRow: { height: 22, flexDirection: 'row', alignItems: 'center' },
  infoCell: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  infoCellLast: { marginRight: 0 },
  infoLabel: { fontSize: 8.4, color: '#6b7280', marginRight: 4 },
  infoValue: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9.2, color: '#16a34a' },
  infoValuePin: { color: '#b91c1c' },

  performance: { height: 207, marginTop: 8, borderWidth: 1, borderColor: '#1e3a8a', borderRadius: 6, overflow: 'hidden', backgroundColor: '#ffffff' },
  performanceHeading: { height: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  performanceHeadingText: { color: '#1e3a8a', fontFamily: 'Helvetica-Bold', fontSize: 12.2 },
  tableHeader: { height: 25, flexDirection: 'row', alignItems: 'center', backgroundColor: '#244291' },
  tableHeaderCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 9.2, textAlign: 'center', borderRightWidth: 0.6, borderRightColor: '#4f7bd9', paddingHorizontal: 2 },
  tableBody: { height: TABLE_BODY_HEIGHT },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.6, borderTopColor: '#244291', backgroundColor: '#ffffff' },
  tableCell: { height: '100%', justifyContent: 'center', borderRightWidth: 0.6, borderRightColor: '#244291', paddingHorizontal: 3 },
  tableText: { color: '#334155', textAlign: 'center' },
  subjectText: { fontFamily: 'Helvetica-Bold', color: '#244291', textAlign: 'left' },
  marksText: { fontFamily: 'Helvetica-Bold', color: '#2563eb' },
  gradeText: { fontFamily: 'Helvetica-Bold', color: '#dc2626' },
  remarkText: { color: '#15803d' },
  subjectCell: { width: '22%' },
  totalCell: { width: '13%' },
  marksCell: { width: '14%' },
  gradeCell: { width: '14%' },
  remarkCell: { width: '27%' },
  initialsCell: { width: '10%', borderRightWidth: 0 },

  summaryOuter: { height: 68, marginTop: 8, borderWidth: 1, borderColor: '#244291', borderRadius: 7, padding: 9, backgroundColor: '#ffffff' },
  summaryRow: { height: 48, flexDirection: 'row' },
  summaryCard: { flex: 1, position: 'relative', borderRadius: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  summaryGap: { marginRight: 7 },
  totalCard: { backgroundColor: '#244291' },
  aggregateCard: { backgroundColor: '#7c3aed' },
  divisionCard: { backgroundColor: '#2563eb' },
  summaryIcon: { position: 'absolute', left: 6, bottom: 5, width: 29, height: 29, objectFit: 'contain', opacity: 0.92 },
  divisionIcon: { position: 'absolute', left: 6, bottom: 4, width: 34, height: 34, objectFit: 'contain' },
  summaryLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.2, color: '#ffffff', textAlign: 'center' },
  summaryValue: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: '#ffffff', textAlign: 'center', marginTop: 3 },
  promotion: { position: 'absolute', right: 5, bottom: 3, color: '#ffffff', fontSize: 4.8 },

  scaleSection: { height: 65, marginTop: 9 },
  scaleTitle: { height: 15, fontFamily: 'Helvetica-Bold', fontSize: 8.7, color: '#64748b', paddingTop: 1 },
  scalePanel: { height: 50, borderWidth: 0.8, borderColor: '#d7dee8', borderRadius: 6, padding: 8, backgroundColor: '#ffffff' },
  scaleRow: { height: 32, flexDirection: 'row' },
  scaleItem: { flex: 1, marginRight: 4, borderWidth: 0.7, borderColor: '#d7dee8', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  scaleItemLast: { marginRight: 0 },
  scaleGrade: { fontFamily: 'Helvetica-Bold', fontSize: 7.8, color: '#244291' },
  scaleRange: { fontSize: 5.9, color: '#64748b', marginTop: 2 },

  progressPanel: { height: 50, borderWidth: 0.8, borderColor: '#d7dee8', borderRadius: 6, overflow: 'hidden', backgroundColor: '#ffffff' },
  progressHeader: { height: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#244291', paddingHorizontal: 3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3, borderTopWidth: 0.5, borderTopColor: '#d7dee8' },
  progressCurrentRow: { backgroundColor: '#eef4ff' },
  progressExamCell: { width: '21%', paddingHorizontal: 2 },
  progressSubjectCell: { flex: 1, paddingHorizontal: 1 },
  progressTotalCell: { width: '11%' },
  progressAggregateCell: { width: '9%' },
  progressDivisionCell: { width: '8%' },
  progressHeaderText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  progressExamText: { fontFamily: 'Helvetica-Bold', color: '#244291', textAlign: 'left' },
  progressMarkText: { color: '#334155', textAlign: 'center' },
  progressTotalText: { fontFamily: 'Helvetica-Bold', color: '#15803d', textAlign: 'center' },
  progressAggregateText: { fontFamily: 'Helvetica-Bold', color: '#7c3aed', textAlign: 'center' },
  progressDivisionText: { fontFamily: 'Helvetica-Bold', color: '#dc2626', textAlign: 'center' },

  comments: { height: 112, marginTop: 9, borderWidth: 0.8, borderColor: '#d7dee8', borderRadius: 6, paddingHorizontal: 9, backgroundColor: '#ffffff' },
  commentRow: { height: 55, justifyContent: 'center' },
  commentRowBorder: { borderBottomWidth: 0.7, borderBottomColor: '#d7dee8' },
  commentLine: { minHeight: 21, flexDirection: 'row', alignItems: 'center' },
  commentTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#244291', marginRight: 6 },
  commentBody: { flex: 1, fontFamily: 'Helvetica-Bold', lineHeight: 1.12 },
  classTeacherComment: { color: '#15803d' },
  headTeacherComment: { color: '#b91c1c' },
  signatureRow: { height: 13, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 5 },
  signatureName: { fontSize: 7.2, color: '#64748b', marginRight: 5 },
  signatureLabel: { fontSize: 7.2, color: '#64748b', marginRight: 5 },
  signatureLine: { width: 178, borderBottomWidth: 0.7, borderBottomColor: '#94a3b8' },

  dates: { height: 38, marginTop: 8, flexDirection: 'row', alignItems: 'center', borderTopWidth: 0.8, borderTopColor: '#d7dee8', borderRadius: 5, backgroundColor: '#f8fafc', paddingHorizontal: 9 },
  dateItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dateItemRight: { justifyContent: 'flex-end' },
  dateLabel: { fontFamily: 'Helvetica-Bold', color: '#244291', fontSize: 8.1 },
  dateValue: { fontFamily: 'Helvetica-Bold', color: '#334155', fontSize: 8.1, marginLeft: 3 },
  footer: { height: 22, marginTop: 17, textAlign: 'center', color: '#e4bd63', fontFamily: 'Helvetica-Oblique', fontSize: 8.5, letterSpacing: 0.55, paddingTop: 4 },
});

const defaultConfig: ReportConfig = {
  pupilAge: { show: true, fill: true },
  className: { show: true, fill: true },
  pin: { show: true, fill: true },
  year: { show: true, fill: true },
  term: { show: true, fill: true },
  promoted: { show: false, fill: false },
  schoolPayCode: { show: false, fill: true },
  createdOn: { show: true, fill: true },
  nextTermBegins: { show: true, fill: true },
  nextTermEnds: { show: true, fill: true },
  palette: 'blue',
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};

const ageAtExam = (pupil: FullReport2Props['processedResults'][number]['pupilInfo'], examDate: string) => {
  if (pupil.ageAtExam && pupil.ageAtExam > 0) return pupil.ageAtExam;
  if (pupil.age && pupil.age > 0) return pupil.age;
  try {
    return calculateAccurateAge(pupil.dateOfBirth, examDate);
  } catch {
    return 0;
  }
};

const remarkFor = (marks: number) => marks >= 95
  ? 'EXCELLENT'
  : marks >= 80
    ? 'VERY GOOD'
    : marks >= 70
      ? 'GOOD'
      : marks >= 60
        ? 'FAIR GOOD'
        : marks >= 45
          ? 'TRIED'
          : 'NEEDS IMPROVEMENT';

const initialsFor = (name?: string) => name
  ? name.trim().split(/\s+/).filter(Boolean).map(part => part[0].toUpperCase()).join('.')
  : '';

const fieldValue = (setting: { show: boolean; fill: boolean }, value: string | number) => setting.show && setting.fill ? String(value) : '';
const divisionAsset = (division: string) => ASSETS.division[division.replace('DIVISION ', '').trim() as keyof typeof ASSETS.division] || ASSETS.division.U;

const normalizedExamName = (examTypeName?: string, fallback?: string) => {
  const raw = (examTypeName || fallback || 'END OF TERM').trim().replace(/\s+REPORT$/i, '');
  return raw.toUpperCase();
};

const fittedCommentFontSize = (comment: string) => {
  if (comment.length <= 62) return 9.6;
  if (comment.length <= 82) return 9;
  if (comment.length <= 105) return 8.4;
  return 7.8;
};

const InfoCell = ({ label, value, accentColor, last = false, tone = 'accent', flex = 1 }: { label: string; value: string; accentColor: string; last?: boolean; tone?: 'accent' | 'red'; flex?: number }) => (
  <View style={last ? [styles.infoCell, styles.infoCellLast, { flex }] : [styles.infoCell, { flex }]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={tone === 'red' ? [styles.infoValue, styles.infoValuePin] : [styles.infoValue, { color: accentColor }]}>{value}</Text>
  </View>
);

const FullReport2Page = ({
  result,
  props,
  qrCode,
  pupilPhoto,
  classTeacherReport,
  headTeacherReport,
}: {
  result: FullReport2Props['processedResults'][number];
  props: FullReport2Props;
  qrCode: string;
  pupilPhoto: string;
  classTeacherReport: string;
  headTeacherReport: string;
}) => {
  const config = props.reportConfig || defaultConfig;
  const paletteName = config.palette || 'blue';
  const palette = REPORT_PALETTES[paletteName];
  const normalizedPupilPhoto = normalizePdfImageSrc(pupilPhoto);
  const generalInfo = props.schoolSettings?.generalInfo;
  const schoolName = generalInfo?.name || 'TRINITY FAMILY NUR AND PRI SCHOOL';
  const address = generalInfo?.physicalAddress || props.schoolSettings?.address?.physical || 'KAMPALA, KASUBI, KAWALA';
  const phones = [
    generalInfo?.phoneNumber || props.schoolSettings?.contact?.phone,
    generalInfo?.alternativePhoneNumber || props.schoolSettings?.contact?.alternativePhone,
  ].filter(Boolean);
  const email = generalInfo?.email || props.schoolSettings?.contact?.email || '';
  const postOffice = generalInfo?.postalAddress || props.schoolSettings?.address?.postal || props.schoolSettings?.address?.poBox || '';
  const contactLine = [phones.length ? `Tel: ${phones.join(' / ')}` : '', email ? `Email: ${email}` : '', postOffice].filter(Boolean).join(' | ');
  const age = ageAtExam(result.pupilInfo, props.examDetails.startDate);
  const scale = props.gradingScale?.length ? props.gradingScale : DEFAULT_GRADING_SCALE;
  const subjects = props.subjectSnaps;
  const rowHeight = subjects.length ? TABLE_BODY_HEIGHT / subjects.length : TABLE_BODY_HEIGHT;
  const tableFontSize = Math.min(10.4, Math.max(6.8, rowHeight * 0.34));
  const classCommentFontSize = fittedCommentFontSize(classTeacherReport);
  const headCommentFontSize = fittedCommentFontSize(headTeacherReport);
  const createdOn = formatDate(props.customDates?.createdOn || props.examDetails.startDate);
  const nextTermBegins = formatDate(props.customDates?.nextTermBegins || props.nextTermInfo?.startDate);
  const nextTermEnds = formatDate(props.customDates?.nextTermEnds || props.nextTermInfo?.endDate);
  const promotion = result.division === 'I' || result.division === 'II'
    ? 'PROMOTED'
    : result.division === 'III'
      ? 'PROMOTED ON PROBATION'
      : 'REPEAT';
  const examName = normalizedExamName(props.examDetails.examTypeName, props.examDetails.name);
  const reportHeading = `${examName} REPORT`;
  const headingWidth = Math.min(350, Math.max(200, reportHeading.length * 8.3 + 88));
  const headingLeft = (535 - headingWidth) / 2;
  const headingFontSize = reportHeading.length > 27 ? 10.2 : reportHeading.length > 21 ? 11.3 : 12.7;
  const schoolMotto = generalInfo?.motto || 'GUIDING GROWTH, INSPIRING GREATNESS';
  const progressSubjectCodes = subjects.map(subject => subject.code);
  const progressRows = [
    {
      name: props.examDetails.examTypeName || props.examDetails.name || 'Current Exam',
      results: result.results,
      totalMarks: result.totalMarks,
      totalAggregates: result.totalAggregates,
      division: result.division,
    },
    ...(result.comparisonDataArray || []).map(comparison => ({
      name: comparison.exam.name || comparison.exam.examTypeName || 'Previous Exam',
      results: comparison.results,
      totalMarks: comparison.totalMarks,
      totalAggregates: comparison.totalAggregates,
      division: comparison.division,
    })),
  ].slice(0, 3);
  const progressRowHeight = 36 / Math.max(progressRows.length, 1);
  const progressFontSize = Math.min(7.2, Math.max(5.5, 8.25 - progressSubjectCodes.length * 0.28));
  const compactExamName = (name: string) => name.length > 18 ? `${name.slice(0, 15)}...` : name;

  return (
    <Page size="A4" style={styles.page}>
      <Image src={ASSETS.background} style={styles.background} fixed />
      <View style={styles.content} wrap={false}>
        <View style={styles.header} wrap={false}>
          <View style={styles.logoWrap}>{generalInfo?.logo && <Image src={generalInfo.logo} style={styles.logo} />}</View>
          <View style={styles.school}>
            <Text style={styles.schoolName}>{schoolName.toUpperCase()}</Text>
            <Text style={styles.schoolAddress}>{address.toUpperCase()}</Text>
            <Text style={styles.schoolDetails}>{contactLine}</Text>
          </View>
          <View style={styles.photoSection}>
            {isRealPhoto(pupilPhoto) && (
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.photoFrame, { borderColor: palette.border }]}>
                  <View style={{
                    position: 'absolute',
                    top: -3,
                    left: -3,
                    right: -3,
                    bottom: -3,
                    borderRadius: 43,
                    backgroundColor: palette.primaryDark,
                    opacity: 0.15,
                  }} />
                  <View style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 36,
                    overflow: 'hidden',
                    backgroundColor: '#f8fafc',
                  }}>
                    <Image src={normalizedPupilPhoto} style={styles.pupilPhoto} />
                  </View>
                  <View style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#10b981',
                    borderWidth: 2.5,
                    borderColor: '#ffffff',
                  }} />
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.titleRegion} wrap={false}>
          <Image src={ASSETS.heading} style={[styles.headingImage, { left: headingLeft, width: headingWidth }]} />
          <View style={[styles.headingTextBox, { left: headingLeft, width: headingWidth }]}>
            <Text style={[styles.headingText, { fontSize: headingFontSize }]}>{reportHeading}</Text>
          </View>
          {qrCode && <Image src={qrCode} style={styles.qr} />}
        </View>

        <View style={[styles.infoBox, { borderColor: palette.border, backgroundColor: palette.softBackground }]} wrap={false}>
          <View style={styles.infoRow}>
            <InfoCell label="PUPIL:" value={result.pupilInfo.name.toUpperCase()} accentColor={palette.primary} flex={1.65} />
            <InfoCell label="CLASS:" value={fieldValue(config.className, props.classSnap.code || props.classSnap.name)} accentColor={palette.primary} flex={1.35} />
            <InfoCell label="AGE:" value={fieldValue(config.pupilAge, age ? `${age} years` : '')} accentColor={palette.primary} flex={0.85} />
            <InfoCell label="PIN:" value={fieldValue(config.pin, result.pupilInfo.admissionNumber)} accentColor={palette.primary} tone="red" flex={1.15} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="YEAR:" value={fieldValue(config.year, props.examDetails.academicYearName || '')} accentColor={palette.primary} />
            <InfoCell label="TERM:" value={fieldValue(config.term, formatTermName(props.examDetails.termName || ''))} accentColor={palette.primary} />
            {config.schoolPayCode.show && (
              <InfoCell label="SCHOOL PAY:" value={fieldValue(config.schoolPayCode, result.pupilInfo.schoolPayCode || '')} accentColor={palette.primary} />
            )}
            <InfoCell label="CREATED ON:" value={fieldValue(config.createdOn, createdOn)} accentColor={palette.primary} last />
          </View>
        </View>

        <View style={[styles.performance, { borderColor: palette.border }]} wrap={false}>
          <View style={styles.performanceHeading}>
            <Text style={[styles.performanceHeadingText, { color: palette.primary }]}>{`${examName} PERFORMANCE`}</Text>
          </View>
          <View style={[styles.tableHeader, { backgroundColor: palette.primary }]}>
            <Text style={[styles.tableHeaderCell, styles.subjectCell, { borderRightColor: palette.softBorder }]}>SUBJECT</Text>
            <Text style={[styles.tableHeaderCell, styles.totalCell, { borderRightColor: palette.softBorder }]}>TOTAL</Text>
            <Text style={[styles.tableHeaderCell, styles.marksCell, { borderRightColor: palette.softBorder }]}>MARKS</Text>
            <Text style={[styles.tableHeaderCell, styles.gradeCell, { borderRightColor: palette.softBorder }]}>GRADE</Text>
            <Text style={[styles.tableHeaderCell, styles.remarkCell, { borderRightColor: palette.softBorder }]}>REMARKS</Text>
            <Text style={[styles.tableHeaderCell, styles.initialsCell]}>INIT.</Text>
          </View>
          <View style={styles.tableBody}>
            {subjects.map(subject => {
              const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
              return (
                <View key={subject.code} style={[styles.tableRow, { height: rowHeight, borderTopColor: palette.border, backgroundColor: palette.softBackground }]} wrap={false}>
                  <View style={[styles.tableCell, styles.subjectCell, { borderRightColor: palette.border }]}><Text style={[styles.tableText, styles.subjectText, { color: palette.primary, fontSize: tableFontSize }]}>{cleanSubjectName(subject.name).toUpperCase()}</Text></View>
                  <View style={[styles.tableCell, styles.totalCell, { borderRightColor: palette.border }]}><Text style={[styles.tableText, { fontSize: tableFontSize }]}>{subject.fullMarks || 100}</Text></View>
                  <View style={[styles.tableCell, styles.marksCell, { borderRightColor: palette.border }]}><Text style={[styles.tableText, styles.marksText, { fontSize: tableFontSize }]}>{subjectResult.marks}</Text></View>
                  <View style={[styles.tableCell, styles.gradeCell, { borderRightColor: palette.border }]}><Text style={[styles.tableText, styles.gradeText, { fontSize: tableFontSize }]}>{subjectResult.grade}</Text></View>
                  <View style={[styles.tableCell, styles.remarkCell, { borderRightColor: palette.border }]}><Text style={[styles.tableText, styles.remarkText, { fontSize: tableFontSize }]}>{remarkFor(subjectResult.marks)}</Text></View>
                  <View style={[styles.tableCell, styles.initialsCell]}><Text style={[styles.tableText, { fontSize: tableFontSize }]}>{initialsFor(subject.teacherName)}</Text></View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={[styles.summaryOuter, { borderColor: palette.border }]} wrap={false}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryGap, { backgroundColor: palette.cardColors[0] }]}>
              <Text style={styles.summaryLabel}>TOTAL MARKS</Text>
              <Text style={styles.summaryValue}>{result.totalMarks}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryGap, { backgroundColor: palette.cardColors[1] }]}>
              <Image src={ASSETS.aggregate} style={styles.summaryIcon} />
              <Text style={styles.summaryLabel}>TOTAL AGGREGATES</Text>
              <Text style={styles.summaryValue}>{result.totalAggregates}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.cardColors[2] }]}>
              <Image src={divisionAsset(result.division)} style={styles.divisionIcon} />
              <Text style={styles.summaryLabel}>DIVISION</Text>
              <Text style={styles.summaryValue}>{result.division}</Text>
              {config.promoted.show && config.promoted.fill && <Text style={styles.promotion}>{promotion}</Text>}
            </View>
          </View>
        </View>

        {props.isProgressReport ? (
          <View style={styles.scaleSection} wrap={false}>
            <Text style={styles.scaleTitle}>PROGRESS ASSESSMENT</Text>
            <View style={[styles.progressPanel, { borderColor: palette.softBorder }]}>
              <View style={[styles.progressHeader, { backgroundColor: palette.primary }]}>
                <View style={styles.progressExamCell}><Text style={[styles.progressHeaderText, { fontSize: progressFontSize }]}>EXAM</Text></View>
                {progressSubjectCodes.map(subjectCode => (
                  <View key={subjectCode} style={styles.progressSubjectCell}><Text style={[styles.progressHeaderText, { fontSize: progressFontSize }]}>{subjectCode}</Text></View>
                ))}
                <View style={styles.progressTotalCell}><Text style={[styles.progressHeaderText, { fontSize: progressFontSize }]}>TOTAL</Text></View>
                <View style={styles.progressAggregateCell}><Text style={[styles.progressHeaderText, { fontSize: progressFontSize }]}>AGG</Text></View>
                <View style={styles.progressDivisionCell}><Text style={[styles.progressHeaderText, { fontSize: progressFontSize }]}>DIV</Text></View>
              </View>
              {progressRows.map((progressRow, index) => (
                <View key={`${progressRow.name}-${index}`} style={index === 0 ? [styles.progressRow, { height: progressRowHeight, backgroundColor: palette.softBackground, borderTopColor: palette.softBorder }] : [styles.progressRow, { height: progressRowHeight, borderTopColor: palette.softBorder }]}>
                  <View style={styles.progressExamCell}><Text style={[styles.progressExamText, { color: palette.primary, fontSize: progressFontSize }]}>{compactExamName(progressRow.name)}</Text></View>
                  {progressSubjectCodes.map(subjectCode => (
                    <View key={subjectCode} style={styles.progressSubjectCell}><Text style={[styles.progressMarkText, { fontSize: progressFontSize }]}>{progressRow.results[subjectCode]?.marks ?? '-'}</Text></View>
                  ))}
                  <View style={styles.progressTotalCell}><Text style={[styles.progressTotalText, { fontSize: progressFontSize }]}>{progressRow.totalMarks}</Text></View>
                  <View style={styles.progressAggregateCell}><Text style={[styles.progressAggregateText, { fontSize: progressFontSize }]}>{progressRow.totalAggregates}</Text></View>
                  <View style={styles.progressDivisionCell}><Text style={[styles.progressDivisionText, { fontSize: progressFontSize }]}>{progressRow.division}</Text></View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.scaleSection} wrap={false}>
            <Text style={styles.scaleTitle}>GRADING SCALE USED</Text>
            <View style={[styles.scalePanel, { borderColor: palette.softBorder, backgroundColor: palette.softBackground }]}>
              <View style={styles.scaleRow}>
                {scale.map((item, index) => (
                  <View key={`${item.grade}-${index}`} style={index === scale.length - 1 ? [styles.scaleItem, styles.scaleItemLast, { borderColor: palette.softBorder }] : [styles.scaleItem, { borderColor: palette.softBorder }]}>
                    <Text style={[styles.scaleGrade, { color: palette.primary }]}>{item.grade}</Text>
                    <Text style={styles.scaleRange}>({item.minMark}-{item.maxMark ?? ''})</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={[styles.comments, { borderColor: palette.softBorder, backgroundColor: palette.softBackground }]} wrap={false}>
          <View style={[styles.commentRow, styles.commentRowBorder, { borderBottomColor: palette.softBorder }]}>
            <View style={styles.commentLine}>
              <Text style={styles.commentTitle}>CLASS TEACHER&apos;S REPORT:</Text>
              <Text style={[styles.commentBody, styles.classTeacherComment, { fontSize: classCommentFontSize }]}>{classTeacherReport}</Text>
            </View>
            <View style={styles.signatureRow}>
              {props.classTeacherInfo?.name && <Text style={styles.signatureName}>{props.classTeacherInfo.name}</Text>}
              <Text style={styles.signatureLabel}>Sign:</Text><View style={styles.signatureLine} />
            </View>
          </View>
          <View style={styles.commentRow}>
            <View style={styles.commentLine}>
              <Text style={styles.commentTitle}>HEAD TEACHER&apos;S REPORT:</Text>
              <Text style={[styles.commentBody, styles.headTeacherComment, { fontSize: headCommentFontSize }]}>{headTeacherReport}</Text>
            </View>
            <View style={styles.signatureRow}>
              <Text style={styles.signatureLabel}>Sign:</Text><View style={styles.signatureLine} />
            </View>
          </View>
        </View>

        <View style={[styles.dates, { borderTopColor: palette.softBorder, backgroundColor: palette.softBackground }]} wrap={false}>
          <View style={styles.dateItem}>
            <Text style={styles.dateLabel}>NEXT TERM BEGINS:</Text>
            <Text style={styles.dateValue}>{fieldValue(config.nextTermBegins, nextTermBegins)}</Text>
          </View>
          <View style={[styles.dateItem, styles.dateItemRight]}>
            <Text style={styles.dateLabel}>TERM ENDS:</Text>
            <Text style={styles.dateValue}>{fieldValue(config.nextTermEnds, nextTermEnds)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>{`“${schoolMotto.toUpperCase()}”`}</Text>
      </View>
    </Page>
  );
};

export const generateFullReport2PDF = async (props: FullReport2Props) => {
  props.onProgress?.(0, `Preparing pupil photos and QR codes for ${props.processedResults.length} pupils...`);
  const [qrCodes, circularPhotos] = await Promise.all([
    Promise.all(props.processedResults.map(async result => [
      result.pupilInfo.pupilId,
      await QRCode.toDataURL([
        `Name: ${result.pupilInfo.name}`,
        `Class: ${props.classSnap.name}`,
        `PIN: ${result.pupilInfo.admissionNumber || 'N/A'}`,
        `Aggregates: ${result.totalAggregates}`,
        `Division: ${result.division}`,
      ].join('\n'), { errorCorrectionLevel: 'L', margin: 1, width: 180 }),
    ] as const)),
    Promise.all(props.processedResults.map(async result => [
      result.pupilInfo.pupilId,
      await createCircularPhotoDataUrl(result.pupilInfo.photo),
    ] as const)),
  ]);

  props.onProgress?.(35, 'Pupil photos and QR codes ready. Rendering Full Report 2...');
  const qrByPupil = new Map(qrCodes);
  const photoByPupil = new Map(circularPhotos);
  const comments = new AggregateCommentPicker();
  const document = (
    <Document title={`${props.examDetails.name} - Full Report 2`}>
      {props.processedResults.map(result => (
        <FullReport2Page
          key={result.pupilInfo.pupilId}
          result={result}
          props={props}
          qrCode={qrByPupil.get(result.pupilInfo.pupilId) || ''}
          pupilPhoto={photoByPupil.get(result.pupilInfo.pupilId) || ''}
          classTeacherReport={comments.classTeacher(result.pupilInfo.name, result.totalAggregates)}
          headTeacherReport={comments.headTeacher(result.pupilInfo.name, result.totalAggregates)}
        />
      ))}
    </Document>
  );
  const blob = await pdf(document).toBlob();
  props.onProgress?.(100, 'Full Report 2 generation complete.');
  return blob;
};
