# 🔑 VAPID Keys Summary - DEV vs PRODUCTION

## Quick Reference Guide

---

## 🔧 **DEV Environment**

### Vercel Project Details:
- **Project Name**: `trinityfamilyschool`
- **Vercel URL**: https://vercel.com/mkpatricks95-gmailcoms-projects/trinityfamilyschool
- **Purpose**: Development and testing

### VAPID Keys (DEV):
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4
VAPID_PRIVATE_KEY=z1e32rBFuHHzkh78Cz5Ed5VCmqoNQNC0xn1ISq5kE6Y
VAPID_EMAIL=admin@trinity-family-schools.com
```

---

## 🚀 **PRODUCTION Environment**

### Vercel Project Details:
- **Project Name**: `trinity-school-ganda`
- **Vercel URL**: https://vercel.com/trinity-school-gandas-projects/trinity-school-ganda
- **Purpose**: Live production deployment

### VAPID Keys (PRODUCTION):
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDKJ2WIld2ETI5PN-a5bW_FQXz3T28qYsPEVUTi6pbkIH5OVaRzlwiP_k918RCNP1BG49nfL7sNuwm9b7MH_rWc
VAPID_PRIVATE_KEY=7IDERd8TwmWj9-32EDonvnpPcIOwMgSfFC29f3kKS0s
VAPID_EMAIL=admin@trinity-family-schools.com
```

---

## 📝 Setup Instructions

### For Local Development:
1. Create `.env.local` in project root
2. Copy the **DEV keys** from above
3. Restart your dev server: `npm run dev`

### For DEV Vercel Deployment:
1. Go to: https://vercel.com/mkpatricks95-gmailcoms-projects/trinityfamilyschool
2. Navigate to: **Settings → Environment Variables**
3. Add the 3 **DEV VAPID keys** (see above)
4. Select: **Production, Preview, Development** (all 3)
5. Click **Save** and **Redeploy**

### For PRODUCTION Vercel Deployment:
1. Go to: https://vercel.com/trinity-school-gandas-projects/trinity-school-ganda
2. Navigate to: **Settings → Environment Variables**
3. Add the 3 **PRODUCTION VAPID keys** (see above)
4. Select: **Production, Preview, Development** (all 3)
5. Click **Save** and **Redeploy**

---

## ⚠️ Important Notes

1. **Do NOT mix keys** between environments
2. **DEV keys** = `trinityfamilyschool` project only
3. **PRODUCTION keys** = `trinity-school-ganda` project only
4. Both sets of keys were generated on: **2025-10-26**
5. These keys are valid URL-safe base64 and fix the previous encoding error

---

## 🔒 Security

- ✅ **Separate keys** provide better security isolation
- ✅ If DEV keys are compromised, PRODUCTION is safe
- ✅ Can rotate keys independently per environment
- ✅ Push notifications won't cross environments
- ❌ **Never commit** these keys to Git (they're in `.gitignore`)

---

## 🧪 Testing

After adding keys to Vercel:

1. **Wait for deployment** to complete
2. Visit your deployed site
3. Go to: `/notifications` page
4. Click **"Enable Push Notifications"**
5. Grant browser permission
6. Send a test notification
7. ✅ Should work perfectly!

---

## 📋 Key Differences At A Glance

| Aspect | DEV | PRODUCTION |
|--------|-----|------------|
| **Project** | trinityfamilyschool | trinity-school-ganda |
| **Vercel Account** | mkpatricks95-gmailcoms-projects | trinity-school-gandas-projects |
| **Public Key (first 10 chars)** | `BKdPGmGr1P...` | `BDKJ2WIld2...` |
| **Private Key (first 10 chars)** | `z1e32rBFuH...` | `7IDERd8TwmW...` |
| **Email** | admin@trinity-family-schools.com | admin@trinity-family-schools.com |
| **Generated** | 2025-10-26 | 2025-10-26 |

---

**Both environments are now properly configured with valid VAPID keys!** 🎉

