/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onTaskDispatched} = require("firebase-functions/tasks");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const next = require("next");
const admin = require("firebase-admin");
const {getFunctions} = require("firebase-admin/functions");
const {createHash} = require("crypto");
const webpush = require("web-push");

if (!admin.apps.length) admin.initializeApp();

const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
const DEFAULT_VAPID_PUBLIC_KEY = "BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY";
const SCHOOL_TIME_ZONE = "Africa/Kampala";
const PROCESSING_LEASE_MS = 15 * 60 * 1000;
const ATTENDANCE_REMINDER_PLANS = "attendanceReminderPlans";
const ATTENDANCE_REMINDER_RUNS = "attendanceReminderRuns";
const ATTENDANCE_REMINDER_TASK_FUNCTION = "locations/us-central1/functions/attendanceReminderTask";
const ENABLE_FIREBASE_ATTENDANCE_REMINDERS = process.env.ENABLE_FIREBASE_ATTENDANCE_REMINDERS === "true";
const PARENT_DASHBOARD_REVISIONS = "parentDashboardRevisions";
const PARENT_DATASET_REVISION_COALESCE_MS = 2 * 1000;

/**
 * Parent datasets remain staff-owned source documents, so they cannot be
 * safely queried by a parent directly. This trigger resolves the affected
 * pupil's active parent account on a source write and advances only that
 * account's tiny offline-sync counter. It never writes financial or attendance data to the
 * counter document.
 */
async function publishParentDatasetRevision(change, dataset) {
  if (!change) return;
  const pupilIds = new Set();
  [change.before, change.after].forEach(snapshot => {
    const pupilId = snapshot?.data?.()?.pupilId;
    if (typeof pupilId === "string" && pupilId.trim()) pupilIds.add(pupilId);
  });
  return publishParentDatasetRevisionForPupilIds(pupilIds, dataset);
}

async function publishParentDatasetRevisionForPupilIds(pupilIds, dataset) {
  if (!pupilIds.size) return;

  const db = admin.firestore();
  const pupils = await Promise.all(Array.from(pupilIds).map(pupilId => db.collection("pupils").doc(pupilId).get()));
  const accountIds = new Set();
  pupils.forEach(pupil => {
    const pupilData = pupil.data() || {};
    const accountId = projectionString(pupilData.parentAccountId).trim();
    if (pupilData.parentAccountActive === true && accountId) accountIds.add(accountId);
  });
  if (!accountIds.size) {
    logger.warn("Parent dataset change has no active parent account.", {dataset, pupilIds: Array.from(pupilIds)});
    return;
  }

  // One school action can write several related records in the same operation.
  // Coalesce those related trigger invocations so
  // a parent receives one refresh signal for the completed change.
  await Promise.all(Array.from(accountIds).map(async accountId => {
    const revisionRef = db.collection(PARENT_DASHBOARD_REVISIONS).doc(accountId);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(revisionRef);
      const currentData = current.data() || {};
      const now = Date.now();
      const timestampField = `last${dataset[0].toUpperCase()}${dataset.slice(1)}ChangeAtMs`;
      const previousChangeAt = Number(currentData[timestampField] || 0);
      const changesAreRelated = now - previousChangeAt >= 0 && now - previousChangeAt < PARENT_DATASET_REVISION_COALESCE_MS;
      transaction.set(revisionRef, {
        // Timestamp revisions are monotonic across the former family-scoped
        // and current account-scoped namespaces, so an older offline counter
        // can never hide the first account-scoped change.
        ...(changesAreRelated ? {} : {[dataset]: now}),
        [timestampField]: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    });
  }));
}

const parentBankingRevisionTriggerOptions = {
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
};

exports.parentBankingAccountChanged = onDocumentWritten(
  {...parentBankingRevisionTriggerOptions, document: "bankAccounts/{accountId}"},
  async event => publishParentDatasetRevision(event.data, "banking"),
);

exports.parentBankingLoanChanged = onDocumentWritten(
  {...parentBankingRevisionTriggerOptions, document: "bankLoans/{loanId}"},
  async event => publishParentDatasetRevision(event.data, "banking"),
);

exports.parentBankingTransactionChanged = onDocumentWritten(
  {...parentBankingRevisionTriggerOptions, document: "bankTransactions/{transactionId}"},
  async event => publishParentDatasetRevision(event.data, "banking"),
);

exports.parentAttendanceChanged = onDocumentWritten(
  {...parentBankingRevisionTriggerOptions, document: "attendanceRecords/{recordId}"},
  async event => publishParentDatasetRevision(event.data, "attendance"),
);

exports.parentResultReleaseChanged = onDocumentWritten(
  {...parentBankingRevisionTriggerOptions, document: "resultReleases/{releaseId}"},
  async event => {
    const pupilIds = new Set();
    [event.data?.before, event.data?.after].forEach(snapshot => {
      const releasedPupils = snapshot?.data?.()?.releasedPupils;
      if (!Array.isArray(releasedPupils)) return;
      releasedPupils.forEach(pupilId => {
        if (typeof pupilId === "string" && pupilId.trim()) pupilIds.add(pupilId);
      });
    });
    return publishParentDatasetRevisionForPupilIds(pupilIds, "results");
  },
);

function projectionString(value) {
  return typeof value === "string" ? value : "";
}

function projectionNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function projectionIsoDate(value) {
  if (typeof value === "string") return value;
  if (value?.toDate && typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

async function requireParentOwnedPupil(request, pupilId, db) {
  if (
    !request.auth
    || request.auth.token.appUser !== true
    || request.auth.token.isActive !== true
    || request.auth.token.role !== "Parent"
  ) {
    throw new HttpsError("unauthenticated", "A verified parent session is required.");
  }
  const pupil = await db.collection("pupils").doc(pupilId).get();
  const pupilData = pupil.data() || {};
  if (
    !pupil.exists
    || pupilData.parentAccountActive !== true
    || projectionString(pupilData.parentAccountId).trim() !== request.auth.uid
  ) {
    throw new HttpsError("not-found", "The requested child is not available to this account.");
  }
  return pupil;
}

/**
 * The parent application receives this small, account-authorized projection
 * through Firebase Functions. It avoids both raw collection access and a
 * Vercel API request during first download or revision-triggered refresh.
 */
exports.getParentBankingProjection = onCall(
  {region: "us-central1", memory: "256MiB", timeoutSeconds: 60},
  async request => {
    if (!request.auth || request.auth.token.appUser !== true || request.auth.token.isActive !== true) {
      throw new HttpsError("unauthenticated", "A verified application session is required.");
    }
    const pupilId = projectionString(request.data?.pupilId).trim();
    if (!pupilId || pupilId.length > 160) {
      throw new HttpsError("invalid-argument", "A valid pupil is required.");
    }

    const db = admin.firestore();
    await requireParentOwnedPupil(request, pupilId, db);

    const accounts = await db.collection("bankAccounts").where("pupilId", "==", pupilId).limit(2).get();
    if (accounts.size > 1) {
      throw new HttpsError("failed-precondition", "The banking account needs reconciliation by the school.");
    }
    const accountDocument = accounts.docs[0];
    if (!accountDocument) return {account: null, transactions: [], loans: []};

    const [transactionDocuments, loanDocuments] = await Promise.all([
      db.collection("bankTransactions").where("pupilId", "==", pupilId).get(),
      db.collection("bankLoans").where("pupilId", "==", pupilId).get(),
    ]);
    const accountData = accountDocument.data();
    const account = {
      id: accountDocument.id,
      pupilId,
      accountNumber: projectionString(accountData.accountNumber),
      accountName: projectionString(accountData.accountName),
      balance: projectionNumber(accountData.balance),
      ...(typeof accountData.isActive === "boolean" ? {isActive: accountData.isActive} : {}),
      createdAt: projectionIsoDate(accountData.createdAt),
      ...(accountData.updatedAt ? {updatedAt: projectionIsoDate(accountData.updatedAt)} : {}),
    };
    const transactions = transactionDocuments.docs
      .map(document => ({id: document.id, ...document.data()}))
      .filter(transaction => transaction.accountId === account.id)
      .map(transaction => ({
        id: transaction.id,
        pupilId,
        accountId: account.id,
        type: transaction.type,
        amount: projectionNumber(transaction.amount),
        description: projectionString(transaction.description),
        balance: projectionNumber(transaction.balance),
        transactionDate: projectionIsoDate(transaction.transactionDate),
        createdAt: projectionIsoDate(transaction.createdAt),
        ...(transaction.processedBy ? {processedBy: projectionString(transaction.processedBy)} : {}),
        academicYearId: projectionString(transaction.academicYearId),
        termId: projectionString(transaction.termId),
        ...(typeof transaction.isReverted === "boolean" ? {isReverted: transaction.isReverted} : {}),
        ...(transaction.revertedAt ? {revertedAt: projectionIsoDate(transaction.revertedAt)} : {}),
        ...(transaction.revertedBy ? {revertedBy: projectionString(transaction.revertedBy)} : {}),
        ...(transaction.originalTransactionId ? {originalTransactionId: projectionString(transaction.originalTransactionId)} : {}),
      }))
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
    const loans = loanDocuments.docs
      .map(document => ({id: document.id, ...document.data()}))
      .map(loan => ({
        id: loan.id,
        pupilId,
        amount: projectionNumber(loan.amount),
        amountRepaid: projectionNumber(loan.amountRepaid),
        purpose: projectionString(loan.purpose),
        repaymentDate: projectionIsoDate(loan.repaymentDate),
        status: loan.status,
        createdAt: projectionIsoDate(loan.createdAt),
        ...(loan.updatedAt ? {updatedAt: projectionIsoDate(loan.updatedAt)} : {}),
        ...(loan.academicYearId ? {academicYearId: projectionString(loan.academicYearId)} : {}),
        ...(loan.termId ? {termId: projectionString(loan.termId)} : {}),
        ...(loan.cancelledAt ? {cancelledAt: projectionIsoDate(loan.cancelledAt)} : {}),
        ...(loan.cancelledBy ? {cancelledBy: projectionString(loan.cancelledBy)} : {}),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return {account, transactions, loans};
  },
);

/** Returns a parent-owned, read-only attendance history for one verified child. */
exports.getParentAttendanceProjection = onCall(
  {region: "us-central1", memory: "256MiB", timeoutSeconds: 60},
  async request => {
    if (!request.auth || request.auth.token.appUser !== true || request.auth.token.isActive !== true) {
      throw new HttpsError("unauthenticated", "A verified application session is required.");
    }
    const pupilId = projectionString(request.data?.pupilId).trim();
    if (!pupilId || pupilId.length > 160) {
      throw new HttpsError("invalid-argument", "A valid pupil is required.");
    }

    const db = admin.firestore();
    await requireParentOwnedPupil(request, pupilId, db);

    const records = await db.collection("attendanceRecords").where("pupilId", "==", pupilId).get();
    return records.docs
      .map(document => ({id: document.id, ...document.data()}))
      .map(record => ({
        id: record.id,
        pupilId,
        date: projectionIsoDate(record.date),
        classId: projectionString(record.classId),
        ...(record.className ? {className: projectionString(record.className)} : {}),
        ...(record.classCode ? {classCode: projectionString(record.classCode)} : {}),
        status: ["Present", "Absent", "Late", "Excused", "Delayed", ""].includes(record.status) ? record.status : "",
        ...(record.remarks ? {remarks: projectionString(record.remarks)} : {}),
        recordedAt: projectionIsoDate(record.recordedAt),
        ...(record.recordedBy ? {recordedBy: projectionString(record.recordedBy)} : {}),
        academicYearId: projectionString(record.academicYearId),
        termId: projectionString(record.termId),
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  },
);

/**
 * Preserves the existing parent attendance-reason interaction without giving
 * the browser write access to staff-owned attendance documents. The parent may
 * change only the remarks field for a record belonging to their own child.
 */
exports.updateParentAttendanceRemark = onCall(
  {region: "us-central1", memory: "256MiB", timeoutSeconds: 60},
  async request => {
    if (!request.auth || request.auth.token.appUser !== true || request.auth.token.isActive !== true) {
      throw new HttpsError("unauthenticated", "A verified application session is required.");
    }
    const attendanceRecordId = projectionString(request.data?.attendanceRecordId).trim();
    const pupilId = projectionString(request.data?.pupilId).trim();
    const remarks = projectionString(request.data?.remarks).trim();
    if (!attendanceRecordId || attendanceRecordId.length > 160 || !pupilId || pupilId.length > 160 || remarks.length > 200) {
      throw new HttpsError("invalid-argument", "A valid attendance record, pupil, and remark are required.");
    }

    const db = admin.firestore();
    const [, attendanceRecord] = await Promise.all([
      requireParentOwnedPupil(request, pupilId, db),
      db.collection("attendanceRecords").doc(attendanceRecordId).get(),
    ]);
    if (!attendanceRecord.exists || attendanceRecord.data()?.pupilId !== pupilId) {
      throw new HttpsError("not-found", "The attendance record is not available to this account.");
    }

    await attendanceRecord.ref.update({
      remarks,
      parentReportedAt: admin.firestore.FieldValue.serverTimestamp(),
      parentReportedBy: request.auth.uid,
    });
    return {success: true};
  },
);

function parentResultDivision(totalAggregates) {
  if (totalAggregates <= 12) return "I";
  if (totalAggregates <= 24) return "II";
  if (totalAggregates <= 28) return "III";
  if (totalAggregates <= 32) return "IV";
  return "U";
}

function parentResultRemarks(totalAggregates) {
  if (totalAggregates <= 12) return "Excellent";
  if (totalAggregates <= 24) return "Good";
  if (totalAggregates <= 28) return "Fair";
  return "Needs Improvement";
}

/**
 * Returns only the released marks for one verified child. Exam result source
 * documents contain every pupil in a class, so they must never be returned to
 * a parent browser or copied to that browser's offline cache.
 */
exports.getParentResultsProjection = onCall(
  {region: "us-central1", memory: "256MiB", timeoutSeconds: 60},
  async request => {
    if (!request.auth || request.auth.token.appUser !== true || request.auth.token.isActive !== true) {
      throw new HttpsError("unauthenticated", "A verified application session is required.");
    }
    const pupilId = projectionString(request.data?.pupilId).trim();
    if (!pupilId || pupilId.length > 160) {
      throw new HttpsError("invalid-argument", "A valid pupil is required.");
    }

    const db = admin.firestore();
    await requireParentOwnedPupil(request, pupilId, db);

    const releaseDocuments = await db.collection("resultReleases")
      .where("releasedPupils", "array-contains", pupilId)
      .get();
    const results = await Promise.all(releaseDocuments.docs.map(async releaseDocument => {
      const examId = projectionString(releaseDocument.data().examId).trim();
      if (!examId) return null;

      const [examDocument, resultDocuments] = await Promise.all([
        db.collection("exams").doc(examId).get(),
        db.collection("examResults").where("examId", "==", examId).limit(2).get(),
      ]);
      const candidateDocuments = resultDocuments.docs.length
        ? resultDocuments.docs
        : [(await db.collection("examResults").doc(examId).get())].filter(document => document.exists);
      const resultDocument = candidateDocuments.find(document => {
        const candidate = document.data();
        return candidate?.results && candidate.results[pupilId] && Array.isArray(candidate.pupilSnapshots);
      });
      if (!resultDocument) return null;

      const resultData = resultDocument.data();
      const pupilResult = resultData.results[pupilId] || {};
      const pupilSnapshot = (Array.isArray(resultData.pupilSnapshots) ? resultData.pupilSnapshots : [])
        .find(snapshot => snapshot?.pupilId === pupilId);
      if (!pupilSnapshot) return null;

      const examData = examDocument.data() || {};
      const academicYearId = projectionString(examData.academicYearId || resultData.academicYearId);
      const termId = projectionString(examData.termId || resultData.termId);
      const academicYearDocument = academicYearId
        ? await db.collection("academicYears").doc(academicYearId).get()
        : null;
      const academicYearData = academicYearDocument?.data() || {};
      const term = (Array.isArray(academicYearData.terms) ? academicYearData.terms : [])
        .find(item => item?.id === termId);
      const subjectSnapshots = Array.isArray(resultData.subjectSnapshots) ? resultData.subjectSnapshots : [];
      let totalMarks = 0;
      let totalAggregates = 0;
      const subjectResults = [];
      Object.entries(pupilResult).forEach(([subjectId, result]) => {
        const subject = subjectSnapshots.find(snapshot => snapshot?.subjectId === subjectId);
        if (!subject || typeof result?.marks !== "number") return;
        const score = projectionNumber(result.marks);
        const maxMarks = projectionNumber(subject.maxMarks);
        const aggregates = projectionNumber(result.aggregates);
        totalMarks += score;
        totalAggregates += aggregates;
        subjectResults.push({
          subject: projectionString(subject.name),
          subjectCode: projectionString(subject.code),
          score,
          totalMarks: maxMarks,
          grade: projectionString(result.grade) || "-",
          aggregates,
          ...(result.comment ? {comment: projectionString(result.comment)} : {}),
        });
      });
      const maxPossibleMarks = subjectSnapshots.reduce(
        (total, subject) => total + projectionNumber(subject?.maxMarks),
        0,
      );
      const totalScore = maxPossibleMarks > 0 ? Math.round((totalMarks / maxPossibleMarks) * 100) : 0;
      const division = parentResultDivision(totalAggregates);
      return {
        id: resultDocument.id,
        examId,
        examName: projectionString(examData.name) || "Unknown Exam",
        examDate: projectionIsoDate(examData.startDate) || projectionIsoDate(resultData.recordedAt),
        academicYear: projectionString(academicYearData.name) || "Unknown Year",
        term: projectionString(term?.name) || "Unknown Term",
        className: projectionString(pupilSnapshot.classNameAtExam),
        ...(pupilSnapshot.classCodeAtExam ? {classCode: projectionString(pupilSnapshot.classCodeAtExam)} : {}),
        totalScore,
        totalMarks,
        totalAggregates,
        maxPossibleMarks,
        subjectResults,
        grade: division,
        division,
        remarks: parentResultRemarks(totalAggregates),
        recordedAt: projectionIsoDate(resultData.recordedAt),
        ...(resultData.releasedAt ? {releasedAt: projectionIsoDate(resultData.releasedAt)} : {}),
        pupilInfo: {
          name: projectionString(pupilSnapshot.name),
          admissionNumber: projectionString(pupilSnapshot.admissionNumber),
          classNameAtExam: projectionString(pupilSnapshot.classNameAtExam),
        },
      };
    }));
    return results
      .filter(Boolean)
      .sort((left, right) => right.examDate.localeCompare(left.examDate));
  },
);

function normalizeVapidValue(value) {
  return String(value || "").trim().replace(/^['\"]|['\"]$/g, "").replace(/\\n/g, "\n");
}

function getLocalClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: hour * 60 + minute,
  };
}

function normalizeReminderTimes(value) {
  const valid = Array.isArray(value) ? value.filter((time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) : [];
  return Array.from(new Set(valid)).sort();
}

function normalizeRecipientIds(value) {
  const valid = Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.trim() && id.length <= 160)
    : [];
  return Array.from(new Set(valid)).slice(0, 500);
}

function isPupilActiveOnDate(pupil, date) {
  const targetDate = date.split("T")[0];
  if (pupil.status === "Graduated" && pupil.graduationDate) {
    if (targetDate < pupil.graduationDate) return true;
    if (!Array.isArray(pupil.statusChangeHistory) || pupil.statusChangeHistory.length === 0) return false;
  }
  if (!Array.isArray(pupil.statusChangeHistory) || pupil.statusChangeHistory.length === 0) {
    return pupil.status === "Active" || pupil.status === "Pending" || pupil.status === "" || !pupil.status;
  }
  const history = [...pupil.statusChangeHistory].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let status = history[0].fromStatus === "N/A" ? "Active" : history[0].fromStatus;
  for (const entry of history) {
    if (String(entry.date).split("T")[0] <= targetDate) status = entry.toStatus;
    else break;
  }
  return status === "Active" || status === "Pending" || status === "";
}

function isExcludedDate(date, academicYear, excludedDays) {
  const day = new Date(`${date}T12:00:00+03:00`);
  const yyyyMmDd = date;
  return excludedDays.some((rule) => {
    if (academicYear && Array.isArray(rule.skippedYearIds) && rule.skippedYearIds.includes(academicYear.id)) return false;
    if (academicYear && rule.applicableYearId && rule.applicableYearId !== "all" && rule.applicableYearId !== academicYear.id) return false;
    if (rule.type === "specific_date") return String(rule.date || "").slice(0, 10) === yyyyMmDd;
    if (rule.type === "recurring_day_of_week") return day.getDay() === rule.dayOfWeek;
    if (rule.type === "recurring_monthly") return day.getDate() === rule.dayOfMonth;
    if (rule.type === "recurring_annual") return day.getDate() === rule.dayOfMonth && day.getMonth() + 1 === rule.monthOfYear;
    return false;
  });
}

function academicDateValue(value) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value && typeof value.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  return "";
}

function academicYearForTermDate(years, date) {
  return years.find((year) => Array.isArray(year.terms) && year.terms.some((term) => {
    const startDate = academicDateValue(term?.startDate);
    const endDate = academicDateValue(term?.endDate);
    return startDate && endDate && date >= startDate && date <= endDate;
  })) || null;
}

function reminderBody(classNames) {
  if (classNames.length <= 4) return `${classNames.join(", ")} have not recorded attendance today.`;
  return `${classNames.slice(0, 4).join(", ")}, and ${classNames.length - 4} more have not recorded attendance today.`;
}

async function sendAttendanceReminderPush(subscriptions, payload, vapidPublicKey) {
  const privateKey = normalizeVapidValue(VAPID_PRIVATE_KEY.value());
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY Firebase secret is not configured");
  webpush.setVapidDetails(
    normalizeVapidValue(process.env.VAPID_EMAIL) || "mailto:admin@trinity-family-schools.com",
    vapidPublicKey,
    privateKey,
  );
  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}},
        payload,
        {urgency: "high", TTL: 6 * 60 * 60},
      );
      return {sent: true, expired: false, id: subscription.id};
    } catch (error) {
      const status = error?.statusCode;
      return {sent: false, expired: status === 403 || status === 404 || status === 410, id: subscription.id};
    }
  }));
  const settled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return {
    sent: settled.filter((result) => result.sent).length,
    failed: subscriptions.length - settled.filter((result) => result.sent).length,
    expiredIds: settled.filter((result) => result.expired).map((result) => result.id),
  };
}

/*
 * Retired five-minute attendance reminder poller.
 *
 * It remains here temporarily as migration reference only; it is not exported
 * or deployed. Exact-time task queue functions below replace it.
 *
exports.attendanceReminderDispatcher = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: SCHOOL_TIME_ZONE,
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: [VAPID_PRIVATE_KEY],
  },
  async () => {
    const db = admin.firestore();
    const settingsSnapshot = await db.collection("notificationAutomationSettings").doc("current").get();
    const storedSettings = settingsSnapshot.data() || {};
    const categories = storedSettings.categories || {};
    const attendanceSettings = categories.attendance || {};
    if (categories.schoolPay === undefined) categories.schoolPay = true;
    const attendanceEnabled = attendanceSettings.enabled !== false && attendanceSettings.missingReminders !== false;
    if (!attendanceEnabled) return logger.info("Attendance reminder dispatcher skipped: disabled in settings.");

    const reminderSettings = storedSettings.attendanceReminders || {};
    const times = normalizeReminderTimes(reminderSettings.times);
    const effectiveTimes = times.length ? times : ["08:30", "11:30", "14:00"];
    const clock = getLocalClock();
    const dueSlots = effectiveTimes.filter((time) => isDueSlot(time, clock.minutes));
    if (!dueSlots.length) return;

    const [academicSnapshot, excludedSnapshot, classesSnapshot, pupilsSnapshot, summarySnapshot, usersSnapshot] = await Promise.all([
      db.collection("academicYears").get(),
      db.collection("excludedDays").get(),
      db.collection("classes").orderBy("order", "asc").get(),
      db.collection("pupils").get(),
      db.collection("attendanceDailySummaries").doc(clock.date).get(),
      db.collection("system_users").get(),
    ]);
    const years = academicSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const academicYear = academicYearForTermDate(years, clock.date);
    const excludedDays = excludedSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (!academicYear || isExcludedDate(clock.date, academicYear, excludedDays)) {
      return logger.info("Attendance reminder dispatcher skipped: excluded school date.", {date: clock.date});
    }

    const classes = classesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const classById = new Map(classes.map((classItem) => [classItem.id, classItem]));
    const expectedClassIds = new Set(
      pupilsSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}))
        .filter((pupil) => pupil.classId && classById.has(pupil.classId) && isPupilActiveOnDate(pupil, clock.date))
        .map((pupil) => pupil.classId),
    );
    const summary = summarySnapshot.data() || {};
    const hasCompletionMap = summary.completedClasses && typeof summary.completedClasses === "object" && !Array.isArray(summary.completedClasses);
    const completedClassIds = new Set(hasCompletionMap
      ? Object.keys(summary.completedClasses)
      : Array.from(new Set((Array.isArray(summary.records) ? summary.records : []).map((record) => record?.classId).filter(Boolean))),
    );
    const missingClassIds = [...expectedClassIds].filter((classId) => !completedClassIds.has(classId));
    const missingClassNames = missingClassIds.map((classId) => classById.get(classId)?.name || classById.get(classId)?.code || classId);
    const recipientIds = usersSnapshot.docs
      .filter((doc) => doc.data().isActive !== false)
      .filter((doc) => {
        const user = doc.data();
        if (user.role === "Admin") return true;
        if (user.role !== "Staff") return false;
        const granular = (user.granularPermissions || []).find((module) => module.moduleId === "reports");
        const page = granular?.pages?.find((item) => item.pageId === "dashboard");
        if (page) return Boolean(page.canAccess && page.actions?.some((action) => action.actionId === "view_stat_attendance_today" && action.allowed));
        return (user.modulePermissions || []).some((permission) => permission.module === "reports");
      })
      .map((doc) => doc.id);

    for (const slot of dueSlots) {
      const runRef = db.collection("attendanceReminderRuns").doc(`${clock.date}_${slot.replace(":", "")}`);
      const claimed = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(runRef);
        const data = current.data() || {};
        if (data.status === "completed" || data.status === "skipped") return false;
        if (data.status === "processing" && Number(data.processingStartedAt || 0) > Date.now() - PROCESSING_LEASE_MS) return false;
        transaction.set(runRef, {
          status: "processing",
          date: clock.date,
          slot,
          processingStartedAt: Date.now(),
          attempts: Number(data.attempts || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        return true;
      });
      if (!claimed) continue;

      if (!missingClassIds.length || !recipientIds.length) {
        await runRef.set({
          status: "skipped",
          reason: missingClassIds.length ? "No eligible recipients." : "All expected classes have recorded attendance.",
          missingClassIds,
          missingClassNames,
          recipientCount: recipientIds.length,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        continue;
      }

      try {
        const vapidPublicKey = normalizeVapidValue(process.env.VAPID_PUBLIC_KEY) || DEFAULT_VAPID_PUBLIC_KEY;
        const subscriptionsSnapshot = await Promise.all(
          Array.from({length: Math.ceil(recipientIds.length / 10)}, (_, index) => recipientIds.slice(index * 10, index * 10 + 10))
            .map((userIds) => db.collection("pushSubscriptions").where("userId", "in", userIds).where("isActive", "==", true).get()),
        );
        const subscriptions = subscriptionsSnapshot.flatMap((snapshot) => snapshot.docs)
          .map((doc) => ({id: doc.id, ...doc.data()}))
          .filter((subscription) => subscription.vapidPublicKey === vapidPublicKey && subscription.endpoint && subscription.p256dh && subscription.auth);
        const push = await sendAttendanceReminderPush(subscriptions, JSON.stringify({
          title: `Attendance reminder — ${missingClassIds.length} class${missingClassIds.length === 1 ? "" : "es"} pending`,
          body: reminderBody(missingClassNames),
          icon: "/trinity-logo-192.png",
          badge: "/icons/trinity-badge-72.png",
          tag: `attendance-reminder-${clock.date}-${slot.replace(":", "")}`,
          url: `/attendance/view?reportType=school&trendPeriod=daily&date=${encodeURIComponent(clock.date)}`,
          requireInteraction: true,
        }), vapidPublicKey);
        if (push.expiredIds.length) {
          await Promise.all(push.expiredIds.map((id) => db.collection("pushSubscriptions").doc(id).set({
            isActive: false,
            deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            deactivationReason: "push-endpoint-expired",
          }, {merge: true})));
        }
        await runRef.set({
          status: "completed",
          missingClassIds,
          missingClassNames,
          recipientCount: recipientIds.length,
          pushSent: push.sent,
          pushFailed: push.failed,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        logger.info("Attendance reminder dispatched.", {date: clock.date, slot, missingClasses: missingClassIds.length, pushSent: push.sent});
      } catch (error) {
        await runRef.set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown reminder push error",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        logger.error("Attendance reminder push failed.", {date: clock.date, slot, error});
      }
    }
  },
);

*/

function attendanceReminderConfiguration(storedSettings) {
  const categories = storedSettings?.categories || {};
  const attendance = categories.attendance || {};
  const reminders = storedSettings?.attendanceReminders || {};
  const recipients = storedSettings?.recipients || {};
  const times = normalizeReminderTimes(reminders.times);
  return {
    enabled: attendance.enabled !== false && attendance.missingReminders !== false,
    times: times.length ? times : ["08:30", "11:30", "14:00"],
    schoolDaysOnly: reminders.schoolDaysOnly !== false,
    recipientMode: recipients.mode === "custom" ? "custom" : "automatic",
    recipientUserIds: normalizeRecipientIds(recipients.attendanceMissing),
  };
}

function attendanceReminderFingerprint(config) {
  return JSON.stringify({
    enabled: config.enabled,
    times: config.times,
    schoolDaysOnly: config.schoolDaysOnly,
    recipientMode: config.recipientMode,
    recipientUserIds: config.recipientUserIds,
  });
}

function toKampalaScheduleTime(date, time) {
  // Kampala uses a fixed UTC+03:00 offset and has no daylight-saving transition.
  return new Date(`${date}T${time}:00+03:00`);
}

function taskIdForAttendanceReminder(date, slot, version, fingerprint) {
  const digest = createHash("sha256")
    .update(`${date}|${slot}|${version}|${fingerprint}`)
    .digest("hex");
  return `attendance-reminder-${digest}`;
}

function taskAlreadyExists(error) {
  return String(error?.code || "").includes("task-already-exists")
    || String(error?.message || "").includes("already exists");
}

function className(classItem) {
  return classItem?.name || classItem?.className || classItem?.code || classItem?.classCode || classItem?.id;
}

function completedClassIds(summary) {
  const completed = summary?.completedClasses;
  if (completed && typeof completed === "object" && !Array.isArray(completed)) return new Set(Object.keys(completed));
  return new Set(
    (Array.isArray(summary?.records) ? summary.records : [])
      .map((record) => record?.classId)
      .filter(Boolean),
  );
}

async function getAttendanceReminderRecipients(db, recipientMode = "automatic", selectedRecipientIds = []) {
  const usersSnapshot = await db.collection("system_users").get();
  const eligibleUserIds = usersSnapshot.docs
    .filter((doc) => doc.data().isActive !== false)
    .filter((doc) => {
      const user = doc.data();
      if (user.role === "Admin") return true;
      if (user.role !== "Staff") return false;
      const granular = (user.granularPermissions || []).find((module) => module.moduleId === "reports");
      const page = granular?.pages?.find((item) => item.pageId === "dashboard");
      if (page) return Boolean(page.canAccess && page.actions?.some((action) => action.actionId === "view_stat_attendance_today" && action.allowed));
      return (user.modulePermissions || []).some((permission) => permission.module === "reports");
    })
    .map((doc) => doc.id);
  if (recipientMode !== "custom") return eligibleUserIds;
  const selected = new Set(normalizeRecipientIds(selectedRecipientIds));
  return eligibleUserIds.filter((userId) => selected.has(userId));
}

async function getActiveAttendanceReminderSubscriptions(db, recipientIds) {
  const vapidPublicKey = normalizeVapidValue(process.env.VAPID_PUBLIC_KEY) || DEFAULT_VAPID_PUBLIC_KEY;
  const snapshots = await Promise.all(
    Array.from({length: Math.ceil(recipientIds.length / 10)}, (_, index) => recipientIds.slice(index * 10, index * 10 + 10))
      .map((userIds) => db.collection("pushSubscriptions").where("userId", "in", userIds).where("isActive", "==", true).get()),
  );
  const subscriptions = snapshots.flatMap((snapshot) => snapshot.docs)
    .map((doc) => ({id: doc.id, ...doc.data()}))
    .filter((subscription) => subscription.vapidPublicKey === vapidPublicKey && subscription.endpoint && subscription.p256dh && subscription.auth);
  return {subscriptions, vapidPublicKey};
}

async function writeAttendanceReminderPlanState(ref, currentPlan, values) {
  const version = Number(currentPlan?.version || 0) + 1;
  await ref.set({
    ...values,
    version,
    queuedSlots: [],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return version;
}

/**
 * Plans future reminder tasks once per day (or when reminder settings change).
 * The roster scan is performed here, never in an individual reminder task.
 */
async function planAttendanceRemindersForDate(date, {now = new Date(), reason = "daily"} = {}) {
  const db = admin.firestore();
  const planRef = db.collection(ATTENDANCE_REMINDER_PLANS).doc(date);
  const [settingsSnapshot, academicSnapshot, excludedSnapshot, planSnapshot] = await Promise.all([
    db.collection("notificationAutomationSettings").doc("current").get(),
    db.collection("academicYears").get(),
    db.collection("excludedDays").get(),
    planRef.get(),
  ]);
  const config = attendanceReminderConfiguration(settingsSnapshot.data() || {});
  const fingerprint = attendanceReminderFingerprint(config);
  const currentPlan = planSnapshot.exists ? planSnapshot.data() || {} : null;
  const sameConfiguration = currentPlan?.settingsFingerprint === fingerprint;
  const years = academicSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
  const academicYear = academicYearForTermDate(years, date);
  const excludedDays = excludedSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));

  if (!config.enabled) {
    await writeAttendanceReminderPlanState(planRef, currentPlan, {
      date,
      status: "disabled",
      reason: "Attendance reminder notifications are disabled.",
      settingsFingerprint: fingerprint,
      times: config.times,
      schoolDaysOnly: config.schoolDaysOnly,
      planningReason: reason,
    });
    return {status: "disabled", date};
  }

  if (!academicYear || isExcludedDate(date, academicYear, excludedDays)) {
    await writeAttendanceReminderPlanState(planRef, currentPlan, {
      date,
      status: "skipped",
      reason: academicYear ? "Excluded school date." : "Outside an active academic term.",
      settingsFingerprint: fingerprint,
      times: config.times,
      schoolDaysOnly: config.schoolDaysOnly,
      planningReason: reason,
    });
    return {status: "skipped", date};
  }

  const futureSlots = config.times.filter((slot) => toKampalaScheduleTime(date, slot).getTime() > now.getTime());
  if (!futureSlots.length) {
    await writeAttendanceReminderPlanState(planRef, currentPlan, {
      date,
      status: "elapsed",
      reason: "No configured reminder times remain today.",
      settingsFingerprint: fingerprint,
      times: config.times,
      schoolDaysOnly: config.schoolDaysOnly,
      planningReason: reason,
    });
    return {status: "elapsed", date};
  }

  if (sameConfiguration && currentPlan?.status === "ready") {
    const queuedSlots = new Set(Array.isArray(currentPlan.queuedSlots) ? currentPlan.queuedSlots : []);
    if (futureSlots.every((slot) => queuedSlots.has(slot))) return {status: "ready", date, reused: true};
  }

  const [classesSnapshot, pupilsSnapshot] = await Promise.all([
    db.collection("classes").orderBy("order", "asc").get(),
    db.collection("pupils").get(),
  ]);
  const classes = classesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
  const classById = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const expectedClassIds = Array.from(new Set(
    pupilsSnapshot.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .filter((pupil) => pupil.classId && classById.has(pupil.classId) && isPupilActiveOnDate(pupil, date))
      .map((pupil) => pupil.classId),
  ));
  const expectedClassNames = Object.fromEntries(expectedClassIds.map((id) => [id, className(classById.get(id)) || id]));
  const version = sameConfiguration && currentPlan?.status === "ready"
    ? Number(currentPlan.version || 1)
    : Number(currentPlan?.version || 0) + 1;
  const queuedSlots = sameConfiguration && currentPlan?.status === "ready"
    ? new Set(Array.isArray(currentPlan.queuedSlots) ? currentPlan.queuedSlots : [])
    : new Set();

  await planRef.set({
    date,
    status: "ready",
    version,
    settingsFingerprint: fingerprint,
    times: config.times,
    queuedSlots: Array.from(queuedSlots),
    schoolDaysOnly: config.schoolDaysOnly,
    recipientMode: config.recipientMode,
    recipientUserIds: config.recipientUserIds,
    academicYearId: academicYear.id,
    expectedClassIds,
    expectedClassNames,
    planningReason: reason,
    plannedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  const queue = getFunctions().taskQueue(ATTENDANCE_REMINDER_TASK_FUNCTION);
  for (const slot of futureSlots) {
    if (queuedSlots.has(slot)) continue;
    const taskId = taskIdForAttendanceReminder(date, slot, version, fingerprint);
    try {
      await queue.enqueue(
        {date, slot, planVersion: version, settingsFingerprint: fingerprint},
        {id: taskId, scheduleTime: toKampalaScheduleTime(date, slot), dispatchDeadlineSeconds: 120},
      );
    } catch (error) {
      if (!taskAlreadyExists(error)) {
        await planRef.set({
          lastEnqueueError: error instanceof Error ? error.message : "Unable to enqueue reminder task.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        throw error;
      }
    }
    queuedSlots.add(slot);
    await planRef.set({
      queuedSlots: Array.from(queuedSlots),
      lastEnqueueError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }

  logger.info("Attendance reminder plan is ready.", {date, version, queuedSlots: futureSlots.length, expectedClasses: expectedClassIds.length, reason});
  return {status: "ready", date, version, queuedSlots: futureSlots.length};
}

/* Legacy Firebase scheduler. Disabled by default because the Spark-compatible
 * GitHub Actions/Vercel dispatcher is the production owner. */
if (ENABLE_FIREBASE_ATTENDANCE_REMINDERS) {
/** Runs once daily; Cloud Tasks handles the exact user-configured times. */
exports.attendanceReminderPlanner = onSchedule(
  {
    schedule: "5 0 * * *",
    timeZone: SCHOOL_TIME_ZONE,
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const clock = getLocalClock();
    await planAttendanceRemindersForDate(clock.date, {reason: "daily"});
  },
);

/** Replans only future slots when an administrator changes reminder settings. */
exports.attendanceReminderSettingsChanged = onDocumentWritten(
  {
    document: "notificationAutomationSettings/current",
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const beforeFingerprint = event.data?.before?.exists
      ? attendanceReminderFingerprint(attendanceReminderConfiguration(event.data.before.data() || {}))
      : null;
    const afterFingerprint = attendanceReminderFingerprint(attendanceReminderConfiguration(after.data() || {}));
    if (beforeFingerprint === afterFingerprint) return;
    const clock = getLocalClock();
    await planAttendanceRemindersForDate(clock.date, {reason: "settings-change"});
  },
);

/**
 * Executes at an exact configured time. User and subscription reads happen only
 * after the compact plan and daily attendance summary show a push is needed.
 */
exports.attendanceReminderTask = onTaskDispatched(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
    invoker: "private",
    secrets: [VAPID_PRIVATE_KEY],
    retryConfig: {maxAttempts: 3, maxRetrySeconds: 15 * 60, minBackoffSeconds: 60, maxBackoffSeconds: 5 * 60, maxDoublings: 3},
    rateLimits: {maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1},
  },
  async (request) => {
    const {date, slot, planVersion, settingsFingerprint} = request.data || {};
    const taskExecutionId = String(request.id || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(slot || "") || !Number.isInteger(planVersion) || typeof settingsFingerprint !== "string") {
      logger.error("Attendance reminder task ignored: invalid payload.", {data: request.data});
      return;
    }

    const db = admin.firestore();
    const planRef = db.collection(ATTENDANCE_REMINDER_PLANS).doc(date);
    const runRef = db.collection(ATTENDANCE_REMINDER_RUNS).doc(`${date}_${slot.replace(":", "")}`);
    const claim = await db.runTransaction(async (transaction) => {
      const [planSnapshot, runSnapshot] = await Promise.all([transaction.get(planRef), transaction.get(runRef)]);
      const plan = planSnapshot.data() || {};
      if (!planSnapshot.exists || plan.status !== "ready" || Number(plan.version) !== planVersion || plan.settingsFingerprint !== settingsFingerprint || !Array.isArray(plan.times) || !plan.times.includes(slot)) {
        return {claimed: false, reason: "stale-or-inactive-plan"};
      }
      const run = runSnapshot.data() || {};
      if (run.status === "completed" || run.status === "skipped") return {claimed: false, reason: "already-finished"};
      if (run.status === "processing" && Number(run.processingStartedAt || 0) > Date.now() - PROCESSING_LEASE_MS && run.processingTaskId !== taskExecutionId) {
        return {claimed: false, reason: "active-lease"};
      }
      transaction.set(runRef, {
        status: "processing",
        date,
        slot,
        planVersion,
        processingStartedAt: Date.now(),
        processingTaskId: taskExecutionId,
        attempts: Number(run.attempts || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return {
        claimed: true,
        expectedClassIds: Array.isArray(plan.expectedClassIds) ? plan.expectedClassIds : [],
        expectedClassNames: plan.expectedClassNames && typeof plan.expectedClassNames === "object" ? plan.expectedClassNames : {},
        recipientMode: plan.recipientMode === "custom" ? "custom" : "automatic",
        recipientUserIds: normalizeRecipientIds(plan.recipientUserIds),
      };
    });
    if (!claim.claimed) {
      logger.info("Attendance reminder task skipped.", {date, slot, reason: claim.reason});
      return;
    }

    // Re-check the live calendar at execution time. An administrator may add
    // an excluded day after this task was planned but before its send time.
    const [academicSnapshot, excludedSnapshot] = await Promise.all([
      db.collection("academicYears").get(),
      db.collection("excludedDays").get(),
    ]);
    const liveAcademicYears = academicSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const liveAcademicYear = academicYearForTermDate(liveAcademicYears, date);
    const liveExcludedDays = excludedSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (!liveAcademicYear || isExcludedDate(date, liveAcademicYear, liveExcludedDays)) {
      await runRef.set({
        status: "skipped",
        reason: liveAcademicYear ? "Excluded school date." : "Outside an active academic term.",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.info("Attendance reminder task skipped after live calendar check.", {date, slot});
      return;
    }

    const summarySnapshot = await db.collection("attendanceDailySummaries").doc(date).get();
    const completed = completedClassIds(summarySnapshot.data() || {});
    const missingClassIds = claim.expectedClassIds.filter((classId) => !completed.has(classId));
    const missingClassNames = missingClassIds.map((classId) => claim.expectedClassNames[classId] || classId);
    if (!missingClassIds.length) {
      await runRef.set({
        status: "skipped",
        reason: "All expected classes have recorded attendance.",
        missingClassIds,
        missingClassNames,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return;
    }

    try {
      const recipientIds = await getAttendanceReminderRecipients(
        db,
        claim.recipientMode,
        claim.recipientUserIds,
      );
      if (!recipientIds.length) {
        await runRef.set({
          status: "skipped",
          reason: "No eligible recipients.",
          missingClassIds,
          missingClassNames,
          recipientCount: 0,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        return;
      }
      const {subscriptions, vapidPublicKey} = await getActiveAttendanceReminderSubscriptions(db, recipientIds);
      const push = await sendAttendanceReminderPush(subscriptions, JSON.stringify({
        title: `Attendance reminder — ${missingClassIds.length} class${missingClassIds.length === 1 ? "" : "es"} pending`,
        body: reminderBody(missingClassNames),
        icon: "/trinity-logo-192.png",
        badge: "/icons/trinity-badge-72.png",
        tag: `attendance-reminder-${date}-${slot.replace(":", "")}`,
        url: `/attendance/view?reportType=school&trendPeriod=daily&date=${encodeURIComponent(date)}`,
        requireInteraction: true,
      }), vapidPublicKey);
      if (push.expiredIds.length) {
        await Promise.all(push.expiredIds.map((id) => db.collection("pushSubscriptions").doc(id).set({
          isActive: false,
          deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          deactivationReason: "push-endpoint-expired",
        }, {merge: true})));
      }
      await runRef.set({
        status: "completed",
        missingClassIds,
        missingClassNames,
        recipientCount: recipientIds.length,
        pushSent: push.sent,
        pushFailed: push.failed,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.info("Attendance reminder dispatched.", {date, slot, missingClasses: missingClassIds.length, pushSent: push.sent});
    } catch (error) {
      await runRef.set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown reminder push error",
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.error("Attendance reminder push failed.", {date, slot, error});
      throw error;
    }
  },
);
}

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// SMS API Functions
const cors = require('cors')({
  origin: true,
  credentials: true
});

// SMS Bulk Send Function
exports.smsBulk = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed' });
          return;
        }

        const { message, recipients, retryAttempt = 0, networkSpecific = true } = req.body;

        console.log('SMS Request Details:', {
          recipientCount: recipients?.length || 0,
          messageLength: message?.length || 0,
          activeProvider: 'Wiza SMS',
          retryAttempt: retryAttempt,
          networkSpecific: networkSpecific
        });
        
        // Force deployment update - Wiza SMS provider support and balance checking added

        // Validate request
        if (!message || !recipients || recipients.length === 0) {
          res.status(400).json({ error: 'Message and recipients are required' });
          return;
        }

        // Wiza SMS expects international phone-number format.
        const validatedRecipients = recipients.map(phone => {
          // Remove any spaces, dashes, or other formatting
          let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
          
          // Add country code if not present (assuming Uganda +256)
          if (!cleanPhone.startsWith('+')) {
            if (cleanPhone.startsWith('0')) {
              cleanPhone = '+256' + cleanPhone.substring(1);
            } else if (cleanPhone.startsWith('256')) {
              cleanPhone = '+' + cleanPhone;
            } else {
              cleanPhone = '+256' + cleanPhone;
            }
          }
          
          return cleanPhone;
        });

        console.log('Processing SMS request:', {
          recipientCount: validatedRecipients.length,
          messageLength: message.length,
          retryAttempt,
          networkSpecific
        });

        const wizaPayload = {
          username: process.env.WIZA_SMS_USERNAME || '',
          password: process.env.WIZA_SMS_PASSWORD || '',
          senderId: process.env.WIZA_SMS_SENDER_ID || 'TRINITY',
          message,
          recipients: validatedRecipients.join(',')
        };

        if (!wizaPayload.username || !wizaPayload.password) {
          res.status(500).json({
            success: false,
            error: 'Wiza SMS credentials are not configured.'
          });
          return;
        }

        console.log('Sending with Wiza SMS:', {
          senderId: wizaPayload.senderId,
          messageLength: wizaPayload.message.length,
          recipientCount: validatedRecipients.length
        });

        const response = await fetch('https://wizasms.ug/API/V1/send-bulk-sms', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(wizaPayload)
        });

        const responseData = await response.json().catch(() => ({}));
        if (!response.ok || !responseData.success) {
          res.status(response.ok ? 400 : response.status).json({
            success: false,
            error: `Wiza SMS API Error: ${responseData.messages || responseData.message || 'Unknown error'}`
          });
          return;
        }

        const successful = responseData.data?.recipients_count || validatedRecipients.length;
        const cost = responseData.data?.cost || 0;
        res.json({
          success: true,
          message: `Messages sent to ${successful} recipients via Wiza SMS`,
          recipientCount: successful,
          messageId: responseData.data?.message_id || `wiza_${Date.now()}`,
          cost: `UGX ${(cost / 100).toFixed(4)}`,
          details: {
            total: validatedRecipients.length,
            successful,
            failed: Math.max(0, validatedRecipients.length - successful),
            blocked: 0,
            mtnBlocked: 0
          }
        });

      } catch (error) {
        console.error('SMS bulk API error:', error);
        res.status(500).json({ error: `SMS service error: ${error.message}` });
      }
    });
  }
);

// SMS Auto Top-up Function
exports.smsAutoTopup = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        const admin = require('firebase-admin');
        
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
          admin.initializeApp();
        }
        
        const db = admin.firestore();

        if (req.method === 'GET') {
          // Fetch auto top-up configuration
          const userId = req.query.userId;

          if (!userId) {
            res.status(400).json({ 
              success: false,
              error: 'User ID is required' 
            });
            return;
          }

          console.log('Fetching auto top-up config for user:', userId);

          const configDoc = await db.collection('autoTopUpConfigs').doc(userId).get();
          
          if (!configDoc.exists) {
            res.json({
              success: false,
              error: 'Auto top-up configuration not found',
              config: null
            });
            return;
          }

          const config = configDoc.data();
          
          res.json({
            success: true,
            config: {
              ...config,
              createdAt: config.createdAt || new Date().toISOString(),
              updatedAt: config.updatedAt || new Date().toISOString()
            }
          });

        } else if (req.method === 'POST') {
          // Create auto top-up configuration
          const { 
            userId, 
            enabled, 
            threshold, 
            amount, 
            currency, 
            paymentMethod, 
            phoneNumber, 
            provider,
            maxTopUpsPerDay = 3
          } = req.body;

          if (!userId || threshold === undefined || amount === undefined || !currency || !paymentMethod) {
            res.status(400).json({ 
              success: false,
              error: 'Missing required fields: userId, threshold, amount, currency, paymentMethod' 
            });
            return;
          }

          console.log('Creating auto top-up config for user:', userId);

          const config = {
            userId,
            enabled: Boolean(enabled),
            threshold: Number(threshold),
            amount: Number(amount),
            currency,
            paymentMethod,
            phoneNumber,
            provider,
            maxTopUpsPerDay,
            topUpCount: 0,
            lastTopUpDate: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await db.collection('autoTopUpConfigs').doc(userId).set(config);

          res.json({
            success: true,
            message: 'Auto top-up configuration created successfully',
            config
          });

        } else if (req.method === 'PUT') {
          // Update configuration or trigger auto top-up
          const body = req.body;
          
          if (body.currentBalance !== undefined) {
            // Auto top-up trigger request
            const { userId, currentBalance } = body;

            if (!userId || currentBalance === undefined) {
              res.status(400).json({ 
                success: false,
                error: 'User ID and current balance are required' 
              });
              return;
            }

            console.log('Checking auto top-up trigger for user:', userId, 'Balance:', currentBalance);

            const configDoc = await db.collection('autoTopUpConfigs').doc(userId).get();
            
            if (!configDoc.exists) {
              res.json({
                success: false,
                error: 'Auto top-up configuration not found'
              });
              return;
            }

            const config = configDoc.data();

            if (!config.enabled) {
              res.json({
                success: false,
                error: 'Auto top-up is disabled'
              });
              return;
            }

            if (parseFloat(currentBalance) >= config.threshold) {
              res.json({
                success: false,
                error: 'Balance is above threshold, no top-up needed'
              });
              return;
            }

            // Return simulation response
            res.json({
              success: true,
              message: 'Auto top-up would be triggered (simulation)',
              triggered: true,
              transactionId: `sim_${Date.now()}`,
              instructions: `Would top up ${config.currency} ${config.amount} via ${config.paymentMethod}`
            });

          } else {
            // Configuration update request
            const { userId } = body;

            if (!userId) {
              res.status(400).json({ 
                success: false,
                error: 'User ID is required' 
              });
              return;
            }

            console.log('Updating auto top-up config for user:', userId);

            const updates = {
              updatedAt: new Date().toISOString()
            };

            // Add fields that are being updated
            Object.keys(body).forEach(key => {
              if (key !== 'userId' && body[key] !== undefined) {
                updates[key] = body[key];
              }
            });

            await db.collection('autoTopUpConfigs').doc(userId).update(updates);

            res.json({
              success: true,
              message: 'Auto top-up configuration updated successfully'
            });
          }

        } else {
          res.status(405).json({ error: 'Method not allowed' });
        }

      } catch (error) {
        console.error('Auto top-up API error:', error);
        res.status(500).json({ 
          success: false,
          error: error.message || 'Failed to process auto top-up request' 
        });
      }
    });
  }
);

const isDev = process.env.NODE_ENV !== "production";
const nextjsDistDir = require("./next.config.js").distDir || ".next";

const nextjsServer = next({
  dev: isDev,
  conf: {
    distDir: nextjsDistDir,
  },
});

const nextjsHandle = nextjsServer.getRequestHandler();

// Wiza SMS Balance Check Function
exports.wizaSMSBalance = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed' });
          return;
        }

        const { username, password } = req.body;

        if (!username || !password) {
          return res.status(400).json({
            success: false,
            error: 'Username and password are required'
          });
        }

        console.log('Checking Wiza SMS balance for username:', username);

        // Try to get balance from Wiza SMS API
        const balanceEndpoints = [
          'https://wizasms.ug/API/V1/balance',
          'https://wizasms.ug/API/V1/account-balance',
          'https://wizasms.ug/API/V1/get-balance'
        ];

        for (const endpoint of balanceEndpoints) {
          try {
            console.log(`Trying Wiza SMS balance endpoint: ${endpoint}`);
            
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                username: username,
                password: password
              })
            });

            if (response.ok) {
              const data = await response.json();
              console.log('Wiza SMS balance API response:', data);
              
              if (data.success && (data.balance || data.amount || data.accountBalance)) {
                const balance = data.balance || data.amount || data.accountBalance;
                return res.json({
                  success: true,
                  balance: balance.toString(),
                  currency: 'UGX',
                  source: 'real-api'
                });
              }
            }
          } catch (endpointError) {
            console.log(`Endpoint ${endpoint} failed:`, endpointError);
            continue;
          }
        }

        // If no real API works, return estimated balance
        console.log('No real Wiza SMS balance API available, returning estimated balance');
        return res.json({
          success: true,
          balance: '15000.00',
          currency: 'UGX',
          source: 'estimated',
          message: 'Real balance API not available, showing estimated balance'
        });

      } catch (error) {
        console.error('Error in Wiza SMS balance check:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check Wiza SMS balance'
        });
      }
    });
  }
);

exports.nextjsFunc = onRequest(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    await nextjsServer.prepare();
    return nextjsHandle(req, res);
  }
);
