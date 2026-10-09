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
    // Gender is semantic, so it must not turn orange/green with a wallpaper palette.
    row: "hover:bg-indigo-50 focus-within:bg-indigo-50 dark:hover:bg-indigo-950/45 dark:focus-within:bg-indigo-950/45 transition-colors duration-150 motion-reduce:transition-none",
    name: "text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200",
    sibling: "text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200",
    detail: "text-indigo-900 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200",
    action: "text-indigo-900 hover:text-indigo-600 hover:bg-indigo-50/50 dark:text-indigo-300 dark:hover:text-indigo-200 dark:hover:bg-indigo-900/35",
  },
} as const;

export function getPupilRowTheme(gender?: string) {
  return gender === "Female" ? PUPIL_ROW_THEMES.female : PUPIL_ROW_THEMES.male;
}
