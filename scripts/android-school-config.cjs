const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadSchool(school = process.env.TRINITY_ANDROID_SCHOOL || 'trinity-live') {
  if (!/^[a-z][a-z0-9-]*$/.test(school)) throw new Error('Invalid Android school configuration name.');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/android-schools', `${school}.json`), 'utf8'));
  const url = new URL(config.websiteOrigin);
  if (url.protocol !== 'https:' || url.origin !== config.websiteOrigin || url.username || url.password || url.port) throw new Error('School website must be a canonical HTTPS origin.');
  if (!/^[a-z][a-z0-9.-]*$/.test(config.schoolId) || !/^[a-z][a-z0-9-]*$/.test(config.firebaseProjectId)) throw new Error('Invalid school/project identity.');
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(config.applicationId)) throw new Error('Invalid Android application ID.');
  if (!/^[A-Za-z0-9][A-Za-z0-9 .'-]{1,59}$/.test(config.appName) || !Number.isInteger(config.versionCode) || config.versionCode < 1 || !/^[0-9][0-9A-Za-z.-]*$/.test(config.versionName)) throw new Error('Invalid Android name/version.');
  for (const key of ['icon', 'smallIcon']) {
    const file = path.resolve(root, config[key]);
    if (!file.startsWith(path.join(root, 'public') + path.sep) || !file.endsWith('.png') || !fs.existsSync(file)) throw new Error('School icons must be existing public PNG files.');
  }
  const messaging = config.firebaseAndroid;
  if (!messaging || !/^1:[0-9]+:android:[a-f0-9]+$/.test(messaging.appId) || !/^[0-9]+$/.test(messaging.messagingSenderId)
    || messaging.appId.split(':')[1] !== messaging.messagingSenderId || !/^AIza[A-Za-z0-9_-]{30,60}$/.test(messaging.apiKey)) throw new Error('A registered Firebase Android app is required for this school.');
  return { ...config, key: school };
}
module.exports = { loadSchool, root };
