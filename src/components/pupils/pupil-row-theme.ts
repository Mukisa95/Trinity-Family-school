// Complete utilities keep Tailwind generation and dark hover/focus states reliable.
const PUPIL_ROW_THEMES = {
  female: {
    row: "hover:bg-pink-50 focus-within:bg-pink-50 dark:hover:bg-pink-950/45 dark:focus-within:bg-pink-950/45 transition-colors duration-150 motion-reduce:transition-none",
    name: "text-pink-600 hover:text-pink-800 dark:text-pink-300 dark:hover:text-pink-200",
    sibling: "text-pink-700 hover:text-pink-900 dark:text-pink-300 dark:hover:text-pink-200",
    detail: "text-pink-900 hover:text-pink-600 dark:text-pink-300 dark:hover:text-pink-200",
    action: "text-pink-900 hover:text-pink-600 hover:bg-pink-50/50 dark:text-pink-300 dark:hover:text-pink-200 dark:hover:bg-pink-900/35",
  },
  male: {
    row: "hover:bg-brand-alt-surface-50 focus-within:bg-brand-alt-surface-50 dark:hover:bg-brand-alt-surface-950/45 dark:focus-within:bg-brand-alt-surface-950/45 transition-colors duration-150 motion-reduce:transition-none",
    name: "text-brand-alt-ink-600 hover:text-brand-alt-ink-800 dark:text-brand-alt-ink-300 dark:hover:text-brand-alt-ink-200",
    sibling: "text-brand-alt-ink-700 hover:text-brand-alt-ink-900 dark:text-brand-alt-ink-300 dark:hover:text-brand-alt-ink-200",
    detail: "text-brand-alt-ink-900 hover:text-brand-alt-ink-600 dark:text-brand-alt-ink-300 dark:hover:text-brand-alt-ink-200",
    action: "text-brand-alt-ink-900 hover:text-brand-alt-ink-600 hover:bg-brand-alt-surface-50/50 dark:text-brand-alt-ink-300 dark:hover:text-brand-alt-ink-200 dark:hover:bg-brand-alt-surface-900/35",
  },
} as const;

export function getPupilRowTheme(gender?: string) {
  return gender === "Female" ? PUPIL_ROW_THEMES.female : PUPIL_ROW_THEMES.male;
}
