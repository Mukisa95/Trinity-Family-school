import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyEventAudience,resolveEventAudience,eventChannelRecipients,eventSmsPreview,validateEventTimes,type EventPlanning } from '@/lib/events/event-planning';
import { writeSMSDocument } from '@/lib/utils/sms-document';
import type { Class,Pupil,Staff,SystemUser } from '@/types';
const classes=[{id:'p4',name:'PRIMARY FOUR',code:'P.4',level:'Upper Primary'},{id:'p1',name:'PRIMARY ONE',code:'P.1',level:'Lower Primary'}] as Class[];
const pupils=[{id:'a',firstName:'Amina',lastName:'Example',classId:'p4',status:'Active',section:'Boarding',gender:'Female',familyId:'family',admissionNumber:'SAMPLE/A',guardians:[{id:'mum',firstName:'Parent',lastName:'One',phone:'0700000001'},{id:'dad',firstName:'Parent',lastName:'Two',phone:'0700000002'}]},{id:'b',firstName:'Brian',lastName:'Example',classId:'p1',status:'Active',section:'Day',gender:'Male',familyId:'family',admissionNumber:'SAMPLE/B',guardians:[{id:'mum',firstName:'Parent',lastName:'One',phone:'0700000001'}]},{id:'old',firstName:'Old',lastName:'Pupil',classId:'p4',status:'Graduated',guardians:[]}] as Pupil[];
const users=[{id:'parent-account',role:'Parent',familyId:'family',guardianId:'mum',isActive:true},{id:'inactive-parent',role:'Parent',pupilId:'a',guardianId:'dad',isActive:false},{id:'teacher-account',role:'Staff',staffId:'s1',isActive:true}] as SystemUser[];
const staff=[{id:'s1',firstName:'Teacher',lastName:'One',employeeId:'E1',contactNumber:'0700000003',status:'active'},{id:'s2',firstName:'Teacher',lastName:'Two',employeeId:'E2',contactNumber:'0700000004',status:'onLeave'},{id:'s3',firstName:'Former',lastName:'Teacher',contactNumber:'0700000005',status:'inactive'}] as Staff[];
const plan=():EventPlanning=>({version:1,requestId:'synthetic-request',kind:'parent',academicType:'other',subjectsByClass:{},audience:emptyEventAudience(),push:true,sms:'without_account',message:'Please attend our school meeting.',smsOptions:{},times:[]});
test('parent filters intersect class, school level, section and gender and ignore inactive pupils',()=>{
 const input=plan();input.audience={...input.audience,scope:'filtered',classIds:['p4'],levels:['Upper Primary'],sections:['Boarding'],genders:['Female']};
 const rows=resolveEventAudience(input,pupils,staff,users,classes);assert.equal(rows.length,2);assert.ok(rows.every(row=>row.context.startsWith('P.4 /')));
 input.audience.genders=['Male'];assert.deepEqual(resolveEventAudience(input,pupils,staff,users,classes),[]);
});
test('account routing honours guardian ownership, family links, active accounts and pupil legacy links',()=>{
 const input=plan(),rows=resolveEventAudience(input,pupils,staff,users,classes),channels=eventChannelRecipients(input,rows);
 assert.deepEqual(channels.pushUserIds,['parent-account']);assert.equal(channels.smsRecipients.length,1);assert.equal(channels.smsRecipients[0].phone,'+256700000002');
 input.sms='all';assert.equal(eventChannelRecipients(input,rows).smsRecipients.length,3);
 const legacy=[{id:'legacy',role:'Parent',pupilId:'a',isActive:true}] as SystemUser[];assert.equal(resolveEventAudience(input,pupils,staff,legacy,classes).filter(row=>row.accountIds.length).length,2);
});
test('staff audience contains only selected current staff and SMS can target those without accounts',()=>{
 const input=plan();input.kind='staff';input.audience.staffIds=['s1','s2','s3'];
 const rows=resolveEventAudience(input,pupils,staff,users,classes);assert.equal(rows.length,2);assert.deepEqual(eventChannelRecipients(input,rows).smsRecipients.map(row=>row.staffId),['s2']);
 input.audience.excludedKeys=['staff:s2'];assert.equal(resolveEventAudience(input,pupils,staff,users,classes).length,1);
});
test('identical family messages deduplicate while pupil-specific messages stay distinct and use class codes',()=>{
 const input=plan();input.sms='all';let rows=resolveEventAudience(input,pupils,staff,users,classes);let preview=eventSmsPreview(input,rows,classes);assert.equal(preview.messages.length,2);
 input.message=writeSMSDocument([{type:'field',id:'pupil',field:'pupil_name',format:{}},{type:'text',text:' / '},{type:'field',id:'class',field:'class',format:{class:'name'}}]);
 preview=eventSmsPreview(input,rows,classes);assert.equal(preview.messages.length,3);assert.ok(preview.messages.some(message=>message.message.includes('P.4')));assert.ok(preview.messages.every(message=>!message.message.includes('PRIMARY FOUR')));
 input.message=writeSMSDocument([{type:'field',id:'fees',field:'balance',format:{}}]);assert.ok(eventSmsPreview(input,rows,classes).issues.length);assert.deepEqual(eventSmsPreview(input,rows,classes).messages,[]);
});
test('several reminders can share a date, but duplicate slots, invalid dates, past times and excessive schedules fail',()=>{
 const now=Date.parse('2026-10-20T10:00:00Z');assert.equal(validateEventTimes([{date:'2026-10-21',time:'08:00'},{date:'2026-10-21',time:'15:00'},{date:'2026-10-23',time:'08:00'}],now),undefined);
 assert.match(validateEventTimes([{date:'2026-10-21',time:'08:00'},{date:'2026-10-21',time:'08:00'}],now)!,/duplicate/);
 assert.match(validateEventTimes([{date:'2026-02-31',time:'08:00'}],now)!,/valid/);
 assert.match(validateEventTimes([{date:'2026-10-20',time:'12:00'}],now)!,/future/);
 assert.match(validateEventTimes(Array(51).fill({date:'2026-10-21',time:'08:00'}),now)!,/50/);
 assert.equal(validateEventTimes([{date:'2026-10-20',time:'13:02'}],now),undefined,'Times use UTC+3 rather than UTC');
});
