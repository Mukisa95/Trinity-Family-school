"use client";

import { normalizeStudioPupilPhotoTreatment, type StudioPupilPhotoTreatment } from './custom-photo-types';

export function StudioPhotoTreatmentControls({ value, onChange }: { value?: StudioPupilPhotoTreatment; onChange: (value: StudioPupilPhotoTreatment) => void }) {
  const settings = normalizeStudioPupilPhotoTreatment(value);
  return <fieldset className="mt-3 space-y-2 rounded-xl border border-violet-200 bg-violet-50/80 p-3">
    <legend className="px-1 text-xs font-bold text-violet-900">All pupil photos</legend>
    <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-violet-900">
      <input type="checkbox" aria-label="Remove backgrounds from all pupil photos" className="h-4 w-4 shrink-0 accent-violet-600" checked={settings.removeBackground} onChange={event => onChange({ ...settings, removeBackground: event.target.checked })} />
      Remove backgrounds throughout this document
    </label>
    {settings.removeBackground && <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1 text-xs text-violet-900">Feather (px)<input type="number" aria-label="Shared photo feather" min={0} max={50} step={1} className="h-11 w-full rounded-md border border-violet-200 bg-white px-2" value={settings.feather} onChange={event => onChange(normalizeStudioPupilPhotoTreatment({ ...settings, feather: event.currentTarget.valueAsNumber }))} /></label>
      <label className="space-y-1 text-xs text-violet-900">Edge shift (px)<input type="number" aria-label="Shared photo edge shift" min={-12} max={12} step={1} className="h-11 w-full rounded-md border border-violet-200 bg-white px-2" value={settings.edgeShift} onChange={event => onChange(normalizeStudioPupilPhotoTreatment({ ...settings, edgeShift: event.currentTarget.valueAsNumber }))} /></label>
    </div>}
    <p className="text-xs leading-relaxed text-violet-800">Each pupil keeps their own photo. This treatment follows every pupil photo on every page, including pupils you select later. Individual pixel corrections take priority. Original pupil records stay unchanged.</p>
  </fieldset>;
}
