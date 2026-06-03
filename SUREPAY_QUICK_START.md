# SurePay Integration - Quick Start Guide

This guide will help you implement the SurePay integration step by step.

## Prerequisites

1. ✅ SurePay account and credentials (API Key, School ID, Webhook Secret)
2. ✅ Active Firebase project
3. ✅ Next.js application running
4. ✅ Basic understanding of TypeScript and React

## Implementation Steps

### Step 1: Configure Environment Variables (5 minutes)

1. Create or update your `.env.local` file:

```bash
# SurePay Configuration
NEXT_PUBLIC_SUREPAY_API_URL=https://sandbox.surepay.com/v1
SUREPAY_API_KEY=your_api_key_here
NEXT_PUBLIC_SUREPAY_SCHOOL_ID=your_school_id
SUREPAY_WEBHOOK_SECRET=your_webhook_secret
```

2. Restart your development server:
```bash
npm run dev
```

### Step 2: Test the Integration Service (10 minutes)

The main integration service is already created at:
- `src/lib/services/surepay-integration.service.ts`

Test if it's working:

1. Open your browser console
2. Navigate to any page in your app
3. Run this test:

```javascript
// Test if SurePay is configured
const { SurePayIntegrationService } = await import('./lib/services/surepay-integration.service');
console.log('Configured:', SurePayIntegrationService.isConfigured());
```

### Step 3: Update Pupil Registration (15 minutes)

Modify your pupil registration to sync with SurePay automatically.

**File**: `src/app/pupils/new/page.tsx`

Find the `handleSubmit` function and update it:

```typescript
const handleSubmit = async () => {
  if (!validateFormData()) {
    return;
  }

  const pupilData = createPupilData();

  try {
    setIsSubmitting(true);

    // Create pupil in local system
    const pupilId = await createPupilMutation.mutateAsync(pupilData);

    // Sync to SurePay
    const pupil = await PupilsService.getPupilById(pupilId);
    if (pupil) {
      const surePayResult = await SurePayIntegrationService.registerPupilInSurePay(pupil);
      
      if (surePayResult.success && surePayResult.payCode) {
        toast({
          title: "Success!",
          description: `Pupil registered. Pay Code: ${surePayResult.payCode}`,
        });
        
        // Display pay code to user (optional)
        setPayCode(surePayResult.payCode);
      } else if (!surePayResult.success) {
        toast({
          variant: "warning",
          title: "Partial Success",
          description: "Pupil registered locally, but SurePay sync failed. You can sync later from the pupil details page.",
        });
      }
    }

    router.push('/pupils');
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to register pupil",
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

### Step 4: Set Up Webhook Handler (Already Done! ✅)

The webhook handler is already created at:
- `src/app/api/webhooks/surepay/route.ts`

This endpoint will automatically:
- Receive payment notifications from SurePay
- Verify webhook signatures
- Record payments in your database
- Handle payment reversals

**Webhook URL**: `https://your-domain.com/api/webhooks/surepay`

### Step 5: Update Promotion Flow (20 minutes)

Modify your promotion page to sync with SurePay automatically.

**File**: `src/app/pupils/promote/page.tsx`

Update the `handleProcessPupils` function:

```typescript
const handleProcessPupils = async () => {
  if (!fromClassId || !toClassId || selectedPupilIds.length === 0) {
    toast({ 
      variant: "destructive", 
      title: "Validation Error",
      description: "Please select both classes and at least one pupil" 
    });
    return;
  }

  const toClass = allClasses.find(c => c.id === toClassId);
  if (!toClass) {
    toast({ variant: "destructive", title: "Class not found" });
    return;
  }

  try {
    let processedCount = 0;
    let surePaySyncErrors = 0;
    
    for (const pupilId of selectedPupilIds) {
      const pupil = allPupils.find(p => p.id === pupilId);
      if (pupil) {
        const historyEntry = {
          date: new Date().toISOString(),
          fromClassId: pupil.classId,
          fromClassName: pupil.className,
          toClassId: toClass.id,
          toClassName: toClass.name,
          type: promotionType,
          notes: `Processed on ${new Date().toLocaleDateString()}`,
          processedBy: "System Admin",
        };

        // Update in local system
        const { id, createdAt, ...updateData } = pupil;
        await updatePupilMutation.mutateAsync({
          id: pupil.id,
          data: {
            ...updateData,
            classId: toClass.id,
            className: toClass.name,
            promotionHistory: [...(pupil.promotionHistory || []), historyEntry],
          }
        });

        // Sync to SurePay
        const surePayResult = await SurePayIntegrationService.syncPromotionToSurePay({
          schoolStudentId: pupil.admissionNumber,
          fromClassId: pupil.classId,
          fromClassName: pupil.className || '',
          toClassId: toClass.id,
          toClassName: toClass.name,
          promotionDate: new Date().toISOString(),
          academicYearId: activeAcademicYear?.id || ''
        });

        if (!surePayResult.success) {
          surePaySyncErrors++;
          console.warn('SurePay sync failed for pupil:', pupil.admissionNumber);
        }

        processedCount++;
      }
    }

    if (surePaySyncErrors > 0) {
      toast({
        variant: "warning",
        title: "Partial Success",
        description: `${processedCount} pupil(s) promoted locally. ${surePaySyncErrors} failed to sync with SurePay.`,
      });
    } else {
      toast({
        title: "Success",
        description: `${processedCount} pupil(s) promoted and synced with SurePay.`,
      });
    }

    setSelectedPupilIds([]);
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to process pupils. Please try again.",
    });
  }
};
```

### Step 6: Add Manual Payment Sync Button (30 minutes)

Create a manual sync button in your fees collection page.

**File**: `src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx`

Add this button component:

```typescript
const SyncPaymentsButton = () => {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      
      const result = await SurePayIntegrationService.syncAllPendingPayments();
      
      if (result.success) {
        toast({
          title: "Sync Complete",
          description: `${result.processedCount} payment(s) synced from SurePay.`,
        });
        
        // Refresh fee data
        refetch();
      } else {
        toast({
          variant: "warning",
          title: "Sync Issues",
          description: `${result.processedCount} synced, ${result.failedCount} failed.`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to sync payments from SurePay.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isSyncing}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Sync SurePay Payments
        </>
      )}
    </Button>
  );
};
```

Add this button to your fees collection header.

### Step 7: Create SurePay Sync Dashboard (Optional - 1 hour)

Create a dashboard to monitor SurePay integration.

**File**: `src/app/settings/surepay-sync/page.tsx`

```typescript
'use client';

import React from 'react';
import { SurePayIntegrationService } from '@/lib/services/surepay-integration.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function SurePaySyncDashboard() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const loadLogs = React.useCallback(async () => {
    try {
      const syncLogs = await SurePayIntegrationService.getSyncLogs(50);
      setLogs(syncLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const result = await SurePayIntegrationService.syncAllPendingPayments();
      
      alert(`Sync complete: ${result.processedCount} processed, ${result.failedCount} failed`);
      
      // Reload logs
      await loadLogs();
    } catch (error) {
      alert('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const stats = React.useMemo(() => {
    const total = logs.length;
    const successful = logs.filter(l => l.status === 'success').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const registrations = logs.filter(l => l.type === 'registration').length;
    const payments = logs.filter(l => l.type === 'payment').length;
    const promotions = logs.filter(l => l.type === 'promotion').length;

    return { total, successful, failed, registrations, payments, promotions };
  }, [logs]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SurePay Integration</h1>
          <p className="text-muted-foreground">Monitor and manage SurePay sync activities</p>
        </div>
        <Button onClick={handleManualSync} disabled={isSyncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Payments
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">
              {stats.successful} successful, {stats.failed} failed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div>Registrations: {stats.registrations}</div>
              <div>Payments: {stats.payments}</div>
              <div>Promotions: {stats.promotions}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Logs</CardTitle>
          <CardDescription>Recent sync activities</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync logs yet
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium">
                        {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {log.admissionNumber || log.pupilId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                      {log.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 8: Configure Webhook in SurePay

1. Log in to your SurePay account
2. Navigate to Settings → Webhooks
3. Add a new webhook:
   - **URL**: `https://your-domain.com/api/webhooks/surepay`
   - **Events**: Select `payment.completed` and `payment.reversed`
   - **Secret**: Copy this and add to your environment variables

### Step 9: Test the Integration

#### Test 1: Pupil Registration
1. Register a new pupil in your system
2. Check if pay code is generated
3. Verify pupil appears in SurePay system

#### Test 2: Payment Webhook
1. Make a test payment in SurePay
2. Check webhook logs in Vercel/server
3. Verify payment appears in fees collection

#### Test 3: Promotion
1. Promote a pupil to another class
2. Verify class updated in SurePay

#### Test 4: Manual Payment Sync
1. Click "Sync SurePay Payments" button
2. Verify new payments are fetched

### Step 10: Deploy to Production

1. Add environment variables to Vercel:
   ```bash
   vercel env add NEXT_PUBLIC_SUREPAY_API_URL
   vercel env add SUREPAY_API_KEY
   vercel env add NEXT_PUBLIC_SUREPAY_SCHOOL_ID
   vercel env add SUREPAY_WEBHOOK_SECRET
   ```

2. Deploy:
   ```bash
   git add .
   git commit -m "Add SurePay integration"
   git push
   ```

3. Update webhook URL in SurePay to production URL

4. Test everything in production

## Common Issues & Solutions

### Issue: "SurePay integration is not configured"

**Solution**: Check environment variables are set correctly and restart server.

### Issue: Webhook signature verification fails

**Solution**: Ensure webhook secret matches between your app and SurePay settings.

### Issue: Payments not appearing

**Solution**: 
1. Check webhook endpoint is accessible
2. Verify pupil exists with correct admission number
3. Check active academic year is configured

### Issue: Duplicate payments

**Solution**: The integration automatically prevents duplicates using `surePayPaymentMappings` collection.

## Next Steps

1. ✅ Set up monitoring alerts for failed syncs
2. ✅ Train staff on new features
3. ✅ Create user documentation
4. ✅ Set up regular payment sync schedule (optional)
5. ✅ Monitor sync logs regularly

## Support

- Check `SUREPAY_INTEGRATION_GUIDE.md` for detailed documentation
- Check `SUREPAY_ENVIRONMENT_SETUP.md` for environment configuration
- Contact SurePay support for API issues
- Review sync logs in `surePaySyncLogs` Firestore collection

## Checklist

- [ ] Environment variables configured
- [ ] Webhook endpoint deployed and accessible
- [ ] Webhook URL configured in SurePay
- [ ] Tested pupil registration sync
- [ ] Tested payment webhook
- [ ] Tested promotion sync
- [ ] Tested manual payment sync
- [ ] Created sync dashboard (optional)
- [ ] Deployed to production
- [ ] Staff trained on new features

---

**Congratulations! 🎉** You've successfully integrated SurePay with your school management system.

