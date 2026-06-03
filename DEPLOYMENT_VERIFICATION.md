## How to Verify Deployment & Clear Cache

### Option 1: Check Vercel Deployment Status
1. Go to https://vercel.com/dashboard
2. Find your Trinity Family School project
3. Check if the latest deployment (commit `f2dfdf9`) is complete
4. Status should show "Ready" with a green checkmark

### Option 2: Clear Browser Cache (Recommended)

**Chrome/Edge:**
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cached images and files"  
3. Time range: "All time"
4. Click "Clear data"
5. Reload the site

**Quick Test - Use Incognito Mode:**
1. Press `Ctrl+Shift+N` (Chrome) or `Ctrl+Shift+P` (Edge/Firefox)
2. Go to https://trinityfamilyschool.vercel.app
3. Check if error still occurs

### Option 3: Force Vercel Rebuild
If the above doesn't work, trigger a new deployment:
```bash
git commit --allow-empty -m "Force rebuild"
git push
```

### How to Confirm Fix Worked
Once cache is cleared, look for these signs in the console:
- ✅ No "Minified React error #310"
- ✅ Different file hash (NOT `common-b352d8e852115497.js`)
- ✅ Notifications load without crashing
