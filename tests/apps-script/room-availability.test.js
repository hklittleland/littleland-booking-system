'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime, addDays, hkDateString } = require('./harness');

function dates() {
  const checkin = addDays(hkDateString(), 45);
  return { checkin, checkout: addDays(checkin, 2) };
}

function addBooking(runtime, overrides = {}) {
  const stay = dates();
  runtime.addRecord('Bookings', Object.assign({
    bookingId: 'TEST-LL-20261201-EXIST001',
    bookingStatus: 'PENDING_DEPOSIT',
    checkinDate: stay.checkin,
    checkoutDate: stay.checkout,
    roomTypeId: 'PRIVATE_SUITE',
    allocatedRoomIdsJson: '["S1"]'
  }, overrides));
}

function availability(runtime, roomTypeId, overrides = {}) {
  const stay = dates();
  const inventory = runtime.context.littlelandReadInventory_();
  return runtime.context.littlelandAvailability_(Object.assign({
    roomTypeId,
    checkin: stay.checkin,
    checkout: stay.checkout
  }, overrides), inventory);
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error.code === code);
}

test('private suite allocates S1 then advances to S2 when S1 is occupied', () => {
  const runtime = createRuntime();
  assert.deepEqual(Array.from(availability(runtime, 'PRIVATE_SUITE').roomIds), ['S1']);
  addBooking(runtime, { allocatedRoomIdsJson: '["S1"]' });
  assert.deepEqual(Array.from(availability(runtime, 'PRIVATE_SUITE').roomIds), ['S2']);
});

test('deluxe suite can use S2+S3 after S1+S2 is blocked and never creates S1+S3', () => {
  const runtime = createRuntime();
  addBooking(runtime, { allocatedRoomIdsJson: '["S1"]' });
  const result = availability(runtime, 'DELUXE_SUITE');
  assert.deepEqual(Array.from(result.roomIds), ['S2', 'S3']);
  assert.notDeepEqual(Array.from(result.roomIds), ['S1', 'S3']);
});

test('deluxe suite returns unavailable when both legal virtual combinations conflict', () => {
  const runtime = createRuntime();
  addBooking(runtime, { bookingId: 'B1', allocatedRoomIdsJson: '["S1"]' });
  addBooking(runtime, { bookingId: 'B2', allocatedRoomIdsJson: '["S2"]' });
  const result = availability(runtime, 'DELUXE_SUITE');
  assert.equal(result.available, false);
  assert.deepEqual(Array.from(result.roomIds), []);
});

test('very deluxe suite maps only to the S1+S2+S3 physical group', () => {
  const runtime = createRuntime();
  const result = availability(runtime, 'VERY_DELUXE_SUITE');
  assert.deepEqual(Array.from(result.roomIds), ['S1', 'S2', 'S3']);
});

test('date intervals are half-open; same-day checkout and next check-in do not overlap', () => {
  const runtime = createRuntime();
  const stay = dates();
  addBooking(runtime, { checkinDate: stay.checkin, checkoutDate: stay.checkout, allocatedRoomIdsJson: '["S1"]' });
  const nextDay = runtime.context.littlelandAvailability_({
    roomTypeId: 'PRIVATE_SUITE', checkin: stay.checkout, checkout: addDays(stay.checkout, 1)
  }, runtime.context.littlelandReadInventory_());
  assert.deepEqual(Array.from(nextDay.roomIds), ['S1']);
});

test('PENDING_CONFIRMATION and closed/cancelled statuses do not occupy rooms', () => {
  for (const status of ['PENDING_CONFIRMATION', 'CANCELLED', 'CHECKED_OUT', 'COMPLETED']) {
    const runtime = createRuntime();
    addBooking(runtime, { bookingStatus: status, allocatedRoomIdsJson: '' });
    assert.deepEqual(Array.from(availability(runtime, 'PRIVATE_SUITE').roomIds), ['S1'], status);
  }
});

test('PENDING_DEPOSIT continues to occupy its room without an expiry timer', () => {
  const runtime = createRuntime();
  const stay = dates();
  addBooking(runtime, {
    bookingStatus: 'PENDING_DEPOSIT',
    checkinDate: stay.checkin,
    checkoutDate: stay.checkout,
    allocatedRoomIdsJson: '["S1"]',
    createdAt: '2024-01-01T00:00:00.000Z'
  });
  assert.deepEqual(Array.from(availability(runtime, 'PRIVATE_SUITE').roomIds), ['S2']);
});

test('active Booking allocation cannot reference virtual rooms or illegal S1+S3 combination', () => {
  for (const [roomTypeId, allocation] of [
    ['DELUXE_SUITE', '["S1","S3"]'],
    ['DELUXE_SUITE', '["SS1"]'],
    ['VERY_DELUXE_SUITE', '["S1","S2"]']
  ]) {
    const runtime = createRuntime();
    addBooking(runtime, { roomTypeId, allocatedRoomIdsJson: allocation });
    expectCode(() => availability(runtime, 'PRIVATE_SUITE'), 'ROOM_INVALID_ALLOCATION');
  }
});

test('unknown booking status fails closed instead of being treated as free', () => {
  const runtime = createRuntime();
  addBooking(runtime, { bookingStatus: 'UNKNOWN_STATUS' });
  expectCode(() => availability(runtime, 'PRIVATE_SUITE'), 'ROOM_INVALID_ALLOCATION');
});

test('pre-existing overlap for an occupied physical room fails closed', () => {
  const runtime = createRuntime();
  addBooking(runtime, { bookingId: 'B1', allocatedRoomIdsJson: '["S1"]' });
  addBooking(runtime, { bookingId: 'B2', allocatedRoomIdsJson: '["S1"]' });
  expectCode(() => availability(runtime, 'PRIVATE_SUITE'), 'ROOM_OVERLAP_DETECTED');
});

test('availability API reveals only an available boolean, not physical IDs or booking details', () => {
  const runtime = createRuntime();
  const stay = dates();
  const result = runtime.invokeGet({
    action: 'availability', checkin: stay.checkin, checkout: stay.checkout,
    species: 'rabbit', roomTypeId: 'DELUXE_SUITE', quantity: '1'
  });
  assert.equal(result.success, true);
  assert.equal(result.data.available, true);
  assert.deepEqual(Object.keys(result.data), ['available']);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('S1'), false);
  assert.equal(serialized.includes('bookingId'), false);
});

test('availability API fails closed for a missing TEST allow-list and rejects caller spreadsheet IDs', () => {
  const stay = dates();
  const missingAllowList = createRuntime({ allowedSpreadsheetId: '' });
  const missing = missingAllowList.invokeGet({
    action: 'availability', checkin: stay.checkin, checkout: stay.checkout,
    species: 'rabbit', roomTypeId: 'DELUXE_ROOM', quantity: '1'
  });
  assert.equal(missing.success, false);
  assert.equal(missing.code, 'SYSTEM_UNAVAILABLE');

  const runtime = createRuntime();
  const suppliedId = runtime.invokeGet({
    action: 'availability', checkin: stay.checkin, checkout: stay.checkout,
    species: 'rabbit', roomTypeId: 'DELUXE_ROOM', quantity: '1', spreadsheetId: 'production-id'
  });
  assert.equal(suppliedId.success, false);
  assert.equal(suppliedId.code, 'VALIDATION_FAILED');
});
