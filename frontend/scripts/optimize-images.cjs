const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imgDir = path.resolve(__dirname, '../public/img');

async function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let totalSaved = 0;
  let totalOriginal = 0;
  let totalNew = 0;
  const processed = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subResult = await processDirectory(fullPath);
      totalOriginal += subResult.totalOriginal;
      totalNew += subResult.totalNew;
      totalSaved += subResult.totalSaved;
      processed.push(...subResult.processed);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.jpeg', '.jpg', '.png'].includes(ext)) continue;

      const originalBuffer = fs.readFileSync(fullPath);
      const originalBytes = originalBuffer.length;
      totalOriginal += originalBytes;

      const isHero = entry.name.toLowerCase().includes('hero');
      const isAbout = entry.name.toLowerCase().includes('about');
      const maxWidth = isHero ? 1600 : (isAbout ? 1200 : 1000);
      const maxHeight = isHero ? 1000 : (isAbout ? 1200 : 1000);

      const image = sharp(originalBuffer);
      const metadata = await image.metadata();

      let pipeline = sharp(originalBuffer).rotate();

      // Resize only if larger than max bounds
      if ((metadata.width && metadata.width > maxWidth) || (metadata.height && metadata.height > maxHeight)) {
        pipeline = pipeline.resize({
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      let buffer;
      if (ext === '.png') {
        buffer = await pipeline
          .png({
            quality: 85,
            compressionLevel: 9,
            palette: true,
          })
          .toBuffer();
      } else {
        buffer = await pipeline
          .jpeg({
            quality: 82,
            mozjpeg: true,
            progressive: true,
          })
          .toBuffer();
      }

      if (buffer.length < originalBytes) {
        fs.writeFileSync(fullPath, buffer);
        const saved = originalBytes - buffer.length;
        totalSaved += saved;
        totalNew += buffer.length;
        processed.push({
          name: entry.name,
          relPath: path.relative(imgDir, fullPath),
          originalKB: (originalBytes / 1024).toFixed(1),
          newKB: (buffer.length / 1024).toFixed(1),
          reduction: `${Math.round((saved / originalBytes) * 100)}%`,
        });
      } else {
        totalNew += originalBytes;
      }
    }
  }

  return { totalOriginal, totalNew, totalSaved, processed };
}

async function run() {
  console.log('🚀 Starting VASHTRAM Image Optimization...\n');
  console.log(`Target directory: ${imgDir}\n`);

  const results = await processDirectory(imgDir);

  console.log('--- Optimization Results ---');
  results.processed.sort((a, b) => parseFloat(b.originalKB) - parseFloat(a.originalKB));
  for (const item of results.processed) {
    console.log(
      `  ✓ ${item.relPath.padEnd(35)} ${item.originalKB.padStart(8)} KB -> ${item.newKB.padStart(8)} KB  (-${item.reduction})`
    );
  }

  const originalMB = (results.totalOriginal / (1024 * 1024)).toFixed(2);
  const newMB = (results.totalNew / (1024 * 1024)).toFixed(2);
  const savedMB = (results.totalSaved / (1024 * 1024)).toFixed(2);
  const percentSaved = Math.round((results.totalSaved / results.totalOriginal) * 100);

  console.log('\n=============================================');
  console.log(`🎉 Total Original Size: ${originalMB} MB`);
  console.log(`⚡ Total Optimized Size: ${newMB} MB`);
  console.log(`📉 Total Space Saved:    ${savedMB} MB (${percentSaved}% reduction)`);
  console.log('=============================================\n');
}

run().catch((err) => {
  console.error('Error optimizing images:', err);
  process.exit(1);
});
