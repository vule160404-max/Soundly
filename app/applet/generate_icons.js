const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'public/assets/aistudio/Logo_Soundly__2__5c576ab3.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(__dirname, 'public/apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(__dirname, 'public/pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(__dirname, 'public/pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(__dirname, 'public/pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
