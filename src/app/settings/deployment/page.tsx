"use client";

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';

type TargetEnvironment = 'production' | 'preview' | 'development';
type EnvironmentVariable = {
  id?: string;
  key: string;
  type: string;
  target: string[];
  gitBranch?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  configured: boolean;
};

type ConnectionResult = {
  account: { username: string | null; email: string | null };
  project: { id: string | null; name: string; framework: string | null; updatedAt: number | null };
  variables: EnvironmentVariable[];
};

type ServiceField = {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  secret?: boolean;
  fixedValue?: string;
};

type ServiceDefinition = {
  id: string;
  title: string;
  purpose: string;
  scope: string;
  steps: string[];
  fields: ServiceField[];
  verification: string;
  warning?: string;
};

const SECRET_KEY_PATTERN = /(SECRET|PASSWORD|TOKEN|PRIVATE|CREDENTIAL|CRON|AUTH|WEBHOOK)/i;
const PUBLIC_SAFE_KEYS = new Set([
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_CLOUDINARY_API_KEY',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'NEXT_PUBLIC_CLOUDINARY_FOLDER',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_LOG_LEVEL',
]);

const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  {
    id: 'wiza-sms',
    title: 'Wiza SMS',
    purpose: 'Bulk messages, scheduled messages, balance checks, login, and recharge actions.',
    scope: 'Used by the active Next.js SMS routes on this Vercel deployment.',
    steps: [
      'Sign in to the Wiza SMS provider portal and confirm that the sender ID has been approved.',
      'Copy the API username and password. Do not use the password for a personal email account.',
      'Enter the approved sender ID exactly as registered, then save this integration.',
      'Redeploy, open Bulk SMS, verify the balance, and send one message to a controlled test number.',
    ],
    fields: [
      { key: 'WIZA_SMS_USERNAME', label: 'API username', description: 'The username issued for the Wiza API account.', placeholder: 'API account username' },
      { key: 'WIZA_SMS_PASSWORD', label: 'API password', description: 'Private Wiza API password; it is stored as a sensitive Vercel value.', placeholder: 'API password', secret: true },
      { key: 'WIZA_SMS_SENDER_ID', label: 'Approved sender ID', description: 'The name recipients see, for example TRINITY.', placeholder: 'TRINITY' },
    ],
    verification: 'After deployment, use Bulk SMS -> Account/Balance, then send a single test message before a real batch.',
  },
  {
    id: 'schoolpay',
    title: 'SchoolPay payments and webhook',
    purpose: 'Payment synchronization, webhook receipt processing, matching, and SchoolPay Feed notifications.',
    scope: 'The callback handled by this application is /api/schoolpay/notify.',
    steps: [
      'Obtain the school code and API password from the SchoolPay integration account.',
      'Keep the default sync URL unless SchoolPay has issued your school a different production endpoint.',
      'Leave webhook signature enforcement set to true and save the integration.',
      'In the SchoolPay portal, register https://YOUR-PRODUCTION-DOMAIN/api/schoolpay/notify as the payment notification URL.',
      'Redeploy, open that URL with GET to confirm it reports configured: true, then ask SchoolPay to send a test callback.',
    ],
    fields: [
      { key: 'SCHOOLPAY_SCHOOL_CODE', label: 'School code', description: 'The unique school code issued by SchoolPay.', placeholder: 'SchoolPay school code' },
      { key: 'SCHOOLPAY_API_PASSWORD', label: 'API password / signing secret', description: 'Used for transaction sync hashes and webhook signature verification.', placeholder: 'SchoolPay API password', secret: true },
      { key: 'SCHOOLPAY_SYNC_BASE_URL', label: 'Sync base URL', description: 'Only change this when SchoolPay provides a different endpoint.', placeholder: 'https://schoolpay.co.ug/paymentapi' },
      { key: 'SCHOOLPAY_REQUIRE_WEBHOOK_SIGNATURE', label: 'Require webhook signature', description: 'Production-safe setting. The control page locks this to true.', placeholder: 'true', fixedValue: 'true' },
    ],
    verification: 'Confirm GET /api/schoolpay/notify shows configured: true, then verify a provider test payment appears once in SchoolPay Feed.',
    warning: 'Do not disable signature verification in production. An unsigned public payment hook can be forged.',
  },
  {
    id: 'cloudinary',
    title: 'Cloudinary media',
    purpose: 'Pupil, staff, logo, and other application photo uploads and deletions.',
    scope: 'Used by the server upload/delete routes; the cloud name and API key are identifiers, while the API secret stays server-only.',
    steps: [
      'Open the Cloudinary console for the correct product environment.',
      'Copy the cloud name, API key, and API secret from API Keys.',
      'Choose a folder prefix that separates this school/deployment from other environments.',
      'Save, redeploy, upload one test photo, then delete it to validate both operations.',
    ],
    fields: [
      { key: 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', label: 'Cloud name', description: 'Cloudinary account/product-environment identifier; browser-visible.', placeholder: 'Cloud name' },
      { key: 'NEXT_PUBLIC_CLOUDINARY_API_KEY', label: 'API key', description: 'Cloudinary API identifier; browser-visible by design.', placeholder: 'API key' },
      { key: 'CLOUDINARY_API_SECRET', label: 'API secret', description: 'Private signing credential. Never put this in a NEXT_PUBLIC variable.', placeholder: 'API secret', secret: true },
      { key: 'NEXT_PUBLIC_CLOUDINARY_FOLDER', label: 'Folder prefix', description: 'For example production or the school slug.', placeholder: 'production' },
    ],
    verification: 'Upload a non-sensitive test image and delete it. Confirm it appears under the expected Cloudinary folder only.',
  },
  {
    id: 'push',
    title: 'Web push notifications (VAPID)',
    purpose: 'Browser push subscriptions, SchoolPay payment alerts, and server-sent notifications.',
    scope: 'The public and private VAPID keys must be a matching pair.',
    steps: [
      'Generate one VAPID key pair using a trusted web-push tool; do not mix keys from different pairs.',
      'Enter the public key, private key, and an operational contact email.',
      'Save and redeploy so the browser bundle receives the public key.',
      'On a test device, remove any old push subscription, subscribe again, and send one test notification.',
    ],
    fields: [
      { key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', label: 'Public VAPID key', description: 'Browser-visible public half of the VAPID pair.', placeholder: 'URL-safe Base64 public key' },
      { key: 'VAPID_PRIVATE_KEY', label: 'Private VAPID key', description: 'Server-only private half of the same pair.', placeholder: 'URL-safe Base64 private key', secret: true },
      { key: 'VAPID_EMAIL', label: 'Contact email', description: 'Use an email or mailto address monitored by the school.', placeholder: 'admin@example.org' },
    ],
    verification: 'Subscribe again from a test browser, send a test push, and confirm the notification opens the expected page.',
  },
  {
    id: 'operations',
    title: 'Scheduled jobs and operational security',
    purpose: 'Protects scheduled SMS, SchoolPay sync jobs, maintenance routes, and this Deployment Control page.',
    scope: 'Use independent, random values. Reusing one secret across these controls increases the impact of a leak.',
    steps: [
      'Generate a different random value of at least 32 characters for each secret.',
      'Save values only for the currently connected Vercel project. Keep its control secret in this tab until that project finishes redeploying.',
      'Configure the scheduler to send the CRON_SECRET exactly as the relevant route expects.',
      'Redeploy and run each job once in a controlled window while checking logs and duplicate protection.',
    ],
    fields: [
      { key: 'CRON_SECRET', label: 'Cron authentication secret', description: 'Protects scheduled SMS and SchoolPay synchronization routes.', placeholder: 'Random 32+ character value', secret: true },
      { key: 'MAINTENANCE_API_KEY', label: 'Maintenance API key', description: 'Protects maintenance and administrative automation routes.', placeholder: 'Different random 32+ character value', secret: true },
      { key: 'DEPLOYMENT_CONTROL_SECRET', label: 'Target control secret', description: 'Authorises this page after the target deployment goes live.', placeholder: 'Different random 32+ character value', secret: true },
    ],
    verification: 'Confirm unauthorised job requests are rejected and authorised scheduled requests complete once without duplicate writes.',
  },
  {
    id: 'application',
    title: 'Application runtime options',
    purpose: 'Optional public API base URL and client logging level used by application components.',
    scope: 'These values are browser-visible. They must never contain credentials.',
    steps: [
      'Leave the API URL empty when the application should use its own same-origin /api routes.',
      'If a separate API is required, enter its public HTTPS base URL and confirm it allows this application origin.',
      'Use a quiet production log level such as warn or error.',
      'Save and redeploy, then inspect the browser network panel for requests to the intended host.',
    ],
    fields: [
      { key: 'NEXT_PUBLIC_API_URL', label: 'Public API base URL', description: 'Optional public URL; never include username, password, or token query parameters.', placeholder: 'https://api.example.org/api' },
      { key: 'NEXT_PUBLIC_LOG_LEVEL', label: 'Browser log level', description: 'Recommended production values: warn or error.', placeholder: 'warn' },
    ],
    verification: 'Check normal application requests and browser logs on the new deployment before moving production traffic.',
  },
];

function parseEnvironmentText(text: string) {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`Invalid environment line: ${rawLine.slice(0, 40)}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) throw new Error(`Invalid environment-variable name: ${key}`);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key.includes('PRIVATE_KEY')) value = value.replace(/\\n/g, '\n');
    if (!value) throw new Error(`${key} has an empty value.`);
    values.set(key, value);
  }
  return Array.from(values, ([key, value]) => ({ key, value }));
}

function isSecretKey(key: string) {
  if (PUBLIC_SAFE_KEYS.has(key)) return false;
  if (key.startsWith('NEXT_PUBLIC_')) return false;
  return SECRET_KEY_PATTERN.test(key) || key.includes('API_KEY');
}

function formatTimestamp(value?: number | null) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

export default function DeploymentSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [controlSecret, setControlSecret] = useState('');
  const [vercelToken, setVercelToken] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const [bulkVariables, setBulkVariables] = useState('');
  const [firebaseWebConfig, setFirebaseWebConfig] = useState('');
  const [firebaseServiceAccount, setFirebaseServiceAccount] = useState('');
  const [deployHookUrl, setDeployHookUrl] = useState('');
  const [serviceValues, setServiceValues] = useState<Record<string, string>>({});
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [overwriteConfirmation, setOverwriteConfirmation] = useState('');
  const [targets, setTargets] = useState<Set<TargetEnvironment>>(new Set(['production', 'preview']));

  const canConnect = Boolean(controlSecret && vercelToken && projectId);
  const sortedVariables = useMemo(() => connection?.variables || [], [connection]);

  const callControlApi = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/admin/deployment-control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-deployment-control-secret': controlSecret,
      },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The deployment-control request failed.');
    return result;
  };

  const inspectProject = async (quiet = false) => {
    if (!canConnect) return;
    setBusyAction('inspect');
    if (!quiet) setStatus(null);
    try {
      const result = await callControlApi({ action: 'inspect', vercelToken, projectId, teamId });
      setConnection(result);
      setAllowOverwrite(false);
      setOverwriteConfirmation('');
      if (!quiet) {
        setStatus({ tone: 'success', message: `Connected to ${result.project.name}. Secret values were not downloaded.` });
      }
    } catch (error) {
      setConnection(null);
      setStatus({ tone: 'warning', message: error instanceof Error ? error.message : 'Unable to connect.' });
    } finally {
      setBusyAction(null);
    }
  };

  const updateTargets = (target: TargetEnvironment, checked: boolean) => {
    setTargets(current => {
      const next = new Set(current);
      if (checked) next.add(target);
      else next.delete(target);
      return next;
    });
  };

  const updateServiceValue = (key: string, value: string) => {
    setServiceValues(current => ({ ...current, [key]: value }));
  };

  const saveService = async (service: ServiceDefinition) => {
    if (!connection) return;
    setBusyAction(service.id);
    setStatus(null);
    try {
      const selectedTargets = Array.from(targets);
      if (!selectedTargets.length) throw new Error('Select at least one Vercel environment.');

      const supplied = service.fields
        .map(field => ({ field, value: field.fixedValue || serviceValues[field.key]?.trim() || '' }))
        .filter(item => item.value);
      if (!supplied.length) throw new Error(`Enter at least one ${service.title} value to save.`);

      const variables = supplied.map(({ field, value }) => {
        const secret = Boolean(field.secret) || isSecretKey(field.key);
        const target = secret ? selectedTargets.filter(item => item !== 'development') : selectedTargets;
        if (!target.length) throw new Error(`${field.key} is secret and must target Production or Preview.`);
        return {
          key: field.key,
          value,
          type: secret ? 'sensitive' : 'encrypted',
          target,
          comment: `${service.title} managed from Trinity deployment control`,
        };
      });

      const result = await callControlApi({
        action: 'upsert',
        vercelToken,
        projectId,
        teamId,
        variables,
        preserveExisting: !allowOverwrite,
      });
      setServiceValues(current => {
        const next = { ...current };
        supplied.forEach(({ field }) => delete next[field.key]);
        return next;
      });
      setStatus({
        tone: 'success',
        message: result.updatedKeys.length
          ? allowOverwrite
            ? `${service.title}: ${result.updatedKeys.length} entered value(s) were intentionally saved to ${connection.project.name}. Complete verification after redeploying.`
            : `${service.title}: ${result.updatedKeys.length} missing value(s) saved. ${result.skippedKeys?.length || 0} existing value(s) were preserved. Complete verification after redeploying.`
          : `${service.title}: no changes were made. All ${result.skippedKeys?.length || 0} submitted key(s) already exist and were preserved.`,
      });
      toast({ title: `${service.title} saved`, description: 'Entered values were cleared from this page.' });
      await inspectProject(true);
    } catch (error) {
      setStatus({ tone: 'warning', message: error instanceof Error ? error.message : `Unable to save ${service.title}.` });
    } finally {
      setBusyAction(null);
    }
  };

  const saveBulkVariables = async () => {
    if (!connection) return;
    setBusyAction('variables');
    setStatus(null);
    try {
      const parsed = parseEnvironmentText(bulkVariables);
      if (!parsed.length) throw new Error('Enter at least one KEY=value line.');
      const selectedTargets = Array.from(targets);
      if (!selectedTargets.length) throw new Error('Select at least one Vercel environment.');

      const variables = parsed.map(({ key, value }) => {
        const secret = isSecretKey(key);
        const target = secret
          ? selectedTargets.filter(item => item !== 'development')
          : selectedTargets;
        if (!target.length) throw new Error(`${key} is secret and must target Production or Preview.`);
        return {
          key,
          value,
          type: secret ? 'sensitive' : 'encrypted',
          target,
          comment: 'Managed from Trinity deployment control',
        };
      });

      const result = await callControlApi({
        action: 'upsert',
        vercelToken,
        projectId,
        teamId,
        variables,
        preserveExisting: !allowOverwrite,
      });
      setBulkVariables('');
      setStatus({
        tone: 'success',
        message: result.updatedKeys.length
          ? allowOverwrite
            ? `${result.updatedKeys.length} entered variable(s) intentionally saved to ${connection.project.name}. Redeploy before expecting the values in that application.`
            : `${result.updatedKeys.length} missing variable(s) saved; ${result.skippedKeys?.length || 0} existing variable(s) preserved. Redeploy before expecting new values in the application.`
          : `No variables changed. ${result.skippedKeys?.length || 0} existing variable(s) were preserved.`,
      });
      toast({ title: 'Variables saved', description: 'Values are now stored by Vercel and were cleared from this form.' });
      await inspectProject(true);
    } catch (error) {
      setStatus({ tone: 'warning', message: error instanceof Error ? error.message : 'Unable to save variables.' });
    } finally {
      setBusyAction(null);
    }
  };

  const seedFirebase = async () => {
    if (!connection) return;
    setBusyAction('firebase');
    setStatus(null);
    try {
      if (!firebaseWebConfig.trim() || !firebaseServiceAccount.trim()) {
        throw new Error('Paste both Firebase JSON documents.');
      }
      const result = await callControlApi({
        action: 'seedFirebase',
        vercelToken,
        projectId,
        teamId,
        webConfigJson: firebaseWebConfig,
        serviceAccountJson: firebaseServiceAccount,
        target: Array.from(targets),
        preserveExisting: !allowOverwrite,
      });
      setFirebaseWebConfig('');
      setFirebaseServiceAccount('');
      setStatus({
        tone: 'success',
        message: result.updatedKeys.length
          ? allowOverwrite
            ? `Firebase ${result.firebaseProjectId} was validated and ${result.updatedKeys.length} variable(s) were intentionally saved to ${connection.project.name}.`
            : `Firebase ${result.firebaseProjectId} was validated. ${result.updatedKeys.length} missing variable(s) were added and ${result.skippedKeys?.length || 0} existing variable(s) were preserved.`
          : `Firebase ${result.firebaseProjectId} was validated, but no active values changed because ${result.skippedKeys?.length || 0} existing variable(s) were preserved.`,
      });
      toast({ title: 'Firebase project seeded', description: 'The credential JSON was cleared from the page.' });
      await inspectProject(true);
    } catch (error) {
      setStatus({ tone: 'warning', message: error instanceof Error ? error.message : 'Unable to seed Firebase.' });
    } finally {
      setBusyAction(null);
    }
  };

  const deploy = async () => {
    setBusyAction('deploy');
    setStatus(null);
    try {
      if (!deployHookUrl) throw new Error('Paste the production deploy-hook URL first.');
      const result = await callControlApi({ action: 'deploy', deployHookUrl });
      setDeployHookUrl('');
      setStatus({ tone: 'success', message: `Vercel accepted the deployment request (${result.deployment.state}). Monitor the new deployment before moving production traffic.` });
    } catch (error) {
      setStatus({ tone: 'warning', message: error instanceof Error ? error.message : 'Unable to start deployment.' });
    } finally {
      setBusyAction(null);
    }
  };

  if (user && user.role !== 'Admin') {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <PageHeader title="Deployment Control" description="Infrastructure credentials are restricted to system administrators." />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Administrator access required</AlertTitle>
          <AlertDescription>You do not have permission to use deployment control.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Deployment Control"
        description="Safely maintain credentials for each independent Vercel and Firebase production pair without exposing private values or changing the other live system."
      />

      <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Secrets stay temporary on this page</AlertTitle>
        <AlertDescription>
          Tokens and credential JSON are held only in this tab and sent to a server-only endpoint. They are never saved in local storage, Firestore, or returned by the API. Closing or refreshing this page clears them.
        </AlertDescription>
      </Alert>

      <Alert className="border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
        <Database className="h-4 w-4" />
        <AlertTitle>Two independent live systems</AlertTitle>
        <AlertDescription>
          Manage each Vercel/Firebase pair separately. Connect with Account A's Vercel token only when working on Account A, and use only Firebase A's JSON there. Then repeat independently for Account B. This page never copies, merges, or deletes data between the two Firebase databases.
        </AlertDescription>
      </Alert>

      {status && (
        <Alert
          aria-live="polite"
          className={status.tone === 'success'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'}
        >
          {status.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle>{status.tone === 'success' ? 'Operation completed' : 'Action required'}</AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-slate-900 p-2 text-white dark:bg-slate-100 dark:text-slate-900"><KeyRound className="h-5 w-5" /></div>
            <div>
              <CardTitle>Authorise this session</CardTitle>
              <CardDescription className="mt-1">The control secret protects this application; the Vercel token limits actions to projects that token can access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="control-secret">Deployment control secret</Label>
            <Input id="control-secret" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={controlSecret} onChange={event => setControlSecret(event.target.value)} placeholder="DEPLOYMENT_CONTROL_SECRET" />
            <p className="text-xs text-muted-foreground">Bootstrap this once on the current host using a random value of at least 24 characters.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="vercel-token">Vercel access token</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setShowSecrets(value => !value)}>
                {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSecrets ? 'Hide' : 'Show'}
              </Button>
            </div>
            <Input
              id="vercel-token"
              type={showSecrets ? 'text' : 'password'}
              autoComplete="off"
              value={vercelToken}
              onChange={event => {
                setVercelToken(event.target.value);
                setConnection(null);
                setAllowOverwrite(false);
                setOverwriteConfirmation('');
              }}
              placeholder="Token with project environment access"
            />
            <p className="text-xs text-muted-foreground">Use a scoped token from the Vercel account that owns the target project.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-id">Vercel project ID or name</Label>
            <Input
              id="project-id"
              value={projectId}
              onChange={event => {
                setProjectId(event.target.value);
                setConnection(null);
                setAllowOverwrite(false);
                setOverwriteConfirmation('');
              }}
              placeholder="trinity-family-school"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-id">Vercel team ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="team-id"
              value={teamId}
              onChange={event => {
                setTeamId(event.target.value);
                setConnection(null);
                setAllowOverwrite(false);
                setOverwriteConfirmation('');
              }}
              placeholder="team_…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <Button onClick={() => inspectProject()} disabled={!canConnect || busyAction !== null} className="gap-2">
              {busyAction === 'inspect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudCog className="h-4 w-4" />}
              Connect without downloading values
            </Button>
            {connection && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{connection.project.name}</Badge>
                <span className="text-muted-foreground">{connection.account.email || connection.account.username || 'Vercel account'} · {connection.variables.length} variables</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <fieldset className="rounded-xl border bg-card p-4" disabled={!connection || busyAction !== null}>
        <legend className="px-2 text-sm font-semibold">Target environments</legend>
        <div className="flex flex-wrap gap-5">
          {(['production', 'preview', 'development'] as TargetEnvironment[]).map(target => (
            <div key={target} className="flex items-center gap-2">
              <Checkbox id={`target-${target}`} checked={targets.has(target)} onCheckedChange={checked => updateTargets(target, checked === true)} />
              <Label htmlFor={`target-${target}`} className="capitalize">{target}</Label>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Vercel sensitive variables can only target Production and Preview. Public Firebase configuration may also target Development.</p>
      </fieldset>

      <Card className={allowOverwrite ? 'border-red-400 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20' : 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
          <Checkbox
            id="allow-overwrite"
            checked={allowOverwrite}
            disabled={!connection || overwriteConfirmation !== connection.project.name || busyAction !== null}
            onCheckedChange={checked => setAllowOverwrite(checked === true)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="allow-overwrite" className="font-semibold">
              Allow entered values to replace existing credentials in this connected Vercel project
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Keep this off for normal setup and preservation. With it off, the server checks existing key names and adds only missing keys; active values are never overwritten. Turn it on only for an intentional credential rotation, after confirming the connected project badge above.
            </p>
            {connection && (
              <div className="max-w-md space-y-1.5 pt-1">
                <Label htmlFor="overwrite-confirmation" className="text-xs font-medium">
                  To unlock replacement, type the connected project name: <span className="font-mono">{connection.project.name}</span>
                </Label>
                <Input
                  id="overwrite-confirmation"
                  value={overwriteConfirmation}
                  onChange={event => {
                    setOverwriteConfirmation(event.target.value);
                    if (event.target.value !== connection.project.name) setAllowOverwrite(false);
                  }}
                  autoComplete="off"
                  placeholder={connection.project.name}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-base">Exact setup flow</CardTitle>
          <CardDescription>Follow this order for a live system. Save one integration at a time so a failed provider can be isolated without changing the others.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
          {[
            'Authorise this tab and connect to the exact Vercel project.',
            'Select Preview and Production; configure one service card at a time.',
            'Open Configured keys and confirm every required name is present.',
            'Trigger a deployment and test the generated Vercel URL first.',
            'After Account A passes, repeat the same isolated process for Account B; do not move or merge either database.',
          ].map((step, index) => (
            <div key={step} className="rounded-lg border bg-background/80 p-4">
              <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white">{index + 1}</span>
              <p className="leading-relaxed">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="services" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-5">
          <TabsTrigger value="services">API services</TabsTrigger>
          <TabsTrigger value="variables">Advanced bulk</TabsTrigger>
          <TabsTrigger value="firebase">Firebase</TabsTrigger>
          <TabsTrigger value="configured">Configured keys</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-5">
          <Alert className="border-emerald-200 bg-emerald-50/60 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Only filled fields are changed</AlertTitle>
            <AlertDescription>
              Empty fields never change anything. In the default preservation mode, even filled fields are skipped when that key already exists. To rotate a credential intentionally, first enable the red replacement control and confirm the connected account.
            </AlertDescription>
          </Alert>

          <div className="grid gap-5 xl:grid-cols-2">
            {SERVICE_DEFINITIONS.map(service => {
              const configuredCount = service.fields.filter(field =>
                connection?.variables.some(variable => variable.key === field.key)
              ).length;
              const hasInput = service.fields.some(field => field.fixedValue || serviceValues[field.key]?.trim());

              return (
                <Card key={service.id} className="flex h-full flex-col overflow-hidden">
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{service.title}</CardTitle>
                        <CardDescription className="mt-1 leading-relaxed">{service.purpose}</CardDescription>
                      </div>
                      <Badge variant={configuredCount === service.fields.length ? 'default' : 'secondary'}>
                        {configuredCount}/{service.fields.length} keys present
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-5 p-5">
                    <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">Where it is used: </span>{service.scope}
                    </div>

                    {service.warning && (
                      <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Important</AlertTitle>
                        <AlertDescription>{service.warning}</AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold">Step by step</h3>
                      <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {service.steps.map((step, index) => (
                          <li key={step} className="flex gap-2.5">
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-semibold text-foreground">{index + 1}</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-4">
                      {service.fields.map(field => {
                        const configured = connection?.variables.some(variable => variable.key === field.key);
                        const browserVisible = field.key.startsWith('NEXT_PUBLIC_');
                        return (
                          <div key={field.key} className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor={`${service.id}-${field.key}`}>{field.label}</Label>
                              {configured && <Badge variant="outline" className="text-[10px]">Currently configured</Badge>}
                              {browserVisible && <Badge variant="secondary" className="text-[10px]">Browser-visible</Badge>}
                              {field.secret && <Badge className="text-[10px]">Sensitive</Badge>}
                            </div>
                            <Input
                              id={`${service.id}-${field.key}`}
                              type={field.secret && !showSecrets ? 'password' : 'text'}
                              autoComplete="off"
                              spellCheck={false}
                              value={field.fixedValue || serviceValues[field.key] || ''}
                              readOnly={Boolean(field.fixedValue)}
                              onChange={event => updateServiceValue(field.key, event.target.value)}
                              placeholder={configured ? 'Leave empty to keep the current value' : field.placeholder}
                              aria-describedby={`${service.id}-${field.key}-help`}
                            />
                            <p id={`${service.id}-${field.key}-help`} className="text-xs leading-relaxed text-muted-foreground">
                              <span className="font-mono text-[11px] text-foreground">{field.key}</span> - {field.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-auto space-y-3 border-t pt-4">
                      <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Verify after deployment:</span> {service.verification}</p>
                      <Button
                        onClick={() => saveService(service)}
                        disabled={!connection || !hasInput || busyAction !== null}
                        className="w-full gap-2 sm:w-auto"
                      >
                        {busyAction === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        Save {service.title}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="variables">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ServerCog className="h-5 w-5" /> Add or replace variables</CardTitle>
              <CardDescription>Paste KEY=value pairs. Preservation mode adds only missing names; intentional replacement must be unlocked above. Entered values are cleared after success.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Browser-visible prefix</AlertTitle>
                <AlertDescription>Anything named NEXT_PUBLIC_* is compiled into browser code. Never use that prefix for passwords, private keys, access tokens, or webhook secrets.</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="bulk-variables">Environment variables</Label>
                <Textarea id="bulk-variables" value={bulkVariables} onChange={event => setBulkVariables(event.target.value)} autoComplete="off" spellCheck={false} className="min-h-56 font-mono text-xs" placeholder={'WIZA_SMS_USERNAME=…\nWIZA_SMS_PASSWORD=…\nSCHOOLPAY_SCHOOL_CODE=…'} />
              </div>
              <Button onClick={saveBulkVariables} disabled={!connection || !bulkVariables.trim() || busyAction !== null} className="gap-2">
                {busyAction === 'variables' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Save securely to Vercel
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firebase">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Verify and complete this deployment's Firebase configuration</CardTitle>
              <CardDescription>The server verifies that both JSON documents belong to the same Firebase project and tests Firestore access. In preservation mode it adds only missing Vercel keys and leaves all existing Firebase credentials unchanged.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firebase-web-config">Firebase web app configuration JSON</Label>
                  <Textarea id="firebase-web-config" value={firebaseWebConfig} onChange={event => setFirebaseWebConfig(event.target.value)} autoComplete="off" spellCheck={false} className="min-h-64 font-mono text-xs" placeholder={'{\n  "apiKey": "…",\n  "authDomain": "…",\n  "projectId": "…",\n  "storageBucket": "…",\n  "messagingSenderId": "…",\n  "appId": "…"\n}'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firebase-service-account">Firebase Admin service-account JSON</Label>
                  <Textarea id="firebase-service-account" value={firebaseServiceAccount} onChange={event => setFirebaseServiceAccount(event.target.value)} autoComplete="off" spellCheck={false} className="min-h-64 font-mono text-xs" placeholder={'{\n  "project_id": "…",\n  "client_email": "…",\n  "private_key": "…"\n}'} />
                </div>
              </div>
              <Alert className="border-blue-200 bg-blue-50/60 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Compatibility protection</AlertTitle>
                <AlertDescription>The wizard seeds both FIREBASE_ADMIN_* and the legacy FIREBASE_* names still used by notification components, preventing a project switch from silently breaking active services.</AlertDescription>
              </Alert>
              <Button onClick={seedFirebase} disabled={!connection || !firebaseWebConfig.trim() || !firebaseServiceAccount.trim() || busyAction !== null} className="gap-2">
                {busyAction === 'firebase' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Validate and seed Firebase
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configured">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Configured variable keys</CardTitle>
                  <CardDescription>Values are intentionally never requested or displayed.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => inspectProject()} disabled={!connection || busyAction !== null} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${busyAction === 'inspect' ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!connection ? (
                <p className="p-6 text-sm text-muted-foreground">Connect to a Vercel project to inspect configured keys.</p>
              ) : sortedVariables.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No project environment variables were found.</p>
              ) : (
                <div className="divide-y">
                  {sortedVariables.map(variable => (
                    <div key={variable.id || `${variable.key}-${variable.target.join('-')}`} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">{variable.key}</p>
                        <p className="text-xs text-muted-foreground">Updated {formatTimestamp(variable.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={variable.type === 'sensitive' ? 'default' : 'secondary'}>{variable.type}</Badge>
                        {variable.target.map(target => <Badge key={target} variant="outline" className="capitalize">{target}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deploy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" /> Activate saved variables</CardTitle>
              <CardDescription>Vercel environment changes only affect a new deployment. This action calls an official project deploy hook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Production change</AlertTitle>
                <AlertDescription>First confirm all required keys are present. Triggering the hook starts a new build; it does not alter the currently running deployment until Vercel finishes successfully.</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="deploy-hook">Production deploy-hook URL</Label>
                <Input id="deploy-hook" type={showSecrets ? 'text' : 'password'} autoComplete="off" value={deployHookUrl} onChange={event => setDeployHookUrl(event.target.value)} placeholder="https://api.vercel.com/v1/integrations/deploy/…" />
                <p className="text-xs text-muted-foreground">Create this once under Vercel Project Settings → Git → Deploy Hooks. Treat it like a password.</p>
              </div>
              <Button onClick={deploy} disabled={!deployHookUrl || !controlSecret || busyAction !== null} className="gap-2">
                {busyAction === 'deploy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start a new Vercel deployment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Safe operating order for both live deployments</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          {[
            'Connect to Vercel Account A and confirm its exact project badge; keep preservation mode on.',
            'Review or add only missing credentials for Firebase A and Account A services, then test Account A.',
            'Disconnect by changing/clearing the token, then repeat independently with Vercel Account B and Firebase B.',
            'Never paste Firebase A credentials into Account B. Keep both production domains and databases active.',
          ].map((step, index) => (
            <div key={step} className="rounded-lg border bg-muted/30 p-4">
              <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
              <p className="leading-relaxed">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
