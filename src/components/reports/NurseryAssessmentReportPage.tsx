"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Pupil, Class, SchoolSettings } from '@/types';
import { getDynamicComments } from '@/utils/commentUtils';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// --- Register Fonts --- 
Font.register({
  family: 'Comic Relief',
  src: '/fonts/ComicRelief-Regular.ttf'
});

// Define styles for modern, beautiful design (copied from NurseryAssessmentReport)
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
  pupilInfoLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginRight: 5,
    color: '#006400',
  },
  pupilInfoValue: {
    fontFamily: 'Comic Relief',
    fontSize: 10,
    color: '#0000FF',
  },
  pupilInfoDivider: {
    borderBottomWidth: 0.5,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#32CD32',
    marginTop: 2,
  },
  contentContainer: {
    marginHorizontal: 15,
    marginTop: 8,
    flex: 1,
  },
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#32CD32',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionContainer: {
    flex: 1,
  },
  rowContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  column: {
    flex: 1,
    paddingRight: 8,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginBottom: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rightColumnSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginBottom: 6,
    marginTop: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  motorSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginBottom: 6,
    marginTop: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  assessmentItem: {
    marginBottom: 8,
    position: 'relative',
  },
  assessmentItemBeforeMotor: {
    marginBottom: 12,
    position: 'relative',
  },
  itemLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#333333',
    marginBottom: 2,
  },
  assessmentLine: {
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#cccccc',
    height: 12,
    marginBottom: 2,
  },
  illustration: {
    width: 35,
    height: 25,
    objectFit: 'contain',
  },
  gutterImageContainer: {
    position: 'absolute',
    right: -45,
    top: 15,
    width: 35,
    height: 25,
  },
  topRightImageContainer: {
    position: 'absolute',
    right: -45,
    top: 5,
    width: 35,
    height: 25,
  },
  rightImageContainer: {
    position: 'absolute',
    right: -45,
    top: 10,
    width: 35,
    height: 25,
  },
  rightBottomImageContainer: {
    position: 'absolute',
    right: -45,
    top: 8,
    width: 35,
    height: 25,
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
  commentContainer: {
    position: 'relative',
    flex: 1,
    minHeight: 20,
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
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#cccccc',
    height: 12,
    marginBottom: 2,
  },
  commentLineWithSignature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  shortenedDottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#cccccc',
    height: 12,
    marginRight: 5,
  },
  signatureLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#333333',
    marginRight: 5,
  },
  inlineSignatureLine: {
    width: 80,
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#cccccc',
    height: 12,
  },
  signatureImage: {
    width: 60,
    height: 20,
    objectFit: 'contain',
    marginLeft: 5,
  },
  nextTermContainer: {
    marginHorizontal: 15,
    marginTop: 6,
    marginBottom: 8,
  },
  nextTermRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  termLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginRight: 8,
  },
  endTermLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    marginLeft: 15,
    marginRight: 8,
  },
  dateValueContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  dateValueText: {
    fontFamily: 'Comic Relief',
    fontSize: 9,
    color: '#0000FF',
    textAlign: 'center',
    marginBottom: 2,
  },
  dateValueLine: {
    borderBottomWidth: 1,
    borderBottomStyle: 'dotted',
    borderBottomColor: '#cccccc',
    width: '100%',
    height: 1,
  },
  footer: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#32CD32',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
});

interface NurseryAssessmentReportPageProps {
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
}

const calculateAge = (dob: string | Date): number | null => {
  if (!dob) return null;
  
  try {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    console.error('Error calculating age:', error);
    return null;
  }
};

const AssessmentLines = ({ count = 5 }: { count?: number }) => (
  <View>
    {Array.from({ length: count }, (_, index) => (
      <View key={index} style={styles.assessmentLine} />
    ))}
  </View>
);

const NurseryAssessmentReportPage: React.FC<NurseryAssessmentReportPageProps> = ({ 
  pupil, 
  pupilClass, 
  settings, 
  currentAcademicYear,
  currentTerm,
  nextTermStartDate,
  nextTermEndDate,
  performanceStatus = 'fair',
  classTeacherComment: passedClassTeacherComment,
  headTeacherComment: passedHeadTeacherComment
}) => {
  const [dynamicComments, setDynamicComments] = useState({
    classTeacherComment: '',
    headTeacherComment: ''
  });

  useEffect(() => {
    const loadComments = async () => {
      try {
        const comments = await getDynamicComments(performanceStatus);
        setDynamicComments(comments);
      } catch (error) {
        console.error('Error loading dynamic comments:', error);
      }
    };

    if (performanceStatus) {
      loadComments();
    }
  }, [performanceStatus]);

  const teacherComment = dynamicComments.classTeacherComment || passedClassTeacherComment || '';
  const headTeacherComment = dynamicComments.headTeacherComment || passedHeadTeacherComment || '';

  const generalInfo = settings?.generalInfo;
  const contactInfo = settings?.contact;
  const schoolLogo = generalInfo?.logo;
  
  const age = calculateAge(pupil.dateOfBirth || '');
  const regNo = pupil.admissionNumber || pupil.learnerIdentificationNumber || '';
  
  const pupilPhotoData = pupil.photo;
  
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  
  const currentYear = currentAcademicYear?.name || new Date().getFullYear().toString();

  const getTermRomanNumeral = (termName: string | null): string => {
    if (!termName) return 'I';
    
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
    
    return 'I';
  };
  
  const termRomanNumeral = getTermRomanNumeral(currentTerm?.name || null);

  return (
    <Page size="A4" style={styles.page} wrap={false}>
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
          
          <View style={styles.pupilInfoRow}>
            <View style={styles.pupilInfoColumn1}>
              <Text style={styles.pupilInfoLabel}>YEAR:</Text>
              <Text style={styles.pupilInfoValue}>{currentYear}</Text>
            </View>
            <View style={styles.pupilInfoColumn2}>
              <Text style={styles.pupilInfoLabel}>TERM:</Text>
              <Text style={styles.pupilInfoValue}>{termRomanNumeral}</Text>
            </View>
            <View style={styles.pupilInfoColumn3}>
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
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Mathematical concepts:</Text>
                  <AssessmentLines count={5} />
                </View>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Reading:</Text>
                  <AssessmentLines count={4} />
                  <View style={styles.gutterImageContainer}>
                    <Image style={styles.illustration} src="/images/Reading.jpg" />
                  </View>
                </View>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Vocabulary:</Text>
                  <AssessmentLines count={5} />
                  <View style={styles.gutterImageContainer}>
                    <Image style={styles.illustration} src="/images/Vocabulary.jpg" />
                  </View>
                </View>
                
                <View style={styles.assessmentItemBeforeMotor}>
                  <Text style={styles.itemLabel}>General Knowledge:</Text>
                  <AssessmentLines count={3} />
                </View>
                
                <Text style={styles.motorSectionTitle}>MOTOR DEVELOPMENT SKILLS</Text>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Outdoor activities:</Text>
                  <AssessmentLines count={4} />
                  <View style={styles.gutterImageContainer}>
                    <Image style={styles.illustration} src="/images/Outdoor activities.jpg" />
                  </View>
                </View>
              </View>
              
              <View style={styles.column}>
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Writing Concepts:</Text>
                  <AssessmentLines count={4} />
                  <View style={styles.topRightImageContainer}>
                    <Image style={styles.illustration} src="/images/writing concepts.jpg" />
                  </View>
                </View>
                
                <Text style={styles.rightColumnSectionTitle}>SOCIAL/EMOTIONAL DEVELOPMENT SKILLS</Text>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>God and his creation:</Text>
                  <AssessmentLines count={2} />
                  <View style={styles.rightImageContainer}>
                    <Image style={styles.illustration} src="/images/God and his creation.jpg" />
                  </View>
                </View>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Life skills:</Text>
                  <AssessmentLines count={3} />
                  <View style={styles.rightImageContainer}>
                    <Image style={styles.illustration} src="/images/Life skills.jpg" />
                  </View>
                </View>
                
                <Text style={styles.rightColumnSectionTitle}>LISTENING AND SEQUENCING</Text>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Story Telling:</Text>
                  <AssessmentLines count={3} />
                </View>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Rhymes / Music:</Text>
                  <AssessmentLines count={4} />
                  <View style={styles.rightBottomImageContainer}>
                    <Image style={styles.illustration} src="/images/Rhymes  Music.jpg" />
                  </View>
                </View>
                
                <View style={styles.assessmentItem}>
                  <Text style={styles.itemLabel}>Punctuality:</Text>
                  <AssessmentLines count={3} />
                  <View style={styles.rightBottomImageContainer}>
                    <Image style={styles.illustration} src="/images/Punctuality.jpg" />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.commentSection}>
          <View style={styles.commentRow}>
            <Text style={styles.commentLabel}>Class teacher's general comment:</Text>
            <View style={styles.commentContainer}>
              <Text style={styles.classTeacherCommentText}>{teacherComment}</Text>
              <View style={[styles.commentLine, {width: '100%'}]} />
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
              <View style={[styles.commentLine, {width: '100%'}]} />
              <View style={[styles.commentLineWithSignature]}>
                <View style={styles.shortenedDottedLine} />
                <Text style={styles.signatureLabel}>Signature:</Text>
                <View style={styles.inlineSignatureLine} />
                {settings?.headTeacher?.signature && (
                  <Image style={styles.signatureImage} src={settings.headTeacher.signature} />
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.nextTermContainer}>
          <View style={styles.nextTermRow}>
            <Text style={styles.termLabel}>Next Term begins on:</Text>
            <View style={[styles.dateValueContainer, {width: '40%'}]}>
              <Text style={styles.dateValueText}>
                {nextTermStartDate || ''}
              </Text>
              <View style={styles.dateValueLine} />
            </View>
            <Text style={styles.endTermLabel}>Ends on:</Text>
            <View style={[styles.dateValueContainer, {width: '25%'}]}>
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

export default NurseryAssessmentReportPage; 