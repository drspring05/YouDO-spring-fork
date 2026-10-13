import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const resDir = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const svgPath = join(publicDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

// The icon SVG is full-bleed (gradient field + centred mark inside the
// maskable safe zone), so every raster target is a straight resize.
async function generateMaskableIcon(size, targetPath) {
  await sharp(svgBuffer).resize(size, size).png().toFile(targetPath);
}

async function generate() {
  // Standard "any" icon — transparent background preserved
  await sharp(svgBuffer).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'));
  console.log('✓ icon-192.png');

  await sharp(svgBuffer).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'));
  console.log('✓ icon-512.png');

  // Maskable icons
  await generateMaskableIcon(512, join(publicDir, 'icon-512-maskable.png'));
  console.log('✓ icon-512-maskable.png');

  await generateMaskableIcon(192, join(publicDir, 'icon-192-maskable.png'));
  console.log('✓ icon-192-maskable.png');

  await generateMaskableIcon(180, join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180)');

  // Android mipmap launcher icons
  if (existsSync(resDir)) {
    const androidSizes = [
      { folder: 'mipmap-mdpi', size: 48 },
      { folder: 'mipmap-hdpi', size: 72 },
      { folder: 'mipmap-xhdpi', size: 96 },
      { folder: 'mipmap-xxhdpi', size: 144 },
      { folder: 'mipmap-xxxhdpi', size: 192 },
    ];

    for (const { folder, size } of androidSizes) {
      const folderPath = join(resDir, folder);
      if (existsSync(folderPath)) {
        await generateMaskableIcon(size, join(folderPath, 'ic_launcher.png'));
        await generateMaskableIcon(size, join(folderPath, 'ic_launcher_round.png'));
        await generateMaskableIcon(size, join(folderPath, 'ic_launcher_foreground.png'));
        console.log(`✓ Android ${folder} (${size}x${size})`);
      }
    }
  }

  console.log('\nAll icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
