import { createHash } from 'node:crypto';
import { getFirestore, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { AcademicYear, FeeStructure, FeesHoliday, PaymentRecord, Pupil, PupilTermSnapshot, SystemUser } from '@/types';
import { circumferenceOf, permitsPupil } from '@/lib/access/circumference';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { calculateFeeBalancesAfterDiscounts } from '@/lib/utils/fee-discount-calculation';
import { schoolPayApplicableFees, schoolPayHistoricalPupil, schoolPayTermSlots } from '@/lib/utils/schoolpay-allocation';
import { schoolPayReceiptSummary, schoolPaySiblingShares, type SchoolPayExcessPreview, type SchoolPayLedgerPayment } from '@/lib/utils/schoolpay-excess';

export class SchoolPayExcessError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

function normalise(value: any): any {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalise(item)]));
  return value;
}
const rows = <T,>(snapshot: any): T[] => snapshot.docs.map((item: any) => ({ ...normalise(item.data()), id: item.id }));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** All balances, membership and receipt allocations are read in the same transaction. */
async function currentViewer(db: Firestore, tx: Transaction, viewer: SystemUser, mutate: boolean) {
  const profile = await tx.get(db.collection('system_users').doc(viewer.id));
  const current = profile.exists ? { ...profile.data(), id: profile.id } as SystemUser : viewer.role === 'Admin' ? viewer : null;
  if (!current || current.isActive === false || !GranularPermissionService.canAccessPage(current, 'fees', 'collect')
    || mutate && (!GranularPermissionService.canPerformAction(current, 'fees', 'collect', 'record_payment')
      || !GranularPermissionService.canPerformAction(current, 'fees', 'collect', 'revert_payment'))) {
    throw new SchoolPayExcessError('Your fee collection access has changed.', 403);
  }
  return current;
}

async function loadContext(db: Firestore, tx: Transaction, pupilId: string, receipt: string, viewer: SystemUser, mutate = false) {
  const current = await currentViewer(db, tx, viewer, mutate);
  const scope = circumferenceOf(current);
  const sourceSnap = await tx.get(db.collection('pupils').doc(pupilId));
  if (!sourceSnap.exists) throw new SchoolPayExcessError('Pupil not found.', 404);
  const source = { ...normalise(sourceSnap.data()), id: sourceSnap.id } as Pupil;
  if (!permitsPupil(scope, source)) throw new SchoolPayExcessError('This pupil is outside your Circumference.', 403);
  const familySnap = source.familyId
    ? await tx.get(db.collection('pupils').where('familyId', '==', source.familyId)) : null;
  const siblings = (familySnap ? rows<Pupil>(familySnap) : []).filter(person => person.id !== pupilId && permitsPupil(scope, person))
    .sort((a, b) => formatPupilDisplayName(a).localeCompare(formatPupilDisplayName(b)));
  if (siblings.length > 29) throw new SchoolPayExcessError('This family needs manual redistribution.');
  const ids = [source.id, ...siblings.map(person => person.id)];
  const [yearSnap, feeSnap, paymentSnap, holidaySnap, snapshotSnap] = await Promise.all([
    tx.get(db.collection('academicYears')), tx.get(db.collection('feeStructures')),
    tx.get(db.collection('payments').where('pupilId', 'in', ids)),
    tx.get(db.collection('feesHolidays').where('pupilId', 'in', ids)),
    tx.get(db.collection('pupilTermSnapshots').where('pupilId', 'in', ids)),
  ]);
  const years = rows<AcademicYear>(yearSnap), fees = rows<FeeStructure>(feeSnap);
  const payments = rows<SchoolPayLedgerPayment>(paymentSnap);
  const holidays = rows<FeesHoliday>(holidaySnap), snapshots = rows<PupilTermSnapshot>(snapshotSnap);
  const receiptPayments = payments.filter(payment => payment.pupilId === pupilId && payment.source === 'schoolpay'
    && (payment.schoolPayReceiptNumber || (payment as any).schoolPayTransactionId || payment.id) === receipt && !payment.reverted);
  const summary = schoolPayReceiptSummary(receiptPayments, years);
  if (!summary) throw new SchoolPayExcessError('This receipt has no available allocation. Reopen the fees page.');
  const originEnd = new Date(summary.origin.term.endDate).getTime();
  // A late review cannot use an earlier term's funds after that term becomes due.
  const cutoff = Math.max(new Date(summary.origin.term.startDate).getTime(), ...schoolPayTermSlots(years)
    .filter(slot => new Date(slot.term.startDate).getTime() <= Date.now())
    .map(slot => new Date(slot.term.startDate).getTime()));
  const excessPayments = summary.excessPayments.filter(payment => payment.feeStructureId === 'schoolpay-general'
    || schoolPayTermSlots(years).some(slot => slot.year.id === payment.academicYearId && slot.term.id === payment.termId
      && new Date(slot.term.startDate).getTime() > cutoff));
  const excessAmount = excessPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceRows = (person: Pupil) => schoolPayTermSlots(years, person)
    .filter(slot => new Date(slot.term.startDate).getTime() <= cutoff)
    .flatMap(slot => {
      const historical = new Date(slot.term.endDate).getTime() < Date.now()
        ? schoolPayHistoricalPupil(person, slot.year, slot.term, snapshots) : person;
      return calculateFeeBalancesAfterDiscounts({
        feeStructures: schoolPayApplicableFees(historical, { ...slot, allAcademicYears: years }, fees),
        allFeeStructures: fees, assignedFees: person.assignedFees,
        payments: payments.filter(payment => payment.pupilId === person.id),
        academicYearId: slot.year.id, termId: slot.term.id, allAcademicYears: years,
        feesHolidays: holidays.filter(holiday => holiday.pupilId === person.id),
      }).filter(fee => fee.balance > 0).sort((a, b) => b.balance - a.balance)
        .map(fee => ({ pupilId: person.id, academicYearId: slot.year.id, termId: slot.term.id,
          feeStructureId: fee.id, feeName: fee.name, balance: fee.balance,
          isPrevious: new Date(slot.term.endDate).getTime() < Math.max(originEnd, cutoff) }));
    });
  const targets = siblings.map(person => ({ person, fees: balanceRows(person) }));
  const originalOwner = receiptPayments.every(payment => !payment.schoolPayOriginalPupilId || payment.schoolPayOriginalPupilId === pupilId);
  const canTransfer = originalOwner && balanceRows(source).length === 0 && excessAmount > 0;
  const preview: SchoolPayExcessPreview = {
    version: digest({ source, siblings, years, fees, payments, holidays, snapshots }),
    pupilName: formatPupilDisplayName(source), receivedAmount: summary.receivedAmount,
    excessAmount, futureAmount: summary.futureAmount, futureTerms: summary.futureTerms, canTransfer,
    siblings: targets.map(({ person, fees: balances }) => ({
      pupilId: person.id, name: formatPupilDisplayName(person),
      previousBalance: balances.filter(fee => fee.isPrevious).reduce((sum, fee) => sum + fee.balance, 0),
      termBalance: balances.filter(fee => !fee.isPrevious).reduce((sum, fee) => sum + fee.balance, 0),
      balance: balances.reduce((sum, fee) => sum + fee.balance, 0),
    })),
  };
  return { preview, targets, source, summary, receiptPayments, excessPayments, years, payments };
}

export async function previewSchoolPayExcess(pupilId: string, receipt: string, viewer: SystemUser) {
  const db = getFirestore(getFirebaseAdminApp());
  return db.runTransaction(async tx => (await loadContext(db, tx, pupilId, receipt, viewer)).preview, { readOnly: true });
}

export async function transferSchoolPayExcess(input: {
  pupilId: string; receipt: string; target: string; version: string; operationId: string;
}, actor: { id: string; name: string; role: string }, viewer: SystemUser) {
  const db = getFirestore(getFirebaseAdminApp());
  const operationRef = db.collection('schoolPayPaymentMappings').doc('excess-transfers')
    .collection('operations').doc(digest(input.operationId));
  const fingerprint = digest(input);
  return db.runTransaction(async tx => {
    const current = await currentViewer(db, tx, viewer, true);
    const owner = await tx.get(db.collection('pupils').doc(input.pupilId));
    if (!owner.exists || !permitsPupil(circumferenceOf(current), owner.data() as Pupil)) {
      throw new SchoolPayExcessError('This pupil is outside your Circumference.', 403);
    }
    const operation = await tx.get(operationRef);
    if (operation.exists) {
      if (operation.data()?.fingerprint !== fingerprint) throw new SchoolPayExcessError('This transfer request has already been used.');
      return { ...operation.data()!.result, wasReplay: true };
    }
    const context = await loadContext(db, tx, input.pupilId, input.receipt, current, true);
    const { preview, targets, source, summary, receiptPayments, excessPayments, years, payments } = context;
    if (preview.version !== input.version) throw new SchoolPayExcessError('Balances changed. Reload the transfer options before confirming.');
    if (!preview.canTransfer) throw new SchoolPayExcessError('Only excess beyond this pupil’s outstanding fees can be transferred.');
    const selected = input.target === 'all' ? preview.siblings : preview.siblings.filter(sibling => sibling.pupilId === input.target);
    if (selected.length === 0) throw new SchoolPayExcessError('Choose a linked sibling.');
    const shares = schoolPaySiblingShares(preview.excessAmount, selected);
    const transferAmount = shares.reduce((sum, share) => sum + share.amount, 0);
    if (transferAmount <= 0) throw new SchoolPayExcessError('The selected siblings have no outstanding fees.');
    const mappingRef = db.collection('schoolPayPaymentMappings').doc(input.receipt);
    const mapping = await tx.get(mappingRef);
    const now = Timestamp.now(), nowIso = new Date().toISOString();
    const created: Array<Record<string, any>> = [];
    const metadata = { schoolPayOriginalPupilId: source.id, schoolPayReceivedAmount: summary.receivedAmount,
      schoolPayTransferredAmount: summary.transferredAmount + transferAmount };
    const template = receiptPayments[0] as any;
    for (const share of shares) {
      let remaining = share.amount;
      for (const fee of targets.find(target => target.person.id === share.pupilId)!.fees) {
        if (remaining <= 0) break;
        const amount = Math.min(remaining, fee.balance);
        created.push({ pupilId: share.pupilId, feeStructureId: fee.feeStructureId,
          academicYearId: fee.academicYearId, termId: fee.termId, amount,
          paymentDate: template.paymentDate, paidBy: template.paidBy || { id: 'schoolpay-system', name: formatPupilDisplayName(source), role: 'Parent/Guardian' },
          paymentMethod: template.paymentMethod || 'SchoolPay', source: 'schoolpay',
          schoolPayReceiptNumber: input.receipt,
          ...(template.schoolPayTransactionId && { schoolPayTransactionId: template.schoolPayTransactionId }),
          ...(template.schoolPayPaymentCode && { schoolPayPaymentCode: template.schoolPayPaymentCode }),
          notes: `${fee.feeName} (SchoolPay excess transferred from ${formatPupilDisplayName(source)}) | Receipt: ${input.receipt}`,
          ...metadata, createdAt: now, schoolPayExcessTransferId: input.operationId });
        remaining -= amount;
      }
    }
    // Keep the earliest future allocations; take funds from the latest ones first.
    let debit = transferAmount;
    const termStarts = new Map(schoolPayTermSlots(years).map(slot => [`${slot.year.id}::${slot.term.id}`, new Date(slot.term.startDate).getTime()]));
    const ordered = [...excessPayments].sort((a, b) =>
      Number(b.feeStructureId === 'schoolpay-general') - Number(a.feeStructureId === 'schoolpay-general')
      || (termStarts.get(`${b.academicYearId}::${b.termId}`) || 0) - (termStarts.get(`${a.academicYearId}::${a.termId}`) || 0));
    const revertedIds: string[] = [];
    for (const payment of ordered) {
      if (debit <= 0) break;
      const take = Math.min(debit, payment.amount);
      revertedIds.push(payment.id);
      if (take < payment.amount) {
        const { id: _id, ...original } = payment;
        created.push({ ...original, amount: payment.amount - take, ...metadata, createdAt: now,
          schoolPayExcessTransferId: input.operationId });
      }
      debit -= take;
    }
    if (debit !== 0 || created.length + revertedIds.length + receiptPayments.length > 420) {
      throw new SchoolPayExcessError('This transfer needs manual review.');
    }
    const paymentIds = created.map(() => db.collection('payments').doc().id);
    // All reads are complete. Reversions, replacements and the retry marker commit together.
    receiptPayments.forEach(payment => tx.update(db.collection('payments').doc(payment.id), {
      ...metadata, ...(revertedIds.includes(payment.id) && { reverted: true, revertedAt: nowIso,
        revertedBy: actor, schoolPayExcessTransferId: input.operationId }),
    }));
    created.forEach((payment, index) => tx.set(db.collection('payments').doc(paymentIds[index]), payment));
    tx.set(db.collection('historyLogs').doc(), { a: 'adjust', e: 'payment', rid: input.receipt,
      rl: 'SchoolPay excess transferred to siblings', uid: actor.id, un: actor.name, ur: actor.role, ts: now,
      m: { amount: transferAmount, pupilId: source.id, source: 'schoolpay_excess_transfer',
        paymentIds: paymentIds.join(',').slice(0, 120), targets: shares.filter(share => share.amount > 0).map(share => share.pupilId).join(',').slice(0, 120) } });
    const result = { transferAmount, remainingExcess: preview.excessAmount - transferAmount, paymentIds,
      pupilIds: [source.id, ...shares.filter(share => share.amount > 0).map(share => share.pupilId)] };
    if (mapping.exists) tx.update(mappingRef, {
      localPaymentIds: [...payments.filter(payment => payment.source === 'schoolpay'
        && payment.schoolPayReceiptNumber === input.receipt && !payment.reverted && !revertedIds.includes(payment.id)).map(payment => payment.id), ...paymentIds],
      updatedAt: now,
    });
    tx.set(operationRef, { fingerprint, result, createdAt: now, actorId: actor.id });
    return { ...result, wasReplay: false };
  });
}
