const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bookingRoot = path.join(root, 'booking');
const html = fs.readFileSync(path.join(bookingRoot, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(bookingRoot, 'booking.js'), 'utf8');

function assetPath(relativePath) {
  return path.join(bookingRoot, 'assets', relativePath);
}

test('booking brand mark points to the supplied LittleLand logo asset', () => {
  assert.match(html, /src="assets\/littleland-logo\.jpg\?v=20261101-hero3"/);
  assert.match(html, /alt="LittleLand 小寵物酒店標誌"/);
  const logo = fs.readFileSync(assetPath('littleland-logo.jpg'));
  assert.deepEqual([...logo.subarray(0, 2)], [0xff, 0xd8]);
});

test('booking homepage uses the customer-selected original hero illustration', () => {
  assert.match(html, /src="assets\/hero-illustration\.webp\?v=20261101-hero3"/);
  const hero = fs.readFileSync(assetPath('hero-illustration.webp'));
  assert.equal(hero.toString('ascii', 0, 4), 'RIFF');
  assert.equal(hero.toString('ascii', 8, 12), 'WEBP');
});

test('every room photo referenced by booking choices exists', () => {
  const roomImages = [...js.matchAll(/image:\s*'([^']+)'/g)]
    .map((match) => match[1])
    .filter((image) => !image.startsWith('/'));
  assert.ok(roomImages.length >= 5, 'expected room photos for priced room choices');
  for (const image of roomImages) {
    assert.ok(fs.existsSync(assetPath(image)), `missing booking room image: ${image}`);
  }
});

test('hamster box room choice uses the newly supplied HK$65 photo', () => {
  assert.match(js, /id:\s*'HAMSTER_BOX',[^\n]*price:\s*65[^\n]*image:\s*'room-065\.png'/);
  const image = fs.readFileSync(assetPath('room-065.png'));
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
