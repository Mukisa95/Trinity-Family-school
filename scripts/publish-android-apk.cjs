const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { loadSchool, root } = require('./android-school-config.cjs');
const school = loadSchool(process.argv[2]);
const source = path.join(root, 'android-app/app/build/outputs/apk/release/app-release.apk');
if (!fs.existsSync(source)) throw new Error('Build the signed release APK first.');
const sdk = process.env.ANDROID_HOME;
if (!sdk || !process.env.JAVA_HOME) throw new Error('Set ANDROID_HOME and JAVA_HOME to verify the release.');
const tools = path.join(sdk, 'build-tools', process.env.TRINITY_ANDROID_BUILD_TOOLS || '35.0.0');
const executable = name => process.platform === 'win32' ? `${name}.exe` : name;
const java = path.join(process.env.JAVA_HOME, 'bin', executable('java'));
const signature = execFileSync(java, ['-jar', path.join(tools, 'lib/apksigner.jar'), 'verify', '--print-certs', source], { encoding: 'utf8' });
const signingCertificate = signature.match(/^Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})$/mi)?.[1];
if (!signingCertificate || /Signer #2 certificate/.test(signature)) throw new Error('Expected one permanent school signing certificate.');
const manifest = execFileSync(path.join(tools, executable('aapt2')), ['dump', 'badging', source], { encoding: 'utf8' });
if (!manifest.includes(`name='${school.applicationId}' versionCode='${school.versionCode}' versionName='${school.versionName}'`) || !manifest.includes(`application-label:'${school.appName}'`) || manifest.includes('application-debuggable')) throw new Error('APK identity/version does not match this school, or the APK is debuggable.');
const resources = execFileSync(path.join(tools, executable('aapt2')), ['dump', 'resources', source], { encoding: 'utf8' });
const shortcutsPath = resources.match(/\bxml\/shortcuts\r?\n\s+\(\) \(file\) (\S+) type=XML/)?.[1];
if (!shortcutsPath) throw new Error('APK settings shortcuts could not be found.');
const shortcuts = execFileSync(path.join(tools, executable('aapt2')), ['dump', 'xmltree', source, '--file', shortcutsPath], { encoding: 'utf8' });
const shortcutTargets = [...shortcuts.matchAll(/android:targetPackage[^\r\n]*?="([^"]+)"/g)].map(match => match[1]);
const shortcutIds = [...shortcuts.matchAll(/android:shortcutId[^\r\n]*?="([^"]+)"/g)].map(match => match[1]);
const shortcutClasses = [...shortcuts.matchAll(/android:targetClass[^\r\n]*?="([^"]+)"/g)].map(match => match[1]);
const shortcutActions = [...shortcuts.matchAll(/android:value[^\r\n]*?="([^"]+)"/g)].map(match => match[1]);
const expectedShortcuts = ['search', 'timetable', 'events', 'pupils', 'exams'];
if (shortcutTargets.length !== 5 || shortcutTargets.some(target => target !== school.applicationId) || shortcutClasses.length !== 5 || shortcutClasses.some(target => target !== 'ug.trinityfamilyschool.photo.MainActivity') || JSON.stringify(shortcutIds) !== JSON.stringify(expectedShortcuts) || JSON.stringify(shortcutActions) !== JSON.stringify(expectedShortcuts)) throw new Error('APK launcher shortcuts do not match this school and its five destinations.');
const bytes = fs.readFileSync(source);
if (bytes.length < 1000 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('Not an APK ZIP file.');
const filename = `${school.key}.apk`;
fs.mkdirSync(path.join(root, 'android-releases'), { recursive: true });
const metadata = { schema: 1, schoolId: school.schoolId, appName: school.appName, applicationId: school.applicationId, websiteOrigin: school.websiteOrigin, firebaseProjectId: school.firebaseProjectId, iconUrl: '/' + school.smallIcon.replace(/^public\//, ''), versionCode: school.versionCode, versionName: school.versionName, minAndroid: '8.0', filename, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
metadata.signingCertificateSha256 = signingCertificate.toUpperCase().match(/.{2}/g).join(':');
metadata.minSdk = Number(manifest.match(/^(?:minSdkVersion|sdkVersion):'([0-9]+)'/m)?.[1]);
if (!Number.isInteger(metadata.minSdk) || metadata.minSdk < 26) throw new Error('APK minimum Android version could not be verified.');
fs.mkdirSync(path.join(root, 'src/lib/android'), { recursive: true });
if (school.releaseNotes) metadata.releaseNotes = school.releaseNotes;
// Both websites deploy the same source tree. Preparing another school must not
// replace the existing school's metadata or silently change its native identity.
const registryPath = path.join(root, 'src/lib/android/app-releases.json');
const legacyPath = path.join(root, 'src/lib/android/app-release.json');
const registry = fs.existsSync(registryPath)
  ? JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  : [JSON.parse(fs.readFileSync(legacyPath, 'utf8'))];
const previous = registry.find(release => release.schoolId === metadata.schoolId);
if (previous?.signingCertificateSha256 && previous.signingCertificateSha256 !== metadata.signingCertificateSha256) throw new Error('The school signing key changed. Existing installations would not accept the update.');
if (!Array.isArray(registry) || registry.some(release => release.schoolId !== metadata.schoolId
  && (release.applicationId === metadata.applicationId || release.firebaseProjectId === metadata.firebaseProjectId || release.websiteOrigin === metadata.websiteOrigin || release.filename === metadata.filename))) {
  throw new Error('A school release cannot reuse another school\'s app, project, website or artifact identity.');
}
const releases = [...registry.filter(release => release.schoolId !== metadata.schoolId), metadata].sort((a, b) => a.schoolId.localeCompare(b.schoolId));
fs.copyFileSync(source, path.join(root, 'android-releases', filename));
fs.writeFileSync(registryPath, JSON.stringify(releases, null, 2) + '\n');
// Keep the original Trinity Live metadata path for existing tooling.
if (school.key === 'trinity-live') fs.writeFileSync(legacyPath, JSON.stringify(metadata, null, 2) + '\n');
console.log(`Prepared locally ${metadata.appName} ${metadata.versionName}: ${metadata.bytes} bytes, SHA-256 ${metadata.sha256}`);
