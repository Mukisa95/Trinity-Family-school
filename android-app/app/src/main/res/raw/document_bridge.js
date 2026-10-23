/* School-origin main-frame client shared by workspace jobs and ordinary exports. */
(() => {
  if (window !== window.top || window.trinityFiles || !window.TrinityDocuments) return;
  const bridge = window.TrinityDocuments, pending = new Map(), jobs = new Set(), saved = new WeakMap(), saving = new WeakMap(), progressTimes = new Map();
  const CHUNK = 96 * 1024, MAX = 100 * 1024 * 1024;
  bridge.onmessage = event => {
    try {
      const value = JSON.parse(event.data), entry = pending.get(value.id); if (!entry) return;
      pending.delete(value.id); clearTimeout(entry.timer);
      value.ok ? entry.resolve(value) : entry.reject(new Error(value.error || 'Unable to save the document.'));
    } catch (_) { /* Stale or invalid replies have no privileges. */ }
  };
  function request(action, input = {}, timeout = 30000) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Document saving timed out. Try again.')); }, timeout);
      pending.set(id, { resolve, reject, timer });
      try { bridge.postMessage(JSON.stringify({ ...input, id, action })); }
      catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  const prepare = () => request('prepare', {}, 180000);
  const encode = blob => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Unable to read this document.')); reader.readAsDataURL(blob);
  });
  async function upload(blob, fileName, jobId) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > MAX) throw new Error('Choose a document smaller than 100 MB.');
    const fileId = jobId || crypto.randomUUID();
    try {
      await request('begin', { fileId, fileName, bytes: blob.size, jobId: jobId || '' });
      for (let offset = 0, sequence = 0; offset < blob.size; offset += CHUNK, sequence++) {
        const data = await encode(blob.slice(offset, offset + CHUNK));
        await request('chunk', { fileId, sequence, data });
      }
      const result = await request('commit', { fileId }, 180000);
      saved.set(blob, { fileId, fileName }); return result;
    } catch (error) {
      await request('cancel', { jobId: jobId || fileId, error: 'File saving failed.' }).catch(() => {}); throw error;
    }
  }
  const api = {
    async start(job) { await prepare(); await request('start', job); jobs.add(job.jobId); },
    progress(jobId, progress, message) {
      const now = Date.now(); if (now - (progressTimes.get(jobId) || 0) < 400 && progress < 95) return;
      progressTimes.set(jobId, now);
      bridge.postMessage(JSON.stringify({ id: crypto.randomUUID(), action: 'progress', jobId, progress, message: message || 'Creating document' }));
    },
    async complete(jobId, blob, fileName) { try { return await upload(blob, fileName, jobId); } finally { jobs.delete(jobId); progressTimes.delete(jobId); } },
    async cancel(jobId, error) { jobs.delete(jobId); progressTimes.delete(jobId); await request('cancel', { jobId, error: error || '' }); },
    async save(blob, fileName) {
      if (!(blob instanceof Blob) || !blob.size || blob.size > MAX) throw new Error('Choose a document smaller than 100 MB.');
      const current = saving.get(blob); if (current?.fileName === fileName) return current.promise;
      const promise = (async () => {
        await prepare(); const previous = saved.get(blob);
        if (previous?.fileName === fileName) try { return await request('reuse', { fileId: previous.fileId }); } catch (_) { saved.delete(blob); }
        return upload(blob, fileName);
      })();
      saving.set(blob, { fileName, promise });
      try { return await promise; } finally { if (saving.get(blob)?.promise === promise) saving.delete(blob); }
    },
    async downloadURL(url, fileName) {
      const jobId = crypto.randomUUID();
      try {
        const source = new URL(url, location.href);
        if (!((source.protocol === 'blob:' && source.origin === location.origin) || source.protocol === 'data:' || (source.protocol === 'https:' && source.origin === location.origin))) throw new Error('Open this link in your browser to download it.');
        // Acquire blob URLs during the click: many exporters revoke them as
        // soon as their anchor returns, before Android's folder picker closes.
        const fetching = fetch(source.href, { credentials: 'same-origin' }).then(response => ({ response }), error => ({ error }));
        await api.start({ jobId, title: 'Saving ' + (fileName || 'document.pdf'), fileName: fileName || 'document.pdf' });
        const fetched = await fetching; if (fetched.error) throw fetched.error;
        const response = fetched.response;
        if (!response.ok) throw new Error('The document could not be downloaded. Try again.');
        if (Number(response.headers.get('content-length')) > MAX) throw new Error('Choose a document smaller than 100 MB.');
        let blob;
        if (response.body) {
          const reader = response.body.getReader(), chunks = []; let size = 0;
          while (true) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength; if (size > MAX) { await reader.cancel(); throw new Error('Choose a document smaller than 100 MB.'); }
            chunks.push(part.value);
          }
          blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
        } else blob = await response.blob();
        const result = await api.complete(jobId, blob, fileName || 'document.pdf');
        if (!result.saved) throw new Error('The document is ready but could not be saved in Trinity Files. Try again.');
      } catch (error) { await request('notice', { message: error.message || 'Unable to save the document.' }).catch(() => {}); }
      finally { await api.cancel(jobId).catch(() => {}); }
    },
  };
  window.trinityFiles = api;
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[download]') : null;
    if (!link || event.defaultPrevented || !/\.(pdf|png|jpe?g|csv|txt|json|docx?|xlsx?|zip)$/i.test(link.download)) return;
    const url = new URL(link.href, location.href);
    if (url.protocol !== 'data:' && url.origin !== location.origin) return;
    event.preventDefault(); void api.downloadURL(link.href, link.download);
  }, true);
  window.addEventListener('pagehide', () => { for (const jobId of jobs) bridge.postMessage(JSON.stringify({ id: crypto.randomUUID(), action: 'cancel', jobId, error: 'Document page closed.' })); });
  window.dispatchEvent(new Event('trinity-documents-ready'));
})();
