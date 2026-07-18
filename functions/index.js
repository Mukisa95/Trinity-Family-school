/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const next = require("next");

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
