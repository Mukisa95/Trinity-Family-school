import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sms/wiza-login
 *
 * Returns an HTML page with a hidden, auto-submitting login form that posts
 * the stored Wiza SMS credentials to wizasms.ug. This sets the session cookie
 * on the wizasms.ug domain in the user's browser so subsequent iframe visits
 * don't require re-login.
 */
export async function GET() {
    // Credentials from env vars only (no browser Firebase SDK in server routes)
    const username = process.env.WIZA_SMS_USERNAME || '';
    const password = process.env.WIZA_SMS_PASSWORD || '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signing in to Wiza SMS…</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 16px;
      color: #334155;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 32px 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      text-align: center;
      max-width: 360px;
      width: 100%;
    }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.125rem; font-weight: 600; margin-bottom: 6px; }
    p  { font-size: 0.875rem; color: #64748b; }
    .account { font-weight: 500; color: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Signing in to Wiza SMS…</h2>
    <p>Logging in as <span class="account">${username.replace(/</g, '&lt;')}</span></p>
    <p style="margin-top:8px">You'll be redirected to your dashboard automatically.</p>
  </div>

  <!-- Hidden auto-submit form — posts credentials to Wiza SMS login -->
  <form id="loginForm" method="POST" action="https://wizasms.ug/login" style="display:none">
    <input type="hidden" name="email"    value="${username.replace(/"/g, '&quot;')}" />
    <input type="hidden" name="password" value="${password.replace(/"/g, '&quot;')}" />
    <input type="hidden" name="_token"   value="" />
  </form>

  <script>
    // Submit the form immediately — the browser will handle the redirect and cookie
    document.getElementById('loginForm').submit();
  </script>
</body>
</html>`;

    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
