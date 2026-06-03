const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'Budge C.png');
const outputDir = path.join(__dirname, '..', 'public');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 72, name: 'icons/badge-72x72.png' },
  { size: 192, name: 'icons/icon-192x192.png' },
  { size: 512, name: 'icons/icon-512x512.png' }
];

async function generateIcons() {
  console.log('Generating PWA icons from Budge C.png...\n');

  if (!fs.existsSync(sourceImage)) {
    console.error('Error: Source image not found at:', sourceImage);
    process.exit(1);
  }

  for (const { size, name } of sizes) {
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
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  }

  console.log('\n✓ All PWA icons generated successfully!');
  console.log('\nNext steps:');
  console.log('1. The icons have been placed in the public folder');
  console.log('2. Clear your browser cache');
  console.log('3. Uninstall and reinstall the PWA to see the new icon');
}

generateIcons().catch(console.error);

