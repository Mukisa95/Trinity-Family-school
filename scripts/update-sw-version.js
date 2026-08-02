#!/usr/bin/env node

/**
 * Automatic Service Worker Version Updater
 * 
 * This script automatically updates the service worker version
 * and build timestamp on each build to ensure cache busting.
 * 
 * Run this before building: node scripts/update-sw-version.js
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw.js');

try {
  // Read the service worker file
  let swContent = fs.readFileSync(SW_PATH, 'utf8');
  
  const versionMatch = swContent.match(/const SW_VERSION = '([^']+)'/);
  const currentVersion = versionMatch ? versionMatch[1] : 'unknown';

  // Vercel starts each build from the checked-in file, so incrementing its
  // patch number produced the same deployed cache name repeatedly. A timestamp
  // version is unique per build and reliably refreshes installed PWAs.
  const timestamp = new Date().toISOString();
  const newVersion = `build-${timestamp.replace(/[-:.TZ]/g, '')}`;
  
  // Update version
  swContent = swContent.replace(
    /const SW_VERSION = '[^']+'/,
    `const SW_VERSION = '${newVersion}'`
  );
  
  // Update timestamp
  swContent = swContent.replace(
    /const BUILD_TIMESTAMP = '[^']+'/,
    `const BUILD_TIMESTAMP = '${timestamp}'`
  );
  
  // Write back to file
  fs.writeFileSync(SW_PATH, swContent, 'utf8');
  
  console.log('✅ Service Worker version updated:');
  console.log(`   Version: ${currentVersion} → ${newVersion}`);
  console.log(`   Timestamp: ${timestamp}`);
  console.log('');
  console.log('💡 Users will automatically get the new version!');
  
} catch (error) {
  console.error('❌ Error updating service worker version:', error.message);
  process.exit(1);
}
