const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'public', 'logo.png');
const outputDir = path.join(__dirname, '..', 'public');

const icons = [
  // PWA Icons
  { size: 192, name: 'icon-192.png', description: 'PWA Icon 192x192' },
  { size: 512, name: 'icon-512.png', description: 'PWA Icon 512x512' },
  { size: 192, name: 'trinity-logo-192.png', description: 'Versioned Trinity PWA Icon 192x192' },
  { size: 512, name: 'trinity-logo-512.png', description: 'Versioned Trinity PWA Icon 512x512' },
  
  // Icons folder
  { size: 72, name: 'icons/badge-72x72.png', description: 'Badge Icon 72x72' },
  { size: 72, name: 'icons/trinity-badge-72.png', description: 'Trinity Notification Badge 72x72' },
  { size: 192, name: 'icons/icon-192x192.png', description: 'Icon 192x192' },
  { size: 512, name: 'icons/icon-512x512.png', description: 'Icon 512x512' },
  
  // Favicons
  { size: 16, name: 'favicon-16x16.png', description: 'Favicon 16x16' },
  { size: 32, name: 'favicon.png', description: 'Favicon 32x32' },
  
  // Apple Touch Icon
  { size: 180, name: 'apple-touch-icon.png', description: 'Apple Touch Icon 180x180' },
];

async function generateAllIcons() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Generating All PWA Icons from public/logo.png             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(sourceImage)) {
    console.error('❌ Error: Source image not found at:', sourceImage);
    console.error('   Please ensure public/logo.png exists.');
    process.exit(1);
  }

  console.log('📁 Source image:', sourceImage);
  console.log('📂 Output directory:', outputDir);
  console.log('\n🔄 Generating icons...\n');

  let successCount = 0;
  let failCount = 0;

  for (const { size, name, description } of icons) {
    const outputPath = path.join(outputDir, name);
    const outputDirPath = path.dirname(outputPath);

    // Ensure directory exists
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    try {
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`  ✅ ${description.padEnd(30)} → ${name}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ ${description.padEnd(30)} → Failed: ${error.message}`);
      failCount++;
    }
  }

  // Copy favicon.png to favicon.ico
  try {
    const faviconSource = path.join(outputDir, 'favicon.png');
    const faviconDest = path.join(outputDir, 'favicon.ico');
    fs.copyFileSync(faviconSource, faviconDest);
    console.log(`  ✅ ${'Favicon ICO'.padEnd(30)} → favicon.ico`);
    successCount++;
  } catch (error) {
    console.error(`  ❌ ${'Favicon ICO'.padEnd(30)} → Failed: ${error.message}`);
    failCount++;
  }

  // Copy icons to Next.js app directory for browser usage
  console.log('\n🔄 Copying icons to Next.js app directory...\n');
  
  const appDir = path.join(__dirname, '..', 'src', 'app');
  const iconsToCopy = [
    { src: 'favicon.ico', dest: 'favicon.ico', name: 'App Favicon ICO' },
    { src: 'apple-touch-icon.png', dest: 'apple-touch-icon.png', name: 'App Apple Touch Icon' },
    { src: 'icon-192.png', dest: 'icon.png', name: 'App Icon' },
  ];

  for (const { src, dest, name } of iconsToCopy) {
    try {
      const srcPath = path.join(outputDir, src);
      const destPath = path.join(appDir, dest);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✅ ${name.padEnd(30)} → src/app/${dest}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ ${name.padEnd(30)} → Failed: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 Summary: ${successCount} icons generated successfully, ${failCount} failed\n`);

  if (failCount === 0) {
    console.log('✨ All icons generated successfully!\n');
    console.log('📱 Next Steps:');
    console.log('   1. Deploy the generated assets');
    console.log('   2. Open the installed PWA normally so its manifest refreshes');
    console.log('   3. No cache clearing or PWA reinstallation is required\n');
    console.log('💡 public/logo.png is now the source for every app icon.\n');
  } else {
    console.log('⚠️  Some icons failed to generate. Please check the errors above.\n');
    process.exit(1);
  }
}

generateAllIcons().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
