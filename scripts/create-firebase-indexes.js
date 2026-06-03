/**
 * Firebase Index Creation Script
 * 
 * This script helps create the required composite indexes for Firestore queries
 * that are failing in mobile view.
 * 
 * Run this script to get the exact URLs for creating the required indexes.
 */

const indexes = [
  {
    name: "Pupils by Class and Last Name",
    description: "Index for querying pupils by classId and ordering by lastName",
    collection: "pupils",
    fields: [
      { field: "classId", order: "ASCENDING" },
      { field: "lastName", order: "ASCENDING" },
      { field: "__name__", order: "ASCENDING" }
    ],
    url: "https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=ClVwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wdXBpbHMvaW5kZXhlcy9fEAEaCwoHY2xhc3NJZBABGgwKCGxhc3ROYW1lEAEaDAoIX19uYW1lX18QAQ"
  },
  {
    name: "Exams by Class and Created At",
    description: "Index for querying exams by classId and ordering by createdAt",
    collection: "exams", 
    fields: [
      { field: "classId", order: "ASCENDING" },
      { field: "createdAt", order: "DESCENDING" },
      { field: "__name__", order: "ASCENDING" }
    ],
    url: "https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=ClRwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9leGFtcy9pbmRleGVzL18QARoLCgdjbGFzc0lkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg"
  },
  {
    name: "Attendance Records by Pupil and Date",
    description: "Index for querying attendance records by pupilId and ordering by date",
    collection: "attendanceRecords",
    fields: [
      { field: "pupilId", order: "ASCENDING" },
      { field: "date", order: "ASCENDING" },
      { field: "__name__", order: "ASCENDING" }
    ],
    url: "https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=CmBwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hdHRlbmRhbmNlUmVjb3Jkcy9pbmRleGVzL18QARoLCgdwdXBpbElkEAEaCAoEZGF0ZRACGgwKCF9fbmFtZV9fEAI"
  },
  {
    name: "Payments by Pupil and Payment Date",
    description: "Index for querying payments by pupilId and ordering by paymentDate",
    collection: "payments",
    fields: [
      { field: "pupilId", order: "ASCENDING" },
      { field: "paymentDate", order: "ASCENDING" },
      { field: "__name__", order: "ASCENDING" }
    ],
    url: "https://console.firebase.google.com/v1/r/project/trinity-family-schools/firestore/indexes?create_composite=Cldwcm9qZWN0cy90cmluaXR5LWZhbWlseS1zY2hvb2xzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wYXltZW50cy9pbmRleGVzL18QARoLCgdwdXBpbElkEAEaDwoLcGF5bWVudERhdGUQAhoMCghfX25hbWVfXxAC"
  }
];

console.log("🔥 Firebase Index Creation Required 🔥");
console.log("=" .repeat(60));
console.log();
console.log("The following indexes need to be created in Firebase Console:");
console.log();

indexes.forEach((index, i) => {
  console.log(`${i + 1}. ${index.name}`);
  console.log(`   Description: ${index.description}`);
  console.log(`   Collection: ${index.collection}`);
  console.log(`   Fields:`);
  index.fields.forEach(field => {
    console.log(`     - ${field.field} (${field.order})`);
  });
  console.log();
  console.log(`   🔗 Create Index URL:`);
  console.log(`   ${index.url}`);
  console.log();
  console.log("   📋 Manual Steps:");
  console.log("   1. Click the URL above");
  console.log("   2. Sign in to Firebase Console");
  console.log("   3. Review the index configuration");
  console.log("   4. Click 'Create Index'");
  console.log("   5. Wait for index to build (may take a few minutes)");
  console.log();
  console.log("-".repeat(60));
  console.log();
});

console.log("📝 Additional Notes:");
console.log("- Indexes may take 1-5 minutes to build");
console.log("- You can monitor progress in Firebase Console > Firestore > Indexes");
console.log("- Once indexes are built, the mobile queries should work properly");
console.log("- Desktop may work due to different caching or network conditions");
console.log();
console.log("🚀 After creating indexes, test the mobile view again!");
