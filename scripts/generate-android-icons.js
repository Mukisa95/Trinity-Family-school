const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Generate Android app icons from source image
 * This script converts your web app icon to all required Android icon sizes
 */

// Android icon sizes (launcher icons)
const ANDROID_ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Source icon (your web app icon)
const SOURCE_ICON = path.join(__dirname, '../public/icons/icon-512x512.png');
const ANDROID_RES_DIR = path.join(__dirname, '../android/app/src/main/res');

async function generateAndroidIcons() {
  console.log('🎨 Generating Android app icons...\n');

  // Check if source icon exists
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error('❌ Source icon not found:', SOURCE_ICON);
    console.error('Please ensure you have icon-512x512.png in public/icons/');
    process.exit(1);
  }

  console.log('✅ Source icon found:', SOURCE_ICON);
  console.log(`📁 Output directory: ${ANDROID_RES_DIR}\n`);

  let successCount = 0;
  let errorCount = 0;

  // Generate icons for each density
  for (const [density, size] of Object.entries(ANDROID_ICON_SIZES)) {
    const outputDir = path.join(ANDROID_RES_DIR, density);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate launcher icon
    const outputPath = path.join(outputDir, 'ic_launcher.png');
    const outputForegroundPath = path.join(outputDir, 'ic_launcher_foreground.png');
    const outputRoundPath = path.join(outputDir, 'ic_launcher_round.png');

    try {
      // Main launcher icon
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      // Foreground icon (for adaptive icons)
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(outputForegroundPath);

      // Round icon
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'cover'
        })
        .png()
        .toFile(outputRoundPath);

      console.log(`✅ Generated ${density} icons (${size}x${size}px)`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error generating ${density} icons:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully generated: ${successCount * 3} icons`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount}`);
  }
  console.log('='.repeat(50));

  console.log('\n📱 Next steps:');
  console.log('1. Run: npx cap sync android');
  console.log('2. Rebuild your app in Android Studio');
  console.log('3. Your app will now use your school logo! 🎉\n');
}

// Run the script
generateAndroidIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

