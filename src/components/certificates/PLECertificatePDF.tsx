import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import QRCode from 'qrcode';

// Helper function to convert numbers/grades to words
const numberToWords = (grade: string | number): string => {
  // Convert grade to string if it's a number
  const gradeStr = String(grade);
  
  const gradeMap: { [key: string]: string } = {
    '1': 'ONE',
    '2': 'TWO',
    '3': 'THREE',
    '4': 'FOUR',
    '5': 'FIVE',
    '6': 'SIX',
    '7': 'SEVEN',
    '8': 'EIGHT',
    '9': 'NINE',
    '10': 'TEN',
    '11': 'ELEVEN',
    '12': 'TWELVE',
    '13': 'THIRTEEN',
    '14': 'FOURTEEN',
    '15': 'FIFTEEN',
    '16': 'SIXTEEN',
    '17': 'SEVENTEEN',
    '18': 'EIGHTEEN',
    '19': 'NINETEEN',
    '20': 'TWENTY',
    '21': 'TWENTY ONE',
    '22': 'TWENTY TWO',
    '23': 'TWENTY THREE',
    '24': 'TWENTY FOUR',
    '25': 'TWENTY FIVE',
    '26': 'TWENTY SIX',
    '27': 'TWENTY SEVEN',
    '28': 'TWENTY EIGHT',
    '29': 'TWENTY NINE',
    '30': 'THIRTY',
    '31': 'THIRTY ONE',
    '32': 'THIRTY TWO',
    '33': 'THIRTY THREE',
    '34': 'THIRTY FOUR',
    '35': 'THIRTY FIVE',
    '36': 'THIRTY SIX',
    'D1': 'ONE',
    'D2': 'TWO',
    'C3': 'THREE',
    'C4': 'FOUR',
    'C5': 'FIVE',
    'C6': 'SIX',
    'P7': 'SEVEN',
    'P8': 'EIGHT',
    'F9': 'NINE'
  };
  
  // For total marks, directly return the word
  if (gradeStr === '12') return 'TWELVE';
  
  // For other grades
  return gradeMap[gradeStr] || '';
};

// Register fonts
Font.register({
  family: 'Helvetica',
  src: 'Helvetica'
});

Font.register({
  family: 'Helvetica-Bold',
  src: 'Helvetica-Bold'
});

Font.register({
  family: 'Times-Bold',
  src: 'Times-Bold'
});

Font.register({
  family: 'Courier',
  src: 'Courier'
});

Font.register({
  family: 'Courier-Bold',
  src: 'Courier-Bold'
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    position: 'relative'
  },
  pageContent: {
    position: 'relative',
    height: '100%'
  },
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0
  },
  watermarkLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    width: 400,
    height: 400,
    objectFit: 'contain',
    opacity: 0.05
  },
  watermarkTextContainer: {
    position: 'absolute',
    top: -200,
    left: -200,
    right: -200,
    bottom: -200,
    transform: 'rotate(-45deg)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    opacity: 0.05
  },
  content: {
    position: 'relative',
    zIndex: 1
  },
  header: {
    marginBottom: 20,
    alignItems: 'center'
  },
  schoolNameLine: {
    fontSize: 24,
    color: '#FF8C42',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12
  },
  centerTextContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 15
  },
  schoolLogo: {
    width: 70,
    height: 70,
    objectFit: 'contain',
    marginTop: -30
  },
  pupilPhoto: {
    width: 70,
    height: 70,
    objectFit: 'cover',
    borderRadius: 4,
    marginTop: -30
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'solid',
    marginTop: -30
  },
  schoolNameContinuation: {
    fontSize: 18,
    color: '#FF8C42',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 1.1
  },
  contactInfoInline: {
    fontSize: 8,
    color: '#654321',
    textAlign: 'center',
    lineHeight: 1.1,
    fontFamily: 'Helvetica',
    marginTop: 1
  },
  contactInfo: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 1.4,
    fontFamily: 'Helvetica'
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  certificationText: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 1.4,
    fontFamily: 'Helvetica'
  },
  certificateTitle: {
    fontSize: 24,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    marginBottom: 24,
    color: '#000000'
  },
  division: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Courier-Bold',
    color: '#000000'
  },
  gradeText: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'left',
    fontFamily: 'Courier',
    color: '#000000'
  },
  studentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Courier',
    color: '#000000',
    width: '100%'
  },
  studentName: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000',
    flex: 1
  },
  identifierNumbers: {
    marginTop: 4,
  },
  identifierText: {
    fontSize: 10,
    color: '#333',
    marginBottom: 2,
    fontWeight: 'bold',
    fontFamily: 'Courier',
  },
  boldText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000',
    fontWeight: 'bold',
  },
  schoolInfo: {
    fontSize: 12,
    marginBottom: 20,
    fontFamily: 'Courier',
    color: '#000000'
  },
  gradesTable: {
    marginBottom: 20
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: 4
  },
  tableHeaderText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  subjectHeader: {
    flex: 1,
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  gradeHeader: {
    width: '40%',
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  headerDash: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000',
    marginTop: 2
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  subjectColumn: {
    flex: 1,
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  gradeColumn: {
    width: '40%',
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'solid'
  },
  totalLabel: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  totalGrade: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#000000'
  },
  conduct: {
    fontSize: 12,
    marginBottom: 20,
    fontFamily: 'Courier',
    color: '#000000'
  },
  footer: {
    marginTop: 'auto'
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20
  },
  footerBottom: {
    alignItems: 'center'
  },
  signature: {
    width: 140,
    position: 'relative'
  },
  signatureImage: {
    width: 80,
    height: 35,
    marginBottom: 6
  },
  signatureLine: {
    width: 140,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid'
  },
  signatureLabel: {
    marginTop: 4,
    textAlign: 'left',
    fontFamily: 'Courier',
    fontSize: 12
  },
  signatureRight: {
    width: 140,
    position: 'relative',
    textAlign: 'right'
  },
  dateText: {
    textAlign: 'right',
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 8
  },
  dateLine: {
    width: 140,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid'
  },
  dateLabel: {
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Courier',
    fontSize: 12
  },
  watermarkText: {
    fontSize: 8,
    fontFamily: 'Courier',
    textAlign: 'center',
    marginVertical: 0.5,
    whiteSpace: 'pre',
    opacity: 0.1,
    color: '#666666'
  },
  motto: {
    textAlign: 'center',
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#2E7D32'
  },
  qrCodeSection: {
    position: 'absolute',
    bottom: -35,
    right: 5,
    width: 60
  },
  qrCodeImage: {
    width: 60,
    height: 60
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    paddingTop: 8,
    marginTop: 4
  }
});

interface CertificateProps {
  pupilName: string;
  admissionNumber: string;
  indexNumber?: string;
  learnerIdentificationNumber?: string;
  schoolName: string;
  division: string;
  subjects: Array<{
    name: string;
    grade: string;
  }>;
  totalMarks: string;
  conduct: string;
  date: string;
  schoolLogo?: string;
  motto?: string;
  signatureUrl?: string;
  pupilPhoto?: string;
  qrCodeDataUrl?: string;
  schoolContact?: {
    phone?: string;
    alternativePhone?: string;
    email?: string;
    website?: string;
    address?: string;
    postal?: string;
    poBox?: string;
    city?: string;
  };
}

const CertificatePDFDocument: React.FC<CertificateProps> = ({
  pupilName = '',
  admissionNumber = '',
  indexNumber,
  learnerIdentificationNumber,
  schoolName = '',
  division = '',
  subjects = [],
  totalMarks = '0',
  conduct = 'GOOD',
  date = '',
  schoolLogo,
  motto = '',
  signatureUrl,
  pupilPhoto,
  qrCodeDataUrl,
  schoolContact
}) => {
  // Process and validate image URL
  const processImageUrl = (url?: string) => {
    if (!url) {
      console.log('No URL provided for image');
      return undefined;
    }
    
    // Remove quotes and clean the URL
    const cleanUrl = url.replace(/['"]/g, '').trim();
    console.log('Processing image URL:', cleanUrl);
    
    // Check for valid image extensions or if it's a data URL or Firebase URL
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => 
      cleanUrl.toLowerCase().endsWith(ext)
    );
    const isDataUrl = cleanUrl.startsWith('data:image/');
    const isFirebaseUrl = cleanUrl.includes('firebasestorage.googleapis.com') || cleanUrl.includes('firebase');
    
    const isValid = hasValidExtension || isDataUrl || isFirebaseUrl;
    console.log('Image URL valid:', isValid, 'URL:', cleanUrl);
    
    return isValid ? cleanUrl : undefined;
  };

  // Function to split school name intelligently
  const splitSchoolName = (name: string) => {
    const upperName = String(name).toUpperCase();
    const words = upperName.split(' ');
    
    // If school name is short enough, put it all on first line
    if (upperName.length <= 50) {
      return { firstLine: upperName, secondLine: '' };
    }
    
    // Find a good split point (around middle, but at word boundary)
    const midPoint = Math.floor(words.length / 2);
    const firstPart = words.slice(0, midPoint).join(' ');
    const secondPart = words.slice(midPoint).join(' ');
    
    return { firstLine: firstPart, secondLine: secondPart };
  };

  const logoUrl = processImageUrl(schoolLogo);
  const pupilPhotoUrl = processImageUrl(pupilPhoto);

  console.log('Certificate data:', {
    schoolLogo,
    pupilPhoto,
    logoUrl,
    pupilPhotoUrl,
    schoolName,
    qrCodeDataUrl
  });
  
  const { firstLine: schoolNameFirst, secondLine: schoolNameSecond } = splitSchoolName(schoolName);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.pageContent}>
          {/* Watermark Layer */}
          <View style={styles.watermark}>
            {logoUrl && <Image src={logoUrl} style={styles.watermarkLogo} />}
            <View style={styles.watermarkTextContainer}>
              {Array(40).fill(null).map((_, i) => {
                // Create watermark text with all identifiers
                const identifiers = [
                  `Admission: ${admissionNumber}`,
                  indexNumber && `Index: ${indexNumber}`,
                  learnerIdentificationNumber && `LIN: ${learnerIdentificationNumber}`
                ].filter(Boolean).join(' • ');
                
                const watermarkText = `${schoolName} • ${identifiers} • ${motto} • `;
                
                return (
                  <Text key={i} style={styles.watermarkText}>
                    {watermarkText.repeat(4)}
                  </Text>
                );
              })}
            </View>
          </View>

          {/* Content Layer */}
          <View style={styles.content}>
                          <View style={styles.header}>
                {/* First line: Main part of school name */}
                <Text style={styles.schoolNameLine}>{schoolNameFirst}</Text>
                
                {/* Second line: Logo, school name continuation, and photo all inline */}
                <View style={styles.inlineContainer}>
                  {logoUrl ? (
                    <Image src={logoUrl} style={styles.schoolLogo} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={{ fontSize: 8, textAlign: 'center', color: '#999' }}>No Logo</Text>
                    </View>
                  )}
                  
                  <View style={styles.centerTextContainer}>
                    {schoolNameSecond && (
                      <Text style={styles.schoolNameContinuation}>
                        {schoolNameSecond}
                      </Text>
                    )}
                                          {schoolContact && (
                        <Text style={styles.contactInfoInline}>
                          {[
                            schoolContact.phone && `Phone: ${schoolContact.phone}`,
                            schoolContact.alternativePhone && `Alt Phone: ${schoolContact.alternativePhone}`,
                            schoolContact.email && `Email: ${schoolContact.email}`,
                            schoolContact.website && `Website: ${schoolContact.website}`,
                            schoolContact.address && `Address: ${schoolContact.address}`,
                            schoolContact.poBox && `P.O Box: ${schoolContact.poBox}`,
                            schoolContact.postal && `Postal: ${schoolContact.postal}`,
                            schoolContact.city && `City: ${schoolContact.city}`
                          ].filter(Boolean).join(' • ')}
                        </Text>
                      )}
                  </View>
                  
                  {pupilPhotoUrl ? (
                    <Image src={pupilPhotoUrl} style={styles.pupilPhoto} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={{ fontSize: 8, textAlign: 'center', color: '#999' }}>No Photo</Text>
                    </View>
                  )}
                </View>
              </View>

            <Text style={styles.certificationText}>
              This is to certify that the candidate named below sat for the Primary{'\n'}
              Leaving Examination in the year {new Date().getFullYear()} and qualified for the award of the
            </Text>

            <View style={{ marginTop: 30 }}>
              <Text style={styles.certificateTitle}>Primary Leaving Certificate</Text>
            </View>

            <View style={{ marginTop: 40 }}>
              <Text style={styles.division}>DIVISION {division}</Text>
            </View>

            <Text style={styles.gradeText}>
              THE CANDIDATE REACHED THE GRADE SHOWN IN THE SUBJECTS NAMED.
            </Text>

            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{String(pupilName).toUpperCase()}</Text>
              <View style={styles.identifierNumbers}>
                <Text style={styles.identifierText}>Admission No: {admissionNumber}</Text>
                {indexNumber && <Text style={styles.identifierText}>Index No: {indexNumber}</Text>}
                {learnerIdentificationNumber && <Text style={styles.identifierText}>LIN: {learnerIdentificationNumber}</Text>}
              </View>
            </View>
            <Text style={styles.schoolInfo}>{String(schoolName).toUpperCase()}.</Text>

            <View style={styles.gradesTable}>
              <View style={styles.tableHeader}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.boldText}>SUBJECT</Text>
                  <Text style={styles.headerDash}>-------</Text>
                </View>
                <View style={styles.gradeHeader}>
                  <Text style={styles.boldText}>GRADE</Text>
                  <Text style={styles.headerDash}>-------</Text>
                </View>
              </View>
              {subjects.map((subject, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.subjectColumn}>{String(subject.name).toUpperCase()}</Text>
                  <Text style={styles.gradeColumn}>{subject.grade} ({numberToWords(subject.grade)})</Text>
                </View>
              ))}
            </View>

            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.subjectColumn, styles.boldText]}>TOTAL</Text>
              <Text style={styles.gradeColumn}>{totalMarks} ({numberToWords(totalMarks)})</Text>
            </View>

            <Text style={[styles.conduct, styles.boldText]}>CONDUCT: {String(conduct).toUpperCase()}</Text>

            <View style={styles.footer}>
              <View style={styles.footerTop}>
                <View style={styles.signature}>
                  {signatureUrl && <Image src={signatureUrl} style={styles.signatureImage} />}
                  <View style={styles.signatureLine} />
                  <Text style={[styles.signatureLabel, styles.boldText]}>HEAD TEACHER</Text>
                </View>
                
                <View style={styles.signatureRight}>
                  <Text style={styles.dateText}>{date}</Text>
                  <View style={styles.dateLine} />
                  <Text style={[styles.dateLabel, styles.boldText]}>DATE</Text>
                </View>
              </View>
              
              <View style={styles.footerBottom}>
                <Text style={styles.motto}>{String(motto).toUpperCase()}</Text>
              </View>
              
              {/* QR Code at bottom right */}
              {qrCodeDataUrl && (
                <View style={styles.qrCodeSection}>
                  <Image src={qrCodeDataUrl} style={styles.qrCodeImage} />
                </View>
              )}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CertificatePDFDocument; 