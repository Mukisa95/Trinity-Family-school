'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidPromotionRanking, type PromotionRankingConfig } from '@/lib/utils/promotion-ranking';

type PromotionRankingOptionsProps = {
  config: PromotionRankingConfig;
  onChange: (next: PromotionRankingConfig) => void;
};

const BANDS = [
  ['promoted', 'Promoted'],
  ['probation', 'Promoted on probation'],
  ['repeat', 'Advised to repeat'],
] as const;

export function PromotionRankingOptions({ config, onChange }: PromotionRankingOptionsProps) {
  return (
    <section aria-label="Term 3 promotion ranking" className="mt-4 space-y-3 rounded-2xl border border-brand-200 bg-brand-surface-50/60 p-4 dark:border-brand-800/60 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <Checkbox
          id="enable-promotion-ranking"
          checked={config.enabled}
          onCheckedChange={enabled => onChange({ ...config, enabled: enabled === true })}
        />
        <Label htmlFor="enable-promotion-ranking" className="cursor-pointer font-semibold">Term 3 promotion ranking</Label>
      </div>
      <p className="text-xs text-muted-foreground">Print the ranking below Division in bold red. The report layout stays in place.</p>
      {config.enabled && (
        <div className="space-y-3">
          {BANDS.map(([key, label]) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold">{label}</span>
              <div className="flex items-center gap-2">
                {(['min', 'max'] as const).map((bound, index) => (
                  <span key={bound} className="flex items-center gap-2">
                    {index > 0 && <span className="text-xs">to</span>}
                    <Input
                      type="number"
                      min={4}
                      max={36}
                      step={1}
                      aria-label={`${label} ${bound}`}
                      value={Number.isFinite(config.ranges[key][bound]) ? config.ranges[key][bound] : ''}
                      onChange={event => onChange({
                        ...config,
                        ranges: {
                          ...config.ranges,
                          [key]: { ...config.ranges[key], [bound]: event.target.value === '' ? Number.NaN : Number(event.target.value) },
                        },
                      })}
                      className="h-9 w-16 rounded-xl"
                    />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!isValidPromotionRanking(config) && <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">Use whole-number ranges from 4 to 36 without overlaps.</p>}
    </section>
  );
}
