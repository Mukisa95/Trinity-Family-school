import jsPDF from 'jspdf';
import { AggregateCommentPicker } from '@/lib/exam-report-commentary';
import { cleanSubjectName } from '@/lib/utils/html-entities';

interface PrimaryMiniReportPDFProps {
  examDetails: {
    name: string;
    examTypeName?: string;
    startDate: string;
    academicYearName?: string;
    termName?: string;
  };
  classSnap: { name: string; code?: string };
  subjectSnaps: Array<{
    code: string;
    name: string;
    fullMarks?: number;
    teacherName?: string;
  }>;
  processedResults: Array<{
    pupilInfo: {
      name: string;
      admissionNumber: string;
      age?: number;
      ageAtExam?: number;
      dateOfBirth?: string;
      photo?: string | null;
    };
    results: Record<string, {
      marks?: number;
      grade?: string;
      aggregates?: number;
    }>;
    totalMarks: number;
    totalAggregates: number;
    division: string;
  }>;
  schoolSettings?: {
    generalInfo?: {
      name?: string;
      logo?: string;
      motto?: string;
      physicalAddress?: string;
      postalAddress?: string;
      phoneNumber?: string;
      alternativePhoneNumber?: string;
      email?: string;
    };
    contact?: { phone?: string; alternativePhone?: string; email?: string };
    address?: { physical?: string; postal?: string; poBox?: string };
  };
  majorSubjects?: string[];
  backgroundImage: string;
  onProgress?: (completed: number, total: number) => void;
}

const toDataUrl = async (source?: string | null): Promise<string | null> => {
  if (!source) return null;
  if (source.startsWith('data:')) return source;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const cropImageToCircle = async (source: string | null): Promise<string | null> => {
  if (!source || typeof document === 'undefined') return source;

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(source), 10000);
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const outputSize = 320;
        canvas.width = outputSize;
        canvas.height = outputSize;
        const context = canvas.getContext('2d');
        if (!context) return finish(source);

        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const cropSize = Math.min(sourceWidth, sourceHeight);
        context.save();
        context.beginPath();
        context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(
          image,
          (sourceWidth - cropSize) / 2,
          (sourceHeight - cropSize) / 2,
          cropSize,
          cropSize,
          0,
          0,
          outputSize,
          outputSize
        );
        context.restore();
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish(source);
      }
    };
    image.onerror = () => finish(source);
    image.src = source;
  });
};

const calculateAge = (dateOfBirth?: string, examDate?: string, savedAge?: number): string => {
  if (savedAge && savedAge > 0 && savedAge < 100) return `${savedAge} years`;
  if (!dateOfBirth) return '-';
  const birth = new Date(dateOfBirth);
  const reference = examDate ? new Date(examDate) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) return '-';
  let age = reference.getFullYear() - birth.getFullYear();
  if (
    reference.getMonth() < birth.getMonth() ||
    (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())
  ) age -= 1;
  return age >= 0 ? `${age} years` : '-';
};

const ellipsize = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}...`) > maxWidth) value = value.slice(0, -1);
  return `${value.trim()}...`;
};

const initials = (value: string): string => value
  .split(/\s+/)
  .filter(Boolean)
  .map(part => part[0]?.toUpperCase() || '')
  .slice(0, 3)
  .join('');

const remarkForMarks = (marks: number): string => {
  if (marks >= 95) return 'EXCELLENT';
  if (marks >= 80) return 'VERY GOOD';
  if (marks >= 70) return 'GOOD';
  if (marks >= 60) return 'FAIR';
  if (marks >= 45) return 'TRIED';
  return 'POOR';
};

export const generatePrimaryMiniReportPDF = async ({
  examDetails,
  classSnap,
  subjectSnaps,
  processedResults,
  schoolSettings,
  majorSubjects,
  backgroundImage,
  onProgress,
}: PrimaryMiniReportPDFProps): Promise<Blob> => {
  const [backgroundData, logoData] = await Promise.all([
    toDataUrl(backgroundImage),
    toDataUrl(schoolSettings?.generalInfo?.logo),
  ]);
  if (!backgroundData) throw new Error('Primary Mini Report background could not be loaded.');

  const photoSources = await Promise.all(processedResults.map(result => toDataUrl(result.pupilInfo.photo)));
  const pupilPhotos = await Promise.all(photoSources.map(cropImageToCircle));
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardX = 3;
  const cardWidth = pageWidth - 6;
  const cardHeight = 141;
  const firstCardY = 3;
  const secondCardY = 153;
  const navy: [number, number, number] = [8, 52, 116];
  const blue: [number, number, number] = [15, 64, 137];
  const green: [number, number, number] = [21, 128, 61];
  const red: [number, number, number] = [220, 38, 38];
  const schoolName = schoolSettings?.generalInfo?.name || 'School Name';
  const schoolAddress = schoolSettings?.generalInfo?.physicalAddress || schoolSettings?.address?.physical || '';
  const phone = [
    schoolSettings?.generalInfo?.phoneNumber || schoolSettings?.contact?.phone,
    schoolSettings?.generalInfo?.alternativePhoneNumber || schoolSettings?.contact?.alternativePhone,
  ].filter(Boolean).join(' / ');
  const email = schoolSettings?.generalInfo?.email || schoolSettings?.contact?.email || '';
  const poBox = schoolSettings?.address?.poBox || schoolSettings?.generalInfo?.postalAddress || schoolSettings?.address?.postal || '';
  const year = examDetails.academicYearName || new Date(examDetails.startDate).getFullYear().toString();
  const term = examDetails.termName || '-';
  const className = classSnap.code || classSnap.name;
  const examTitle = `${(examDetails.name || examDetails.examTypeName || 'EXAM').toUpperCase()} - ASSESSMENT`;
  const commentPicker = new AggregateCommentPicker();
  let logoLayout: { data: string; width: number; height: number } | null = null;

  if (logoData) {
    try {
      const properties = doc.getImageProperties(logoData);
      const maxWidth = 16;
      const maxHeight = 24;
      const ratio = properties.width / properties.height;
      const width = Math.min(maxWidth, maxHeight * ratio);
      logoLayout = { data: logoData, width, height: width / ratio };
    } catch (error) {
      console.warn('Primary Mini Report logo could not be decoded.', error);
    }
  }

  const drawPhoto = (photo: string | null, name: string, x: number, y: number, size: number) => {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    if (photo) {
      doc.addImage(photo, x, y, size, size, undefined, 'FAST');
    } else {
      doc.setFillColor(226, 232, 240);
      doc.circle(centerX, centerY, size / 2, 'F');
      doc.setTextColor(15, 64, 137);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(initials(name), centerX, centerY + 2.4, { align: 'center' });
    }
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.8);
    doc.circle(centerX, centerY, size / 2 + 0.8, 'S');
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.circle(centerX, centerY, size / 2 + 1.8, 'S');
  };

  const drawCard = (result: PrimaryMiniReportPDFProps['processedResults'][number], index: number, y: number) => {
    doc.addImage(backgroundData, 'PNG', cardX, y, cardWidth, cardHeight, 'primary-mini-background', 'FAST');

    if (logoLayout) {
      doc.addImage(
        logoLayout.data,
        cardX + 20.2 - (logoLayout.width / 2),
        y + 4 + ((26 - logoLayout.height) / 2),
        logoLayout.width,
        logoLayout.height,
        'primary-mini-logo',
        'FAST'
      );
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TFS', cardX + 20.2, y + 18, { align: 'center' });
    }

    drawPhoto(pupilPhotos[index], result.pupilInfo.name, cardX + cardWidth - 31, y + 6, 18);

    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(ellipsize(doc, schoolName.toUpperCase(), 130), cardX + 112, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    if (schoolAddress) doc.text(schoolAddress.toUpperCase(), cardX + 112, y + 15.3, { align: 'center' });
    if (phone) doc.text(`Tel: ${phone}`, cardX + 112, y + 20.1, { align: 'center' });
    const contactLine = [email ? `Email: ${email}` : '', poBox ? `P.O. Box: ${poBox}` : ''].filter(Boolean).join('   |   ');
    if (contactLine) doc.text(ellipsize(doc, contactLine, 118), cardX + 112, y + 24.7, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(13.5);
    doc.text(ellipsize(doc, examTitle, 94), cardX + cardWidth / 2, y + 39.7, { align: 'center' });

    const infoX = cardX + 10;
    const infoY = y + 45;
    const infoWidth = cardWidth - 20;
    const infoHeight = 18;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(191, 203, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(infoX, infoY, infoWidth, infoHeight, 2.2, 2.2, 'FD');
    const age = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam || result.pupilInfo.age);
    const columns = [infoX + 6, infoX + 58, infoX + 109, infoX + 149];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text('Pupil:', columns[0], infoY + 6.5);
    doc.text('Class:', columns[1], infoY + 6.5);
    doc.text('Age:', columns[2], infoY + 6.5);
    doc.text('PIN:', columns[3], infoY + 6.5);
    doc.text('Year:', columns[0], infoY + 14);
    doc.text('Term:', columns[1], infoY + 14);
    doc.text('Created:', columns[2], infoY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...green);
    doc.text(ellipsize(doc, result.pupilInfo.name.toUpperCase(), 35), columns[0] + 12, infoY + 6.5);
    doc.text(ellipsize(doc, className.toUpperCase(), 28), columns[1] + 12, infoY + 6.5);
    doc.text(age, columns[2] + 10, infoY + 6.5);
    doc.setTextColor(...red);
    doc.text(result.pupilInfo.admissionNumber || '', infoX + infoWidth - 5, infoY + 6.5, { align: 'right' });
    doc.setTextColor(...green);
    doc.text(year, columns[0] + 12, infoY + 14);
    doc.text(term, columns[1] + 12, infoY + 14);
    doc.text(new Date().toLocaleDateString(), columns[2] + 18, infoY + 14);

    const tableX = cardX + 10;
    const tableY = y + 66;
    const tableWidth = cardWidth - 20;
    const headerHeight = 5.5;
    const totalHeight = 5.5;
    const maxTableHeight = 45;
    const rowsHeight = Math.max(0, maxTableHeight - headerHeight - totalHeight);
    const rowHeight = Math.min(6, Math.max(2.45, rowsHeight / Math.max(subjectSnaps.length, 1)));
    const tableHeight = headerHeight + (rowHeight * subjectSnaps.length) + totalHeight;
    const subjectWidth = 59;
    const totalWidth = 20;
    const marksWidth = 22;
    const gradeWidth = 20;
    const initialsWidth = 17;
    const remarksWidth = tableWidth - subjectWidth - totalWidth - marksWidth - gradeWidth - initialsWidth;
    const widths = [subjectWidth, totalWidth, marksWidth, gradeWidth, remarksWidth, initialsWidth];
    const labels = ['SUBJECT', 'TOTAL', 'MARKS', 'GRADE', 'REMARKS', 'INIT.'];

    doc.setFillColor(...navy);
    doc.setDrawColor(...blue);
    doc.roundedRect(tableX, tableY, tableWidth, tableHeight, 2.2, 2.2, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    const headerY = tableY;
    let cursorX = tableX;
    doc.setFontSize(8.2);
    labels.forEach((label, labelIndex) => {
      doc.setDrawColor(185, 199, 219);
      doc.line(cursorX, headerY, cursorX, tableY + tableHeight);
      doc.text(label, cursorX + widths[labelIndex] / 2, headerY + 3.7, { align: 'center' });
      cursorX += widths[labelIndex];
    });
    doc.line(tableX + tableWidth, headerY, tableX + tableWidth, tableY + tableHeight);

    const majorSubjectCodes = new Set(majorSubjects || []);
    subjectSnaps.forEach((subject, subjectIndex) => {
      const rowY = headerY + headerHeight + (subjectIndex * rowHeight);
      const subjectResult = result.results[subject.code];
      const marks = Number(subjectResult?.marks ?? 0);
      const isMajor = majorSubjectCodes.size > 0 ? majorSubjectCodes.has(subject.code) : subjectSnaps.length <= 4;
      const rowValues = [
        cleanSubjectName(subject.name).toUpperCase(),
        String(subject.fullMarks || 100),
        String(marks),
        isMajor ? (subjectResult?.grade || '') : '-',
        remarkForMarks(marks),
        initials(subject.teacherName || ''),
      ];
      doc.setFillColor(subjectIndex % 2 === 0 ? 255 : 248, subjectIndex % 2 === 0 ? 255 : 250, subjectIndex % 2 === 0 ? 255 : 252);
      doc.setDrawColor(213, 222, 235);
      doc.rect(tableX + 0.25, rowY, tableWidth - 0.5, rowHeight, 'FD');
      cursorX = tableX;
      doc.setFontSize(rowHeight < 3.2 ? 5.2 : rowHeight < 4.2 ? 6.6 : 8.1);
      rowValues.forEach((value, valueIndex) => {
        const cellWidth = widths[valueIndex];
        doc.setFont('helvetica', valueIndex === 0 ? 'bold' : 'normal');
        doc.setTextColor(valueIndex === 2 ? 30 : valueIndex === 3 ? 220 : valueIndex === 4 ? 21 : 30, valueIndex === 2 ? 64 : valueIndex === 3 ? 38 : valueIndex === 4 ? 128 : 41, valueIndex === 2 ? 175 : valueIndex === 3 ? 38 : valueIndex === 4 ? 61 : 59);
        const textY = rowY + (rowHeight / 2) + 1;
        if (valueIndex === 0) doc.text(ellipsize(doc, value, cellWidth - 4), cursorX + 2, textY);
        else doc.text(ellipsize(doc, value, cellWidth - 2), cursorX + cellWidth / 2, textY, { align: 'center' });
        cursorX += cellWidth;
      });
    });

    const totalY = headerY + headerHeight + (subjectSnaps.length * rowHeight);
    const totalAvailable = subjectSnaps.reduce((sum, subject) => sum + (subject.fullMarks || 100), 0);
    const totalValues = ['TOTAL', String(totalAvailable), String(result.totalMarks ?? 0), String(result.totalAggregates ?? ''), '-', '-'];
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(...navy);
    doc.rect(tableX + 0.25, totalY, tableWidth - 0.5, totalHeight, 'FD');
    cursorX = tableX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    totalValues.forEach((value, valueIndex) => {
      const cellWidth = widths[valueIndex];
      if (valueIndex === 0) {
        doc.setFillColor(...navy);
        doc.rect(cursorX, totalY, cellWidth, totalHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(value, cursorX + 3, totalY + 3.8);
      } else {
        doc.setTextColor(valueIndex === 1 || valueIndex === 2 ? 220 : 30, valueIndex === 1 || valueIndex === 2 ? 38 : 41, valueIndex === 1 || valueIndex === 2 ? 38 : 59);
        doc.text(value, cursorX + cellWidth / 2, totalY + 3.8, { align: 'center' });
      }
      cursorX += cellWidth;
    });
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.45);
    doc.roundedRect(tableX, tableY, tableWidth, tableHeight, 2.2, 2.2, 'S');

    const footerY = Math.min(y + 117, tableY + tableHeight + 1);
    const commentX = cardX + 11;
    const divisionY = footerY + 3.5;
    const divisionLabelX = cardX + 160;

    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DIVISION:', divisionLabelX, divisionY);
    doc.setTextColor(...red);
    doc.setFontSize(11.5);
    doc.text(result.division || '-', cardX + 190, divisionY, { align: 'right' });

    const commentY = divisionY + 5.5;
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    const commentLabel = "CLASS TEACHER'S COMMENT:";
    doc.text(commentLabel, commentX, commentY);
    const commentTextX = commentX + doc.getTextWidth(commentLabel) + 2;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...green);
    doc.setFontSize(9.5);
    const teacherComment = commentPicker.classTeacher(result.pupilInfo.name, result.totalAggregates || 0);
    const commentLines = doc.splitTextToSize(
      teacherComment,
      cardX + cardWidth - commentTextX - 11
    ) as string[];
    doc.text(commentLines, commentTextX, commentY, { lineHeightFactor: 1.15 });

    const commentLineHeight = 3.9;
    const signatureY = commentY + (Math.max(commentLines.length, 1) * commentLineHeight) + 4;
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const signatureX = cardX + 12;
    const signatureLabel = 'Signature:';
    doc.text(signatureLabel, signatureX, signatureY);
    doc.setDrawColor(...navy);
    doc.line(signatureX + doc.getTextWidth(signatureLabel) + 1, signatureY, cardX + 93, signatureY);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.text(
      (schoolSettings?.generalInfo?.motto || 'GUIDING GROWTH, INSPIRING GREATNESS').toUpperCase(),
      cardX + cardWidth / 2,
      y + cardHeight - 3,
      { align: 'center', maxWidth: 105 }
    );
  };

  for (let index = 0; index < processedResults.length; index += 1) {
    if (index > 0 && index % 2 === 0) doc.addPage('a4', 'portrait');
    drawCard(processedResults[index], index, index % 2 === 0 ? firstCardY : secondCardY);
    const completed = index + 1;
    if (completed % 2 === 0 || completed === processedResults.length) {
      onProgress?.(completed, processedResults.length);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  if (processedResults.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('No primary results available.', pageWidth / 2, 148.5, { align: 'center' });
  }

  return doc.output('blob');
};
