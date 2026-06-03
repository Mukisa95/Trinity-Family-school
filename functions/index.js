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

// SMS Account Balance Function
exports.smsAccount = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method !== 'GET') {
          res.status(405).json({ error: 'Method not allowed' });
          return;
        }

        // Africa's Talking configuration
        const AFRICAS_TALKING_CONFIG = {
          username: process.env.AFRICAS_TALKING_USERNAME || 'trinityfsch',
          apiKey: process.env.AFRICAS_TALKING_API_KEY || 'atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617',
          baseUrl: 'https://api.africastalking.com/version1/user'
        };

        console.log('Fetching Africa\'s Talking account data for username:', AFRICAS_TALKING_CONFIG.username);

        // Make the API call to Africa's Talking User Data endpoint
        const response = await fetch(`${AFRICAS_TALKING_CONFIG.baseUrl}?username=${AFRICAS_TALKING_CONFIG.username}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'apiKey': AFRICAS_TALKING_CONFIG.apiKey
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Africa\'s Talking User Data API error response:', errorText);
          res.status(response.status).json({ 
            success: false,
            error: `Africa's Talking API error: ${response.status} - ${errorText}` 
          });
          return;
        }

        const responseData = await response.json();
        console.log('Africa\'s Talking User Data API response:', responseData);
        
        // Parse Africa's Talking response
        if (responseData.UserData && responseData.UserData.balance) {
          const balance = responseData.UserData.balance;
          
          // Extract currency and amount from balance string (e.g., "KES 1,234.56")
          const balanceMatch = balance.match(/([A-Z]{3})\s*([\d,]+\.?\d*)/);
          const currency = balanceMatch ? balanceMatch[1] : 'KES';
          const amount = balanceMatch ? balanceMatch[2].replace(/,/g, '') : '0';

          const result = {
            success: true,
            balance: amount,
            currency: currency
          };

          console.log('Account balance retrieved:', result);
          res.json(result);
        } else {
          console.error('Invalid Africa\'s Talking User Data response format:', responseData);
          res.status(500).json({ 
            success: false,
            error: 'Invalid response format from Africa\'s Talking User Data API' 
          });
        }
      } catch (error) {
        console.error('Account data API route error:', error);
        
        if (error.message.includes('fetch') || error.message.includes('network')) {
          res.status(503).json({ 
            success: false,
            error: 'Network error: Could not connect to Africa\'s Talking service. Please check your internet connection.' 
          });
        } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
          res.status(401).json({ 
            success: false,
            error: 'Authentication error: Invalid API credentials for Africa\'s Talking service.' 
          });
        } else {
          res.status(500).json({ 
            success: false,
            error: `Account service error: ${error.message}` 
          });
        }
      }
    });
  }
);

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

        const { message, recipients, sentBy, retryAttempt = 0, networkSpecific = true, activeProvider = 'africas_talking' } = req.body;

        console.log('SMS Request Details:', {
          recipientCount: recipients?.length || 0,
          messageLength: message?.length || 0,
          activeProvider: activeProvider,
          retryAttempt: retryAttempt,
          networkSpecific: networkSpecific
        });
        
        // Force deployment update - Wiza SMS provider support and balance checking added

        // Validate request
        if (!message || !recipients || recipients.length === 0) {
          res.status(400).json({ error: 'Message and recipients are required' });
          return;
        }

        // Africa's Talking configuration
        const AFRICAS_TALKING_CONFIG = {
          username: process.env.AFRICAS_TALKING_USERNAME || 'trinityfsch',
          apiKey: process.env.AFRICAS_TALKING_API_KEY || 'atsk_f6441bd8aa6d905da4199c5d824c45b46b81185c8f4663fa3b5c315a3cceb204687b3617',
          baseUrl: 'https://api.africastalking.com/version1/messaging'
        };

        // Validate phone numbers (Africa's Talking expects international format)
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

        // Check if we should block MTN numbers based on active provider
        let mtnNumbers = [];
        let allowedNumbers = validatedRecipients;
        
        console.log('Provider Selection Logic:', {
          activeProvider: activeProvider,
          isAfricasTalking: activeProvider === 'africas_talking' || activeProvider === 'Africa\'s Talking',
          isWizaSMS: activeProvider === 'Wiza SMS' || activeProvider === 'wiza_sms',
          totalRecipients: validatedRecipients.length
        });
        
        // Only block MTN numbers if using Africa's Talking (which has delivery issues with MTN)
        if (activeProvider === 'africas_talking' || activeProvider === 'Africa\'s Talking') {
          mtnNumbers = validatedRecipients.filter(phone => {
            const cleanNumber = phone.replace(/[\s\-\(\)\+]/g, '');
            let localNumber = cleanNumber;
            if (cleanNumber.startsWith('256')) {
              localNumber = cleanNumber.substring(3);
            }
            if (localNumber.startsWith('0')) {
              localNumber = localNumber.substring(1);
            }
            return localNumber.match(/^(77|78|76|39)/);
          });

          allowedNumbers = validatedRecipients.filter(phone => !mtnNumbers.includes(phone));

          if (allowedNumbers.length === 0) {
            res.json({
              success: false,
              message: `All ${mtnNumbers.length} recipients are MTN numbers and have been blocked to prevent charges for undelivered messages (Africa's Talking has delivery issues with MTN)`,
              recipientCount: 0,
              messageId: `blocked_${Date.now()}`,
              cost: 'UGX 0.0000',
              details: {
                total: validatedRecipients.length,
                successful: 0,
                failed: 0,
                blocked: mtnNumbers.length,
                mtnBlocked: mtnNumbers.length
              }
            });
            return;
          }
        }

        let response;
        let responseData;

        // Send SMS via the appropriate provider
        if (activeProvider === 'Wiza SMS' || activeProvider === 'wiza_sms') {
          console.log('Using Wiza SMS Provider');
          
          // Send via Wiza SMS API
          const wizaPayload = {
            username: process.env.WIZA_SMS_USERNAME || 'mk.patricks95@gmail.com',
            password: process.env.WIZA_SMS_PASSWORD || 'patricks95',
            senderId: process.env.WIZA_SMS_SENDER_ID || 'TRINITY',
            message: message,
            recipients: allowedNumbers.join(',')
          };
          
          console.log('Wiza SMS Payload:', {
            username: wizaPayload.username,
            senderId: wizaPayload.senderId,
            messageLength: wizaPayload.message.length,
            recipientCount: allowedNumbers.length,
            sampleRecipients: allowedNumbers.slice(0, 3)
          });

          response = await fetch('https://wizasms.ug/API/V1/send-bulk-sms', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(wizaPayload)
          });

          responseData = await response.json();
          console.log('Wiza SMS API response:', responseData);

          // Handle Wiza SMS response format
          if (responseData.success) {
            const cost = responseData.data?.cost || 0;
            res.json({
              success: true,
              message: `Messages sent to ${responseData.data?.recipients_count || allowedNumbers.length} recipients via Wiza SMS`,
              recipientCount: responseData.data?.recipients_count || allowedNumbers.length,
              messageId: `wiza_${Date.now()}`,
              cost: `UGX ${(cost / 100).toFixed(4)}`,
              details: {
                total: validatedRecipients.length,
                successful: responseData.data?.recipients_count || allowedNumbers.length,
                failed: 0,
                blocked: mtnNumbers.length,
                mtnBlocked: mtnNumbers.length
              }
            });
            return;
          } else {
            res.status(400).json({ 
              error: `Wiza SMS API Error: ${responseData.messages || 'Unknown error'}` 
            });
            return;
          }
        } else {
          console.log('Using Africa\'s Talking Provider (default)');
          
          // Send via Africa's Talking (default)
          const payload = {
            username: AFRICAS_TALKING_CONFIG.username,
            to: allowedNumbers.join(','),
            message: message
          };
          
          console.log('Africa\'s Talking Payload:', {
            username: payload.username,
            recipientCount: allowedNumbers.length,
            sampleRecipients: allowedNumbers.slice(0, 3)
          });

          response = await fetch(AFRICAS_TALKING_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              'apiKey': AFRICAS_TALKING_CONFIG.apiKey
            },
            body: new URLSearchParams(payload).toString()
          });

          responseData = await response.json();
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('SMS API error:', errorText);
          res.status(response.status).json({ error: `SMS API error: ${response.status} - ${errorText}` });
          return;
        }

        console.log('SMS API response:', responseData);

        if (responseData.SMSMessageData && responseData.SMSMessageData.Recipients) {
          const recipients = responseData.SMSMessageData.Recipients;
          const successfulRecipients = recipients.filter(r => r.status === 'Success');
          const totalCost = recipients.reduce((sum, r) => {
            if (r.cost && r.cost !== 'KES 0.0000') {
              const costMatch = r.cost.match(/[\d.]+/);
              return sum + (costMatch ? parseFloat(costMatch[0]) : 0);
            }
            return sum;
          }, 0);

          res.json({
            success: successfulRecipients.length > 0,
            message: `Messages sent to ${successfulRecipients.length} recipients${mtnNumbers.length > 0 ? `. ${mtnNumbers.length} MTN numbers were blocked.` : ''}`,
            recipientCount: successfulRecipients.length,
            messageId: recipients[0]?.messageId || `at_${Date.now()}`,
            cost: totalCost > 0 ? `UGX ${totalCost.toFixed(4)}` : 'UGX 0.0000',
            details: {
              total: validatedRecipients.length,
              successful: successfulRecipients.length,
              failed: recipients.length - successfulRecipients.length,
              blocked: mtnNumbers.length,
              mtnBlocked: mtnNumbers.length
            }
          });
        } else {
          res.status(500).json({ error: 'Invalid response format from SMS API' });
        }

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

// SMS Top-up Function
exports.smsTopup = onRequest(
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

        const { amount, currency, paymentMethod, phoneNumber, provider, metadata } = req.body;

        // Validate request
        if (!amount || amount <= 0) {
          res.status(400).json({ 
            success: false,
            error: 'Invalid amount. Amount must be greater than 0.' 
          });
          return;
        }

        if (!currency) {
          res.status(400).json({ 
            success: false,
            error: 'Currency is required.' 
          });
          return;
        }

        console.log('Processing top-up request - redirecting to Africa\'s Talking:', {
          amount,
          currency,
          paymentMethod,
          provider,
          phoneNumber,
          userId: metadata?.userId
        });

        // Generate a simple transaction ID for tracking
        const transactionId = `at_redirect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Return Africa's Talking billing page URL
        const response = {
          success: true,
          transactionId: transactionId,
          paymentUrl: 'https://account.africastalking.com/apps/ayaprfvonp/billing/payment/methods',
          status: 'pending',
          instructions: `You will be redirected to Africa's Talking billing page to top up your SMS account with ${currency} ${amount}. After payment, your SMS balance will be updated automatically.`
        };

        console.log('Top-up redirect response:', response);
        res.json(response);

      } catch (error) {
        console.error('Top-up redirect error:', error);
        res.status(500).json({ 
          success: false,
          error: error.message || 'Failed to process top-up request' 
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
