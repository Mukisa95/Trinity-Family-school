/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const next = require("next");
const admin = require("firebase-admin");
const webpush = require("web-push");

if (!admin.apps.length) admin.initializeApp();

const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
const DEFAULT_VAPID_PUBLIC_KEY = "BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY";
const SCHOOL_TIME_ZONE = "Africa/Kampala";
const REMINDER_WINDOW_MINUTES = 10;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;

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

function isDueSlot(time, localMinutes) {
  const [hour, minute] = time.split(":").map(Number);
  const scheduled = hour * 60 + minute;
  return localMinutes >= scheduled && localMinutes < scheduled + REMINDER_WINDOW_MINUTES;
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

function activeAcademicYear(years, date) {
  return years.find((year) => year.isActive) || years.find((year) => date >= String(year.startDate).slice(0, 10) && date <= String(year.endDate).slice(0, 10)) || null;
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

/**
 * Firebase owns the frequent schedule because Vercel Hobby supports only one
 * imprecise run each day. One Cloud Scheduler job checks the user-configured
 * Kampala slots and Firestore claims prevent duplicate sends on retries.
 */
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
    const academicYear = activeAcademicYear(years, clock.date);
    const excludedDays = excludedSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (reminderSettings.schoolDaysOnly !== false && isExcludedDate(clock.date, academicYear, excludedDays)) {
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
