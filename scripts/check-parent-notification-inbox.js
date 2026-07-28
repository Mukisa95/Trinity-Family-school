const fs = require('fs');

const files = [
  'src/components/parent/floating-notification-bubble.tsx',
  'src/components/parent/floating-notifications-modal.tsx',
  'src/components/parent/simple-floating-notification.tsx',
  'src/lib/hooks/use-notification-badge.ts',
];

const contents = new Map(files.map(file => [file, fs.readFileSync(file, 'utf8')]));
const failures = [];

for (const [file, content] of contents) {
  if (content.includes('getAllNotifications(')) {
    failures.push(`${file} must not download the complete notifications collection.`);
  }
}

for (const file of [
  'src/components/parent/simple-floating-notification.tsx',
  'src/lib/hooks/use-notification-badge.ts',
]) {
  if (contents.get(file).includes('setInterval(')) {
    failures.push(`${file} must not poll Firestore for notification updates.`);
  }
}

const inboxStore = fs.readFileSync('src/lib/notification-inbox-store.ts', 'utf8');
if (!inboxStore.includes("where('userId', '==', entry.userId)") || !inboxStore.includes('onSnapshot(')) {
  failures.push('The notification inbox must use a user-scoped live delivery query.');
}

if (failures.length) {
  console.error('Parent notification inbox contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Parent notification inbox contract passed: no broad download or polling.');
