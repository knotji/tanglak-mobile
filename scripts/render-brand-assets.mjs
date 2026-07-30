import sharp from 'sharp';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const render = (source, target, size) => sharp(resolve(root, source))
  .resize(size, size)
  .png()
  .toFile(resolve(root, target));

await Promise.all([
  render('resources/icon.svg', 'resources/icon.png', 1024),
  render('resources/icon-foreground.svg', 'resources/icon-foreground.png', 1024),
  render('resources/icon-background.svg', 'resources/icon-background.png', 1024),
  render('resources/icon.svg', 'public/apple-touch-icon.png', 512),
  render('resources/icon.svg', 'public/favicon.png', 192),
  render('resources/splash.svg', 'resources/splash.png', 2732),
]);
