// This file is disabled for static export - functionality moved to Firebase Functions
export default function handler() {
  return new Response('API route disabled for static export', { status: 404 });
}

/*
// This API route is disabled for static export deployment
// SMS topup functionality is handled by Firebase Functions instead

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

interface TopUpRequest {
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string;
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  metadata?: {
    userId: string;
    description?: string;
  };
}

interface TopUpResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  instructions?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TopUpRequest = await request.json();
    const { amount, currency, paymentMethod, phoneNumber, provider, metadata } = body;

    // Validate request
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid amount. Amount must be greater than 0.' 
        },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Currency is required.' 
        },
        { status: 400 }
      );
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
    const response: TopUpResponse = {
      success: true,
      transactionId: transactionId,
      paymentUrl: 'https://account.africastalking.com/apps/ayaprfvonp/billing/payment/methods',
      status: 'pending',
      instructions: `You will be redirected to Africa's Talking billing page to top up your SMS account with ${currency} ${amount}. After payment, your SMS balance will be updated automatically.`
    };

    console.log('Top-up redirect response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Top-up redirect error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false,
          error: `Top-up service error: ${error.message}` 
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unknown error occurred while processing top-up' 
        },
        { status: 500 }
      );
    }
  }
}

// Simple GET endpoint for status (always redirect to billing page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // For Africa's Talking redirects, always return pending status
    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Please complete payment on Africa\'s Talking billing page',
      paymentUrl: 'https://account.africastalking.com/apps/ayaprfvonp/billing/payment/methods'
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
*/ 