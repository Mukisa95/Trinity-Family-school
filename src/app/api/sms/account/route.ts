// This file is disabled for static export - functionality moved to Firebase Functions
export default function handler() {
  return new Response('API route disabled for static export', { status: 404 });
}

/*
// This API route is disabled for static export deployment
// SMS account functionality is handled by Firebase Functions instead

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { 
          success: false,
          error: `Africa's Talking API error: ${response.status} - ${errorText}` 
        },
        { status: response.status }
      );
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
      return NextResponse.json(result);
    } else {
      console.error('Invalid Africa\'s Talking User Data response format:', responseData);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid response format from Africa\'s Talking User Data API' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Account data API route error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Network error: Could not connect to Africa\'s Talking service. Please check your internet connection.' 
          },
          { status: 503 }
        );
      } else if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Authentication error: Invalid API credentials for Africa\'s Talking service.' 
          },
          { status: 401 }
        );
      } else {
        return NextResponse.json(
          { 
            success: false,
            error: `Account service error: ${error.message}` 
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unknown error occurred while fetching account data' 
        },
        { status: 500 }
      );
    }
  }
}
*/ 