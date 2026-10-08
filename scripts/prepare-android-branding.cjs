const fs = require('node:fs');
const path = require('node:path');
const { loadSchool, root } = require('./android-school-config.cjs');
const config = loadSchool(process.argv[2]);
const res = path.join(root, 'android-app/app/src/main/res');
for (const [directory, icon] of [['mipmap-mdpi', config.smallIcon], ['mipmap-hdpi', config.smallIcon], ['mipmap-xhdpi', config.smallIcon], ['mipmap-xxhdpi', config.icon], ['mipmap-xxxhdpi', config.icon], ['drawable-nodpi', config.icon]]) {
  fs.mkdirSync(path.join(res, directory), { recursive: true });
  fs.copyFileSync(path.join(root, icon), path.join(res, directory, directory === 'drawable-nodpi' ? 'school_logo.png' : 'ic_launcher.png'));
}
console.log(`Prepared ${config.appName} using the existing PWA icons.`);
