# Trinity Family School - Pupils Data Migration Guide

## Overview

This guide provides step-by-step instructions for migrating pupils data from the JSON file (`pupils data.txt`) into the Firebase Firestore database. The migration process includes data analysis, validation, transformation, and batch import.

## 📋 Prerequisites

Before starting the migration, ensure you have:

1. **Firebase Project Setup**: Your Firebase project is properly configured
2. **Authentication**: Firebase Admin SDK credentials or proper authentication
3. **Data File**: The `pupils data.txt` file is in the project root directory
4. **Dependencies**: All required npm packages are installed
5. **Backup**: Current database backup (if any existing data)

## 🔍 Step 1: Data Analysis (Recommended)

Before migrating, run the analysis script to understand your data quality and identify potential issues:

```bash
npm run analyze-pupils
```

This will:
- ✅ Analyze 394 pupils records
- 📊 Generate comprehensive statistics
- ⚠️ Identify data quality issues
- 💾 Save detailed report to `pupils-data-analysis-report.json`

### What the Analysis Checks:

#### Data Distribution:
- Gender distribution (Male/Female/Other)
- Section distribution (Day/Boarding)
- Status distribution (Active/Inactive/Graduated/Transferred)
- Class distribution across all classes
- Nationality and religion statistics
- Guardian relationship analysis

#### Data Quality Issues:
- Missing required fields (names, admission numbers)
- Duplicate admission numbers
- Invalid gender/section/status values
- Pupils without guardians
- Invalid date formats
- Field completeness percentages

#### Migration Readiness Score:
The analysis provides a data quality score and migration readiness assessment.

## 🔧 Step 2: Data Preparation

Based on the analysis results, you may need to:

### Critical Issues (Must Fix):
- **Missing Names**: Pupils without first or last names
- **Missing Admission Numbers**: Required for unique identification
- **Duplicate Admission Numbers**: Must be resolved before migration

### Optional Improvements:
- **Missing Guardians**: Add guardian information where missing
- **Invalid Values**: Standardize gender, section, and status values
- **Incomplete Fields**: Fill in missing optional information

## 🚀 Step 3: Migration Execution

Once you're satisfied with the data quality, run the migration:

```bash
npm run migrate-pupils
```

### Migration Process:

1. **Data Loading**: Reads and parses the JSON file
2. **Data Transformation**: 
   - Maps `pupilIdentificationNumber` → `admissionNumber`
   - Converts all text fields to UPPERCASE
   - Normalizes gender, section, and status values
   - Validates and transforms guardian data
   - Generates missing guardian IDs
3. **Class Validation**: Checks if referenced class IDs exist in the database
4. **Batch Processing**: Imports data in batches of 500 pupils for optimal performance
5. **Error Handling**: Continues processing even if some batches fail
6. **Progress Reporting**: Real-time progress updates and final summary

### Migration Features:

#### Data Transformation:
- **Field Mapping**: `pupilIdentificationNumber` → `admissionNumber`
- **Case Conversion**: All text fields converted to UPPERCASE
- **Value Normalization**:
  - Gender: `male` → `Male`, `female` → `Female`
  - Section: `day` → `Day`, `boarding` → `Boarding`
  - Status: `active` → `Active`, etc.
- **Guardian Processing**: Generates IDs for guardians without them
- **Emergency Contact**: Sets first guardian as emergency contact if not specified

#### Batch Processing:
- **Batch Size**: 500 pupils per batch (configurable)
- **Error Isolation**: Failed batches don't stop the entire process
- **Progress Tracking**: Real-time batch completion status
- **Performance Optimization**: Small delays between batches to avoid overwhelming Firestore

## 📊 Data Structure Mapping

### Original JSON Structure:
```json
{
  "pupils": [
    {
      "id": "1738166624004",
      "firstName": "KAASA",
      "lastName": "JOSEPHINE",
      "pupilIdentificationNumber": "TFF/15K/634",
      "classId": "1738165922575",
      "section": "day",
      "status": "ACTIVE",
      "guardians": [
        {
          "relationship": "MOTHER",
          "firstName": "AKULU",
          "lastName": "TUMUHIRWE",
          "phone": "+256776182264"
        }
      ]
    }
  ]
}
```

### Transformed Firestore Structure:
```typescript
{
  id: "1738166624004",
  firstName: "KAASA",
  lastName: "JOSEPHINE",
  admissionNumber: "TFF/15K/634", // Mapped from pupilIdentificationNumber
  classId: "1738165922575",
  section: "Day", // Normalized from "day"
  status: "Active", // Normalized from "ACTIVE"
  guardians: [
    {
      id: "guardian_1738166624004_0", // Generated if missing
      relationship: "MOTHER",
      firstName: "AKULU",
      lastName: "TUMUHIRWE",
      phone: "+256776182264"
    }
  ],
  emergencyContactGuardianId: "guardian_1738166624004_0" // Auto-set to first guardian
}
```

## ⚠️ Important Considerations

### Before Migration:
1. **Backup Existing Data**: If you have existing pupils data, create a backup
2. **Test Environment**: Consider running migration in a test environment first
3. **Class Dependencies**: Ensure all referenced classes exist in the database
4. **Firebase Limits**: Be aware of Firestore write limits and quotas

### During Migration:
1. **Monitor Progress**: Watch the console output for batch completion status
2. **Network Stability**: Ensure stable internet connection
3. **Don't Interrupt**: Let the process complete fully

### After Migration:
1. **Verify Data**: Check Firebase console to confirm data was imported correctly
2. **Test Application**: Verify that the application works with the new data
3. **Update Indexes**: Create any necessary Firestore indexes
4. **Clean Up**: Remove temporary files if desired

## 🔧 Troubleshooting

### Common Issues:

#### "File not found" Error:
- Ensure `pupils data.txt` is in the project root directory
- Check file name spelling and extension

#### Firebase Authentication Errors:
- Verify Firebase configuration in the script
- Ensure proper service account credentials
- Check Firebase project permissions

#### Class ID Validation Failures:
- Some pupils may reference non-existent classes
- Migration will continue but these pupils may need manual review
- Check the class validation output for details

#### Batch Processing Errors:
- Individual batch failures don't stop the entire migration
- Check error logs for specific pupil records that failed
- Failed pupils can be manually reviewed and re-imported

### Performance Optimization:

If migration is slow:
1. **Reduce Batch Size**: Modify `batchSize` parameter in the script
2. **Check Network**: Ensure stable, fast internet connection
3. **Firebase Quotas**: Verify you haven't hit Firestore write limits

## 📈 Expected Results

After successful migration, you should have:

- ✅ **394 pupils** imported into Firestore
- 📊 **Comprehensive statistics** about the imported data
- 🔍 **Data quality report** highlighting any issues
- 👥 **Guardian relationships** properly linked
- 🎓 **Class assignments** maintained
- 📝 **All text fields** in UPPERCASE format

## 🛠️ Script Customization

### Modifying Batch Size:
```typescript
// In migrate-pupils-data.ts
await migratePupilsInBatches(transformedPupils, 250); // Smaller batches
```

### Adding Custom Validation:
```typescript
// Add custom validation logic in transformPupil function
if (importedPupil.customField) {
  // Custom validation logic
}
```

### Changing Field Mappings:
```typescript
// Modify field mappings in transformPupil function
admissionNumber: importedPupil.customAdmissionField, // Different source field
```

## 📞 Support

If you encounter issues during migration:

1. **Check Console Output**: Look for specific error messages
2. **Review Analysis Report**: Identify data quality issues first
3. **Verify Prerequisites**: Ensure all setup requirements are met
4. **Test with Smaller Dataset**: Try migrating a subset first

## 🎯 Next Steps

After successful migration:

1. **Verify Data Integrity**: Spot-check imported records
2. **Update Application**: Ensure UI works with new data
3. **Create Indexes**: Add necessary Firestore indexes for performance
4. **User Training**: Brief users on any changes
5. **Monitor Performance**: Watch for any performance issues

---

**Note**: This migration is designed to be safe and non-destructive. It adds new data without modifying existing records. However, always backup your database before running any migration scripts. 