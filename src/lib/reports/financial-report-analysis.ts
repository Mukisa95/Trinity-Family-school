import type { PaymentRecord, Pupil } from '@/types';
import type { ReportData, ReportPeriod, ReportSection, ReportTable, ReportValue } from './report-model';
import { formatReportValue, reportDate, reportNumber as number } from './report-model';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';

const money = (value: number) => formatReportValue(value, 'money');
const sum = <T,>(rows: T[], value: (row: T) => unknown) => rows.reduce((total, row) => total + number(value(row)), 0);
const share = (paid: number, expected: number) => expected > 0 ? Math.round(paid / expected * 10000) / 100 : 0;
const uniquePayments = (rows: PaymentRecord[]) => [...new Map(rows.map(row => [row.id, row])).values()];
const countLabel = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const displayDate = (date: string) => date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' }).format(new Date(`${date}T12:00:00+03:00`)) : 'Not shown';
const pupilName = (pupil?: Pupil) => pupil ? formatPupilDisplayName(pupil) : 'Pupil details not available';

function currentClass(pupil: Pupil | undefined, classes: ReportData['classes']) {
  if (!pupil) return 'Not available';
  const record = classes.find(item => item.id === pupil.classId);
  return [record?.code || record?.name || pupil.classCode || pupil.className || 'Not shown', pupil.streamName].filter(Boolean).join(' · ');
}

/** Group by saved identities, never by admission number or a guessed class alias. */
function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id=key(row),bucket=groups.get(id);
    if(bucket)bucket.push(row);else groups.set(id,[row]);
  }
  return [...groups];
}

function admissionChecks(pupils: Pupil[], ids: Set<string>) {
  return groupBy(pupils.filter(pupil => ids.has(pupil.id) && pupil.admissionNumber), pupil => pupil.admissionNumber.trim())
    .filter(([, rows]) => new Set(rows.map(row => row.id)).size > 1);
}

export function feePaymentPurpose(payment: PaymentRecord, fees: ReportData['feeStructures']) {
  if (payment.feeStructureId === 'previous-balance') return 'Old unpaid fees';
  if (payment.feeStructureId.startsWith('uniform-')) return 'Uniforms';
  const fee = fees.find(item => item.id === payment.feeStructureId);
  if (fee?.category === 'Uniform Fee') return 'Uniforms';
  return fee?.name || 'Payment purpose needs checking';
}

function addTable(report: ReportSection, table: ReportTable) { report.tables.push(table); }

export function buildFeesReport(data: ReportData, period: ReportPeriod, now: Date): ReportSection {
  const asOf = reportDate(now), all = uniquePayments(data.payments), payments = all.filter(payment => !payment.reverted);
  const reversed = all.filter(payment => payment.reverted), assessment = data.assessments, rows = assessment.rows;
  const complete = assessment.missingHistorical === 0, singleTerm = !!period.termId;
  const expected = sum(rows, row => row.assessed), paid = sum(rows, row => row.paid), unpaid = sum(rows, row => row.balance), extra = sum(rows, row => row.extra);
  const wider = sum(payments, payment => payment.amount), pupils = new Map(data.pupils.map(pupil => [pupil.id, pupil]));
  const periodName = singleTerm ? period.year.terms.find(term => term.id === period.termId)?.name || 'Selected term' : 'Selected year';
  const headValue = (value: number): ReportValue => !complete ? 'Not complete' : singleTerm ? value : 'See each term below';
  const report: ReportSection = {
    id: 'fees', title: 'Fees collection', description: 'What pupils should pay, what has been paid and what is still unpaid', asOf,
    summary: !complete
      ? `The fee list is not complete: ${countLabel(assessment.missingHistorical, 'pupil and term record')} could not be checked because saved details for an earlier term are missing. The tables show only the records that could be checked.`
      : singleTerm
        ? `Pupils are expected to pay ${money(expected)} in ${periodName} fees. ${money(paid)} is recorded as paid towards those fees, leaving ${money(unpaid)} still unpaid.${expected > 0 ? ` About ${Math.round(share(paid, expected))} out of every 100 shillings expected have been paid.` : ' No fees to pay were found in the checked fee list.'}${extra > 0 ? ` ${money(extra)} extra on individual fee items is shown separately; it does not reduce another unpaid item.` : ''}`
        : 'Fees to pay, money paid and unpaid amounts are shown separately for each term below. They are not combined into one yearly bill because some fees repeat or apply to particular terms only.',
    metrics: [
      { label: 'Fees pupils are expected to pay', value: headValue(expected), format: 'money' },
      { label: 'Paid towards those fees', value: headValue(paid), format: 'money' },
      { label: 'Fees still unpaid', value: headValue(unpaid), format: 'money' },
      { label: 'How much has been paid', value: !complete ? 'Not complete' : !singleTerm ? 'See each term below' : expected > 0 ? share(paid, expected) : 'No fees to compare', format: 'percent' },
      { label: `Payments listed for ${singleTerm ? 'the term' : 'the year'}`, value: wider, format: 'money', detail: 'Includes other items and old fees; explained below.' },
      { label: 'Extra money on fee items', value: headValue(extra), format: 'money' },
    ], insights: [], actions: [], sources: [], notes: [], tables: [],
  };
  report.insights.push('Unpaid does not always mean late. We cannot tell how much is late because payment deadlines are not included in this report.');
  const terms = period.year.terms.filter(term => !singleTerm || term.id === period.termId);
  for (const term of terms) {
    const selected = rows.filter(row => row.termId ? row.termId === term.id : row.termName === term.name);
    const classRows = groupBy(selected, row => `${row.classId || row.className}:${row.className}`).map(([, items]) => {
      const fees = sum(items, row => row.assessed), payments = sum(items, row => row.paid);
      return [items[0].className, fees, payments, sum(items, row => row.balance), sum(items, row => row.extra), fees > 0 ? share(payments, fees) : 'Not applicable'];
    });
    const fees = sum(selected, row => row.assessed), payments = sum(selected, row => row.paid);
    addTable(report, { title: `Which classes have unpaid fees?${singleTerm ? '' : ` - ${term.name}`}`, description: `${term.name}: ${complete ? 'All checked fee records are included.' : 'Only available fee records are included; the list is not complete.'} Class and stream names come from the fee list for this term. Paid (%) shows the part of the listed fees paid. Extra money stays separate from unpaid fees.`, columns: ['Class in fee list', 'Fees to pay', 'Paid', 'Still unpaid', 'Extra paid', 'Paid (%)'], rows: classRows, total: [complete ? 'Total' : 'Available records only', fees, payments, sum(selected, row => row.balance), sum(selected, row => row.extra), fees > 0 ? share(payments, fees) : 'Not applicable'], moneyColumns: [1, 2, 3, 4], percentColumns: [5] });
  }
  const difference = wider - paid;
  const old = payments.filter(payment => payment.feeStructureId === 'previous-balance');
  const linked = complete && rows.every(row => Array.isArray(row.paymentIds));
  const appliedIds = new Set(rows.flatMap(row => row.paymentIds || []));
  const oldOutside = linked ? sum(old.filter(payment => !appliedIds.has(payment.id)), payment => payment.amount) : null;
  const uniformOutside = linked ? sum(payments.filter(payment => feePaymentPurpose(payment, data.feeStructures) === 'Uniforms' && !appliedIds.has(payment.id)), payment => payment.amount) : null;
  addTable(report, { title: 'Why do the payment totals differ?', description: 'The wider payment list may include old unpaid fees, uniforms and other items. The main fee list includes only the fees checked above. A difference is not proof of missing money. Only payments confirmed outside the main fee list are subtracted below.', columns: ['What the figure means', 'Amount'], rows: [
    ['Payments listed for this period, including other items', wider],
    ['Payments towards the main fee list', complete ? paid : 'Not complete'],
    ['Difference between the two lists', complete ? difference : 'Not available'],
    ['Payments labelled as old unpaid fees', sum(old, payment => payment.amount)],
    ['Old-fee payments confirmed outside the main fee list', oldOutside ?? 'Not yet checked'],
    ['Uniform payments confirmed outside the main fee list', uniformOutside ?? 'Not yet checked'],
    ['Difference still needing an explanation', linked ? difference - (oldOutside || 0) - (uniformOutside || 0) : 'Not yet checked'],
  ], moneyColumns: [1] });
  report.insights.push(`The wider payment list totals ${money(wider)}. ${complete ? `The main fee list shows ${money(paid)} paid; the difference is ${money(difference)}.` : 'It cannot yet be compared with a complete main fee list.'} Old-fee payments total ${money(sum(old, payment => payment.amount))}. Do not add these lists together.`);
  const unpaidRows = rows.filter(row => row.balance > 0);
  addTable(report, { title: 'How large are the unpaid amounts?', description: `${countLabel(unpaidRows.length, 'pupil and term entry', 'pupil and term entries')} in the ${complete ? 'checked' : 'available part of the'} fee list. This groups amounts by size, not by how late they are.${singleTerm ? '' : ' A pupil can appear once in each term; the yearly amount is not a new bill.'}`, columns: ['Unpaid amount per entry', 'Entries', 'Still unpaid', 'Share (%)'], rows: [[0, 50000, 'Up to 50,000'], [50000, 200000, '50,001 to 200,000'], [200000, 400000, '200,001 to 400,000'], [400000, Infinity, 'Above 400,000']].map(([low, high, label]) => { const group = unpaidRows.filter(row => row.balance > Number(low) && row.balance <= Number(high)); const total = sum(group, row => row.balance); return [String(label), group.length, total, share(total, unpaid)]; }), total: ['Total of listed entries', unpaidRows.length, unpaid, share(unpaid, unpaid)], moneyColumns: [2], percentColumns: [3] });
  const largest = groupBy(unpaidRows, row => `${row.classId || row.className}:${row.className}`).map(([, items]) => ({ label: items[0].className, amount: sum(items, row => row.balance) })).sort((a, b) => b.amount - a.amount).slice(0, 2);
  if (unpaid > 0 && largest.length) report.insights.push(`${largest.map(item => item.label).join(' and ')} ${largest.length > 1 ? 'together have' : 'has'} ${money(sum(largest, item => item.amount))} still unpaid in the listed records, about ${Math.round(share(sum(largest, item => item.amount), unpaid))} out of every 100 shillings still unpaid. Check pupil details and payment deadlines before contacting families.`);
  const purposes = groupBy(payments, payment => feePaymentPurpose(payment, data.feeStructures)).map(([purpose, items]) => [purpose, sum(items, payment => payment.amount), share(sum(items, payment => payment.amount), wider)]);
  addTable(report, { title: 'What was the money paid for?', description: 'Readable names are shown here. Uniform payment references are grouped as Uniforms; original references stay in the full payment list. A school-level fee name is kept as saved; it is not assumed to mean tuition.', columns: ['Payment purpose', 'Paid', 'Share (%)'], rows: purposes, total: ['Total', wider, wider > 0 ? 100 : 0], moneyColumns: [1], percentColumns: [2] });
  const monthLabel = (month: string) => {
    if (!month) return 'Payment date not shown';
    const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Kampala' }).format(new Date(`${month}-01T12:00:00+03:00`));
    return month === asOf.slice(0, 7) ? `${label} - month still in progress` : month > asOf.slice(0, 7) ? `${label} - dated after this report` : label;
  };
  addTable(report, { title: 'When were the payments made?', description: `These are payment dates for money listed under ${periodName}, even when paid before or after the term dates. A month still in progress should not be judged against a full month. Future-dated entries remain listed and need checking. Records checked on ${displayDate(asOf)}.`, columns: ['Month the money was paid', 'Paid'], rows: groupBy(payments, payment => reportDate(payment.paymentDate).slice(0, 7)).sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => [monthLabel(month), sum(items, payment => payment.amount)]), total: ['Total', wider], moneyColumns: [1] });
  const currentClasses = groupBy(payments, payment => `${pupils.get(payment.pupilId)?.classId || 'unknown'}:${pupils.get(payment.pupilId)?.streamId || pupils.get(payment.pupilId)?.streamName || ''}`);
  addTable(report, { title: 'Payments listed by current class', description: 'Uses each pupil’s current saved class and stream, which may differ from the term’s fee list. Classes are linked by their saved class records; similar-looking names are not joined by guesswork.', columns: ['Current class', 'Pupils with payments', 'Paid'], rows: currentClasses.map(([, items]) => [currentClass(pupils.get(items[0].pupilId), data.classes), new Set(items.map(item => item.pupilId)).size, sum(items, item => item.amount)]), total: ['Total', new Set(payments.map(item => item.pupilId)).size, wider], moneyColumns: [2] });
  const checks: [string, PaymentRecord[]][] = [
    ['Cancelled payment entries - excluded from totals', reversed],
    ['Payments before the selected dates', payments.filter(payment => !!reportDate(payment.paymentDate) && reportDate(payment.paymentDate) < period.start)],
    ['Payments after the selected dates', payments.filter(payment => reportDate(payment.paymentDate) > period.end)],
    ['Payments dated after this report', payments.filter(payment => reportDate(payment.paymentDate) > asOf)],
    ['Payments with no usable date', payments.filter(payment => !reportDate(payment.paymentDate))],
  ];
  addTable(report, { title: 'Payment entries to check', description: 'These groups can overlap. A cancelled entry does not by itself prove that money was returned to a family. Cancelled entries are already excluded from payment totals.', columns: ['What to check', 'Entries', 'Amount'], rows: checks.map(([label, items]) => [label, items.length, sum(items, item => item.amount)]), moneyColumns: [2] });
  const conflicts = admissionChecks(data.pupils, new Set([...payments.map(item => item.pupilId), ...rows.map(row => row.pupilId)]));
  if (conflicts.length) report.insights.push(`${countLabel(conflicts.length, 'admission number')} is shared by different pupil records in these lists. This is a details check, not proof of duplicate payment. Accounts stay linked by the system’s unique pupil record.`);
  if (conflicts.length) addTable(report, { title: 'Pupil details to check', columns: ['Admission number', 'Pupils using this number'], rows: conflicts.map(([admission, pupils]) => [admission, pupils.map(pupil => `${pupilName(pupil)} (${pupil.id})`).join('; ')]), detail: true });
  const receiptReference = (payment: PaymentRecord) => {
    const fields = payment as PaymentRecord & { receiptNumber?: string; receiptId?: string; operationId?: string };
    return fields.receiptNumber || fields.receiptId || fields.operationId || `Payment record: ${payment.id}`;
  };
  addTable(report, { title: 'Full pupil payment list', description: `Complete list: ${payments.length} payment entries for ${period.label}, totalling ${money(wider)}. One pupil or receipt can have several entries for different purposes; each saved payment entry is counted once. Original fee references are included for checking.`, columns: ['No.', 'Pupil / admission', 'Current class', 'Purpose / saved reference', 'Payment date', 'Receipt / record', 'Paid'], rows: payments.map((payment, index) => { const pupil = pupils.get(payment.pupilId); return [index + 1, `${pupilName(pupil)}\n${pupil?.admissionNumber || 'Admission not shown'}`, currentClass(pupil, data.classes), `${feePaymentPurpose(payment, data.feeStructures)}\n${payment.feeStructureId}`, displayDate(reportDate(payment.paymentDate)), receiptReference(payment), number(payment.amount)]; }), total: ['', 'Total', '', '', '', '', wider], moneyColumns: [6], detail: true });
  addTable(report, { title: 'Full list of fees still unpaid', description: `${complete ? 'Complete checked list' : 'Available records only - not a complete school list'}: ${unpaidRows.length} pupil and term entries totalling ${money(unpaid)} for ${period.label}. Payment deadlines, payment agreements, follow-up owner and follow-up dates are not supplied by the checked fee records. These are unpaid amounts, not a list of late payments.`, columns: ['No.', 'Pupil / admission', 'Class in fee list', 'Term', 'Still unpaid', 'Last payment towards these fees', 'Deadline'], rows: [...unpaidRows].sort((a, b) => b.balance - a.balance).map((row, index) => [index + 1, `${row.pupilName}\n${row.admission || 'Admission not shown'}`, row.className, row.termName, row.balance, displayDate(row.lastPaymentDate || ''), 'Not shown']), total: ['', 'Total of listed entries', '', '', unpaid, '', ''], moneyColumns: [4], detail: true });
  report.actions = ['Bursar: check the two payment lists against each pupil and receipt. Leave any unexplained difference visible until it is checked.', 'Bursar and class staff: confirm fees, discounts and payment deadlines before agreeing a follow-up plan with families.', ...(conflicts.length ? ['System administrator: check the shared admission numbers against the actual pupil records. Do not join accounts just because a number matches.'] : [])];
  report.sources = ['Fees pupils should pay: the application’s fee and discount rules, pupil records and saved class details for ended terms.', 'Payments: saved payment entries for the selected academic year and term. Cancelled entries are excluded; separate parts of a receipt are kept as separate payment purposes.'];
  report.notes = ['The main fee list does not include old unpaid balances from other terms. The wider payment list may include those balances, uniforms and other items. It is not a statement of cash received between the term dates.', `These are current saved records checked on ${displayDate(asOf)}. They do not recreate what the account looked like on an earlier day; later corrections may change a new report. No bank or SchoolPay statement check is implied.`, 'Each family’s unpaid fees and extra payments remain separate. A missing record is not treated as zero. For a whole year, read each term’s fees separately.'];
  report.metrics.forEach((metric,index)=>{metric.tone=(['blue','green','red','green','violet','amber'] as const)[index];});
  report.charts=[];
  if(complete&&singleTerm&&expected>0&&extra===0&&paid>=0&&unpaid>=0&&Math.abs(expected-paid-unpaid)<.01)report.charts.push({title:'How much of the fee list has been paid?',description:'Uses only the main fee list. Old-fee and other payments in the wider list are not added to this percentage.',kind:'donut',centerValue:`${share(paid,expected)}%`,centerLabel:'Paid',format:'money',items:[{label:'Paid towards these fees',value:paid,tone:'green'},{label:'Fees still unpaid',value:unpaid,tone:'red'}],tableTitle:report.tables[0]?.title});
  report.charts.push({title:'What families paid for',description:'Payment purposes from the wider list. Read the table for every group and its exact total.',kind:'bar',format:'money',items:purposes.filter(row=>Number(row[1])>=0).map(row=>({label:String(row[0]),value:Number(row[1])})),tableTitle:'What was the money paid for?'});
  return report;
}

export function buildUniformReport(data: ReportData, period: ReportPeriod, now: Date): ReportSection {
  const rows = [...new Map(data.uniforms.map(row => [row.id, row])).values()];
  const hasMoney = (row: typeof rows[number]) => typeof row.finalAmount === 'number' && Number.isFinite(row.finalAmount) && typeof row.paidAmount === 'number' && Number.isFinite(row.paidAmount);
  const checked = rows.filter(hasMoney), missing = rows.length - checked.length, cost = sum(checked, row => row.finalAmount), paid = sum(checked, row => row.paidAmount);
  const unpaid = sum(checked, row => Math.max(0, row.finalAmount - row.paidAmount)), extra = sum(checked, row => Math.max(0, row.paidAmount - row.finalAmount));
  const waiting = checked.filter(row => row.finalAmount > 0 && row.paidAmount >= row.finalAmount && row.collectionStatus !== 'collected');
  const pupils = new Map(data.pupils.map(pupil => [pupil.id, pupil]));
  const allItems = new Map((data.uniformItems || []).map(item => [item.id, item]));
  const report: ReportSection = { id: 'uniforms', title: 'Uniforms', description: 'How much has been paid and who is still waiting for uniforms', asOf: reportDate(now), summary: `${countLabel(rows.length, 'uniform order')} ${rows.length === 1 ? 'is' : 'are'} listed for ${period.label}. ${missing ? `Money details are missing on ${missing} orders; the money totals are not complete.` : `Orders cost ${money(cost)} after saved discounts; ${money(paid)} is recorded as paid and ${money(unpaid)} is still unpaid.${extra ? ` ${money(extra)} extra paid on individual orders is shown separately.` : ''}`} ${countLabel(waiting.length, 'fully paid order')} ${waiting.length === 1 ? 'is' : 'are'} not marked as fully collected.`, metrics: [
    { label: 'Uniform orders', value: rows.length }, { label: 'Cost after saved discounts', value: missing ? 'Not complete' : cost, format: 'money' }, { label: 'Paid towards orders', value: missing ? 'Not complete' : paid, format: 'money' }, { label: 'Still unpaid', value: missing ? 'Not complete' : unpaid, format: 'money' }, { label: 'Extra money paid', value: missing ? 'Not complete' : extra, format: 'money' }, { label: 'Fully paid, not fully collected', value: waiting.length, detail: missing ? 'Known orders only; some money details are missing.' : 'Orders, not the number of garments.' },
  ], insights: [], notes: [], actions: [], sources: [], tables: [] };
  addTable(report, { title: 'Uniform money: what has been paid?', description: `${missing ? 'Only orders with complete money details are added below.' : 'All listed orders have money details.'} Unpaid amounts and extra payments are worked out for each order separately, so one family’s extra payment does not reduce another family’s unpaid amount.`, columns: ['What the figure means', 'Amount'], rows: [['Cost after saved discounts', cost], ['Payments recorded against these orders', paid], ['Order cost minus payments', cost - paid], ['Amounts still unpaid, added order by order', unpaid], ['Extra paid, added order by order', extra], ['Difference to check after allowing for extra paid', unpaid - extra - (cost - paid)]].map(([label,value])=>[label,!checked.length&&missing?'Not available':value]), moneyColumns: [1] });
  const paymentLabels: Record<string, string> = { paid: 'Fully paid', partial: 'Partly paid', pending: 'Waiting for payment' };
  const collectionLabels: Record<string, string> = { pending: 'Not collected yet', partial: 'Some collected', collected: 'All collected' };
  addTable(report, { title: 'How much has been paid?', description: 'The saved payment status is shown here. Staff should check any status that disagrees with the saved amount.', columns: ['Payment status', 'Orders'], rows: groupBy(rows, row => row.paymentStatus || 'unknown').map(([status, items]) => [paymentLabels[status] || 'Not shown', items.length]), total: ['Total orders', rows.length] });
  addTable(report, { title: 'Have the uniforms been collected?', description: 'Counts are orders, not individual garments. Check for pickups that happened but were not recorded.', columns: ['Pickup status', 'Orders', 'Share (%)'], rows: groupBy(rows, row => row.collectionStatus || 'unknown').map(([status, items]) => [collectionLabels[status] || 'Not shown', items.length, share(items.length, rows.length)]), total: ['Total orders', rows.length, rows.length ? 100 : 0], percentColumns: [2] });
  if (data.payments) {
    const feeUniforms = uniquePayments(data.payments).filter(payment => !payment.reverted && (payment.feeStructureId.startsWith('uniform-') || data.feeStructures?.some(fee => fee.id === payment.feeStructureId && fee.category === 'Uniform Fee')));
    addTable(report, { title: 'Do the two uniform payment lists agree?', description: 'Fees collection is included. The two lists may show the same money: do not add them. Check orders and receipts.', columns: ['Payment list', 'Amount'], rows: [['Paid in uniform order records', missing ? 'Not complete' : paid], ['Uniform payments in the fees payment list', sum(feeUniforms, payment => payment.amount)], ['Difference to check', missing ? 'Not available' : paid - sum(feeUniforms, payment => payment.amount)]], moneyColumns: [1] });
  } else report.notes.push('The Fees collection payment list is not included, so its uniform total has not been compared here. Include Fees collection to see that comparison.');
  const followups: ReportValue[][] = [];
  for (const order of waiting) {
    const before=followups.length;
    const pupil = pupils.get(order.pupilId), ids = Array.isArray(order.uniformId) ? order.uniformId : order.uniformId ? [order.uniformId] : [];
    for (const id of ids.length ? ids : ['']) {
      const quantity = order.selectedQuantities?.[id] ?? (id && allItems.has(id) ? 1 : undefined);
      const collected = order.collectedQuantities?.[id] ?? (order.collectedItems?.includes(id) && quantity === 1 ? 1 : undefined);
      if (quantity !== undefined && collected !== undefined && collected >= quantity) continue;
      followups.push([`${pupilName(pupil)}\n${pupil?.admissionNumber || 'Admission not shown'}`, order.id, allItems.get(id)?.name || 'Uniform name not available', order.selectedSizes?.[id] || 'Not shown', quantity ?? 'Not shown', collected ?? 'Not shown', quantity !== undefined && collected !== undefined ? Math.max(0, quantity - collected) : 'Not shown', displayDate(reportDate(order.paymentDate)), 'Not shown']);
    }
    if(before===followups.length)followups.push([`${pupilName(pupils.get(order.pupilId))}\n${pupils.get(order.pupilId)?.admissionNumber||'Admission not shown'}`,order.id,'Saved item quantities say all collected; order status needs checking','Not shown','See item quantities','See item quantities',0,displayDate(reportDate(order.paymentDate)),'Not shown']);
  }
  addTable(report, { title: 'Fully paid orders still to check for pickup', description: `Complete saved-item list for ${countLabel(waiting.length, 'fully paid order')} not marked as fully collected. An order may contain several items. Missing quantities, pickup dates and the person handling each order are not shown or guessed.`, columns: ['Pupil / admission', 'Order reference', 'Uniform', 'Size', 'Ordered', 'Collected', 'Still needed', 'Saved payment date', 'Expected pickup'], rows: followups });
  const conflicts = checked.filter(row => (row.paymentStatus === 'paid') !== (row.paidAmount >= row.finalAmount));
  report.insights = [`${countLabel(waiting.length, 'fully paid order')} still ${waiting.length === 1 ? 'needs' : 'need'} a pickup check. Confirm what was handed over before explaining why an order is still waiting.`, ...(extra > 0 ? [`${money(extra)} extra is recorded on individual orders. Check discounts, receipts and corrections before deciding how it should be used or returned.`] : []), ...(conflicts.length ? [`${countLabel(conflicts.length, 'order')} has a payment status that does not agree with its amount. Check the order before relying on the status list.`] : [])];
  report.actions = ['Person in charge of uniforms: check the paid orders still waiting, update any pickups already made and agree a date for the remaining items.', 'Bursar and person in charge of uniforms: compare each order, discount and receipt. Explain differences between the order list and fee payments before adding them to any other report.'];
  report.sources = ['Saved uniform orders for the selected period, including item names, sizes, quantities, discounts and pickup status.', 'Pupils are linked by their unique school record, never by admission number alone.'];
  report.notes.push('Order payments can include money paid outside the term dates. They may also appear in Fees collection: do not add them as extra income.', `Current records checked on ${displayDate(reportDate(now))}, not a past-day account.`);
  report.metrics.forEach((metric,index)=>{metric.tone=(['blue','violet','green','red','amber','amber'] as const)[index];});
  report.charts=[{title:'Uniform pickup progress',description:'Counts saved orders, not garments. A pickup may have happened without being recorded; check before explaining a delay.',kind:'donut',centerValue:String(rows.filter(row=>row.collectionStatus==='collected').length),centerLabel:'All collected',items:groupBy(rows,row=>row.collectionStatus||'unknown').map(([status,items])=>({label:collectionLabels[status]||'Not shown',value:items.length,tone:status==='collected'?'green':status==='partial'?'amber':'blue'})),tableTitle:'Have the uniforms been collected?'}];
  return report;
}
