# How to Add Environment Variables in Vercel - Step by Step

This guide shows you **exactly** how to add your Firebase credentials to your Vercel production project.

---

## **🎯 What You're Doing**

You're telling your **production Vercel project** to use your **production Firebase database** (`trinity-family-ganda`) instead of your development database.

---

## **📋 Step-by-Step Instructions**

### **Step 1: Go to Your Production Vercel Project**

1. Open https://vercel.com/dashboard
2. Find your **production project** (the new one you just created)
3. Click on it to open the project

---

### **Step 2: Open Settings**

1. In your project, click **"Settings"** tab at the top
2. In the left sidebar, click **"Environment Variables"**

You should see a page that says "Environment Variables" with a form to add new variables.

---

### **Step 3: Add Each Variable One by One**

You need to add **12 variables**. For each one:

1. **Name** (Key): Copy the variable name exactly
2. **Value**: Copy the value exactly
3. **Environment**: Select **"Production"** (uncheck Preview and Development)
4. Click **"Save"**
5. Repeat for the next variable

---

## **🔑 The 12 Variables to Add**

Copy and paste these **EXACTLY** (one at a time):

### **Variable 1:**
- **Name**: `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: `AIzaSyD7AgzLMQUvDv_NLXiCATBnEfvd_aebYho`
- **Environment**: ✅ Production only

---

### **Variable 2:**
- **Name**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- **Value**: `trinity-family-ganda.firebaseapp.com`
- **Environment**: ✅ Production only

---

### **Variable 3:**
- **Name**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- **Value**: `trinity-family-ganda`
- **Environment**: ✅ Production only

---

### **Variable 4:**
- **Name**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- **Value**: `trinity-family-ganda.firebasestorage.app`
- **Environment**: ✅ Production only

---

### **Variable 5:**
- **Name**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: `386680805645`
- **Environment**: ✅ Production only

---

### **Variable 6:**
- **Name**: `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Value**: `1:386680805645:web:a6166da3358c1003a5b844`
- **Environment**: ✅ Production only

---

### **Variable 7:**
- **Name**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- **Value**: `G-HE7DNM6YF9`
- **Environment**: ✅ Production only

---

### **Variable 8:**
- **Name**: `FIREBASE_PROJECT_ID`
- **Value**: `trinity-family-ganda`
- **Environment**: ✅ Production only

---

### **Variable 9:**
- **Name**: `FIREBASE_CLIENT_EMAIL`
- **Value**: `firebase-adminsdk-fbsvc@trinity-family-ganda.iam.gserviceaccount.com`
- **Environment**: ✅ Production only

---

### **Variable 10: (IMPORTANT - Long value!)**
- **Name**: `FIREBASE_PRIVATE_KEY`
- **Value**: Copy this **ENTIRE** block (including quotes):
```
"-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC63VnNS/XGaoJr\ntPuNBnG0wOQW5c31qmeUZub/1RoV6RkY93eyRyJ+J/6ErQ8PmjJ9fkLMMA62cMrB\n9NhTA9sq8fe600WiTc6wc1Pqu7da+dNOkTEoIx50BUZ/FHXYG1Tu1ozT7DsYwx6m\nMZXGIucpabHoFrT3FGmHj4NvZtQADw99KgBkVINmGyuC18QhubUVwhwyBUNO7JJV\nWaFS4vRBJNI5bw0Kcs0sAhphTrn8gfLlAfY7q2eBtMqKQ30pgAymHXkbuPyj8Sm/\n5qQW5shfjgdKoxWIrpdn9SpM9aTKa5b3U9AYsRaMy1c/DH4tCy5hy4Wkuvi7C3zA\nwgdu86AvAgMBAAECggEAPkWlt5Sowwabj+kwKz8KhYICgN70U/oFqp7gPEF3//U+\nN+PAL9kk1YXee7hwXHK2gLui5wjc3k+YQiqmLIQMdbNNKyVc/0mOp57HSGJmKBs5\nH+WizA1oCKH5bEAVRX9WPoGhTL5cs1PS0u+TSgQ3pMVkVEO86toSkOpykp1h6OKJ\n+FJjLikKwHfsRnq4Bx06awcj2Ii8PaER/vQG3maCX3PusJUuyO/iX8LEJCQdkcIR\nKNcDRpf9CXc61p52B+6Oa+7aRLRrGI9QyQ1AB5SxzE0zp6O1/MncpqNwt3SeirF+\nmQD/RfTCRKT1Ib8NHoiEnntvTFsRExFYARvgixuxAQKBgQDnBEIWAhIYFk/nXmRH\njvU+pvzBWY429oK7JD1QARFLJ4BDtWsFc5J0ejLT4zCjBZMxIFy39ge8j/WCKuVk\nWa4YZ2IXRyRedqdwh9AZbt2RPgnrEr/GtP1tgZroL/tEA7tn4ZkefAnJA0w5OLR/\nyB5w5CMAebPJgW+bFCNxtiCuZwKBgQDPErx1KUoxD587KK7EwceiCLpNiJxQWZH6\n00RiW5ojT2UAHZICXDCryBE+6Ov+s8um0j2TciSoHTUy1HmEk2BqFqENlKSPxXP/\n02YkYya81uJyPr2jl33aX+GUgXCmLRZ5muQ7YGdw337QrWXiqnAsP5R6kv6WZadh\nLTr6iitS+QKBgDNRENUOtLJBEpLUtvXmXbgDJBZXLG4tKDEmBbCl7A+DwMxJmnJl\nj9zr4CqNRxqPfHjnNXFv55wNZn35xWcbPL8TCAkftoZ9WQh4QtPDethurYlYat1b\nCwiuR5jYP7qGEbUrufW5m/rZDq+PVxkjfQ+aveO3JSbX59DNEmqKCIx1AoGAC/GE\ntS1AfjvsbzkVe3vBy/K87CPpAClqZhExbIrkBQ1bQfpypXgzxnSvqfU9R1+Pa3vM\n2WhH/PpSSzA+IgtuEDBl8aaVJ0W4PxUuWwLtBQ9P2E8OGRVvyNym4i3lFXCcTz9D\n0rjovnXllpupuL0j4yl3ouo/jOUoFk7JjBHUFeECgYBbnIvmCu3NKHn7J6pDV/uY\nZYL0jsVGwRCQlW4lFkJJEJyuxfrYG8sBBG85WL51YkZM3stoR2Uo37R/6b7plqPA\nD1b5cIu57nQWNxkeus+AY208V2CeROGZemYKlo0B5v1/edV757zdRBZmigtYu8LX\neYsOx/nuVgdRpsLW3X97UA==\n-----END PRIVATE KEY-----\n"
```
- **Environment**: ✅ Production only
- **⚠️ IMPORTANT**: Make sure you copy the **quotes at the beginning and end** too!

---

### **Variable 11: (You need to fill this in)**
- **Name**: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- **Value**: Get this from your `.env.local` file (or Cloudinary dashboard)
- **Environment**: ✅ Production only

---

### **Variable 12: (You need to fill this in)**
- **Name**: `CLOUDINARY_API_KEY`
- **Value**: Get this from your `.env.local` file (or Cloudinary dashboard)
- **Environment**: ✅ Production only

---

### **Variable 13: (You need to fill this in)**
- **Name**: `CLOUDINARY_API_SECRET`
- **Value**: Get this from your `.env.local` file (or Cloudinary dashboard)
- **Environment**: ✅ Production only

---

### **Variable 14: (Optional)**
- **Name**: `NEXT_PUBLIC_DEFAULT_SMS_PROVIDER`
- **Value**: Get this from your `.env.local` file
- **Environment**: ✅ Production only

---

## **✅ After Adding All Variables**

You should see a list of **12-14 environment variables** in your Vercel project settings.

---

## **🚀 Deploy Your Production Project**

After adding all variables:

1. Go to the **"Deployments"** tab in your production project
2. Click **"Redeploy"** button
3. Wait for the build to complete (2-5 minutes)
4. Click on the deployment URL to open your production site

---

## **🔍 Verify It's Working**

1. Open your production site URL
2. Press **F12** to open browser developer tools
3. Go to the **Console** tab
4. Look for a line that says: `Firebase initialized successfully with project: trinity-family-ganda`

If you see `trinity-family-ganda`, it's working! ✅

If you see `trinity-family-schools`, something went wrong. ❌

---

## **🆘 Troubleshooting**

### **Problem: Still seeing development Firebase**
**Solution**: 
1. Check you're looking at the **production** Vercel project, not development
2. Make sure all variables are set for **"Production"** environment
3. Redeploy the project

### **Problem: Build fails**
**Solution**:
1. Check the build logs in Vercel
2. Make sure `FIREBASE_PRIVATE_KEY` has quotes around it
3. Make sure you didn't miss any variables

### **Problem: Can't find Cloudinary values**
**Solution**:
1. Open your `.env.local` file in your project
2. Copy the `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` values
3. Or go to https://cloudinary.com/console and get them from there

---

## **📝 Quick Checklist**

Before deploying:
- [ ] Added all 10 Firebase variables
- [ ] Added `FIREBASE_PRIVATE_KEY` with quotes
- [ ] Added Cloudinary variables (3 variables)
- [ ] Added SMS provider variable (optional)
- [ ] All variables set to **Production** environment only
- [ ] Clicked "Save" for each variable

After deploying:
- [ ] Build completed successfully
- [ ] Site opens without errors
- [ ] Console shows `trinity-family-ganda` Firebase project
- [ ] Can create a test account

---

**You're ready to deploy! 🚀**
