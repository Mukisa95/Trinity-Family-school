import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Define the column selection interface
export interface ColumnSelection {
  pin: boolean;
  name: boolean;
  gender: boolean;
  age: boolean;
  class: boolean;
  section: boolean;
  status: boolean;
  house: boolean;
  guardianContacts: boolean;
  siblings: boolean;
  religion: boolean;
  photo: boolean;
}

// Define interfaces for the component
interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
  email: string;
  occupation: string;
  address: string;
}

interface House {
  id: string;
  name: string;
  motto?: string;
  color: string;
}

interface ActivePupil {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: string;
  dateOfBirth: string;
  pupilIdentificationNumber: string;
  classId: string;
  photo?: string;
  status: 'ACTIVE' | 'INACTIVE';
  section: 'boarding' | 'day';
  guardians: Guardian[];
  emergencyContactGuardianId: string;
  familyId?: string;
  currentHouse?: House;
  religion?: string;
}

interface Class {
  id: string;
  name: string;
  section: string;
  code: string;
}

interface Filters {
  classId: string;
  gender: string;
  status: string;
  section: string;
  houseId: string;
  ageRange: {
    min: number;
    max: number;
  };
}

interface Settings {
  generalInfo: {
    name: string;
    logo?: string;
    motto?: string;
    establishedYear?: string;
    schoolType?: string;
    registrationNumber?: string;
  };
  contact: {
    email?: string;
    phone?: string;
    alternativePhone?: string;
    website?: string;
  };
  address: {
    physical?: string;
    postal?: string;
    city?: string;
    country?: string;
  };
  headTeacher: {
    name?: string;
    signature?: string;
    message?: string;
  };
}

interface CurrentUser {
  firstName: string;
  lastName: string;
  role: string;
}

interface PupilsListPDFDocumentProps {
  pupils: ActivePupil[];
  classes: Class[];
  filters: Filters;
  sortField: string;
  sortOrder: string;
  settings: Settings;
  currentUser: CurrentUser;
  columnSelection: ColumnSelection;
}

// Create styles with 1cm margins (28.35 points = 1cm)
const createStyles = (isLandscape: boolean) => StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 28.35, // 1cm margin
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1a365d',
  },
  motto: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 3,
    color: '#4a5568',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2d3748',
  },
  filterInfo: {
    fontSize: 10,
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f7fafc',
    borderRadius: 4,
    border: '1px solid #e2e8f0',
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#2d3748',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 30,
    wrap: false, // Prevent row from wrapping/breaking across pages
    orphans: 1, // Ensure at least 1 line stays together
    widows: 1, // Ensure at least 1 line stays together
  },
  tableRowBreakable: {
    flexDirection: 'row',
    minHeight: 30,
    break: false, // Allow break before this row if needed
    minPresenceAhead: 30, // Ensure at least 30pt space ahead for next row
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#2d3748',
    backgroundColor: '#4a5568',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  tableCellHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
  },
  tableCell: {
    fontSize: 12,
    textAlign: 'left',
    color: '#2d3748',
    lineHeight: 1.4,
  },
  tableCellSmall: {
    fontSize: 10,
    textAlign: 'left',
    color: '#4a5568',
    lineHeight: 1.3,
  },
  footer: {
    position: 'absolute',
    bottom: 28.35, // 1cm from bottom
    left: 28.35,
    right: 28.35,
    textAlign: 'center',
    fontSize: 9,
    color: '#718096',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  pupilPhoto: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  photoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  combinedCell: {
    fontSize: 12,
    textAlign: 'left',
    color: '#2d3748',
    lineHeight: 1.4,
  },
  guardianInfo: {
    fontSize: 10,
    marginBottom: 2,
    color: '#4a5568',
    lineHeight: 1.2,
  },
  siblingInfo: {
    fontSize: 10,
    marginBottom: 2,
    color: '#4a5568',
    lineHeight: 1.2,
  },
  emergencyTag: {
    fontSize: 8,
    color: '#e53e3e',
    fontWeight: 'bold',
  },
  // Add styles for page-aware content
  tableContainer: {
    flex: 1,
    minHeight: 0, // Allow container to shrink
  },
  continuousTable: {
    width: '100%',
  },
});

// Helper function to calculate age
const calculateAge = (dateOfBirth: string) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to get siblings
const getSiblings = (pupil: ActivePupil, allPupils: ActivePupil[]): ActivePupil[] => {
  if (!pupil.familyId) return [];
  return allPupils.filter(p => 
    p.familyId === pupil.familyId && 
    p.id !== pupil.id && 
    (p.status === 'ACTIVE' || p.status === 'INACTIVE')
  );
};

// Helper function to determine optimal column widths
const getOptimalColumnWidths = (columnSelection: ColumnSelection, isLandscape: boolean) => {
  const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
  const totalColumns = selectedColumns.length;
  
  // Base widths for different column types (in percentage)
  const columnWidths: Record<string, number> = {
    pin: 8,
    name: 20,
    gender: 8,
    age: 6,
    class: 7,
    section: 10,
    status: 8,
    house: 12,
    guardianContacts: 25,
    siblings: 15,
    religion: 8,
    photo: 8,
  };

  // Calculate total desired width
  const totalDesiredWidth = selectedColumns.reduce((sum, [column]) => {
    return sum + columnWidths[column];
  }, 0);

  // Scale widths to fit 100%
  const scaleFactor = 100 / totalDesiredWidth;
  
  const optimizedWidths: Record<string, string> = {};
  selectedColumns.forEach(([column]) => {
    optimizedWidths[column] = `${(columnWidths[column] * scaleFactor).toFixed(1)}%`;
  });

  return optimizedWidths;
};

// Helper function to determine if landscape orientation is needed
const shouldUseLandscape = (columnSelection: ColumnSelection) => {
  const selectedColumns = Object.entries(columnSelection).filter(([_, selected]) => selected);
  const heavyColumns = ['name', 'guardianContacts', 'siblings'];
  const hasHeavyColumns = selectedColumns.some(([column]) => heavyColumns.includes(column));
  
  // Use landscape if more than 6 columns or if heavy columns are selected
  return selectedColumns.length > 6 || hasHeavyColumns;
};

const PupilsListPDFDocument: React.FC<PupilsListPDFDocumentProps> = ({
  pupils,
  classes,
  filters,
  sortField,
  sortOrder,
  settings,
  currentUser,
  columnSelection
}) => {
  // Determine orientation and create styles
  const isLandscape = shouldUseLandscape(columnSelection);
  const styles = createStyles(isLandscape);
  
  // Get optimal column widths
  const columnWidths = getOptimalColumnWidths(columnSelection, isLandscape);

  // Generate filter description
  const getFilterDescription = () => {
    const filterParts = [];
    
    if (filters.classId) {
      const className = classes.find(c => c.id === filters.classId)?.name;
      if (className) filterParts.push(`Class: ${className}`);
    }
    
    if (filters.gender) filterParts.push(`Gender: ${filters.gender}`);
    if (filters.status) filterParts.push(`Status: ${filters.status}`);
    if (filters.section) filterParts.push(`Section: ${filters.section.charAt(0).toUpperCase() + filters.section.slice(1)}`);
    
    if (filters.ageRange.min > 0 || filters.ageRange.max < 100) {
      filterParts.push(`Age: ${filters.ageRange.min}-${filters.ageRange.max} years`);
    }
    
    if (filterParts.length === 0) return 'All pupils included';
    return `Filtered by: ${filterParts.join(', ')}`;
  };

  return (
    <Document>
      <Page 
        size="A4" 
        orientation={isLandscape ? "landscape" : "portrait"} 
        style={styles.page}
        wrap
      >
        {/* School Header - only on first page */}
        <View style={styles.header} fixed={false}>
          <Text style={styles.schoolName}>{settings.generalInfo.name}</Text>
          {settings.generalInfo.motto && (
            <Text style={styles.motto}>"{settings.generalInfo.motto}"</Text>
          )}
          {settings.generalInfo.registrationNumber && (
            <Text style={[styles.motto, { fontSize: 10, marginBottom: 5 }]}>
              Reg. No: {settings.generalInfo.registrationNumber}
            </Text>
          )}
          {settings.address.physical && (
            <Text style={[styles.motto, { fontSize: 10, marginBottom: 5 }]}>
              {settings.address.physical}
            </Text>
          )}
          {(settings.contact.phone || settings.contact.email) && (
            <Text style={[styles.motto, { fontSize: 10, marginBottom: 10 }]}>
              {settings.contact.phone && `Tel: ${settings.contact.phone}`}
              {settings.contact.phone && settings.contact.email && ' | '}
              {settings.contact.email && `Email: ${settings.contact.email}`}
            </Text>
          )}
          <Text style={styles.title}>Pupils List</Text>
        </View>

        {/* Continuous Table with Smart Breaking */}
        <View style={styles.tableContainer}>
          {/* Table Header - will repeat on new pages */}
          <View style={[styles.table, styles.continuousTable]} wrap={false}>
            <View style={styles.tableRow} fixed>
              {columnSelection.photo && (
                <View style={[styles.tableColHeader, { width: '8%' }]}>
                  <Text style={styles.tableCellHeader}>Photo</Text>
                </View>
              )}
              {columnSelection.pin && (
                <View style={[styles.tableColHeader, { width: columnSelection.section ? '15%' : columnWidths.pin }]}>
                  <Text style={styles.tableCellHeader}>PIN {columnSelection.section ? '/ Section' : ''}</Text>
                </View>
              )}
              {!columnSelection.pin && columnSelection.section && (
                <View style={[styles.tableColHeader, { width: columnWidths.section }]}>
                  <Text style={styles.tableCellHeader}>Section</Text>
                </View>
              )}
              {columnSelection.name && (
                <View style={[styles.tableColHeader, { width: columnWidths.name }]}>
                  <Text style={styles.tableCellHeader}>Full Name</Text>
                </View>
              )}
              {(columnSelection.class || columnSelection.status) && (
                <View style={[styles.tableColHeader, { width: columnSelection.class && columnSelection.status ? '12%' : (columnWidths.class || columnWidths.status) }]}>
                  <Text style={styles.tableCellHeader}>
                    {columnSelection.class && columnSelection.status ? 'Class / Status' : (columnSelection.class ? 'Class' : 'Status')}
                  </Text>
                </View>
              )}
              {(columnSelection.age || columnSelection.gender || columnSelection.religion) && (
                <View style={[styles.tableColHeader, { width: '15%' }]}>
                  <Text style={styles.tableCellHeader}>Details</Text>
                </View>
              )}
              {columnSelection.house && (
                <View style={[styles.tableColHeader, { width: columnWidths.house }]}>
                  <Text style={styles.tableCellHeader}>House</Text>
                </View>
              )}
              {columnSelection.guardianContacts && (
                <View style={[styles.tableColHeader, { width: columnWidths.guardianContacts }]}>
                  <Text style={styles.tableCellHeader}>Guardian Contacts</Text>
                </View>
              )}
              {columnSelection.siblings && (
                <View style={[styles.tableColHeader, { width: columnWidths.siblings }]}>
                  <Text style={styles.tableCellHeader}>Siblings</Text>
                </View>
              )}
            </View>

            {/* Table Body - Each row will break intelligently */}
            {pupils.map((pupil, index) => {
              const pupilClass = classes.find(c => c.id === pupil.classId);
              const siblings = getSiblings(pupil, pupils);
              const emergencyGuardian = pupil.guardians?.find(g => g.id === pupil.emergencyContactGuardianId);

              return (
                <View key={pupil.id} style={styles.tableRowBreakable} wrap={false} minPresenceAhead={40}>
                  {/* Photo - First column on the left */}
                  {columnSelection.photo && (
                    <View style={[styles.tableCol, { width: '8%', alignItems: 'center', justifyContent: 'center' }]}>
                      {pupil.photo ? (
                        <Image style={styles.pupilPhoto} src={pupil.photo} />
                      ) : (
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={[styles.tableCellSmall, { fontSize: 8 }]}>No photo</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* PIN and Section combined */}
                  {columnSelection.pin && (
                    <View style={[styles.tableCol, { width: columnSelection.section ? '15%' : columnWidths.pin }]}>
                      <Text style={styles.tableCell}>
                        {pupil.pupilIdentificationNumber || 'N/A'}
                        {columnSelection.section && ` • ${pupil.section === 'boarding' ? 'Boarding' : 'Day'}`}
                      </Text>
                    </View>
                  )}
                  {!columnSelection.pin && columnSelection.section && (
                    <View style={[styles.tableCol, { width: columnWidths.section }]}>
                      <Text style={styles.tableCell}>
                        {pupil.section === 'boarding' ? 'Boarding' : 'Day'}
                      </Text>
                    </View>
                  )}
                  {/* Name */}
                  {columnSelection.name && (
                    <View style={[styles.tableCol, { width: columnWidths.name }]}>
                      <Text style={styles.tableCell}>
                        {pupil.firstName} {pupil.lastName}
                        {pupil.otherNames && ` ${pupil.otherNames}`}
                      </Text>
                    </View>
                  )}
                  {/* Class and Status combined */}
                  {(columnSelection.class || columnSelection.status) && (
                    <View style={[styles.tableCol, { width: columnSelection.class && columnSelection.status ? '12%' : (columnWidths.class || columnWidths.status) }]}>
                      <Text style={styles.combinedCell}>
                        {columnSelection.class && `${pupilClass?.code || 'N/A'}`}
                        {columnSelection.class && columnSelection.status && ' • '}
                        {columnSelection.status && pupil.status}
                      </Text>
                    </View>
                  )}
                  {/* Age, Gender, and Religion combined */}
                  {(columnSelection.age || columnSelection.gender || columnSelection.religion) && (
                    <View style={[styles.tableCol, { width: '15%' }]}>
                      <Text style={styles.combinedCell}>
                        {[
                          columnSelection.age && `${calculateAge(pupil.dateOfBirth)}`,
                          columnSelection.gender && pupil.gender,
                          columnSelection.religion && (pupil.religion || 'N/A')
                        ].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                  )}
                  {columnSelection.house && (
                    <View style={[styles.tableCol, { width: columnWidths.house }]}>
                      <Text style={styles.tableCell}>
                        {pupil.currentHouse?.name || 'N/A'}
                      </Text>
                    </View>
                  )}
                  {columnSelection.guardianContacts && (
                    <View style={[styles.tableCol, { width: columnWidths.guardianContacts }]}>
                      {pupil.guardians?.slice(0, 2).map((guardian, idx) => (
                        <View key={guardian.id} wrap={false}>
                          <Text style={styles.guardianInfo}>
                            {guardian.firstName} {guardian.lastName} ({guardian.relationship})
                          </Text>
                          <Text style={styles.tableCellSmall}>
                            📞 {guardian.phone}
                            {guardian.id === pupil.emergencyContactGuardianId && (
                              <Text style={styles.emergencyTag}> [EMERGENCY]</Text>
                            )}
                          </Text>
                          {idx < Math.min(pupil.guardians.length - 1, 1) && (
                            <Text style={styles.tableCellSmall}>---</Text>
                          )}
                        </View>
                      ))}
                      {pupil.guardians && pupil.guardians.length > 2 && (
                        <Text style={styles.tableCellSmall}>
                          +{pupil.guardians.length - 2} more contacts
                        </Text>
                      )}
                    </View>
                  )}
                  {columnSelection.siblings && (
                    <View style={[styles.tableCol, { width: columnWidths.siblings }]}>
                      {siblings.length > 0 ? (
                        <View wrap={false}>
                          {siblings.slice(0, 3).map((sibling, idx) => {
                            const siblingClass = classes.find(c => c.id === sibling.classId);
                            return (
                              <Text key={sibling.id} style={styles.siblingInfo}>
                                • {sibling.firstName} {sibling.lastName} ({siblingClass?.code || 'N/A'})
                              </Text>
                            );
                          })}
                          {siblings.length > 3 && (
                            <Text style={styles.tableCellSmall}>
                              +{siblings.length - 3} more
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.tableCellSmall}>No siblings</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <Text 
          style={styles.footer} 
          fixed 
          render={({ pageNumber, totalPages }) => 
            `${settings.generalInfo.name} • Page ${pageNumber} of ${totalPages} • Generated: ${new Date().toLocaleDateString()}`
          }
        />
      </Page>
    </Document>
  );
};

export default PupilsListPDFDocument; 