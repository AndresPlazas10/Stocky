const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BANKS_DIR = path.join(ASSETS_DIR, 'banks');

const targets = [
  { file: path.join(BANKS_DIR, 'banco_bogota_logo.png'), width: 200 },
  { file: path.join(BANKS_DIR, 'bancolombia_logo.png'), width: 200 },
  { file: path.join(BANKS_DIR, 'davivienda_logo.png'), width: 200 },
  { file: path.join(BANKS_DIR, 'Nequi_logo.png'), width: 200 },
  { file: path.join(BANKS_DIR, 'nu_logo.jpg'), width: 200 },
  { file: path.join(ASSETS_DIR, 'icon.png'), width: 512 },
  { file: path.join(ASSETS_DIR, 'splash-icon.png'), width: 512 },
  { file: path.join(ASSETS_DIR, 'android-icon-foreground.png'), width: 256 },
  { file: path.join(ASSETS_DIR, 'logoStocky.png'), width: 300 },
];

async function optimize({ file, width }) {
  const ext = path.extname(file).toLowerCase();
  const isJpeg = ext === '.jpg' || ext === '.jpeg';
  const tempFile = `${file}.tmp${ext}`;

  console.log(`Optimizing ${path.basename(file)}...`);

  const pipeline = sharp(file).resize(width, null, {
    withoutEnlargement: true,
    fit: 'inside',
  });

  // Flatten only applies to images with an alpha channel (PNG/WebP).
  // We only flatten bank logos because they are rendered at very small sizes
  // on potentially non-transparent surfaces. App icons and the Android
  // adaptive icon foreground must keep their transparency.
  const isBankLogo = file.includes(path.join('assets', 'banks'));
  if (!isJpeg && isBankLogo) {
    pipeline.flatten({ background: '#FFFFFF' });
  }

  const encoder = isJpeg ? 'jpeg' : 'png';
  await pipeline[encoder]({
    quality: isJpeg ? 85 : undefined,
    compressionLevel: 9,
  }).toFile(tempFile);

  const originalSize = fs.statSync(file).size;
  const newSize = fs.statSync(tempFile).size;

  fs.renameSync(tempFile, file);

  console.log(
    `  ${path.basename(file)}: ${(originalSize / 1024).toFixed(1)} KB → ${(
      newSize / 1024
    ).toFixed(1)} KB`
  );
}

(async () => {
  for (const target of targets) {
    if (!fs.existsSync(target.file)) {
      console.warn(`Missing: ${target.file}`);
      continue;
    }
    await optimize(target);
  }
  console.log('Done.');
})();
