"use client";
import { useClasses } from '@/lib/hooks/use-classes';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { circumferenceOf, permitsClass, type Circumference } from '@/lib/access/circumference';
import { getCircumferenceUser } from '@/lib/access/circumference-session';

export function CircumferenceEditor({ value, onChange, disabled = false }: { value?: Circumference; onChange: (scope: Circumference) => void; disabled?: boolean }) {
  const { data: availableClasses = [], isLoading, error } = useClasses();
  const scope = circumferenceOf({role: 'Staff', circumference: value});
  const maximum = circumferenceOf(getCircumferenceUser());
  const classes = availableClasses.filter(item => permitsClass(maximum, item.id));
  const toggle = (axis: keyof Circumference, item: string, checked: boolean) => {
    const previous = scope[axis] || [];
    onChange({ ...scope, [axis]: checked ? [...new Set([...previous, item])] : previous.filter(entry => entry !== item) });
  };
  const groups = [...new Set(classes.map(item => item.level || 'Other'))];
  return <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4" aria-label="Circumference">
    <div><h3 className="text-base font-semibold text-foreground">Circumference</h3><p className="mt-1 text-sm text-muted-foreground">Choose which pupils this account can access. Classes, section and gender apply together across every permitted page.</p></div>
    <fieldset disabled={disabled} className="space-y-3"><legend className="mb-2 text-sm font-medium">Classes</legend>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={maximum.classIds !== null} variant={scope.classIds === null ? 'default' : 'outline'} className="min-h-11" onClick={() => onChange({ ...scope, classIds: null })}>All classes</Button><Button type="button" variant={scope.classIds !== null ? 'default' : 'outline'} className="min-h-11" onClick={() => onChange({ ...scope, classIds: scope.classIds ?? [] })}>Selected classes</Button></div>
      {scope.classIds !== null && <div className="space-y-3">
        {isLoading ? <p role="status" className="text-sm">Loading classes…</p> : error ? <p role="alert" className="text-sm text-destructive">Classes could not be loaded. Retry before choosing a scope.</p> : <>
          <div className="flex flex-wrap gap-2">{groups.map(group => <Button key={group} type="button" variant="outline" size="sm" className="min-h-11" onClick={() => onChange({ ...scope, classIds: [...new Set([...(scope.classIds || []), ...classes.filter(item => (item.level || 'Other') === group).map(item => item.id)])] })}>Add {group}</Button>)}<Button type="button" variant="ghost" className="min-h-11" onClick={() => onChange({ ...scope, classIds: [] })}>Clear classes</Button></div>
          <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">{classes.map(item => <Label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"><Checkbox checked={scope.classIds!.includes(item.id)} onCheckedChange={checked => toggle('classIds', item.id, checked === true)} aria-label={item.name} /><span className="min-w-0 break-words">{item.name}</span></Label>)}</div>
          {scope.classIds.length === 0 && <p className="text-sm text-destructive">No classes selected. This account will have no pupil access.</p>}
        </>}
      </div>}
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">{([{ axis: 'sections', label: 'Section', all: 'All sections', values: ['Day', 'Boarding'] }, { axis: 'genders', label: 'Gender', all: 'All genders', values: ['Male', 'Female'] }] as const).map(group => <fieldset key={group.axis} disabled={disabled} className="space-y-2"><legend className="mb-2 text-sm font-medium">{group.label}</legend><Label className="flex min-h-11 cursor-pointer items-center gap-3"><Checkbox disabled={maximum[group.axis] !== null} checked={scope[group.axis] === null} onCheckedChange={checked => onChange({ ...scope, [group.axis]: checked ? null : [] })} aria-label={group.all} />{group.all}</Label>{group.values.map(item => <Label key={item} className="flex min-h-11 cursor-pointer items-center gap-3"><Checkbox disabled={maximum[group.axis] !== null && !(maximum[group.axis] as string[]).includes(item)} checked={scope[group.axis]?.includes(item as never) ?? false} onCheckedChange={checked => toggle(group.axis, item, checked === true)} aria-label={item} />{item}</Label>)}</fieldset>)}</div>
    <p className="text-xs text-muted-foreground">Page permissions decide what the user can do. Circumference decides whose records they can use. Existing accounts keep their current access until you set a restriction.</p>
  </section>;
}
