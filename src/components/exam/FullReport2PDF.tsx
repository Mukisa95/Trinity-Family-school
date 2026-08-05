import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { DEFAULT_GRADING_SCALE } from '@/lib/constants';
import { cleanSubjectName } from '@/lib/utils/html-entities';
import { formatTermName, calculateAccurateAge } from '@/lib/utils/term-formatter';
import { AggregateCommentPicker } from '@/lib/exam-report-commentary';

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
};

interface FullReport2Props {
  examDetails: { name: string; examTypeName: string; startDate: string; endDate: string; academicYearName?: string; termName?: string };
  classSnap: { name: string; code?: string };
  subjectSnaps: Array<{ code: string; name: string; fullMarks?: number; teacherName?: string }>;
  processedResults: Array<{
    pupilInfo: { name: string; admissionNumber: string; pupilId: string; age?: number; ageAtExam?: number; photo?: string; dateOfBirth?: string; schoolPayCode?: string };
    results: Record<string, { marks: number; grade: string; aggregates: number }>;
    totalMarks: number;
    totalAggregates: number;
    division: string;
  }>;
  schoolSettings?: { generalInfo?: { name?: string; physicalAddress?: string; phoneNumber?: string; alternativePhoneNumber?: string; email?: string; logo?: string }; address?: { physical?: string; poBox?: string }; contact?: { phone?: string; alternativePhone?: string; email?: string } };
  gradingScale?: Array<{ minMark: number; maxMark?: number; grade: string; aggregates: number }>;
  nextTermInfo?: { startDate: string; endDate: string };
  reportConfig?: ReportConfig;
  customDates?: { createdOn?: string; nextTermBegins?: string; nextTermEnds?: string };
  onProgress?: (progress: number, status: string) => void;
}

const ASSETS = {
  background: '/Full%20Upp/background.png',
  heading: '/Full%20Upp/a87590a5-f340-418d-b28d-e776347aac2d.png',
  aggregate: '/Full%20Upp/f37cbfce-2a15-4b59-ad8e-52e96ed5856d.png',
  division: {
    I: '/Full%20Upp/D1.png', II: '/Full%20Upp/D2.png', III: '/Full%20Upp/D3.png', IV: '/Full%20Upp/D4.png', U: '/Full%20Upp/DU.png',
  },
};

const styles = StyleSheet.create({
  page: { position: 'relative', fontFamily: 'Helvetica', color: '#334155' },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  content: { position: 'absolute', top: 30, left: 35, right: 35, bottom: 31 },
  header: { flexDirection: 'row', height: 72, alignItems: 'center' },
  logoWrap: { width: 66, height: 66, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 60, height: 60, objectFit: 'contain' },
  school: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  schoolName: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#1f2937', textAlign: 'center', letterSpacing: 0.1 },
  schoolDetails: { fontSize: 7.2, color: '#6b7280', textAlign: 'center', marginTop: 2, lineHeight: 1.25 },
  photoWrap: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', borderWidth: 1.5, borderColor: '#1e3a8a', backgroundColor: '#f8fafc' },
  photo: { width: '100%', height: '100%', objectFit: 'cover' },
  headingWrap: { position: 'relative', height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 3 },
  headingImage: { position: 'absolute', width: 270, height: 78, objectFit: 'contain' },
  headingText: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#ffffff', letterSpacing: 1.1, marginTop: -1 },
  qr: { position: 'absolute', top: 80, right: 6, width: 48, height: 48, backgroundColor: '#ffffff', padding: 2 },
  infoBox: { marginTop: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#1e3a8a', borderRadius: 7, paddingVertical: 7, paddingHorizontal: 11 },
  infoRow: { flexDirection: 'row', minHeight: 20, alignItems: 'center' },
  infoCell: { flex: 1, flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: '#9facbf', marginRight: 12, paddingBottom: 2 },
  infoCellLast: { marginRight: 0 },
  infoLabel: { fontSize: 8, color: '#6b7280', marginRight: 4 },
  infoValue: { fontFamily: 'Helvetica-Bold', fontSize: 8.2, color: '#16a34a', flex: 1 },
  infoValuePin: { color: '#b91c1c' },
  performanceHeading: { marginTop: 10, backgroundColor: '#082d62', borderTopLeftRadius: 6, borderTopRightRadius: 6, height: 28, justifyContent: 'center', alignItems: 'center' },
  performanceHeadingText: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 12, letterSpacing: 1.1 },
  table: { borderLeftWidth: 0.7, borderRightWidth: 0.7, borderBottomWidth: 0.7, borderColor: '#69809d' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#16458e', minHeight: 24, alignItems: 'center' },
  tableHeaderCell: { color: '#ffffff', fontFamily: 'Times-Bold', fontSize: 8.5, textAlign: 'center', borderRightWidth: 0.7, borderColor: '#d6dfed', paddingHorizontal: 2 },
  tableRow: { flexDirection: 'row', minHeight: 20, alignItems: 'center', borderTopWidth: 0.55, borderColor: '#aeb9c7' },
  tableCell: { fontSize: 7.1, textAlign: 'center', color: '#334155', borderRightWidth: 0.55, borderColor: '#aeb9c7', paddingHorizontal: 2 },
  subjectCell: { width: '22%', textAlign: 'left', paddingLeft: 5 },
  marksText: { color: '#2563eb', fontFamily: 'Helvetica-Bold' }, remarkText: { color: '#15803d' },
  totalCell: { width: '13%' }, marksCell: { width: '15%' }, gradeCell: { width: '14%' }, remarkCell: { width: '24%' }, initialsCell: { width: '12%', borderRightWidth: 0 },
  summary: { flexDirection: 'row', gap: 10, marginTop: 10 },
  summaryCard: { flex: 1, height: 65, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 7, padding: 5 },
  summaryIcon: { width: 37, height: 37, objectFit: 'contain', marginRight: 5 },
  divisionIcon: { width: 42, height: 42, objectFit: 'contain', marginRight: 2 },
  summaryText: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 8.2, color: '#6b7280', textAlign: 'center' },
  summaryValue: { marginTop: 5, minWidth: 67, backgroundColor: '#f8fafc', borderRadius: 4, paddingVertical: 5, fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center', color: '#b91c1c' },
  scale: { borderWidth: 0.8, borderColor: '#98a9bd', borderRadius: 6, marginTop: 10, padding: 6 },
  scaleTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: '#64748b', textAlign: 'center', marginBottom: 4 },
  scaleRow: { flexDirection: 'row' },
  scaleItem: { flex: 1, alignItems: 'center', borderRightWidth: 0.5, borderColor: '#aeb9c7' },
  scaleItemLast: { borderRightWidth: 0 },
  scaleGrade: { fontFamily: 'Helvetica-Bold', fontSize: 8.2, color: '#1e3a8a' }, scaleRange: { fontSize: 6.8, color: '#334155', marginTop: 1 },
  commentBox: { marginTop: 8, minHeight: 56, borderWidth: 0.8, borderColor: '#082d62', borderRadius: 6, padding: 7 },
  commentTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8.8, color: '#1e3a8a', marginBottom: 4 },
  commentBody: { fontSize: 7.2, color: '#334155', lineHeight: 1.35, minHeight: 21, borderBottomWidth: 0.6, borderBottomColor: '#9facbf', paddingBottom: 2 },
  classTeacherComment: { color: '#15803d', fontFamily: 'Helvetica-Bold' }, headTeacherComment: { color: '#b91c1c', fontFamily: 'Helvetica-Bold' },
  signature: { fontSize: 7.4, color: '#64748b', textAlign: 'right', marginTop: 4 },
  dates: { flexDirection: 'row', backgroundColor: '#f8fafc', borderWidth: 0.8, borderColor: '#e2e8f0', borderRadius: 5, marginTop: 8, padding: 7 },
  dateItem: { flex: 1, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.6, borderBottomColor: '#9facbf', marginHorizontal: 4, paddingBottom: 2 },
  dateLabel: { fontFamily: 'Helvetica-Bold', color: '#1e3a8a', fontSize: 8 }, dateValue: { fontFamily: 'Helvetica-Bold', color: '#334155', fontSize: 8, marginLeft: 5 },
  footer: { position: 'absolute', bottom: 3, left: 0, right: 0, textAlign: 'center', color: '#ff5a00', fontFamily: 'Helvetica-Oblique', fontSize: 9, letterSpacing: 0.7 },
});

const defaultConfig: ReportConfig = { pupilAge: { show: true, fill: true }, className: { show: true, fill: true }, pin: { show: true, fill: true }, year: { show: true, fill: true }, term: { show: true, fill: true }, promoted: { show: false, fill: false }, schoolPayCode: { show: false, fill: true }, createdOn: { show: true, fill: true }, nextTermBegins: { show: true, fill: true }, nextTermEnds: { show: true, fill: true } };

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
};
const ageAtExam = (pupil: FullReport2Props['processedResults'][number]['pupilInfo'], examDate: string) => {
  if (pupil.ageAtExam && pupil.ageAtExam > 0) return pupil.ageAtExam;
  if (pupil.age && pupil.age > 0) return pupil.age;
  try { return calculateAccurateAge(pupil.dateOfBirth, examDate); } catch { return 0; }
};
const remarkFor = (marks: number) => marks >= 95 ? 'EXCELLENT' : marks >= 80 ? 'VERY GOOD' : marks >= 70 ? 'GOOD' : marks >= 60 ? 'FAIR GOOD' : marks >= 45 ? 'TRIED' : 'NEEDS IMPROVEMENT';
const initialsFor = (name?: string) => name ? name.trim().split(/\s+/).filter(Boolean).map(part => part[0].toUpperCase()).join('.') : '';
const fieldValue = (setting: { show: boolean; fill: boolean }, value: string | number) => setting.show && setting.fill ? String(value) : '';
const divisionAsset = (division: string) => ASSETS.division[division.replace('DIVISION ', '').trim() as keyof typeof ASSETS.division] || ASSETS.division.U;

const InfoCell = ({ label, value, last = false, tone = 'green' }: { label: string; value: string; last?: boolean; tone?: 'green' | 'red' }) => (
  <View style={last ? [styles.infoCell, styles.infoCellLast] : styles.infoCell}><Text style={styles.infoLabel}>{label}</Text><Text style={tone === 'red' ? [styles.infoValue, styles.infoValuePin] : styles.infoValue}>{value}</Text></View>
);

const FullReport2Page = ({ result, props, qrCode, classTeacherReport, headTeacherReport }: { result: FullReport2Props['processedResults'][number]; props: FullReport2Props; qrCode: string; classTeacherReport: string; headTeacherReport: string }) => {
  const config = props.reportConfig || defaultConfig;
  const school = props.schoolSettings?.generalInfo;
  const schoolName = school?.name || 'TRINITY FAMILY NUR AND PRI SCHOOL';
  const address = school?.physicalAddress || props.schoolSettings?.address?.physical || 'KAMPALA, KASUBI, KAWALA';
  const phone = school?.phoneNumber || props.schoolSettings?.contact?.phone || '';
  const email = school?.email || props.schoolSettings?.contact?.email || '';
  const age = ageAtExam(result.pupilInfo, props.examDetails.startDate);
  const scale = props.gradingScale?.length ? props.gradingScale : DEFAULT_GRADING_SCALE;
  const subjects = props.subjectSnaps.slice(0, 7);
  const createdOn = formatDate(props.customDates?.createdOn || props.examDetails.startDate);
  const nextTermBegins = formatDate(props.customDates?.nextTermBegins || props.nextTermInfo?.startDate);
  const nextTermEnds = formatDate(props.customDates?.nextTermEnds || props.nextTermInfo?.endDate);
  const promotion = result.division === 'I' || result.division === 'II' ? 'PROMOTED' : result.division === 'III' ? 'PROMOTED ON PROBATION' : 'REPEAT';

  return <Page size="A4" style={styles.page}>
    <Image src={ASSETS.background} style={styles.background} />
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.logoWrap}>{school?.logo && <Image src={school.logo} style={styles.logo} />}</View>
        <View style={styles.school}><Text style={styles.schoolName}>{schoolName}</Text><Text style={styles.schoolDetails}>{address}</Text><Text style={styles.schoolDetails}>{[phone, email].filter(Boolean).join('   |   ')}</Text></View>
        <View style={styles.photoWrap}>{result.pupilInfo.photo && <Image src={result.pupilInfo.photo} style={styles.photo} />}</View>
      </View>
      {qrCode && <Image src={qrCode} style={styles.qr} />}
      <View style={styles.headingWrap}><Image src={ASSETS.heading} style={styles.headingImage} /><Text style={styles.headingText}>{`${props.examDetails.examTypeName || 'MIDTERM'} REPORT`.toUpperCase()}</Text></View>
      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <InfoCell label="PUPIL:" value={result.pupilInfo.name} />
          <InfoCell label="CLASS:" value={fieldValue(config.className, props.classSnap.code || props.classSnap.name)} />
          <InfoCell label="AGE:" value={fieldValue(config.pupilAge, age)} />
          <InfoCell label="PIN:" value={fieldValue(config.pin, result.pupilInfo.admissionNumber)} tone="red" last />
        </View>
        <View style={styles.infoRow}>
          <InfoCell label="YEAR:" value={fieldValue(config.year, props.examDetails.academicYearName || '')} />
          <InfoCell label="TERM:" value={fieldValue(config.term, formatTermName(props.examDetails.termName || ''))} />
          <InfoCell label="CREATED ON:" value={fieldValue(config.createdOn, createdOn)} last />
        </View>
        {config.schoolPayCode.show && <View style={styles.infoRow}><InfoCell label="SCHOOL PAY CODE:" value={fieldValue(config.schoolPayCode, result.pupilInfo.schoolPayCode || '')} last /></View>}
      </View>
      <View style={styles.performanceHeading}><Text style={styles.performanceHeadingText}>MID-TERM PERFORMANCE</Text></View>
      <View style={styles.table}>
        <View style={styles.tableHeader}><Text style={[styles.tableHeaderCell, styles.subjectCell]}>SUBJECT</Text><Text style={[styles.tableHeaderCell, styles.totalCell]}>TOTAL</Text><Text style={[styles.tableHeaderCell, styles.marksCell]}>MARKS</Text><Text style={[styles.tableHeaderCell, styles.gradeCell]}>GRADE</Text><Text style={[styles.tableHeaderCell, styles.remarkCell]}>REMARKS</Text><Text style={[styles.tableHeaderCell, styles.initialsCell]}>INIT.</Text></View>
        {subjects.map(subject => {
          const subjectResult = result.results[subject.code] || { marks: 0, grade: 'F9', aggregates: 9 };
          return <View key={subject.code} style={styles.tableRow}><Text style={[styles.tableCell, styles.subjectCell]}>{cleanSubjectName(subject.name)}</Text><Text style={[styles.tableCell, styles.totalCell]}>{subject.fullMarks || 100}</Text><Text style={[styles.tableCell, styles.marksCell, styles.marksText]}>{subjectResult.marks}</Text><Text style={[styles.tableCell, styles.gradeCell]}>{subjectResult.grade}</Text><Text style={[styles.tableCell, styles.remarkCell, styles.remarkText]}>{remarkFor(subjectResult.marks)}</Text><Text style={[styles.tableCell, styles.initialsCell]}>{initialsFor(subject.teacherName)}</Text></View>;
        })}
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryCard}><View style={styles.summaryText}><Text style={styles.summaryLabel}>TOTAL MARKS</Text><Text style={styles.summaryValue}>{result.totalMarks}</Text></View></View>
        <View style={styles.summaryCard}><Image src={ASSETS.aggregate} style={styles.summaryIcon} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>TOTAL AGGREGATES</Text><Text style={styles.summaryValue}>{result.totalAggregates}</Text></View></View>
        <View style={styles.summaryCard}><Image src={divisionAsset(result.division)} style={styles.divisionIcon} /><View style={styles.summaryText}><Text style={styles.summaryLabel}>DIVISION</Text><Text style={styles.summaryValue}>{result.division}</Text>{config.promoted.show && config.promoted.fill && <Text style={{ color: '#15803d', fontSize: 5.7, marginTop: 2 }}>{promotion}</Text>}</View></View>
      </View>
      <View style={styles.scale}><Text style={styles.scaleTitle}>GRADING SCALE</Text><View style={styles.scaleRow}>{scale.map((item, index) => <View key={`${item.grade}-${index}`} style={index === scale.length - 1 ? [styles.scaleItem, styles.scaleItemLast] : styles.scaleItem}><Text style={styles.scaleGrade}>{item.grade}</Text><Text style={styles.scaleRange}>({item.minMark}-{item.maxMark ?? ''})</Text></View>)}</View></View>
      <View style={styles.commentBox}><Text style={styles.commentTitle}>CLASS TEACHER&apos;S REPORT / COMMENTS</Text><Text style={[styles.commentBody, styles.classTeacherComment]}>{classTeacherReport}</Text><Text style={styles.signature}>SIGNATURE: __________________________</Text></View>
      <View style={styles.commentBox}><Text style={styles.commentTitle}>HEAD TEACHER&apos;S REPORT / COMMENTS</Text><Text style={[styles.commentBody, styles.headTeacherComment]}>{headTeacherReport}</Text><Text style={styles.signature}>SIGNATURE: __________________________</Text></View>
      <View style={styles.dates}><View style={styles.dateItem}><Text style={styles.dateLabel}>NEXT TERM BEGINS:</Text><Text style={styles.dateValue}>{fieldValue(config.nextTermBegins, nextTermBegins)}</Text></View><View style={styles.dateItem}><Text style={styles.dateLabel}>TERM ENDS:</Text><Text style={styles.dateValue}>{fieldValue(config.nextTermEnds, nextTermEnds)}</Text></View></View>
      <Text style={styles.footer}>GUIDING GROWTH, INSPIRING GREATNESS</Text>
    </View>
  </Page>;
};

export const generateFullReport2PDF = async (props: FullReport2Props) => {
  props.onProgress?.(0, `Generating QR codes for ${props.processedResults.length} pupils...`);
  const qrCodes = await Promise.all(props.processedResults.map(async result => [result.pupilInfo.pupilId, await QRCode.toDataURL([`Name: ${result.pupilInfo.name}`, `Class: ${props.classSnap.name}`, `PIN: ${result.pupilInfo.admissionNumber || 'N/A'}`, `Aggregates: ${result.totalAggregates}`, `Division: ${result.division}`].join('\n'), { errorCorrectionLevel: 'L', margin: 1, width: 180 })] as const));
  props.onProgress?.(35, 'QR codes ready. Rendering Full Report 2...');
  const qrByPupil = new Map(qrCodes);
  const comments = new AggregateCommentPicker();
  const document = <Document title={`${props.examDetails.name} - Full Report 2`}>{props.processedResults.map(result => <FullReport2Page key={result.pupilInfo.pupilId} result={result} props={props} qrCode={qrByPupil.get(result.pupilInfo.pupilId) || ''} classTeacherReport={comments.classTeacher(result.pupilInfo.name, result.totalAggregates)} headTeacherReport={comments.headTeacher(result.pupilInfo.name, result.totalAggregates)} />)}</Document>;
  const blob = await pdf(document).toBlob();
  props.onProgress?.(100, 'Full Report 2 generation complete.');
  return blob;
};
