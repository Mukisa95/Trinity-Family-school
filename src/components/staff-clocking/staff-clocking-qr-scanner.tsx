'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, CircleAlert, Loader2, ScanLine, ShieldCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubmitStaffClockingScan } from '@/lib/hooks/use-staff-clocking';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

function scannerConstructor() {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

function operationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `clock_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function StaffClockingQrScanner({ available }: { available: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream>();
  const generationRef = useRef(0);
  const pendingRef = useRef<{ token: string; operationId: string }>();
  const scanningRef = useRef(false);
  const submittingRef = useRef(false);
  const submit = useSubmitStaffClockingScan();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [needsAppUpdate, setNeedsAppUpdate] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const stopCamera = () => {
    generationRef.current += 1;
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setCameraActive(false);
    setCameraStarting(false);
  };

  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') stopCamera(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stopCamera);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', stopCamera); stopCamera(); };
  }, []);
  useEffect(() => { if (!available) stopCamera(); }, [available]);

  const recordToken = (token: string) => {
    if (!token || submittingRef.current) return;
    submittingRef.current = true;
    setMessage(undefined);
    stopCamera();
    const input = pendingRef.current?.token === token ? pendingRef.current : { token, operationId: operationId() };
    pendingRef.current = input;
    submit.mutate(input, {
      onSuccess: (result) => {
        pendingRef.current = undefined;
        const value = result as { duplicate?: boolean; event?: { type?: string; arrivalStatus?: string } };
        const event = value.event;
        setMessage(value.duplicate ? 'This clocking request was already saved.' : event?.type === 'clock_out'
          ? 'Clock out recorded successfully.'
          : `Clock in recorded${event?.arrivalStatus ? ` as ${event.arrivalStatus.replace('_', ' ')}` : ''}.`);
      },
      onError: (error) => setMessage(error.message),
      onSettled: () => { submittingRef.current = false; },
    });
  };

  const startCamera = async () => {
    if (!available || cameraStarting || scanningRef.current) return;
    const generation = ++generationRef.current;
    setCameraStarting(true);
    setMessage(undefined);
    setNeedsAppUpdate(false);
    try {
      if (hasAndroidOfflineBridge()) {
        const capabilities = await androidOfflineRequest('deviceCapabilities', {}, 5_000).catch(() => {
          throw new Error('Camera support could not be checked. Close and reopen the school app, then try again.');
        });
        if (generation !== generationRef.current) return;
        if (capabilities.webCameraCapture !== true) {
          setNeedsAppUpdate(true);
          throw new Error('This Android app version cannot open the QR camera. Install the latest school app update, then try again.');
        }
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera scanning needs a secure connection and camera permission.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('The camera preview could not start.');
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      setMessage(undefined);
      setCameraActive(true);
      setCameraStarting(false);
      scanningRef.current = true;
      const Detector = scannerConstructor();
      if (!Detector) {
        const { default: decodeQr } = await import('jsqr');
        if (generation !== generationRef.current) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('The camera reader is unavailable on this device.');
        const decodeFrame = () => {
          if (!scanningRef.current || generation !== generationRef.current) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1, 720 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = decodeQr(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
            if (result?.data) { recordToken(result.data); return; }
          }
          window.setTimeout(decodeFrame, 180);
        };
        decodeFrame();
        return;
      }
      const detector = new Detector({ formats: ['qr_code'] });
      const scan = async () => {
        if (!scanningRef.current || generation !== generationRef.current || !videoRef.current) return;
        try {
          const matches = await detector.detect(videoRef.current);
          const token = matches.find((match) => match.rawValue)?.rawValue;
          if (token && generation === generationRef.current && scanningRef.current) {
            recordToken(token);
            return;
          }
        } catch {
          // A partially loaded video frame is expected while the camera starts.
        }
        window.setTimeout(scan, 180);
      };
      void scan();
    } catch (error) {
      if (generation === generationRef.current) {
        stopCamera();
        const name = error instanceof Error ? error.name : '';
        setMessage(name === 'NotAllowedError' || name === 'SecurityError'
          ? hasAndroidOfflineBridge()
            ? 'Camera permission was denied. Open Android Settings, select this school app, then Permissions and allow Camera. Return here and try again.'
            : 'Camera permission was denied. Allow camera access in your browser site settings, then try again.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : name === 'NotReadableError'
              ? 'The camera is busy or unavailable. Close other apps using it, then try again.'
              : error instanceof Error ? error.message : 'Camera access was not available. Check the camera permission and try again.');
      }
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    recordToken(manualToken.trim());
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-black" aria-busy={cameraStarting}>
        <video ref={videoRef} className={cameraActive || cameraStarting ? 'aspect-[3/4] w-full object-cover sm:aspect-video' : 'hidden'} autoPlay muted playsInline aria-label="Camera preview for staff clocking QR scan" />
        {!cameraActive && (
          <div className={`${cameraStarting ? 'absolute inset-0' : 'aspect-[3/4] sm:aspect-video'} flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100`}>
            {cameraStarting ? <Loader2 className="h-10 w-10 animate-spin text-slate-300" aria-hidden="true" /> : <Camera className="h-10 w-10 text-slate-300" aria-hidden="true" />}
            <p className="mt-3 font-semibold">{cameraStarting ? 'Opening camera…' : 'Camera is off'}</p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-300">{cameraStarting ? 'Allow camera access if your device asks for permission.' : 'Start a scan only when you are standing at the school\'s rotating QR display.'}</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" className="min-h-12" onClick={startCamera} disabled={!available || cameraStarting || cameraActive || submit.isPending}>
          {submit.isPending || cameraStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          {cameraStarting ? 'Opening camera…' : cameraActive ? 'Scanning QR' : 'Scan school QR'}
        </Button>
        {(cameraActive || cameraStarting) && <Button type="button" variant="outline" className="min-h-12" onClick={stopCamera}><Square className="h-4 w-4" /> Stop camera</Button>}
        {submit.isError && pendingRef.current && <Button type="button" variant="outline" className="min-h-12" onClick={() => recordToken(pendingRef.current!.token)} disabled={submit.isPending}>Retry last request</Button>}
      </div>
      {message && <div role="status" className="flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{message}</div>}
      {needsAppUpdate && <Button asChild variant="outline"><a href="/download">Get the latest school app</a></Button>}
      <form className="rounded-xl border border-border/80 bg-background/70 p-4" onSubmit={submitManual}>
        <Label htmlFor="staff-clocking-token">Scan payload from an approved scanner</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Use this only if your approved scanner supplies the school QR payload. The token is short-lived and still receives full server validation.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input id="staff-clocking-token" value={manualToken} onChange={(event) => setManualToken(event.target.value)} placeholder="Paste scan payload" autoComplete="off" disabled={!available || submit.isPending} />
          <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={!available || submit.isPending || manualToken.trim().length < 20}>Submit scan</Button>
        </div>
      </form>
      <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Your camera image stays on this device. The server records the verified result, not the video.</p>
    </div>
  );
}
