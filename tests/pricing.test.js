'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ROOM_CATALOG,
  ERROR_CODES,
  PricingError,
  calculatePricing
} = require('../booking/pricing.js');

function price(overrides = {}) {
  return calculatePricing({
    species: 'rabbit',
    roomId: 'DELUXE_SUITE',
    checkin: '2026-10-26', // Monday
    checkout: '2026-10-28',
    quantity: 1,
    services: [],
    ...overrides
  });
}

function expectCode(code, callback) {
  assert.throws(callback, (error) => error instanceof PricingError && error.code === code);
}

test('catalog contains every specified species, room rate and capacity', () => {
  const expected = {
    rabbit: {
      DELUXE_ROOM: [178, 1], PRIVATE_SUITE: [278, 2], DELUXE_SUITE: [350, 3], VERY_DELUXE_SUITE: [600, 3]
    },
    guineaPig: {
      STANDARD_ROOM: [98, 1], DELUXE_ROOM: [178, 3], PRIVATE_SUITE: [278, 3], DELUXE_SUITE: [350, 5], VERY_DELUXE_SUITE: [600, 5]
    },
    hamster: {
      STANDARD_ROOM: [98, 1], HAMSTER_BOX: [65, 1], OWN_CAGE: [50, 1]
    }
  };

  assert.deepEqual(Object.keys(ROOM_CATALOG), Object.keys(expected));
  for (const [species, rooms] of Object.entries(expected)) {
    assert.deepEqual(Object.keys(ROOM_CATALOG[species]), Object.keys(rooms));
    for (const [roomId, [pricePerNight, maxPets]] of Object.entries(rooms)) {
      assert.equal(ROOM_CATALOG[species][roomId].pricePerNight, pricePerNight, `${species}.${roomId} rate`);
      assert.equal(ROOM_CATALOG[species][roomId].maxPets, maxPets, `${species}.${roomId} limit`);
    }
  }
});

test('specified 3-rabbit, deluxe suite, two-night example matches every amount', () => {
  const result = price({ quantity: 3 });
  assert.equal(result.nights, 2);
  assert.equal(result.baseRoomFee, 700);
  assert.equal(result.extraPetFee, 200);
  assert.equal(result.weekendFee, 0);
  assert.equal(result.totalSurcharges, 200);
  assert.equal(result.estimatedTotal, 900);
  assert.equal(result.depositAmount, 350);
  assert.equal(result.remainingBalance, 550);
  assert.equal(result.cashDeposit, 3000);
});

test('weekend short-stay surcharge is charged only for Friday, Saturday or Sunday check-in for one night', () => {
  const cases = [
    ['2026-10-30', '2026-10-31', 250], // Friday
    ['2026-10-31', '2026-11-01', 250], // Saturday
    ['2026-11-01', '2026-11-02', 250], // Sunday
    ['2026-10-30', '2026-11-01', 0], // Friday, two nights
    ['2026-10-29', '2026-10-30', 0] // Thursday, one night
  ];

  for (const [checkin, checkout, expectedFee] of cases) {
    assert.equal(price({ checkin, checkout }).weekendFee, expectedFee, `${checkin} to ${checkout}`);
  }
});

test('service prices are itemized and per-night services scale by stay length', () => {
  const result = price({
    services: ['GROOMING_ONCE', 'GROOMING_DAILY', 'MEDICINE_ONCE', 'EARLY_CHECKIN', 'LATE_CHECKOUT']
  });
  assert.deepEqual(result.serviceItems.map((item) => item.amount), [70, 100, 160, 200, 200]);
  assert.equal(result.serviceFees, 730);
  assert.equal(result.totalSurcharges, 730);
  assert.equal(result.estimatedTotal, 1430);
  assert.equal(result.depositAmount, 350);
  assert.equal(result.remainingBalance, 1080);
});

test('medicine twice scales by each night of the stay', () => {
  const result = price({ services: ['MEDICINE_TWICE'] });
  assert.equal(result.serviceItems[0].amount, 300);
  assert.equal(result.serviceFees, 300);
});

test('medicine twice, pet surcharge, weekend surcharge and cash deposit remain separated', () => {
  const result = price({
    species: 'guineaPig',
    roomId: 'DELUXE_SUITE',
    checkin: '2026-10-30',
    checkout: '2026-10-31',
    quantity: 5,
    services: ['MEDICINE_TWICE']
  });
  assert.equal(result.baseRoomFee, 350);
  assert.equal(result.extraPetFee, 200);
  assert.equal(result.weekendFee, 250);
  assert.equal(result.serviceFees, 150);
  assert.equal(result.totalSurcharges, 600);
  assert.equal(result.estimatedTotal, 950);
  assert.equal(result.depositAmount, 175);
  assert.equal(result.remainingBalance, 775);
  assert.equal(result.cashDeposit, 5000);
  assert.equal(result.estimatedTotal + result.cashDeposit, 5950);
  assert.notEqual(result.estimatedTotal, result.estimatedTotal + result.cashDeposit);
});

test('prices and capacities are selected by species and room ID, not caller-supplied prices', () => {
  const result = price({ species: 'hamster', roomId: 'HAMSTER_BOX', quantity: 1, roomPrice: 1, price: 0 });
  assert.equal(result.roomPrice, 65);
  assert.equal(result.baseRoomFee, 130);
  assert.equal(result.room.maxPets, 1);
});

test('accepts valid leap day and calculates calendar nights independent of local DST', () => {
  const result = price({ checkin: '2028-02-28', checkout: '2028-03-01' });
  assert.equal(result.nights, 2);
  assert.equal(result.baseRoomFee, 700);
});

test('rejects invalid date formats and impossible dates', () => {
  for (const checkin of ['2026/10/26', '26-10-2026', '2026-02-29', '', null]) {
    expectCode(ERROR_CODES.INVALID_DATE, () => price({ checkin }));
  }
});

test('rejects same-day and reversed stays', () => {
  expectCode(ERROR_CODES.INVALID_STAY, () => price({ checkin: '2026-10-26', checkout: '2026-10-26' }));
  expectCode(ERROR_CODES.INVALID_STAY, () => price({ checkin: '2026-10-28', checkout: '2026-10-26' }));
});

test('rejects unknown species, unknown room and species-room mismatches', () => {
  expectCode(ERROR_CODES.INVALID_ROOM, () => price({ species: 'ferret' }));
  expectCode(ERROR_CODES.INVALID_ROOM, () => price({ roomId: 'UNKNOWN' }));
  expectCode(ERROR_CODES.INVALID_ROOM, () => price({ species: 'rabbit', roomId: 'HAMSTER_BOX' }));
  expectCode(ERROR_CODES.INVALID_ROOM, () => price({ species: 'toString' }));
  expectCode(ERROR_CODES.INVALID_ROOM, () => price({ roomId: 'toString' }));
});

test('rejects non-integer and non-positive pet quantities', () => {
  for (const quantity of [0, -1, 1.5, NaN, '2', null]) {
    expectCode(ERROR_CODES.INVALID_QUANTITY, () => price({ quantity }));
  }
});

test('rejects quantity above each selected room capacity without truncation', () => {
  expectCode(ERROR_CODES.QUANTITY_EXCEEDS_LIMIT, () => price({ quantity: 4 }));
  expectCode(ERROR_CODES.QUANTITY_EXCEEDS_LIMIT, () => price({ species: 'hamster', roomId: 'STANDARD_ROOM', quantity: 2 }));
});

test('rejects duplicate services, mutually exclusive medicine options and unknown services', () => {
  expectCode(ERROR_CODES.DUPLICATE_SERVICE, () => price({ services: ['GROOMING_ONCE', 'GROOMING_ONCE'] }));
  expectCode(ERROR_CODES.DUPLICATE_SERVICE, () => price({ services: ['MEDICINE_ONCE', 'MEDICINE_TWICE'] }));
  expectCode(ERROR_CODES.INVALID_INPUT, () => price({ services: ['INVENTED_SERVICE'] }));
  expectCode(ERROR_CODES.INVALID_INPUT, () => price({ services: ['toString'] }));
  expectCode(ERROR_CODES.INVALID_INPUT, () => price({ services: ['GROOMING_ONCE', 123] }));
  expectCode(ERROR_CODES.INVALID_INPUT, () => price({ services: 'GROOMING_ONCE' }));
});

test('does not mutate caller input', () => {
  const input = {
    species: 'rabbit', roomId: 'DELUXE_SUITE', checkin: '2026-10-26', checkout: '2026-10-28',
    quantity: 2, services: ['GROOMING_DAILY']
  };
  const before = structuredClone(input);
  price(input);
  assert.deepEqual(input, before);
});
