/* Shared by the app and payment-change trigger to keep promise accounting identical. */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentMatchesReminderScope = paymentMatchesReminderScope;
exports.getFeeReminderProgress = getFeeReminderProgress;
exports.canAccessFeeReminderPage = canAccessFeeReminderPage;
exports.canReceiveFeeReminders = canReceiveFeeReminders;
function canAccessFeeReminderPage(user, pageId) {
    if (!user || user.isActive === false || user.role === 'Parent') return false;
    if (user.role === 'Admin') return true;
    const granular = user.granularPermissions?.find(module => module.moduleId === 'fees');
    if (granular) return Boolean(granular.pages?.find(page => page.pageId === pageId)?.canAccess);
    return Boolean(user.modulePermissions?.some(module => module.module === 'fees'));
}
function canReceiveFeeReminders(user) {
    return ['list', 'collection', 'collect', 'analytics', 'schoolpay_feed'].some(page => canAccessFeeReminderPage(user, page));
}
function paymentMatchesReminderScope(payment, scope) {
    if (payment.feeStructureId === scope.feeStructureId
        && payment.academicYearId === scope.academicYearId && payment.termId === scope.termId)
        return true;
    const carry = payment;
    if (carry.feeStructureId !== 'previous-balance' || !carry.isCarryForwardPayment)
        return false;
    const equalName = (left, right) => Boolean(left && right
        && left.trim().toLowerCase() === right.trim().toLowerCase());
    const feeMatches = carry.originalFeeStructureId
        ? carry.originalFeeStructureId === scope.feeStructureId
        : equalName(carry.carryForwardItemName, scope.feeName);
    const yearMatches = carry.originalAcademicYearId
        ? carry.originalAcademicYearId === scope.academicYearId
        : equalName(carry.originalYear, scope.academicYearName);
    const termMatches = carry.originalTermId
        ? carry.originalTermId === scope.termId
        : equalName(carry.originalTerm, scope.termName);
    return feeMatches && yearMatches && termMatches;
}
function getFeeReminderProgress(note, ledger, now = new Date()) {
    const start = Date.parse(note.createdAt);
    const end = Date.parse(note.dueAt);
    const cutoff = Math.min(end, now.getTime());
    const baseline = new Set(note.baselinePaymentIds);
    // Use the latest record for an ID so a reversal cannot leave an older copy counted.
    const unique = new Map(ledger.map(payment => [payment.id, payment]));
    const matching = [...unique.values()].filter(payment => payment.pupilId === note.pupilId
        && !payment.reverted && !baseline.has(payment.id) && Number.isFinite(payment.amount) && payment.amount > 0
        && note.scopes.some(scope => paymentMatchesReminderScope(payment, scope)));
    const payments = matching.filter(payment => {
        const at = Date.parse(payment.paymentDate);
        return Number.isFinite(at) && at >= start && at <= cutoff;
    }).sort((left, right) => Date.parse(left.paymentDate) - Date.parse(right.paymentDate));
    let paid = 0;
    let completedAt = null;
    payments.forEach(payment => {
        paid += payment.amount;
        if (!completedAt && paid >= note.promisedAmount)
            completedAt = payment.paymentDate;
    });
    const paidAfterDeadline = matching.reduce((sum, payment) => {
        const at = Date.parse(payment.paymentDate);
        return at > end && at <= now.getTime() ? sum + payment.amount : sum;
    }, 0);
    return {
        status: paid >= note.promisedAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        paid, remaining: Math.max(0, note.promisedAmount - paid), overdue: now.getTime() >= end,
        completedAt, lastPaymentAt: payments.at(-1)?.paymentDate || null, paidAfterDeadline, payments,
    };
}
