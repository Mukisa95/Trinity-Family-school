import jsPDF from 'jspdf';

interface NurseryMiniReportPDFProps {
  examDetails: {
    name: string;
    startDate: string;
    academicYearName?: string;
    termName?: string;
  };
  classSnap: {
    name: string;
    code?: string;
  };
  subjectSnaps: Array<{
    code: string;
    name: string;
    teacherInitials?: string;
  }>;
  processedResults: Array<{
    pupilInfo: {
      name: string;
      admissionNumber: string;
      ageAtExam?: number;
      dateOfBirth?: string;
      photo?: string | null;
    };
    results: Record<string, {
      grade?: string;
      comment?: string;
    }>;
  }>;
  schoolSettings?: {
    generalInfo?: {
      name?: string;
      logo?: string;
      motto?: string;
    };
    contact?: {
      phone?: string;
      alternativePhone?: string;
      email?: string;
    };
    address?: {
      physical?: string;
      poBox?: string;
      postal?: string;
    };
  };
  backgroundImage: string;
  includeTeacherComment?: boolean;
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
        if (!context) {
          finish(source);
          return;
        }

        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const cropSize = Math.min(sourceWidth, sourceHeight);
        const sourceX = (sourceWidth - cropSize) / 2;
        const sourceY = (sourceHeight - cropSize) / 2;

        context.clearRect(0, 0, outputSize, outputSize);
        context.save();
        context.beginPath();
        context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(
          image,
          sourceX,
          sourceY,
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

const getPupilInitials = (name: string): string => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase() || '')
  .join('');

const generateTeacherComment = (remarks: string[]): string => {
  const excellent = remarks.filter(value => value === 'EXCELLENT' || value === 'VERY GOOD').length;
  const developing = remarks.filter(value => value === 'NEEDS IMPROVEMENT').length;

  if (excellent >= Math.max(1, Math.ceil(remarks.length / 2))) {
    return 'Wonderful progress! Keep exploring, learning and shining every day.';
  }
  if (developing >= Math.max(1, Math.ceil(remarks.length / 2))) {
    return 'Keep practising with support. Every small step is wonderful progress!';
  }
  return 'Good progress. Keep practising, discovering and growing every day!';
};

export const generateNurseryMiniReportPDF = async ({
  examDetails,
  classSnap,
  subjectSnaps,
  processedResults,
  schoolSettings,
  backgroundImage,
  includeTeacherComment = true,
  onProgress,
}: NurseryMiniReportPDFProps): Promise<Blob> => {
  const [backgroundData, logoData] = await Promise.all([
    toDataUrl(backgroundImage),
    toDataUrl(schoolSettings?.generalInfo?.logo),
  ]);

  if (!backgroundData) throw new Error('Nursery report background could not be loaded.');

  const pupilPhotoSources = await Promise.all(
    processedResults.map(result => toDataUrl(result.pupilInfo.photo))
  );
  const pupilPhotos = await Promise.all(pupilPhotoSources.map(cropImageToCircle));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cardX = 3;
  const cardWidth = pageWidth - 6;
  const cardHeight = 143;
  const firstCardY = 3;
  const secondCardY = 151;
  const schoolName = schoolSettings?.generalInfo?.name || 'School Name';
  const schoolAddress = schoolSettings?.address?.physical || '';
  const phone = [schoolSettings?.contact?.phone, schoolSettings?.contact?.alternativePhone].filter(Boolean).join(' / ');
  const email = schoolSettings?.contact?.email || '';
  const poBox = schoolSettings?.address?.poBox || schoolSettings?.address?.postal || '';
  const className = classSnap.code || classSnap.name;
  const year = examDetails.academicYearName || new Date(examDetails.startDate).getFullYear().toString();
  const term = examDetails.termName || '-';
  const normalizedExamName = examDetails.name.trim().replace(/\s+report$/i, '');
  const reportTitle = `${normalizedExamName} REPORT`.toUpperCase();
  let logoLayout: { data: string; width: number; height: number } | null = null;

  if (logoData) {
    try {
      const logoProperties = doc.getImageProperties(logoData);
      const logoBoxSize = 19;
      const logoRatio = logoProperties.width / logoProperties.height;
      logoLayout = {
        data: logoData,
        width: logoRatio >= 1 ? logoBoxSize : logoBoxSize * logoRatio,
        height: logoRatio >= 1 ? logoBoxSize / logoRatio : logoBoxSize,
      };
    } catch (error) {
      console.warn('Nursery mini report logo could not be decoded; using fallback.', error);
    }
  }

  const drawCircularPhoto = (photo: string | null, name: string, x: number, y: number, size: number) => {
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    if (photo) {
      // The photo is circular-cropped on a canvas before it reaches jsPDF.
      // Avoid PDF clipping paths here: some renderers keep the clip active and
      // hide all content (including the second report) drawn after the avatar.
      doc.addImage(photo, x, y, size, size, undefined, 'FAST');
    } else {
      doc.setFillColor(224, 242, 254);
      doc.circle(centerX, centerY, size / 2, 'F');
      doc.setTextColor(14, 116, 144);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(getPupilInitials(name), centerX, centerY + 2.5, { align: 'center' });
    }

    doc.setDrawColor(14, 116, 144);
    doc.setLineWidth(0.7);
    doc.circle(centerX, centerY, size / 2 + 0.8, 'S');
    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(0.3);
    doc.circle(centerX, centerY, size / 2 + 1.8, 'S');
  };

  const drawCard = (result: NurseryMiniReportPDFProps['processedResults'][number], index: number, y: number) => {
    doc.addImage(backgroundData, 'PNG', cardX, y, cardWidth, cardHeight, 'nursery-report-background', 'FAST');

    const innerLeft = cardX + 14;
    const innerRight = cardX + cardWidth - 14;
    const innerWidth = innerRight - innerLeft;

    if (logoLayout) {
      const logoBoxSize = 19;
      doc.addImage(
        logoLayout.data,
        innerLeft + 2 + ((logoBoxSize - logoLayout.width) / 2),
        y + 6 + ((logoBoxSize - logoLayout.height) / 2),
        logoLayout.width,
        logoLayout.height,
        'nursery-school-logo',
        'FAST'
      );
    } else {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(22, 163, 74);
      doc.circle(innerLeft + 11.5, y + 15.5, 9.5, 'FD');
      doc.setTextColor(21, 128, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('TFS', innerLeft + 11.5, y + 18, { align: 'center' });
    }

    drawCircularPhoto(pupilPhotos[index], result.pupilInfo.name, innerRight - 22, y + 6, 18);

    doc.setTextColor(15, 41, 92);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15.5);
    doc.text(ellipsize(doc, schoolName.toUpperCase(), 126), cardX + cardWidth / 2, y + 10.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(51, 65, 85);
    if (schoolAddress) doc.text(schoolAddress.toUpperCase(), cardX + cardWidth / 2, y + 15.2, { align: 'center' });
    if (phone) doc.text(`Tel: ${phone}`, cardX + cardWidth / 2, y + 20, { align: 'center' });
    const contactLine = [email ? `Email: ${email}` : '', poBox ? `P.O. Box: ${poBox}` : ''].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, cardX + cardWidth / 2, y + 24.5, { align: 'center' });

    const titleWidth = 116;
    const titleX = cardX + (cardWidth - titleWidth) / 2;
    doc.setFillColor(113, 73, 164);
    doc.setDrawColor(83, 50, 130);
    doc.roundedRect(titleX, y + 28, titleWidth, 11, 2, 2, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(ellipsize(doc, reportTitle, titleWidth - 8), cardX + cardWidth / 2, y + 35.3, { align: 'center' });

    const infoY = y + 42;
    doc.setFillColor(255, 253, 242);
    doc.setDrawColor(251, 191, 36);
    doc.setLineWidth(0.35);
    doc.roundedRect(innerLeft + 5, infoY, innerWidth - 10, 18, 2, 2, 'FD');

    const pupilAge = calculateAge(result.pupilInfo.dateOfBirth, examDetails.startDate, result.pupilInfo.ageAtExam);
    const infoColumns = [innerLeft + 9, innerLeft + 69, innerLeft + 118];
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 49, 105);
    doc.text('Pupil:', infoColumns[0], infoY + 6.5);
    doc.text('Class:', infoColumns[1], infoY + 6.5);
    doc.text('Age:', innerRight - 66, infoY + 6.5);
    doc.text('PIN:', innerRight - 39, infoY + 6.5);
    doc.text('Year:', infoColumns[0], infoY + 14);
    doc.text('Term:', infoColumns[1], infoY + 14);
    doc.text('Created:', innerRight - 49, infoY + 14);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text(ellipsize(doc, result.pupilInfo.name.toUpperCase(), 40), infoColumns[0] + 13, infoY + 6.5);
    doc.text(ellipsize(doc, className.toUpperCase(), 29), infoColumns[1] + 14, infoY + 6.5);
    doc.text(pupilAge, innerRight - 55, infoY + 6.5);
    doc.setTextColor(220, 38, 38);
    doc.text(result.pupilInfo.admissionNumber, innerRight - 7, infoY + 6.5, { align: 'right' });
    doc.setTextColor(21, 128, 61);
    doc.text(year, infoColumns[0] + 13, infoY + 14);
    doc.text(term, infoColumns[1] + 14, infoY + 14);
    doc.text(new Date().toLocaleDateString(), innerRight - 7, infoY + 14, { align: 'right' });

    const tableX = innerLeft + 2;
    const tableY = y + 64.5;
    const tableWidth = innerWidth - 4;
    const initialsWidth = 18;
    const headerHeight = 8;
    const maxTableHeight = 53;
    const rowHeight = Math.min(8.5, Math.max(5.2, (maxTableHeight - headerHeight) / Math.max(subjectSnaps.length, 1)));
    const rowFontSize = rowHeight < 6.5 ? 8.5 : 10.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(rowFontSize);
    const longestSubjectWidth = Math.max(
      0,
      ...subjectSnaps.map(subject => doc.getTextWidth(subject.name.toUpperCase()))
    );
    const subjectWidth = Math.min(
      Math.max(longestSubjectWidth + 7, 34),
      tableWidth - initialsWidth - 60
    );
    const remarkWidth = tableWidth - subjectWidth - initialsWidth;
    const tableHeight = headerHeight + (subjectSnaps.length * rowHeight);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.55);
    doc.roundedRect(tableX, tableY, tableWidth, tableHeight, 2.5, 2.5, 'FD');

    const headerCells = [
      { label: 'SUBJECT', x: tableX, width: subjectWidth, color: [37, 99, 235] as const },
      { label: 'REMARK', x: tableX + subjectWidth, width: remarkWidth, color: [219, 39, 119] as const },
      { label: 'INIT.', x: tableX + subjectWidth + remarkWidth, width: initialsWidth, color: [8, 145, 178] as const },
    ];
    const tableRadius = 2.5;

    headerCells.forEach((cell, cellIndex) => {
      doc.setFillColor(cell.color[0], cell.color[1], cell.color[2]);
      if (cellIndex === 0) {
        doc.roundedRect(cell.x, tableY, cell.width, headerHeight, tableRadius, tableRadius, 'F');
        doc.rect(cell.x + tableRadius, tableY, cell.width - tableRadius, headerHeight, 'F');
        doc.rect(cell.x, tableY + tableRadius, cell.width, headerHeight - tableRadius, 'F');
      } else if (cellIndex === headerCells.length - 1) {
        doc.roundedRect(cell.x, tableY, cell.width, headerHeight, tableRadius, tableRadius, 'F');
        doc.rect(cell.x, tableY, cell.width - tableRadius, headerHeight, 'F');
        doc.rect(cell.x, tableY + tableRadius, cell.width, headerHeight - tableRadius, 'F');
      } else {
        doc.rect(cell.x, tableY, cell.width, headerHeight, 'F');
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(cell.label, cell.x + cell.width / 2, tableY + (headerHeight / 2) + 1.25, { align: 'center' });
    });
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.35);
    doc.line(tableX + subjectWidth, tableY, tableX + subjectWidth, tableY + headerHeight);
    doc.line(tableX + subjectWidth + remarkWidth, tableY, tableX + subjectWidth + remarkWidth, tableY + headerHeight);

    const remarks: string[] = [];
    subjectSnaps.forEach((subject, subjectIndex) => {
      const rowY = tableY + headerHeight + (subjectIndex * rowHeight);
      const saved = result.results[subject.code];
      const remark = saved?.comment || saved?.grade || '';
      if (remark) remarks.push(remark);

      doc.setFillColor(subjectIndex % 2 === 0 ? 255 : 248, subjectIndex % 2 === 0 ? 255 : 250, subjectIndex % 2 === 0 ? 255 : 252);
      doc.setDrawColor(203, 213, 225);
      const rowFillX = tableX + 0.25;
      const rowFillWidth = tableWidth - 0.5;
      if (subjectIndex === subjectSnaps.length - 1) {
        const rowRadius = 2.25;
        doc.roundedRect(rowFillX, rowY, rowFillWidth, rowHeight, rowRadius, rowRadius, 'F');
        doc.rect(rowFillX, rowY, rowFillWidth, rowHeight - rowRadius, 'F');
        doc.line(tableX, rowY, tableX + tableWidth, rowY);
      } else {
        doc.rect(rowFillX, rowY, rowFillWidth, rowHeight, 'FD');
      }
      doc.line(tableX + subjectWidth, rowY, tableX + subjectWidth, rowY + rowHeight);
      doc.line(tableX + subjectWidth + remarkWidth, rowY, tableX + subjectWidth + remarkWidth, rowY + rowHeight);

      doc.setFontSize(rowFontSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 41, 77);
      const textY = rowY + (rowHeight / 2) + 1.25;
      doc.text(ellipsize(doc, subject.name.toUpperCase(), subjectWidth - 5), tableX + 2.5, textY);
      doc.setTextColor(21, 128, 61);
      if (remark) doc.text(ellipsize(doc, remark, remarkWidth - 3), tableX + subjectWidth + remarkWidth / 2, textY, { align: 'center' });
      doc.setTextColor(30, 41, 59);
      if (subject.teacherInitials) doc.text(subject.teacherInitials, tableX + subjectWidth + remarkWidth + initialsWidth / 2, textY, { align: 'center' });
    });

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.55);
    doc.roundedRect(tableX, tableY, tableWidth, tableHeight, 2.5, 2.5, 'S');

    const tableBottom = tableY + tableHeight;
    const commentY = Math.min(y + 124, tableBottom + 4);
    const commentX = innerLeft + 11;
    const signatureX = innerLeft + 118;
    const signatureLineX = innerLeft + 135;
    const writingLineEnd = innerRight - 5;

    if (includeTeacherComment) {
      const commentLabel = "CLASS TEACHER'S COMMENT:";
      const commentText = generateTeacherComment(remarks);
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(commentLabel, commentX, commentY + 3);
      const commentLabelWidth = doc.getTextWidth(commentLabel) + 2;
      doc.setTextColor(101, 163, 13);
      doc.setFont('helvetica', 'normal');
      const firstLineWidth = Math.max(25, 99 - commentLabelWidth);
      const initialCommentLines = doc.splitTextToSize(commentText, firstLineWidth);
      const firstCommentLine = initialCommentLines[0] || '';
      if (firstCommentLine) {
        doc.text(firstCommentLine, commentX + commentLabelWidth, commentY + 3);
      }
      const remainingComment = commentText.slice(firstCommentLine.length).trim();
      if (remainingComment) {
        const remainingLines = doc.splitTextToSize(remainingComment, 99).slice(0, 1);
        doc.text(remainingLines, commentX, commentY + 6.7);
      }

      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Signature:', signatureX, commentY + 3);
      doc.setDrawColor(30, 64, 175);
      doc.line(signatureLineX, commentY + 3, writingLineEnd, commentY + 3);
    } else {
      const blankCommentLabel = "CLASS TEACHER'S COMMENT:";
      const firstWritingLineY = commentY + 3;
      const secondWritingLineY = commentY + 10.5;
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(blankCommentLabel, commentX, firstWritingLineY);
      const blankCommentLabelWidth = doc.getTextWidth(blankCommentLabel) + 2;
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.35);
      doc.line(commentX + blankCommentLabelWidth, firstWritingLineY, writingLineEnd, firstWritingLineY);
      doc.line(commentX, secondWritingLineY, signatureX - 3, secondWritingLineY);
      doc.text('Signature:', signatureX, secondWritingLineY);
      doc.line(signatureLineX, secondWritingLineY, writingLineEnd, secondWritingLineY);
    }

    doc.setFontSize(9.5);
    doc.setTextColor(30, 64, 175);
    doc.text(
      (schoolSettings?.generalInfo?.motto || 'GUIDING GROWTH, INSPIRING GREATNESS').toUpperCase(),
      cardX + cardWidth / 2,
      y + cardHeight - 3.2,
      { align: 'center', maxWidth: 110 }
    );
  };

  for (let index = 0; index < processedResults.length; index += 1) {
    const result = processedResults[index];
    if (index > 0 && index % 2 === 0) doc.addPage('a4', 'portrait');
    drawCard(result, index, index % 2 === 0 ? firstCardY : secondCardY);

    const completed = index + 1;
    if (completed % 2 === 0 || completed === processedResults.length) {
      onProgress?.(completed, processedResults.length);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  if (processedResults.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('No nursery results available.', pageWidth / 2, pageHeight / 2, { align: 'center' });
  }

  return doc.output('blob');
};
