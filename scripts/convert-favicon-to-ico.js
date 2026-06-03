const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'public', 'favicon-16x16.png');
const outputPath = path.join(__dirname, '..', 'public', 'favicon.ico');

async function convertToIco() {
  console.log('Converting favicon PNG to favicon.ico...\n');

  if (!fs.existsSync(inputPath)) {
    console.error('Error: favicon PNG not found at:', inputPath);
    process.exit(1);
  }

  try {
    // Read the PNG file
    const pngBuffer = fs.readFileSync(inputPath);
    
    // Convert to ICO
    const buf = await pngToIco([pngBuffer]);
    fs.writeFileSync(outputPath, buf);
    console.log('✓ Successfully created favicon.ico');
    console.log('  Location:', outputPath);
  } catch (error) {
    console.error('✗ Failed to convert favicon:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

convertToIco().catch(console.error);

