const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const bookingRoot = path.join(root, 'booking');
const html = fs.readFileSync(path.join(bookingRoot, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(bookingRoot, 'booking.js'), 'utf8');
const css = fs.readFileSync(path.join(bookingRoot, 'styles.css'), 'utf8');
function assetPath(relativePath) {
  return path.join(bookingRoot, 'assets', relativePath);
}
function assertWebp(relativePath) {
  const image = fs.readFileSync(assetPath(relativePath));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF', `${relativePath} must be a WebP RIFF file`);
  assert.equal(image.toString('ascii', 8, 12), 'WEBP', `${relativePath} must be a WebP image`);
}
test('booking brand mark points to the supplied LittleLand logo asset', () => {
  assert.match(html, /src="assets\/littleland-logo\.jpg\?v=20261101-flowfix1"/);
  assert.match(html, /alt="LittleLand 小寵物酒店標誌"/);
  const logo = fs.readFileSync(assetPath('littleland-logo.jpg'));
  assert.deepEqual([...logo.subarray(0, 2)], [0xff, 0xd8]);
});
test('public guest page loads the TEST API client before the booking application', () => {
  assert.match(html, /api-client\.js\?v=20261101-flowfix1[\s\S]*?booking\.js\?v=20261101-flowfix1/);
  assert.ok(fs.existsSync(path.join(bookingRoot, 'api-client.js')));
  assert.match(fs.readFileSync(path.join(bookingRoot, 'api-client.js'), 'utf8'), /availability/);
});
test('booking homepage uses the customer-selected original hero illustration', () => {
  assert.match(html, /src="assets\/hero-illustration\.webp\?v=20261101-flowfix1"/);
  assertWebp('hero-illustration.webp');
});
test('generated species illustrations are bundled locally for all three choices', () => {
  for (const image of ['species-rabbit.webp', 'species-guinea-pig.webp', 'species-hamster.webp']) {
    assert.ok(js.includes(`assets/${image}`), `booking UI should use ${image}`);
    assertWebp(image);
  }
  assert.doesNotMatch(js, /\/manus-storage\/async-images\//);
});
test('every room photo referenced by the room choices exists', () => {
  const roomsSource = js.split('const ROOMS = {')[1].split('const FOOD = {')[0];
  const roomImages = [...roomsSource.matchAll(/image:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.ok(roomImages.length >= 5, 'expected room photos for priced room choices');
  for (const image of roomImages) assert.ok(fs.existsSync(assetPath(image)), `missing booking room image: ${image}`);
});
test('hamster box photo keeps its full square content inside the shared room-photo frame', () => {
  assert.match(js, /id:\s*'HAMSTER_BOX',[^\n]*price:\s*65[^\n]*image:\s*'room-065\.webp'/);
  assert.match(js, /room-card--contained-photo/);
  assert.match(css, /\.room-photo-wrap\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.room-card--contained-photo \.room-photo\s*\{[^}]*object-fit:\s*contain/);
  assertWebp('room-065.webp');
});
test('brand and hero image edges blend softly into the booking-page palette', () => {
  assert.match(css, /\.brand-mark\s*\{[^}]*mask-image:/);
  assert.match(css, /\.hero-pets\s*\{[^}]*mask-image:/);
});
