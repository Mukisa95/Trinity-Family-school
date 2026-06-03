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
  
  // Get current version
  const versionMatch = swContent.match(/const SW_VERSION = '([^']+)'/);
  const currentVersion = versionMatch ? versionMatch[1] : 'v1.0.0';
  
  // Increment version (simple increment of patch version)
  const versionParts = currentVersion.replace('v', '').split('.');
  versionParts[2] = String(parseInt(versionParts[2] || 0) + 1);
  const newVersion = 'v' + versionParts.join('.');
  
  // Get current timestamp
  const timestamp = new Date().toISOString();
  
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

