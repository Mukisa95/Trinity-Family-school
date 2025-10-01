export const SCHOOL_CONFIG = {
  name: "Trinity Family School",
  shortName: "TFS",
  // Add other school-related constants here as needed
} as const;

export const getSchoolFirstLetter = (): string => {
  return SCHOOL_CONFIG.name.charAt(0).toUpperCase();
};
