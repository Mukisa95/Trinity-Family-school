export interface NativeDocumentFiles {
  start(job: { jobId: string; title: string; fileName: string }): Promise<void>;
  progress(jobId: string, progress: number, message?: string): void;
  complete(jobId: string, blob: Blob, fileName: string): Promise<{ saved: boolean }>;
  preview?(jobId: string, blob: Blob, fileName: string): Promise<{ saved: boolean }>;
  cancel(jobId: string, message?: string): Promise<void>;
  save(blob: Blob, fileName: string): Promise<{ saved: boolean }>;
}
declare global { interface Window { trinityFiles?: NativeDocumentFiles } }
export function nativeDocumentFiles(): NativeDocumentFiles | undefined {
  return typeof window === 'undefined' ? undefined : window.trinityFiles;
}

/** Stream native exports without moving the PDF into a different browser. */
export async function saveDocumentFile(blob: Blob, fileName: string) {
  const native = nativeDocumentFiles();
  if (native) {
    const result = await native.save(blob, fileName);
    if (!result.saved) throw new Error('The document could not be saved. Try downloading it again.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
