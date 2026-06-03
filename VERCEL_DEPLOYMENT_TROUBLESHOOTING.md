# Vercel Deployment Troubleshooting Guide

## Issue: Updates Not Deploying Automatically to Vercel

### Common Causes & Solutions:

## 1. **Git Email Mismatch** ⚠️ (MOST LIKELY ISSUE)
Your git email is currently set to `you@example.com` which doesn't match your Vercel account.

**Fix:**
```bash
# Set your git email to match your Vercel account email
git config --global user.email "your-actual-email@example.com"
git config --global user.name "Your Real Name"

# For this repository only (if you prefer):
git config user.email "your-actual-email@example.com"
git config user.name "Your Real Name"
```

**Then amend the last commit:**
```bash
git commit --amend --reset-author --no-edit
git push --force-with-lease origin main
```

## 2. **Verify Vercel-GitHub Integration**

### Steps to Check:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Git**
4. Verify:
   - ✅ Repository is connected: `Mukisa95/Trinity-Family-school`
   - ✅ Production Branch is set to: `main`
   - ✅ Auto-deploy is enabled

### If Not Connected:
1. Click **"Connect Git Repository"**
2. Select **GitHub**
3. Authorize Vercel to access your repositories
4. Select `Trinity-Family-school` repository
5. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (or leave default)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

## 3. **Check GitHub Webhooks**

1. Go to your GitHub repository: `https://github.com/Mukisa95/Trinity-Family-school`
2. Click **Settings** → **Webhooks**
3. Look for a webhook pointing to `api.vercel.com` or `vercel.com`
4. If missing:
   - Reconnect the repository in Vercel (this will recreate the webhook)

## 4. **Manual Deployment (Quick Fix)**

If automatic deployment isn't working, trigger manually:

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click **"Redeploy"** button on the latest deployment
4. Or click **"Deploy"** → **"Deploy Latest Commit"**

## 5. **Check Build Logs**

1. In Vercel Dashboard → **Deployments**
2. Click on the latest deployment
3. Check **Build Logs** for errors
4. Common issues:
   - Missing environment variables
   - Build errors
   - TypeScript errors
   - Missing dependencies

## 6. **Verify Branch Settings**

Ensure Vercel is watching the correct branch:
1. Vercel Dashboard → Project → **Settings** → **Git**
2. **Production Branch:** Should be `main`
3. **Preview Branches:** Should include branches you want to deploy

## 7. **Clear Build Cache**

Sometimes cached builds cause issues:
1. Vercel Dashboard → Project → **Settings** → **Build & Development Settings**
2. Enable **"Clear Build Cache"**
3. Trigger a new deployment

## 8. **Check Vercel Status**

Visit [Vercel Status Page](https://vercel.com/status) to check for service disruptions.

## Quick Fix Commands

```bash
# 1. Update git config (REPLACE WITH YOUR ACTUAL EMAIL)
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"

# 2. Create an empty commit to trigger deployment
git commit --allow-empty -m "chore: Trigger Vercel deployment"
git push origin main

# 3. Or force push the last commit with correct author
git commit --amend --reset-author --no-edit
git push --force-with-lease origin main
```

## Still Not Working?

1. **Disconnect and Reconnect** the repository in Vercel
2. **Check Vercel Team Settings** - ensure you have deployment permissions
3. **Contact Vercel Support** with:
   - Repository URL
   - Project name
   - Deployment logs
   - Git commit SHA

