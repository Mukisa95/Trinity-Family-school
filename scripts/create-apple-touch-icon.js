const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'Budge C.png');
const outputPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');

async function createAppleTouchIcon() {
  console.log('Creating Apple Touch Icon from Budge C.png...\n');

  if (!fs.existsSync(sourceImage)) {
    console.error('Error: Source image not found at:', sourceImage);
    process.exit(1);
  }

  try {
    // Apple recommends 180x180 for touch icons
    await sharp(sourceImage)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath);
    
    console.log('✓ Generated apple-touch-icon.png (180x180)');
    console.log('  Location:', outputPath);
  } catch (error) {
    console.error('✗ Failed to generate Apple Touch Icon:', error.message);
  }
}

createAppleTouchIcon().catch(console.error);

