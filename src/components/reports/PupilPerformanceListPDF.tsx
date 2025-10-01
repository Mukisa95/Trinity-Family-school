import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Pupil, Class, SchoolSettings } from '@/types';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

// Register font if needed (assuming Helvetica is default or registered elsewhere)
// Font.register({ family: 'YourFontFamily', src: '/path/to/font.ttf' });

// Define styles with a more modern aesthetic
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 35,
    paddingBottom: 50,
    paddingHorizontal: 30,
    backgroundColor: '#ffffff',
  },
  pageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
  colorAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#32CD32',
  },
  headerContainer: {
    marginBottom: 20,
    borderBottom: '1 solid #e0e0e0',
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#32CD32',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 4,
    color: '#444444',
  },
  dateText: {
    fontSize: 9,
    color: '#666666',
    marginTop: 5,
  },
  classInfoContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 3,
    padding: 8,
    marginBottom: 15,
    borderLeft: '3 solid #32CD32',
  },
  classInfoText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  classInfoStats: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    marginRight: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#32CD32',
  },
  statLabel: {
    fontSize: 9,
    color: '#666666',
    marginLeft: 4,
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2f8f2',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottom: '1 solid #e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 32,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#fafafa',
  },
  colPhoto: {
    width: '12%',
    alignItems: 'center',
  },
  colName: {
    width: '43%',
    paddingLeft: 5,
  },
  colStatus: {
    width: '28%',
    alignItems: 'center',
  },
  colId: {
    width: '17%',
    alignItems: 'flex-start',
    paddingLeft: 5,
  },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#444444',
  },
  pupilPhoto: {
    width: 26,
    height: 26,
    borderRadius: 13,
    objectFit: 'cover',
    border: '1 solid #e0e0e0',
  },
  photoPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderInitial: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#aaaaaa',
  },
  nameText: {
    fontSize: 9,
    color: '#333333',
    fontFamily: 'Helvetica',
  },
  idText: {
    fontSize: 8,
    color: '#666666',
  },
  statusText: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    width: '90%',
  },
  statusGood: { 
    backgroundColor: '#d1fae5', 
    color: '#065f46',
    border: '1 solid #a7f3d0',
  },
  statusFair: { 
    backgroundColor: '#fef3c7', 
    color: '#92400e',
    border: '1 solid #fde68a',
  },
  statusWeak: { 
    backgroundColor: '#ffedd5', 
    color: '#9a3412',
    border: '1 solid #fed7aa',
  },
  statusYoung: { 
    backgroundColor: '#ede9fe', 
    color: '#5b21b6',
    border: '1 solid #ddd6fe',
  },
  statusIrregular: { 
    backgroundColor: '#fee2e2', 
    color: '#991b1b',
    border: '1 solid #fecaca',
  },
  statusDefault: { 
    backgroundColor: '#f3f4f6', 
    color: '#374151',
    border: '1 solid #e5e7eb',
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
    borderTop: '1 solid #e0e0e0',
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 25,
    right: 30,
    fontSize: 9,
    color: '#666666',
  },
  watermark: {
    position: 'absolute',
    bottom: '45%',
    left: '25%',
    right: '25%',
    textAlign: 'center',
    fontSize: 60,
    color: 'rgba(200, 200, 200, 0.15)',
    transform: 'rotate(-45deg)',
  },
});

// Helper to get status style
const getStatusStyle = (status: string | null | undefined) => {
  switch (status) {
    case 'good': return styles.statusGood;
    case 'fair': return styles.statusFair;
    case 'weak': return styles.statusWeak;
    case 'young': return styles.statusYoung;
    case 'irregular': return styles.statusIrregular;
    default: return styles.statusDefault;
  }
};

// Helper to get status label
const getStatusLabel = (status: string | null | undefined, options: any[]) => {
  const option = options.find(opt => opt.value === status);
  return option?.label || status || 'Not Set';
};

// Get user's initials for placeholder
const getInitials = (firstName: string, lastName: string) => {
  return `${lastName.charAt(0)}${firstName.charAt(0)}`.toUpperCase();
};

interface PupilPerformanceListPDFProps {
  pupils: Pupil[];
  pupilClass: Class | null;
  settings: SchoolSettings | null;
  performanceOptions: any[];
}

const PupilPerformanceListPDF: React.FC<PupilPerformanceListPDFProps> = ({
  pupils,
  pupilClass,
  settings,
  performanceOptions
}) => {
  // Count pupils by status (using otherNames field as we're storing status there)
  const statusCounts = pupils.reduce((acc: Record<string, number>, pupil) => {
    const status = pupil.otherNames || 'default';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Document title={`Performance List - ${pupilClass?.name || 'Class'}`}>
      <Page size="A4" style={styles.page}>
        {/* Background elements */}
        <View style={styles.pageBackground}>
          <View style={styles.colorAccent} />
          <Text style={styles.watermark}>
            {settings?.generalInfo?.name || 'School Records'}
          </Text>
        </View>
        
        {/* Header section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Performance List</Text>
              <Text style={styles.headerSubtitle}>
                {pupilClass?.name || 'Selected Class'} - Student Performance Status
              </Text>
              <Text style={styles.dateText}>
                Generated on {new Date().toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
            </View>
            {/* School logo could go here if available */}
          </View>
        </View>
        
        {/* Class info box */}
        <View style={styles.classInfoContainer}>
          <Text style={styles.classInfoText}>{pupilClass?.name || 'Class'} Performance Summary</Text>
          <View style={styles.classInfoStats}>
            <View style={styles.statItem}>
              <Text style={styles.statCount}>{pupils.length}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            {Object.entries(statusCounts).map(([status, count]) => {
              if (status !== 'default') {
                const label = performanceOptions.find(opt => opt.value === status)?.label || status;
                return (
                  <View key={status} style={styles.statItem}>
                    <Text style={styles.statCount}>{count}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
        </View>
        
        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colPhoto}>
              <Text style={styles.headerText}>Photo</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.headerText}>Student Name</Text>
            </View>
            <View style={styles.colStatus}>
              <Text style={styles.headerText}>Status</Text>
            </View>
            <View style={styles.colId}>
              <Text style={styles.headerText}>Reg No.</Text>
            </View>
          </View>
          
          {/* Table Body */}
          {pupils.map((pupil, index) => (
            <View 
              key={pupil.id} 
              style={[
                styles.tableRow, 
                index % 2 === 1 ? styles.tableRowEven : {}
              ]}
            >
              <View style={styles.colPhoto}>
                {pupil.photo ? (
                  <Image style={styles.pupilPhoto} src={pupil.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.placeholderInitial}>
                      {getInitials(pupil.firstName || '', pupil.lastName || '')}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.colName}>
                <Text style={styles.nameText}>
                  {formatPupilDisplayName(pupil)}
                </Text>
              </View>
              <View style={styles.colStatus}>
                <Text style={[
                  styles.statusText, 
                  getStatusStyle(pupil.otherNames)
                ]}>
                  {getStatusLabel(pupil.otherNames, performanceOptions)}
                </Text>
              </View>
              <View style={styles.colId}>
                <Text style={styles.idText}>
                  {pupil.admissionNumber || pupil.learnerIdentificationNumber || '-'}
                </Text>
              </View>
            </View>
          ))}
        </View>
        
        {/* Footer */}
        <Text style={styles.footer}>
          {settings?.generalInfo?.name || 'School'} - {settings?.generalInfo?.motto || 'Excellence in Education'}
        </Text>
        
        {/* Page number */}
        <Text 
          style={styles.pageNumber} 
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} 
          fixed 
        />
      </Page>
    </Document>
  );
};

export default PupilPerformanceListPDF; 