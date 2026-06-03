const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'Budge C.png');
const outputPath = path.join(__dirname, '..', 'public', 'favicon.ico');

async function generateFavicon() {
  console.log('Generating favicon from Budge C.png...\n');

  if (!fs.existsSync(sourceImage)) {
    console.error('Error: Source image not found at:', sourceImage);
    process.exit(1);
  }

  try {
    // Generate a 32x32 PNG first, then convert to ICO format
    // Note: sharp doesn't directly support ICO, so we'll create a PNG favicon
    const faviconPngPath = path.join(__dirname, '..', 'public', 'favicon.png');
    
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(faviconPngPath);
    
    console.log('✓ Generated favicon.png (32x32)');
    
    // Also generate a 16x16 version
    const favicon16Path = path.join(__dirname, '..', 'public', 'favicon-16x16.png');
    await sharp(sourceImage)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(favicon16Path);
    
    console.log('✓ Generated favicon-16x16.png (16x16)');
    
    console.log('\n✓ Favicon generated successfully!');
    console.log('Note: For best browser compatibility, consider converting favicon.png to favicon.ico using an online tool.');
  } catch (error) {
    console.error('✗ Failed to generate favicon:', error.message);
  }
}

generateFavicon().catch(console.error);

