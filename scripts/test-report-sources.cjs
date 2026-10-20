const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/report-center-qa');
async function main(){fs.mkdirSync(output,{recursive:true});const mocks={
  '@/lib/firebase':`export const db={};`,
  '@/lib/access/authorized-fetch':`export const authorizedFetch=()=>{throw new Error('Unselected payroll must not be read')};`,
  '@/lib/access/circumference-session':`export const circumferenceCacheSuffix=()=>':scope';`,
  '@/lib/access/scoped-firestore':`export const collection=(_,name)=>({name}),where=(field,op,value)=>({field,op,value}),query=(ref,...constraints)=>({...ref,constraints});export const Timestamp={fromDate:date=>({toDate:()=>date,seconds:date.getTime()/1000})};export const getDocs=ref=>globalThis.reportSourceFixture.read(ref);`,
  '@/lib/cache/pupil-cache':`export const getPupilCacheScope=()=>'',readPupilCache=async()=>({data:[{id:'cached'}]});`,
  '@/lib/cache/class-cache':`export const getClassCacheScope=()=>'',readClassCache=()=>({data:[]});`,
  '@/lib/cache/staff-cache':`export const getStaffCacheScope=()=>'',readStaffCache=()=>({data:[]});`,
  './report-fee-assessment':`export const assessReportFees=async()=>({rows:[],missingHistorical:0});`,
};
const services=['pupils','classes','staff','fee-structures','attendance','procurement','banking','exams','timetable'];
for(const service of services)mocks['@/lib/services/'+service+'.service']=`export const PupilsService={getAllForCache:async()=>{globalThis.reportSourceFixture.catalogReads++;return [{id:'fresh'}]}};export const ClassesService={getAllForCache:async()=>[]},StaffService={getAllForCache:async()=>[]},FeeStructuresService={getAllFeeStructures:async()=>[]},AttendanceService={getAttendanceByDateRange:async()=>[]},ProcurementService={getBudgets:async()=>[]},BankingService={getAllAccounts:async()=>[]},ExamsService={getExamsByAcademicYearAndTerm:async()=>[],getExamResultByExamId:async()=>null},TimetableService={getTimetables:async()=>[]};`;
await esbuild.build({absWorkingDir:root,entryPoints:['src/lib/reports/report-sources.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(output,'source-test.cjs'),plugins:[{name:'sources',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'ts',resolveDir:root}));}}]});
const stamp=value=>({toDate:()=>new Date(value),seconds:Date.parse(value)/1000});
const payments=[{id:'term',academicYearId:'2026',termId:'three',paymentDate:'2026-10-20',amount:100},{id:'previous-year',academicYearId:'2025',termId:'one',paymentDate:'2026-10-19T22:00:00Z',amount:200},{id:'start-boundary',academicYearId:'2026',termId:'three',paymentDate:'2026-08-31T22:00:00Z',amount:300},{id:'timestamp',academicYearId:'2026',termId:'three',paymentDate:stamp('2026-10-19T22:00:00Z'),amount:400},{id:'later',academicYearId:'2026',termId:'three',paymentDate:'2027-01-01',amount:500}];
const requests=[];let failure=false;
globalThis.reportSourceFixture={catalogReads:0,read:async ref=>{requests.push(ref);if(failure&&['inventoryItems','uniforms'].includes(ref.name))throw new Error('Inventory read unavailable');const records=ref.name==='payments'?payments:[];const selected=records.filter(record=>(ref.constraints||[]).every(({field,op,value})=>{const actual=record[field];if(op==='==')return actual===value;if(typeof actual!==typeof value)return false;const comparable=item=>typeof item==='string'?item:item?.seconds;const a=comparable(actual),b=comparable(value);return op==='>='?a>=b:a<=b;}));return {docs:selected.map(record=>({id:record.id,data:()=>record}))};}};
const {loadReportSource,reportSourceKey}=require(path.join(output,'source-test.cjs'));
const context={user:{id:'user1',role:'Admin'},period:{year:{id:'2026',terms:[]},termId:'three',start:'2026-09-01',end:'2026-12-10'},queryClient:{}};
const cash=await loadReportSource('cashPayments',context);assert.deepEqual(cash.map(record=>record.id).sort(),['previous-year','start-boundary','term','timestamp']);assert.equal(requests.length,2);assert.ok(requests.every(ref=>ref.name==='payments'&&ref.constraints.every(c=>c.field==='paymentDate')),'Date reads have lower and upper bounds, not an all-history ledger scan');
requests.length=0;const allocated=await loadReportSource('payments',context);assert.deepEqual(allocated.map(record=>record.id).sort(),['later','start-boundary','term','timestamp']);assert.equal(requests.length,1);assert.deepEqual(requests[0].constraints.map(c=>c.field),['academicYearId','termId']);
assert.equal((await loadReportSource('pupils',context))[0].id,'cached');assert.equal((await loadReportSource('pupils',{...context,forceRefresh:true}))[0].id,'fresh');assert.equal(globalThis.reportSourceFixture.catalogReads,1);
failure=true;await assert.rejects(loadReportSource('inventory',context),/unavailable/);await assert.rejects(loadReportSource('uniformItems',context),/unavailable/);
assert.notDeepEqual(reportSourceKey('payments',context),reportSourceKey('payments',{...context,user:{...context.user,granularPermissions:[{moduleId:'reports',pages:[]}]}}));
console.log('REPORT_SOURCES_OK: bounded mixed-date reads, school-day boundaries, academic allocations, source failures, forced catalog refresh and permission-sensitive keys.');}
main().catch(error=>{console.error(error);process.exitCode=1});
