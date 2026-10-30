'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const canonical = require('../../booking/pricing.js');
const { createRuntime, fs, path, PROJECT_ROOT, addDays, hkDateString } = require('./harness');

const runtime = createRuntime();
const mirror = runtime.context.LittleLandPricing;

function weekdayDate(weekday, start = addDays(hkDateString(), 25)) {
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(start, offset);
    const [year, month, day] = date.split('-').map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === weekday) return date;
  }
  throw new Error('Unable to find requested weekday.');
}

function compareErrorCode(engine, input) {
  try {
    engine.calculatePricing(input);
    return null;
  } catch (error) {
    return error.code;
  }
}

test('GAS PricingEngine.gs is byte-for-byte copied from the accepted pricing.js', () => {
  const original = fs.readFileSync(path.join(PROJECT_ROOT, 'booking/pricing.js'));
  const gasMirror = fs.readFileSync(path.join(PROJECT_ROOT, 'apps-script/PricingEngine.gs'));
  assert.deepEqual(gasMirror, original);
});

test('GAS mirror exposes the same room and service catalogs as the canonical engine', () => {
  assert.equal(JSON.stringify(mirror.ROOM_CATALOG), JSON.stringify(canonical.ROOM_CATALOG));
  assert.equal(JSON.stringify(mirror.SERVICE_CATALOG), JSON.stringify(canonical.SERVICE_CATALOG));
  assert.equal(JSON.stringify(mirror.ERROR_CODES), JSON.stringify(canonical.ERROR_CODES));
});

test('GAS mirror returns identical calculation snapshots for every accepted room type', () => {
  const checkin = addDays(hkDateString(), 36);
  const checkout = addDays(checkin, 3);
  for (const [species, rooms] of Object.entries(canonical.ROOM_CATALOG)) {
    for (const [roomId, room] of Object.entries(rooms)) {
      const input = {
        species,
        roomId,
        checkin,
        checkout,
        quantity: room.maxPets,
        services: ['GROOMING_ONCE', 'GROOMING_DAILY', 'MEDICINE_ONCE', 'EARLY_CHECKIN', 'LATE_CHECKOUT']
      };
      const expected = canonical.calculatePricing(input);
      const actual = mirror.calculatePricing(input);
      assert.equal(JSON.stringify(actual), JSON.stringify(expected), `${species}/${roomId}`);
    }
  }
});

test('GAS mirror preserves Friday/Saturday/Sunday one-night surcharge and multi-night exclusion', () => {
  for (const weekday of [0, 5, 6]) {
    const checkin = weekdayDate(weekday);
    for (const nights of [1, 2]) {
      const input = {
        species: 'rabbit', roomId: 'DELUXE_ROOM', checkin,
        checkout: addDays(checkin, nights), quantity: 1, services: []
      };
      const expected = canonical.calculatePricing(input);
      const actual = mirror.calculatePricing(input);
      assert.equal(actual.weekendFee, nights === 1 ? 250 : 0);
      assert.equal(JSON.stringify(actual), JSON.stringify(expected));
    }
  }
});

test('GAS mirror preserves all existing pricing error codes', () => {
  const date = addDays(hkDateString(), 40);
  const valid = { species: 'rabbit', roomId: 'DELUXE_ROOM', checkin: date, checkout: addDays(date, 1), quantity: 1, services: [] };
  const badInputs = [
    Object.assign({}, valid, { checkin: '2026-02-30' }),
    Object.assign({}, valid, { checkout: date }),
    Object.assign({}, valid, { quantity: 0 }),
    Object.assign({}, valid, { quantity: 2 }),
    Object.assign({}, valid, { roomId: 'HAMSTER_BOX' }),
    Object.assign({}, valid, { services: ['MEDICINE_ONCE', 'MEDICINE_TWICE'] })
  ];
  badInputs.forEach((input) => assert.equal(compareErrorCode(mirror, input), compareErrorCode(canonical, input)));
});
