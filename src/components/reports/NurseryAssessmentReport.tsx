"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Pupil, Class, SchoolSettings, SubjectCommentType } from '@/types';
import { getDynamicComments } from '@/utils/commentUtils';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { getSchoolPayCode } from '@/lib/utils/schoolpay';

// --- Register Fonts --- 
Font.register({
  family: 'Comic Relief',
  src: '/fonts/ComicRelief-Regular.ttf'
});

// Define styles for modern, beautiful design
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 0,
    backgroundColor: '#ffffff',
  },
  pageBorder: {
    borderRadius: 8,
    marginTop: 25,
    marginBottom: 10,
    marginLeft: 30,
    marginRight: 30,
    paddingTop: 8,
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 4,
    position: 'relative',
  },
  innerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderTopStyle: 'solid',
    borderLeftStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderRadius: 6,
    borderTopColor: '#32CD32',
    borderLeftColor: '#32CD32',
    borderRightColor: '#1ca01c',
    borderBottomColor: '#1ca01c',
  },
  watermark: {
    position: 'absolute',
    top: '25%',
    left: '25%',
    width: '50%',
    height: '50%',
    opacity: 0.05,
    zIndex: -1,
  },
  headerContainer: {
    marginTop: 5,
    marginHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  logoImage: {
    width: 55,
    height: 55,
    objectFit: 'contain',
  },
  schoolInfoContainer: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 5,
  },
  photoContainer: {
    width: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regNoUnderPhoto: {
    fontSize: 8,
    color: '#666666',
    textAlign: 'center',
    marginTop: 2,
    fontFamily: 'Helvetica',
  },
  pupilPhoto: {
    width: 55,
    height: 65,
    objectFit: 'cover',
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#32CD32',
  },
  photoPlaceholder: {
    width: 60,
    height: 70,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#32CD32',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#32CD32',
    fontSize: 8,
    textAlign: 'center',
  },
  schoolNameLine1: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#32CD32',
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  schoolNameLine2: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: '#32CD32',
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  contactInfo: {
    fontSize: 10,
    marginTop: 4,
    color: '#555555',
    textAlign: 'center',
  },
  contactValue: {
    fontFamily: 'Helvetica-Bold',
  },
  pupilInfoContainer: {
    marginHorizontal: 15,
    marginTop: 5,
    marginBottom: 3,
    padding: 5,
    backgroundColor: '#f8fffe',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: '#32CD32',
  },
  pupilInfoRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingBottom: 2,
    width: '100%',
  },
  pupilInfoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pupilInfoColumn1: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pupilInfoColumn2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pupilInfoColumn3: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pupilInfoColumn4: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pupilMetaCellSm: {
    width: '16%',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingRight: 6,
  },
  pupilMetaCellMd: {
    width: '20%',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingRight: 6,
  },
  pupilMetaCellLg: {
    width: '38%',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    paddingRight: 6,
  },
  pupilMetaCellEnd: {
    width: '26%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  pupilInfoLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginRight: 5,
    color: '#006400',
    flexShrink: 0,
  },
  pupilInfoValue: {
    fontFamily: 'Comic Relief',
    fontSize: 10,
    color: '#0000FF',
    flexShrink: 1,
  },
  pupilInfoDivider: {
    borderBottomWidth: 0.5,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#32CD32',
    marginTop: 2,
    width: '100%',
  },
  contentContainer: {
    marginHorizontal: 15,
    marginTop: 3,
    flexDirection: 'column',
  },
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 3,
    textTransform: 'uppercase',
    color: '#000000',
  },
  sectionContainer: {
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#FF0000',
    textTransform: 'uppercase',
    marginBottom: 5,
    textDecoration: 'underline',
  },
  rightColumnSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#FF0000',
    textTransform: 'uppercase',
    marginBottom: 5,
    marginTop: 5,
    textDecoration: 'underline',
  },
  motorSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#FF0000',
    textTransform: 'uppercase',
    marginBottom: 5,
    marginTop: 4,
    textDecoration: 'underline',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 0,
    position: 'relative',
  },
  column: {
    width: '47%',
  },
  assessmentItem: {
    marginBottom: 5,
    position: 'relative',
  },
  assessmentItemBeforeMotor: {
    marginBottom: 4,
    position: 'relative',
  },
  itemLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000000',
    marginBottom: 4,
  },
  topRightImageContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 60,
    height: 60,
    zIndex: 1,
  },
  gutterImageContainer: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 55,
    height: 55,
    zIndex: 1,
  },
  rightImageContainer: {
    position: 'absolute',
    right: 0,
    top: -5,
    width: 50,
    height: 50,
    zIndex: 1,
  },
  lifeSkillsImageContainer: {
    position: 'absolute',
    right: 0,
    top: 10,
    width: 50,
    height: 50,
    zIndex: 1,
  },
  rightBottomImageContainer: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    width: 60,
    height: 60,
    zIndex: 1,
  },
  illustration: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'right',
  },
  assessmentLine: {
    borderBottomWidth: 0.75,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    marginTop: 8,
    marginBottom: 8,
    height: 1,
    position: 'relative',
    zIndex: 2,
  },
  commentSection: {
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 4,
  },
  commentRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginRight: 5,
    flexShrink: 0,
  },
  classTeacherCommentText: {
    fontSize: 9,
    fontFamily: 'Comic Relief',
    color: '#0000FF',
    textAlign: 'left',
    lineHeight: 1.3,
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  headTeacherCommentText: {
    fontSize: 9,
    fontFamily: 'Comic Relief',
    color: '#FF0000',
    textAlign: 'left',
    lineHeight: 1.3,
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  commentLine: {
    borderBottomWidth: 0.75,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    height: 12,
    marginBottom: 2,
  },
  commentLineWithSignature: {
    height: 12,
    marginBottom: 2,
    position: 'relative',
  },
  shortenedDottedLine: {
    borderBottomWidth: 0.75,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    height: 1,
    position: 'absolute',
    left: 0,
    right: 170,
    bottom: 0,
  },
  signatureLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginRight: 5,
    position: 'absolute',
    right: 110,
    bottom: 0,
  },
  inlineSignatureLine: {
    borderBottomWidth: 0.75,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    width: 100,
    position: 'absolute',
    right: 0,
    bottom: 0,
    height: 1,
  },
  signatureImage: {
    position: 'absolute',
    right: 5,
    bottom: -5,
    width: 70,
    height: 20,
    objectFit: 'contain',
  },
  nextTermContainer: {
    marginHorizontal: 15,
    marginTop: 2,
    marginBottom: 0,
  },
  nextTermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'space-between',
  },
  termLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000000',
    marginRight: 5,
    flexShrink: 0,
  },
  endTermLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000000',
    marginLeft: 10,
    marginRight: 5,
    flexShrink: 0,
  },
  dateValueContainer: {
    position: 'relative',
    width: '30%',
    height: 12,
  },
  dateValueText: {
    fontFamily: 'Comic Relief',
    fontSize: 10,
    color: '#0000FF',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
  },
  dateValueLine: {
    borderBottomWidth: 0.75,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#444444',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  footer: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 9,
    color: '#FF0000',
    fontFamily: 'Helvetica-Bold',
  },
  commentContainer: {
    position: 'relative',
    flex: 1,
    minHeight: 20,
  },
});

// Predefined comments
const comments = {
  good: [
    "Outstanding achievement! Your hard work and commitment are truly paying off.",
    "Excellent work across the board. Keep pushing yourself and reaching new heights!",
    "You are consistently showing great understanding and effort. Very impressive!",
    "Brilliant performance this term! Maintain this positive momentum.",
  ],
  fair: [
    "A strong effort! With just a bit more focus, you'll achieve even greater success.",
    "You're building a solid foundation; keep aiming higher.",
    "Good progress! Let's keep up the energy and reach for excellence.",
    "You are on the right track. A little more consistency will take you even further!",
  ],
  young: [
    "You're showing promise. Let's channel your energy into steady learning habits.",
    "With greater attention to detail, you can achieve wonderful results.",
    "There is so much potential here — let's work together to develop it.",
    "You're at the beginning of an exciting journey. Stay focused and enthusiastic!",
  ],
  weak: [
    "Improvement is within reach! Let's put more effort into challenging areas.",
    "A stronger commitment to study will help you unlock your full potential.",
    "You have the ability — now let's work on consistency and effort.",
    "Focus and persistence will lead to much better results next term.",
  ],
  irregular: [
    "More consistent attendance will greatly boost your performance.",
    "Regular participation is key to achieving your true potential.",
    "With steady attendance, your understanding and results will significantly improve.",
    "Frequent engagement will help you build stronger skills and confidence.",
  ],
  default: [
    "Keep up the good effort and continue striving for improvement.",
    "Positive progress noted this term."
  ]
};

const headTeacherComments = {
  good: [
    "You are doing well, but there's always room to reach even higher.",
    "Excellent effort so far — aim for even greater achievements!",
    "You're performing strongly; now challenge yourself to reach your fullest potential.",
    "Solid results! Push yourself a little further for even bigger success.",
  ],
  fair: [
    "Good progress, but greater focus will lead to even better results.",
    "You've done well — now aim to double your efforts for outstanding achievements.",
    "A strong performance, but there's more you can accomplish with extra dedication.",
    "With continued hard work, you can move from good to exceptional.",
  ],
  young: [
    "Patience and practice will lead to steady improvement.",
    "Keep developing your skills — growth takes time.",
    "You have the foundation; consistent effort will bring visible results.",
    "With persistence and guidance, your abilities will continue to grow.",
  ],
  weak: [
    "Greater effort and focus are key to better outcomes.",
    "A stronger commitment to learning will greatly improve your results.",
    "Let's aim to strengthen your understanding for better future results.",
    "You can do much better with more consistent effort and attention.",
  ],
  irregular: [
    "Consistent attendance is essential for steady improvement.",
    "Making it to class regularly will boost both confidence and performance.",
    "Frequent class participation will support much better results.",
    "Attendance needs to be more regular for you to achieve your best.",
  ],
  default: [
    "Continue to work hard and strive for your best.",
    "Focus on consistent effort for future success."
  ]
};

interface NurseryAssessmentReportProps {
  pupil: Pupil;
  pupilClass: Class | null;
  settings: SchoolSettings | null;
  currentAcademicYear: any | null;
  currentTerm: any | null;
  nextTermStartDate: string | null;
  nextTermEndDate: string | null;
  performanceStatus?: string;
  classTeacherComment?: string;
  headTeacherComment?: string;
  subjectComments?: Record<SubjectCommentType, string>;
  showPayCode?: boolean;
}

const calculateAge = (dob: string | Date): number | null => {
  if (!dob) return null;
  try {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age >= 0 && age < 150 ? age : null;
  } catch (e) {
    console.error("Error calculating age:", e);
    return null;
  }
};

const getSafePdfImageSource = (src?: string | null): string | null => {
  if (!src || typeof src !== 'string') return null;

  const trimmed = src.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  // React-PDF batch rendering is unreliable with transient browser blob/file URLs.
  if (trimmed.startsWith('blob:') || trimmed.startsWith('file:')) {
    return null;
  }

  return trimmed;
};

// Component for assessment lines
const AssessmentLines = ({ count = 5 }: { count?: number }) => (
  <>
    {Array(count).fill(null).map((_, i) => (
      <View key={i} style={styles.assessmentLine} />
    ))}
  </>
);

// Component for assessment item with optional comment
const AssessmentItem = ({
  label,
  subjectType,
  subjectComments,
  defaultLineCount = 5,
  imageSrc,
  imageStyle,
  itemStyle
}: {
  label: string;
  subjectType?: SubjectCommentType;
  subjectComments?: Record<SubjectCommentType, string>;
  defaultLineCount?: number;
  imageSrc?: string;
  imageStyle?: any;
  itemStyle?: any;
}) => {
  const comment = subjectType && subjectComments?.[subjectType];

  const fontSize = 10.5; // Readable font size
  const lineSpacing = 1.5; // Very tight spacing - minimal gap between lines

  // Determine if there's an image and calculate right padding to avoid text overlap
  const hasImage = !!imageSrc;
  let rightPadding = 0;
  if (hasImage) {
    // Set padding to exact image width so lines stop right at image edge
    if (imageStyle === styles.topRightImageContainer || imageStyle === styles.rightBottomImageContainer) {
      rightPadding = 60; // Exact image width
    } else if (imageStyle === styles.gutterImageContainer) {
      rightPadding = 55; // Exact image width
    } else {
      rightPadding = 50; // Exact image width
    }
  }

  return (
    <View style={itemStyle || styles.assessmentItem}>
      <Text style={styles.itemLabel}>{label}</Text>
      <View style={{
        position: 'relative',
        minHeight: defaultLineCount * 17
      }}>
        {/* Render lines with padding if image exists */}
        {hasImage ? (
          <View style={{ paddingRight: rightPadding }}>
            <AssessmentLines count={defaultLineCount} />
          </View>
        ) : (
          <AssessmentLines count={defaultLineCount} />
        )}

        {/* Render comment text */}
        {comment && (
          <View style={{
            position: 'absolute',
            top: -2,
            left: 0,
            right: rightPadding, // Padding to avoid images
            zIndex: 2
          }}>
            <Text style={{
              fontSize: fontSize,
              fontFamily: 'Comic Relief',
              color: '#0000FF',
              lineHeight: lineSpacing
            }}>
              {comment}
            </Text>
          </View>
        )}
      </View>

      {/* Render image as sibling to AssessmentLines - this ensures it appears on top */}
      {imageSrc && (
        <View style={imageStyle || styles.gutterImageContainer}>
          <Image style={styles.illustration} src={imageSrc} />
        </View>
      )}
    </View>
  );
};

export const NurseryAssessmentReportPageContent: React.FC<NurseryAssessmentReportProps> = ({
  pupil,
  pupilClass,
  settings,
  currentAcademicYear,
  currentTerm,
  nextTermStartDate,
  nextTermEndDate,
  performanceStatus = 'fair',
  classTeacherComment: passedClassTeacherComment,
  headTeacherComment: passedHeadTeacherComment,
  subjectComments: passedSubjectComments,
  showPayCode = false,
}) => {
  const [dynamicComments, setDynamicComments] = useState({
    classTeacherComment: '',
    headTeacherComment: ''
  });
  const [subjectCommentsState, setSubjectCommentsState] = useState<Record<SubjectCommentType, string>>(
    passedSubjectComments || {} as Record<SubjectCommentType, string>
  );

  // Load dynamic comments when component mounts or performance status changes
  useEffect(() => {
    // If comments are passed as props, use them directly
    if (passedClassTeacherComment && passedHeadTeacherComment) {
      setDynamicComments({
        classTeacherComment: passedClassTeacherComment,
        headTeacherComment: passedHeadTeacherComment
      });
      return;
    }

    const loadComments = async () => {
      try {
        const comments = await getDynamicComments(performanceStatus);
        setDynamicComments(comments);
      } catch (error) {
        console.error('Error loading dynamic comments:', error);
        // Fallback to static comments
        const pupilStatus = performanceStatus as keyof typeof comments;
        const statusKey = pupilStatus && comments[pupilStatus] ? pupilStatus : 'default';
        const classTeacherSet = comments[statusKey] || comments.default;
        const headTeacherSet = headTeacherComments[statusKey] || headTeacherComments.default;

        setDynamicComments({
          classTeacherComment: classTeacherSet[Math.floor(Math.random() * classTeacherSet.length)],
          headTeacherComment: headTeacherSet[Math.floor(Math.random() * headTeacherSet.length)]
        });
      }
    };

    console.log('📄 PDF Component - Comments received:', {
      passedClassTeacherComment,
      passedHeadTeacherComment,
      dynamicComments,
      finalTeacherComment: dynamicComments.classTeacherComment,
      finalHeadTeacherComment: dynamicComments.headTeacherComment
    });

    // Additional detailed logging
    console.log('📄 PDF Component - Detailed comment analysis:', {
      classTeacher: {
        comment: dynamicComments.classTeacherComment,
        length: dynamicComments.classTeacherComment?.length || 0,
        hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(dynamicComments.classTeacherComment || ''),
        firstChars: dynamicComments.classTeacherComment?.substring(0, 20) || 'N/A'
      },
      headTeacher: {
        comment: dynamicComments.headTeacherComment,
        length: dynamicComments.headTeacherComment?.length || 0,
        hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(dynamicComments.headTeacherComment || ''),
        firstChars: dynamicComments.headTeacherComment?.substring(0, 20) || 'N/A'
      }
    });

    if (performanceStatus) {
      loadComments();
    }
  }, [passedClassTeacherComment, passedHeadTeacherComment, performanceStatus]);

  const teacherComment = dynamicComments.classTeacherComment || passedClassTeacherComment || '';
  const headTeacherComment = dynamicComments.headTeacherComment || passedHeadTeacherComment || '';

  const generalInfo = settings?.generalInfo;
  const contactInfo = settings?.contact;
  const age = calculateAge(pupil.dateOfBirth || '');
  const currentDate = new Date().toLocaleDateString('en-GB');
  const regNo = pupil.admissionNumber || pupil.learnerIdentificationNumber;
  const pupilPhotoData = getSafePdfImageSource(pupil.photo || null);
  const schoolPayCode = getSchoolPayCode(pupil);
  const schoolLogo = getSafePdfImageSource(generalInfo?.logo || null);
  const headTeacherSignature = getSafePdfImageSource(settings?.headTeacher?.signature || null);

  // Get current year from academic year or fallback to current year
  const currentYear = currentAcademicYear?.year || new Date().getFullYear();

  // Convert term name to Roman numerals
  const getTermRomanNumeral = (termName: string | null): string => {
    if (!termName) return 'I';
    const lowerTermName = termName.toLowerCase();

    // Check for term 3 patterns
    if (lowerTermName.includes('3') ||
      lowerTermName.includes('third') ||
      lowerTermName.includes('three') ||
      lowerTermName.includes('iii')) return 'III';

    // Check for term 2 patterns  
    if (lowerTermName.includes('2') ||
      lowerTermName.includes('second') ||
      lowerTermName.includes('two') ||
      lowerTermName.includes('ii')) return 'II';

    // Check for term 1 patterns (or default)
    if (lowerTermName.includes('1') ||
      lowerTermName.includes('first') ||
      lowerTermName.includes('one') ||
      lowerTermName.includes('i')) return 'I';

    // Try to extract number from term name (e.g., "Term 3" -> "3")
    const numberMatch = termName.match(/\d+/);
    if (numberMatch) {
      const termNumber = parseInt(numberMatch[0]);
      switch (termNumber) {
        case 1: return 'I';
        case 2: return 'II';
        case 3: return 'III';
        default: return 'I';
      }
    }

    return 'I'; // Default to Term I
  };

  const termRomanNumeral = getTermRomanNumeral(currentTerm?.name || null);

  // Debug logging right before rendering
  console.log('🎨 RENDER TIME - Class Teacher Comment:', {
    teacherComment,
    length: teacherComment?.length || 0,
    isEmpty: !teacherComment || teacherComment.trim() === '',
    passedComment: passedClassTeacherComment,
    dynamicComment: dynamicComments.classTeacherComment,
    wordCount: teacherComment?.split(' ').length || 0,
    hasLongWords: teacherComment?.split(' ').some(word => word.length > 15) || false,
    preview: teacherComment?.substring(0, 50) + (teacherComment?.length > 50 ? '...' : '') || 'N/A'
  });

  console.log('🎨 RENDER TIME - Head Teacher Comment:', {
    headTeacherComment,
    length: headTeacherComment?.length || 0,
    isEmpty: !headTeacherComment || headTeacherComment.trim() === '',
    passedComment: passedHeadTeacherComment,
    dynamicComment: dynamicComments.headTeacherComment,
    wordCount: headTeacherComment?.split(' ').length || 0,
    hasLongWords: headTeacherComment?.split(' ').some(word => word.length > 15) || false,
    preview: headTeacherComment?.substring(0, 50) + (headTeacherComment?.length > 50 ? '...' : '') || 'N/A'
  });

  return (
      <Page size="A4" style={styles.page}>
        <View style={styles.pageBorder}>
          <View style={styles.innerBorder} />

          {schoolLogo && (
            <Image src={schoolLogo} style={styles.watermark} />
          )}

          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <View style={styles.logoContainer}>
                {schoolLogo ? (
                  <Image style={styles.logoImage} src={schoolLogo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.placeholderText}>School Logo</Text>
                  </View>
                )}
              </View>

              <View style={styles.schoolInfoContainer}>
                <Text style={styles.schoolNameLine1}>
                  {generalInfo?.name?.toUpperCase() || ''}
                </Text>

                <Text style={styles.contactInfo}>
                  {contactInfo?.phone ? (
                    <>
                      TEL: <Text style={styles.contactValue}>{contactInfo.phone}</Text>
                    </>
                  ) : ''}
                  {contactInfo?.alternativePhone ? (
                    <>
                      {contactInfo?.phone ? ' / ' : 'TEL: '}
                      <Text style={styles.contactValue}>{contactInfo.alternativePhone}</Text>
                    </>
                  ) : ''}
                  {(contactInfo?.phone || contactInfo?.alternativePhone) && contactInfo?.email ? '\n' : ''}
                  {contactInfo?.email ? (
                    <>
                      EMAIL: <Text style={styles.contactValue}>{contactInfo.email}</Text>
                    </>
                  ) : ''}
                </Text>
              </View>

              <View style={styles.photoContainer}>
                {pupilPhotoData ? (
                  <Image style={styles.pupilPhoto} src={pupilPhotoData} />
                ) : null}
                <Text style={styles.regNoUnderPhoto}>{regNo || ''}</Text>
              </View>
            </View>
          </View>

          <View style={styles.pupilInfoContainer}>
            <View style={styles.pupilInfoRow}>
              <View style={styles.pupilInfoColumn1}>
                <Text style={styles.pupilInfoLabel}>NAME:</Text>
                <Text style={styles.pupilInfoValue}>{formatPupilDisplayName(pupil)}</Text>
              </View>
              <View style={styles.pupilInfoColumn2}>
                <Text style={styles.pupilInfoLabel}>CLASS:</Text>
                <Text style={styles.pupilInfoValue}>{pupilClass?.name || ''}</Text>
              </View>
              <View style={styles.pupilInfoColumn3}>
                <Text style={styles.pupilInfoLabel}>AGE:</Text>
                <Text style={styles.pupilInfoValue}>{age !== null ? age : ''}</Text>
              </View>
            </View>
            <View style={styles.pupilInfoDivider} />

            <View style={styles.pupilInfoMetaRow}>
              <View style={styles.pupilMetaCellSm}>
                <Text style={styles.pupilInfoLabel}>YEAR:</Text>
                <Text style={styles.pupilInfoValue}>{currentYear}</Text>
              </View>
              <View style={styles.pupilMetaCellMd}>
                <Text style={styles.pupilInfoLabel}>TERM:</Text>
                <Text style={styles.pupilInfoValue}>{termRomanNumeral}</Text>
              </View>
              {showPayCode && !!schoolPayCode && (
                <View style={styles.pupilMetaCellLg}>
                  <Text style={styles.pupilInfoLabel}>School Pay Code:</Text>
                  <Text style={styles.pupilInfoValue}>{schoolPayCode}</Text>
                </View>
              )}
              <View style={styles.pupilMetaCellEnd}>
                <Text style={styles.pupilInfoLabel}>Print Date:</Text>
                <Text style={styles.pupilInfoValue}>{currentDate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.mainTitle}>CHILD'S PROGRESSIVE ASSESSMENT REPORT</Text>

            <View style={styles.sectionContainer}>
              <View style={styles.rowContainer}>
                <View style={styles.column}>
                  <Text style={styles.sectionTitle}>COGNITIVE DEVELOPMENT SKILLS</Text>

                  <AssessmentItem
                    label="Mathematical concepts:"
                    subjectType="mathematical_concepts"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={5}
                  />

                  <AssessmentItem
                    label="Reading:"
                    subjectType="reading"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={4}
                    imageSrc="/images/Reading.png"
                    imageStyle={styles.gutterImageContainer}
                  />

                  <AssessmentItem
                    label="Vocabulary:"
                    subjectType="vocabulary"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={5}
                    imageSrc="/images/Vocabulary.png"
                    imageStyle={styles.gutterImageContainer}
                  />

                  <AssessmentItem
                    label="General Knowledge:"
                    subjectType="general_knowledge"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={3}
                    itemStyle={styles.assessmentItemBeforeMotor}
                  />

                  <Text style={styles.motorSectionTitle}>MOTOR DEVELOPMENT SKILLS</Text>

                  <AssessmentItem
                    label="Outdoor activities:"
                    subjectType="outdoor_activities"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={3}
                    imageSrc="/images/Outdoor activities.png"
                    imageStyle={styles.gutterImageContainer}
                  />
                </View>

                <View style={styles.column}>
                  <AssessmentItem
                    label="Writing Concepts:"
                    subjectType="writing_concepts"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={4}
                    imageSrc="/images/writing concepts.png"
                    imageStyle={styles.topRightImageContainer}
                  />

                  <Text style={styles.rightColumnSectionTitle}>SOCIAL/EMOTIONAL DEVELOPMENT SKILLS</Text>

                  <AssessmentItem
                    label="God and his creation:"
                    subjectType="god_and_his_creation"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={2}
                    imageSrc="/images/God and his creation.png"
                    imageStyle={styles.rightImageContainer}
                  />

                  <AssessmentItem
                    label="Life skills:"
                    subjectType="life_skills"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={3}
                    imageSrc="/images/Life skills.png"
                    imageStyle={styles.lifeSkillsImageContainer}
                  />

                  <Text style={styles.rightColumnSectionTitle}>LISTENING AND SEQUENCING</Text>

                  <AssessmentItem
                    label="Story Telling:"
                    subjectType="story_telling"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={3}
                  />

                  <AssessmentItem
                    label="Rhymes / Music:"
                    subjectType="rhymes_music"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={4}
                    imageSrc="/images/Rhymes  Music.png"
                    imageStyle={styles.rightBottomImageContainer}
                  />

                  <AssessmentItem
                    label="Punctuality:"
                    subjectType="punctuality"
                    subjectComments={subjectCommentsState}
                    defaultLineCount={3}
                    imageSrc="/images/Punctuality.png"
                    imageStyle={styles.rightBottomImageContainer}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.commentSection}>
            <View style={styles.commentRow}>
              <Text style={styles.commentLabel}>Class teacher's general comment:</Text>
              <View style={styles.commentContainer}>
                <Text style={styles.classTeacherCommentText}>{teacherComment}</Text>
                <View style={[styles.commentLine, { width: '100%' }]} />
                <View style={[styles.commentLineWithSignature]}>
                  <View style={styles.shortenedDottedLine} />
                  <Text style={styles.signatureLabel}>Signature:</Text>
                  <View style={styles.inlineSignatureLine} />
                </View>
              </View>
            </View>

            <View style={styles.commentRow}>
              <Text style={styles.commentLabel}>Headteacher's Comment:</Text>
              <View style={styles.commentContainer}>
                <Text style={styles.headTeacherCommentText}>{headTeacherComment}</Text>
                <View style={[styles.commentLine, { width: '100%' }]} />
                <View style={[styles.commentLineWithSignature]}>
                  <View style={styles.shortenedDottedLine} />
                  <Text style={styles.signatureLabel}>Signature:</Text>
                  <View style={styles.inlineSignatureLine} />
                  {headTeacherSignature && (
                    <Image style={styles.signatureImage} src={headTeacherSignature} />
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.nextTermContainer}>
            <View style={styles.nextTermRow}>
              <Text style={styles.termLabel}>Next Term begins on:</Text>
              <View style={[styles.dateValueContainer, { width: '40%' }]}>
                <Text style={styles.dateValueText}>
                  {nextTermStartDate || ''}
                </Text>
                <View style={styles.dateValueLine} />
              </View>
              <Text style={styles.endTermLabel}>Ends on:</Text>
              <View style={[styles.dateValueContainer, { width: '25%' }]}>
                <Text style={styles.dateValueText}>{nextTermEndDate || ''}</Text>
                <View style={styles.dateValueLine} />
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            {settings?.generalInfo?.motto || ''}
          </Text>
        </View>
      </Page>
  );
};

const NurseryAssessmentReport: React.FC<NurseryAssessmentReportProps> = (props) => {
  const pupilName = formatPupilDisplayName(props.pupil);

  return (
    <Document title={`Report - ${pupilName}`}>
      <NurseryAssessmentReportPageContent {...props} />
    </Document>
  );
};

export default NurseryAssessmentReport; 
