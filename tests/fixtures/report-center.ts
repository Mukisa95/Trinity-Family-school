import type { AcademicYear } from '@/types';
import type { ReportData } from '@/lib/reports/report-model';
export const reportYear={id:'2026',name:'2026',isActive:true,startDate:'2026-01-01',endDate:'2026-12-31',terms:[{id:'one',name:'Term 1',startDate:'2026-01-01',endDate:'2026-04-30'},{id:'three',name:'Term 3',startDate:'2026-09-01',endDate:'2026-12-10'}]} as AcademicYear;
const receipt={id:'pay1',pupilId:'p1',feeStructureId:'tuition',amount:100000,paymentDate:'2026-10-20',academicYearId:'2026',termId:'three'};
const exam={id:'exam1',name:'Term assessment',classId:'p7',status:'Completed',maxMarks:100,passingMarks:50,assessmentMode:'marks',startDate:'2026-10-12',endDate:'2026-10-13',academicYearId:'2026',termId:'three'};
export const reportFixture={
 pupils:[{id:'p1',firstName:'Amina',lastName:'Example',admissionNumber:'TF/001',classId:'p7',classCode:'P.7',gender:'Female',section:'Day',status:'Active',dateOfBirth:'2014-10-20',registrationDate:'2026-01-01',guardians:[{phone:'0700000000'}]},{id:'p2',firstName:'Brian',lastName:'Example',admissionNumber:'TF/002',classId:'p7',classCode:'P.7',gender:'Male',section:'Boarding',status:'Active',guardians:[]}],
 classes:[{id:'p7',name:'Primary Seven',code:'P.7',order:7}],
 staff:[{id:'s1',firstName:'Teacher',lastName:'Example',status:'active',role:['Teacher','Headteacher'],department:['Teaching'],contactNumber:'0700000001',contractType:'permanent'}],
 payments:[receipt,receipt,{...receipt,id:'reversed',amount:50000,reverted:true},{...receipt,id:'late',pupilId:'p2',amount:20000,paymentDate:'2027-01-03'}],
 cashPayments:[receipt,receipt,{...receipt,id:'prior-term',amount:200000,termId:'one'},{...receipt,id:'outside',amount:999000,paymentDate:'2025-12-31'},{...receipt,id:'reverted',amount:50000,reverted:true}],
 feeStructures:[{id:'tuition',name:'Tuition',amount:300000}],
 assessments:{rows:[{pupilId:'p1',pupilName:'Example Amina',admission:'TF/001',className:'P.7',termName:'Term 3',assessed:300000,paid:100000,balance:200000}],missingHistorical:0},
 attendance:[{id:'a1',pupilId:'p1',date:'2026-10-20',status:'Present',classId:'p7',classCode:'P.7'},{id:'a2',pupilId:'p2',date:'2026-10-20',status:'Late',classId:'p7',classCode:'P.7'},{id:'a3',pupilId:'p1',date:'2026-10-21',status:'Absent',classId:'p7',classCode:'P.7'},{id:'a4',pupilId:'p2',date:'2026-10-21',status:'Excused',classId:'p7',classCode:'P.7'},{id:'a5',pupilId:'p1',date:'2026-10-22',status:'',classId:'p7',classCode:'P.7'}],
 purchases:[{id:'purchase1',itemId:'books',itemName:'Textbooks',itemCategory:'Class Utility',quantity:10,totalCost:60000,supplierName:'Books supplier',purchaseDate:'2026-10-10',approvalStatus:'Approved'},{id:'legacy',itemId:'food',itemName:'Food',itemCategory:'Foodstuff',quantity:3,totalCost:20000,purchaseDate:'2026-10-11'},{id:'pending',itemId:'pending',quantity:1,totalCost:90000,approvalStatus:'Pending',purchaseDate:'2026-10-12'},{id:'rejected',itemId:'reject',quantity:1,totalCost:40000,approvalStatus:'Rejected',purchaseDate:'2026-10-12'}],
 budgets:[{id:'budget1',name:'Term supplies',status:'Active',periodType:'Term',academicYearId:'2026',termId:'three',termName:'Term 3',totalEstimatedCost:100000},{id:'annual',name:'Annual plan',status:'Active',periodType:'Year',academicYearId:'2026',totalEstimatedCost:500000}],
 payroll:{totalAmount:30000,paymentCount:1,staffPaidCount:1,paymentMethods:[{method:'Cash',amount:30000,paymentCount:1}],byStaff:[{staffId:'s1',staffName:'Teacher Example',amount:30000,paymentCount:1,lastPaymentDate:'2026-10-15'}]},
 exams:[exam],results:[{exam,result:{examId:'exam1',subjectSnapshots:[{subjectId:'eng',name:'English',code:'ENG',maxMarks:80,passingMarks:40}],results:{p1:{eng:{marks:60}},p2:{eng:{marks:0}},p3:{eng:{status:'missed'}}}}}],
 requirements:[{id:'req1',paidAmount:50000,paymentStatus:'paid',releaseStatus:'pending',coverageMode:'cash'}],uniforms:[{id:'uniform1',finalAmount:60000,paidAmount:20000,paymentStatus:'partial',collectionStatus:'pending'}],
 inventory:[{id:'item1',name:'Chalk',category:'Stationery',quantity:2,unit:'Boxes',reorderLevel:3,totalValue:10000,isActive:true,condition:'Good',location:'Store'},{id:'item2',name:'Books',category:'Books',quantity:40,unit:'Pieces',isActive:true,condition:'Good',location:'Library'}],
 banking:[{id:'account1',pupilId:'p1',accountNumber:'ACC/001',accountName:'Example Amina',balance:1000000,isActive:true}],
 events:[{id:'event1',title:'School sports day',startDate:'2026-10-25',endDate:'2026-10-25',type:'Co-curricular',status:'Scheduled'}],
 timetable:[{profile:{id:'profile1',name:'Primary timetable',classIds:['p7']},entries:[{id:'lesson1',classId:'p7',subjectId:'eng',teacherId:'s1'},{id:'lesson2',classId:'p7',subjectId:'',teacherId:''}]}],
} as unknown as ReportData;
