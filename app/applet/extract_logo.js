const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'public/assets/aistudio/Logo_Soundly__2__5c576ab3.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

const match = svgContent.match(/xlink:href="(data:image\/png;base64,[^"]+)"/);
if (!match) {
  console.error('Could not find base64 png in SVG');
  process.exit(1);
}

const base64Data = match[1].replace(/^data:image\/png;base64,/, '');
const buffer = Buffer.from(base64Data, 'base64');

const targetFiles = [
  'public/apple-touch-icon.png',
  'public/pwa-192x192.png',
  'public/pwa-512x512.png',
  'public/pwa-maskable-512x512.png'
];

for (const file of targetFiles) {
  fs.writeFileSync(path.join(__dirname, file), buffer);
  console.log(`Updated ${file}`);
}
console.log('Successfully updated all PWA and Apple touch icons with the new Soundly logo!');
