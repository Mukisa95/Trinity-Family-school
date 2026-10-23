export type AppSettingSection = 'appearance' | 'account' | 'security' | 'tracking' | 'push' | 'lessons' | 'widgets' | 'storage' | 'about';
export const APP_SETTING_SECTIONS: { id: AppSettingSection; title: string; description: string }[] = [
  { id: 'appearance', title: 'Look and feel', description: 'Choose how the app looks on this device.' },
  { id: 'account', title: 'My account', description: 'Your profile and sign-in details.' },
  { id: 'security', title: 'Security', description: 'Auto lock and device verification.' },
  { id: 'tracking', title: 'Live tracking', description: 'Control timetables and calendar events in your phone’s notification area.' },
  { id: 'push', title: 'Push notifications', description: 'School alerts, calendar events and announcements on this device.' },
  { id: 'lessons', title: 'Lesson push notifications', description: 'Choose which lessons send reminders, and when.' },
  { id: 'widgets', title: 'Widget settings', description: 'Manage the timetable widgets on your Android home screen.' },
  { id: 'storage', title: 'Offline and storage', description: 'Manage saved school information.' },
  { id: 'about', title: 'About app', description: 'Version details, updates and sharing.' },
];
export const APP_SETTINGS = [
  { id: 'theme', section: 'appearance', title: 'Theme', description: 'Light, dark, or follow your device setting.', keywords: 'appearance look feel colour color display night mode' },
  { id: 'look-and-feel', section: 'appearance', title: 'Look and feel options', description: 'Choose colours, typography, surfaces and motion.', keywords: 'appearance palette display animations font' },
  { id: 'profile', section: 'account', title: 'My profile', description: 'View your personal details and account information.', keywords: 'name email role user' },
  { id: 'account', section: 'account', title: 'Account settings', description: 'Manage your username and password.', keywords: 'login sign in credentials' },
  { id: 'autolock', section: 'security', title: 'Auto lock', description: 'Choose whether to lock when you close the app or leave it.', keywords: 'autolock privacy lock leave background signout sign out' },
  { id: 'biometrics', section: 'security', title: 'Biometrics and device unlock', description: 'Set up fingerprint, supported face unlock, or device verification for sign-in and privacy lock.', keywords: 'pin fingerprint face password authentication passkeys' },
  { id: 'timetable', section: 'tracking', title: 'Timetable notification', description: 'Show or hide the ongoing timetable card in the notification area. Widgets and lesson reminders have separate settings.', keywords: 'live calendar schedule persistent ongoing notification shade turn off', androidOnly: true },
  { id: 'timetable-display', section: 'tracking', title: 'Timetable card settings', description: 'Choose visible timetables and whether to show lesson progress.', keywords: 'live display countdown progress selection', androidOnly: true },
  { id: 'live-events', section: 'tracking', title: 'Calendar event tracking', description: 'Include calendar events in the ongoing timetable card, and manage event reminder alerts.', keywords: 'live calendar events persistent notification reminder alerts', androidOnly: true },
  { id: 'push', section: 'push', title: 'School push notifications', description: 'Turn school alerts on or off for this device, including event announcements.', keywords: 'events calendar messages fees alerts notifications permissions' },
  { id: 'lesson-reminders', section: 'lessons', title: 'Lesson reminder settings', description: 'Turn reminders on or off. Filter by timetable, class, subject, teacher and lesson; choose advance, start and end alerts.', keywords: 'lesson push notifications periods schedule sound vibration', androidOnly: true },
  { id: 'widgets', section: 'widgets', title: 'Home screen widgets', description: 'Choose an installed widget to change its timetables and progress display, or see how to add one.', keywords: 'android launcher resize home screen widget settings', androidOnly: true },
  { id: 'offline', section: 'storage', title: 'Offline access', description: 'Prepare or remove saved school information for use without internet.', keywords: 'download cache data storage network' },
  { id: 'home-screen', section: 'storage', title: 'Home screen app', description: 'Installation, saved workspace and diagnostics for supported browsers.', keywords: 'iphone ios ipad pwa installed storage diagnostic' },
  { id: 'updates', section: 'about', title: 'Check app updates', description: 'Check for a newer version of this school’s Android app.', keywords: 'version upgrade download install', androidOnly: true },
  { id: 'about-app', section: 'about', title: 'App details', description: 'About this app and a QR code to share its public download page.', keywords: 'changelog version release help about share qr code download build website' },
] as const;
export type AppSetting = typeof APP_SETTINGS[number];
export function filterAppSettings(query: string, android: boolean, section?: AppSettingSection) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return APP_SETTINGS.filter(item => {
    if ('androidOnly' in item && item.androidOnly && !android) return false;
    if (!words.length && section && item.section !== section) return false;
    const group = APP_SETTING_SECTIONS.find(group => group.id === item.section)!;
    const haystack = `${group.title} ${group.description} ${item.title} ${item.description} ${item.keywords}`.toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
