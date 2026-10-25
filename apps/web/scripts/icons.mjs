// Renders the PNG icons of the installed app (public/icon-*.png) from the logo:
// node scripts/icons.mjs
import { chromium } from '@playwright/test';

const PITCH = '#123d2a';
const BALL = '#b8e04a';

// The favicon's rounded square; maskable icons fill the square, the logo inside the
// safe zone (the middle 80%)
const svg = (size, maskable) => {
  const radius = maskable ? 0 : size / 4;
  const ball = size * (maskable ? 0.17 : 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${PITCH}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${ball}" fill="${BALL}"/>
  </svg>`;
};

const icons = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  // iOS rounds the corners itself
  ['apple-touch-icon.png', 180, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, maskable] of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg(size, maskable)}</body>`,
  );
  await page.screenshot({
    path: new URL(`../public/${file}`, import.meta.url).pathname,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}
await browser.close();
