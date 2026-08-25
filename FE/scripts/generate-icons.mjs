import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');

const normalSvg = readFileSync(path.join(__dirname, 'icon-source.svg'));
const maskableSvg = readFileSync(path.join(__dirname, 'icon-source-maskable.svg'));

const jobs = [
  { svg: normalSvg, size: 192, out: 'icon-192.png' },
  { svg: normalSvg, size: 512, out: 'icon-512.png' },
  { svg: normalSvg, size: 180, out: 'apple-touch-icon.png' },
  { svg: maskableSvg, size: 512, out: 'icon-maskable-512.png' },
];

for (const job of jobs) {
  await sharp(job.svg, { density: 384 })
    .resize(job.size, job.size)
    .png()
    .toFile(path.join(iconsDir, job.out));
  console.log('Đã tạo', job.out);
}
