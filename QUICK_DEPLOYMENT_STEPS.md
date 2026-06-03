# Quick Deployment Steps: Dev + Production

**Goal**: Deploy to both development and production Vercel accounts with separate Firebase databases.

---

## **🚀 Quick Setup (30 Minutes)**

### **Step 1: Create Production Firebase** (5 min)
1. Go to https://console.firebase.google.com/
2. Click "Add project" → Name: `school-management-prod`
3. Enable:
   - **Firestore Database** (production mode)
   - **Authentication** (Email/Password)
   - **Storage**
4. Get config: **Project Settings** → **Your apps** → **Web** icon
5. Save the config values

### **Step 2: Create Production Vercel Account** (5 min)
1. Go to https://vercel.com
2. Sign up with **new email** (for commercial use)
3. Choose **Pro plan** ($20/month - required for commercial)
4. Connect your GitHub account

### **Step 3: Deploy to Production Vercel** (10 min)
1. Click **Add New** → **Project**
2. Import your repository
3. Configure:
   - Framework: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
4. **Before deploying**, click **Environment Variables**
5. Add these variables (use production Firebase values):
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY = your-prod-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = school-management-prod.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID = school-management-prod
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = school-management-prod.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = your-prod-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID = your-prod-app-id
   
   FIREBASE_PROJECT_ID = school-management-prod
   FIREBASE_CLIENT_EMAIL = (from service account JSON)
   FIREBASE_PRIVATE_KEY = (from service account JSON)
   
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = (your cloudinary)
   CLOUDINARY_API_KEY = (your key)
   CLOUDINARY_API_SECRET = (your secret)
   ```
6. Click **Deploy**

### **Step 4: Configure Both Vercel Projects** (10 min)

#### **Development Vercel** (current account)
1. Go to your existing Vercel project
2. **Settings** → **Git**
3. Set **Production Branch**: `development`
4. This will deploy from `development` branch

#### **Production Vercel** (new account)
1. Go to your new production Vercel project
2. **Settings** → **Git**
3. Set **Production Branch**: `production`
4. This will deploy from `production` branch

---

## **📦 Daily Workflow**

### **Making Updates**

```bash
# 1. Work on development branch
git checkout development
# Make your changes, test locally
git add .
git commit -m "Add new feature"
git push origin development
```
→ **Automatically deploys to dev Vercel** ✅

### **Deploying to Production**

```bash
# 2. When ready for production, merge to production branch
git checkout production
git merge development
git push origin production
```
→ **Automatically deploys to prod Vercel** ✅

**That's it!** Both environments update automatically when you push to their respective branches.

---

## **🔧 Alternative: Manual Deployment**

If you prefer manual control instead of auto-deployment:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to development Vercel
vercel login  # Use dev account email
vercel --prod

# Deploy to production Vercel
vercel login  # Use prod account email
vercel --prod
```

---

## **⚙️ Create Git Branches**

If you don't have separate branches yet:

```bash
# Create development branch
git checkout -b development
git push origin development

# Create production branch
git checkout -b production
git push origin production

# Set development as default for your work
git checkout development
```

---

## **✅ Verify Setup**

After deployment, check:

1. **Dev Vercel**: Visit your dev URL
   - Open browser console → Check Firebase project ID = `trinity-family-schools`
   
2. **Prod Vercel**: Visit your prod URL
   - Open browser console → Check Firebase project ID = `school-management-prod`

They should be using **different Firebase databases**!

---

## **📊 Environment Summary**

| Environment | Firebase Project | Vercel Account | Git Branch | Auto-Deploy |
|-------------|-----------------|----------------|------------|-------------|
| **Development** | trinity-family-schools | Current account | `development` | Yes |
| **Production** | school-management-prod | New account (Pro) | `production` | Yes |

---

## **💡 Pro Tips**

1. **Always test on dev first** before merging to production
2. **Use different Cloudinary folders** for dev/prod (optional)
3. **Set up Firebase budget alerts** for production
4. **Enable Vercel deployment notifications** to know when deploys finish
5. **Use Vercel preview deployments** for testing PRs

---

## **🆘 Troubleshooting**

### Issue: Both environments use same Firebase
- Check environment variables in Vercel dashboard
- Make sure you added production Firebase config to production Vercel

### Issue: Deployment fails
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Make sure `.env.local` is in `.gitignore`

### Issue: Can't switch Vercel accounts in CLI
```bash
# Logout first
vercel logout
# Then login with the account you want
vercel login
```

---

**Need help?** Refer to the full guide: `MULTI_ENVIRONMENT_DEPLOYMENT_GUIDE.md`
