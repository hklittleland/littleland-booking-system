'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime, makePayload, addDays, hkDateString } = require('./harness');

function expectFailure(response, code) {
  assert.equal(response.success, false, JSON.stringify(response));
  assert.equal(response.code, code);
  assert.equal(typeof response.requestId, 'string');
  assert.equal(typeof response.timestamp, 'string');
  assert.equal(typeof response.retryable, 'boolean');
}

function activeBooking(runtime, payload, roomId, bookingId = 'TEST-LL-20261201-OCCUPIED') {
  runtime.addRecord('Bookings', {
    bookingId,
    bookingStatus: 'PENDING_DEPOSIT',
    checkinDate: payload.form.checkin,
    checkoutDate: payload.form.checkout,
    roomTypeId: payload.form.roomId,
    allocatedRoomIdsJson: JSON.stringify([roomId])
  });
}

function fridayFrom(start = addDays(hkDateString(), 35)) {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(start, offset);
    const [year, month, day] = candidate.split('-').map(Number);
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 5) return candidate;
  }
  throw new Error('Unable to find Friday.');
}

test('Create Booking writes one pending request, per-pet rows and a minimal log to mocked TEST Sheets', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime);
  const response = runtime.invokePost(payload);

  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.code, 'OK');
  assert.equal(response.data.bookingStatus, 'PENDING_CONFIRMATION');
  assert.match(response.data.bookingId, /^TEST-LL-\d{8}-[A-F0-9]{8}$/);
  assert.equal(response.data.roomTypeId, 'DELUXE_ROOM');
  assert.equal(JSON.stringify(response).includes('A1'), false);
  assert.equal(JSON.stringify(response).includes('Test Parent'), false);

  const bookings = runtime.records('Bookings');
  const pets = runtime.records('Pets');
  const logs = runtime.records('Logs');
  const idempotency = runtime.records('IdempotencyKeys');
  assert.equal(bookings.length, 1);
  assert.equal(pets.length, 1);
  assert.equal(runtime.records('Payments').length, 0);
  assert.equal(logs.length, 1);
  assert.equal(bookings[0].bookingId, response.data.bookingId);
  assert.equal(bookings[0].bookingStatus, 'PENDING_CONFIRMATION');
  assert.deepEqual(JSON.parse(bookings[0].allocatedRoomIdsJson), ['A1']);
  assert.equal(bookings[0].depositStatus, 'UNPAID');
  assert.equal(bookings[0].balanceStatus, 'UNPAID');
  assert.equal(bookings[0].cashDepositStatus, 'NOT_COLLECTED');
  assert.equal(bookings[0].cashDepositAmount, 1000);
  assert.equal(pets[0].bookingId, bookings[0].bookingId);
  assert.equal(pets[0].healthReviewStatus, '');
  assert.equal(logs[0].actorType, 'SYSTEM');
  assert.equal(logs[0].summary.includes('Test Parent'), false);
  assert.equal(idempotency.length, 1);
  assert.equal(idempotency[0].state, 'COMPLETED');
  assert.equal(idempotency[0].bookingId, response.data.bookingId);
  assert.equal(idempotency[0].payloadHash.length, 64);
});

test('same key and canonical payload replays the original success without creating duplicate rows', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, { idempotencyKey: 'same-key' });
  const first = runtime.invokePost(payload);
  const countsAfterFirst = ['Bookings', 'Pets', 'Logs', 'IdempotencyKeys'].map((name) => runtime.records(name).length);
  const second = runtime.invokePost(payload);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(second.data.bookingId, first.data.bookingId);
  assert.deepEqual(['Bookings', 'Pets', 'Logs', 'IdempotencyKeys'].map((name) => runtime.records(name).length), countsAfterFirst);
});

test('same idempotency key with a different normalized payload is rejected', () => {
  const runtime = createRuntime();
  const firstPayload = makePayload(runtime, {}, { idempotencyKey: 'same-key' });
  assert.equal(runtime.invokePost(firstPayload).success, true);
  const changedPayload = makePayload(runtime, { parentName: 'Changed Parent' }, { idempotencyKey: 'same-key' });
  const response = runtime.invokePost(changedPayload);
  expectFailure(response, 'DUPLICATE_REQUEST');
  assert.equal(runtime.records('Bookings').length, 1);
});

test('same key cannot be reused for another operation even with identical payload hash', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, { idempotencyKey: 'same-key' });
  assert.equal(runtime.invokePost(payload).success, true);
  runtime.sheet('IdempotencyKeys').values[1][1] = 'OTHER_OPERATION';
  expectFailure(runtime.invokePost(payload), 'DUPLICATE_REQUEST');
  assert.equal(runtime.records('Bookings').length, 1);
});

test('tampered client quote is rejected and terminal failure is replayed without a booking', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, {
    idempotencyKey: 'bad-quote',
    quoteOverrides: { estimatedTotal: 999999 }
  });
  expectFailure(runtime.invokePost(payload), 'PRICE_CLIENT_MISMATCH');
  const second = runtime.invokePost(payload);
  expectFailure(second, 'PRICE_CLIENT_MISMATCH');
  assert.equal(runtime.records('Bookings').length, 0);
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'FAILED');
});

test('expired client price version is rejected with the stable version error code', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, {
    idempotencyKey: 'old-price',
    quoteOverrides: { priceVersion: 'old-commit-sha' }
  });
  expectFailure(runtime.invokePost(payload), 'PRICE_VERSION_EXPIRED');
  assert.equal(runtime.records('Bookings').length, 0);
});

test('a health disclosure with required details is accepted and marked for manual review', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {
    pets: [{ vetVisit: 'yes', vetDetails: '例行檢查，已提供藥物清單。' }]
  });
  const response = runtime.invokePost(payload);
  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.data.bookingStatus, 'PENDING_CONFIRMATION');
  assert.equal(runtime.records('Pets')[0].healthReviewStatus, 'HEALTH_REVIEW_REQUIRED');
});

test('pregnancy and surgery within 30 days remain hard booking blocks', () => {
  const pregnant = createRuntime();
  const pregnantPayload = makePayload(pregnant, {
    pets: [{ pregnant: 'yes' }]
  });
  expectFailure(pregnant.invokePost(pregnantPayload), 'PET_PREGNANT_NOT_ACCEPTED');
  assert.equal(pregnant.records('Bookings').length, 0);

  const surgery = createRuntime();
  const surgeryPayload = makePayload(surgery, {
    pets: [{ recentSurgery: 'yes' }]
  });
  expectFailure(surgery.invokePost(surgeryPayload), 'PET_RECENT_SURGERY_NOT_ACCEPTED');
  assert.equal(surgery.records('Bookings').length, 0);
});

test('species-specific minimum ages are enforced server-side', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {
    species: 'hamster',
    pets: [{ ageValue: '1', ageUnit: 'month' }]
  });
  expectFailure(runtime.invokePost(payload), 'PET_AGE_BELOW_MINIMUM');
  assert.equal(runtime.records('Bookings').length, 0);
});

test('pet count must match a valid species and room limit', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, { roomId: 'DELUXE_SUITE', quantity: 3 });
  payload.form.roomId = 'DELUXE_ROOM';
  payload.form.quantity = 2;
  expectFailure(runtime.invokePost(payload), 'PET_QTY_EXCEEDS_LIMIT');
  assert.equal(runtime.records('Bookings').length, 0);
});

test('yes health flags require details, all six consents and valid contact data', () => {
  const healthRuntime = createRuntime();
  const missingDetails = makePayload(healthRuntime, {
    pets: [{ medication: 'yes', medicationDetails: '' }]
  });
  expectFailure(healthRuntime.invokePost(missingDetails), 'VALIDATION_FAILED');

  const consentRuntime = createRuntime();
  const missingConsent = makePayload(consentRuntime);
  missingConsent.terms[3] = false;
  expectFailure(consentRuntime.invokePost(missingConsent), 'VALIDATION_FAILED');

  const contactRuntime = createRuntime();
  const invalidPhone = makePayload(contactRuntime, { phone: '123' });
  expectFailure(contactRuntime.invokePost(invalidPhone), 'VALIDATION_FAILED');
});

test('hamster booking stores no sterilization, pregnancy, flea or feeding-frequency fields', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, { species: 'hamster' });
  const response = runtime.invokePost(payload);
  assert.equal(response.success, true, JSON.stringify(response));
  const pet = runtime.records('Pets')[0];
  const booking = runtime.records('Bookings')[0];
  assert.equal(pet.sterilized, '');
  assert.equal(pet.pregnant, '');
  assert.equal(pet.fleaTreatment, '');
  assert.equal(booking.feeding, '');
  assert.equal(booking.hay, '');
});

test('server pricing applies weekend, extra-pet and each selected service, independently of client amounts', () => {
  const runtime = createRuntime();
  const checkin = fridayFrom();
  const payload = makePayload(runtime, {
    checkin,
    checkout: addDays(checkin, 1),
    species: 'rabbit',
    roomId: 'DELUXE_SUITE',
    quantity: 2,
    groomingOnce: true,
    groomingDaily: true,
    medicine: 'once',
    earlyCheckin: true,
    lateCheckout: true
  });
  const response = runtime.invokePost(payload);
  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.data.price.baseRoomFee, 350);
  assert.equal(response.data.price.extraPetFee, 50);
  assert.equal(response.data.price.weekendFee, 250);
  assert.equal(response.data.price.serviceFees, 600);
  assert.equal(response.data.price.estimatedTotal, 1250);
  assert.equal(response.data.price.depositAmount, 175);
  assert.equal(response.data.price.remainingBalance, 1075);
  assert.equal(response.data.price.cashDeposit, 2000);
});

test('the API performs a last-moment room recheck and does not create a stale booking', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime);
  ['A1', 'A2', 'A3'].forEach((roomId) => activeBooking(runtime, payload, roomId, `OCCUPIED-${roomId}`));
  expectFailure(runtime.invokePost(payload), 'ROOM_NO_LONGER_AVAILABLE');
  assert.equal(runtime.records('Bookings').length, 3);
  assert.equal(runtime.records('Pets').length, 0);
  assert.equal(runtime.records('Logs').length, 0);
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'FAILED');
});

test('retryable inventory read failure can be retried with the same key after recovery', () => {
  const runtime = createRuntime({ failRead: { sheetName: 'Rooms', minRows: 2 } });
  const payload = makePayload(runtime, {}, { idempotencyKey: 'retry-after-read-failure' });
  const first = runtime.invokePost(payload);
  expectFailure(first, 'SHEET_READ_FAILED');
  assert.equal(first.retryable, true);
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'FAILED');
  const second = runtime.invokePost(payload);
  assert.equal(second.success, true, JSON.stringify(second));
  assert.equal(runtime.records('Bookings').length, 1);
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'COMPLETED');
});

test('partial cross-sheet write leaves PROCESSING and blocks duplicate creation for manual reconciliation', () => {
  const runtime = createRuntime({ failWrite: { sheetName: 'Pets', afterWrite: true } });
  const payload = makePayload(runtime, {}, { idempotencyKey: 'partial-write' });
  expectFailure(runtime.invokePost(payload), 'SHEET_WRITE_FAILED');
  assert.equal(runtime.records('Bookings').length, 1);
  assert.equal(runtime.records('Pets').length, 1);
  assert.equal(runtime.records('Logs').length, 0);
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'PROCESSING');
  const before = runtime.records('Bookings').length;
  expectFailure(runtime.invokePost(payload), 'DUPLICATE_REQUEST');
  assert.equal(runtime.records('Bookings').length, before);
});

test('lock timeout returns retryable LOCK_TIMEOUT before claiming a key', () => {
  const runtime = createRuntime({ lockTimeout: true });
  const payload = makePayload(runtime);
  const response = runtime.invokePost(payload);
  expectFailure(response, 'LOCK_TIMEOUT');
  assert.equal(response.retryable, true);
  assert.equal(runtime.records('IdempotencyKeys').length, 0);
  assert.equal(runtime.records('Bookings').length, 0);
});

test('API rejects caller-selected spreadsheet IDs and wrong spreadsheet title without writes', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, { topLevelOverrides: { spreadsheetId: 'production-id' } });
  expectFailure(runtime.invokePost(payload), 'VALIDATION_FAILED');
  assert.equal(runtime.records('Bookings').length, 0);

  const wrongTitle = createRuntime({ spreadsheetName: 'LittleLand' });
  const wrongTitleResponse = wrongTitle.invokePost(makePayload(wrongTitle));
  expectFailure(wrongTitleResponse, 'SYSTEM_UNAVAILABLE');
  assert.equal(wrongTitle.records('Bookings').length, 0);
});


function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reverseObjectKeys(value[key])]));
}

test('canonical idempotency hash is stable when JSON object key order changes', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, {}, { idempotencyKey: 'key-order' });
  const first = runtime.invokePost(payload);
  const reordered = reverseObjectKeys(payload);
  const replay = runtime.invokePost(reordered);
  assert.equal(first.success, true);
  assert.equal(replay.success, true);
  assert.equal(replay.data.bookingId, first.data.bookingId);
  assert.equal(runtime.records('Bookings').length, 1);
});

test('one occupied physical room causes allocation to advance to the next free room of the selected type', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime, { species: 'rabbit', roomId: 'DELUXE_ROOM' });
  activeBooking(runtime, payload, 'A1');
  const response = runtime.invokePost(payload);
  assert.equal(response.success, true, JSON.stringify(response));
  assert.deepEqual(JSON.parse(runtime.records('Bookings').find((row) => row.bookingId === response.data.bookingId).allocatedRoomIdsJson), ['A2']);
});

test('PENDING_CONFIRMATION is provisional and does not occupy a physical room for another request', () => {
  const runtime = createRuntime();
  const firstPayload = makePayload(runtime, {}, { idempotencyKey: 'pending-one' });
  const first = runtime.invokePost(firstPayload);
  const secondPayload = makePayload(runtime, {}, { idempotencyKey: 'pending-two', topLevelOverrides: { form: Object.assign({}, firstPayload.form, { parentName: 'Second Parent', email: 'second@example.com' }) } });
  secondPayload.clientQuote = firstPayload.clientQuote;
  const second = runtime.invokePost(secondPayload);
  assert.equal(first.success, true);
  assert.equal(second.success, true, JSON.stringify(second));
  const created = runtime.records('Bookings').filter((row) => [first.data.bookingId, second.data.bookingId].includes(row.bookingId));
  assert.equal(created.length, 2);
  assert.ok(created.every((row) => row.bookingStatus === 'PENDING_CONFIRMATION'));
  assert.ok(created.every((row) => row.allocatedRoomIdsJson === '["A1"]'));
});

test('Availability returns false when all physical rooms for a type are occupied, without revealing why', () => {
  const runtime = createRuntime();
  const stay = {
    checkin: addDays(hkDateString(), 50),
    checkout: addDays(hkDateString(), 52)
  };
  ['A1', 'A2', 'A3'].forEach((roomId, index) => runtime.addRecord('Bookings', {
    bookingId: `OCCUPIED-${index}`,
    bookingStatus: 'CONFIRMED',
    checkinDate: stay.checkin,
    checkoutDate: stay.checkout,
    roomTypeId: 'DELUXE_ROOM',
    allocatedRoomIdsJson: JSON.stringify([roomId])
  }));
  const response = runtime.invokeGet({
    action: 'availability', checkin: stay.checkin, checkout: stay.checkout,
    species: 'rabbit', roomTypeId: 'DELUXE_ROOM', quantity: '1'
  });
  assert.equal(response.success, true);
  assert.equal(response.data.available, false);
  assert.deepEqual(Object.keys(response.data), ['available']);
  assert.equal(JSON.stringify(response).includes('A1'), false);
  assert.equal(JSON.stringify(response).includes('OCCUPIED'), false);
});

test('client cannot inject physical allocation or server-controlled price fields into form', () => {
  const runtime = createRuntime();
  const payload = makePayload(runtime);
  payload.form.allocatedRoomIdsJson = '["SSR1"]';
  expectFailure(runtime.invokePost(payload), 'VALIDATION_FAILED');
  assert.equal(runtime.records('Bookings').length, 0);
});


test('idempotency claim write failure before side effect is retryable with the same key', () => {
  const runtime = createRuntime({ failWrite: { sheetName: 'IdempotencyKeys', afterWrite: false } });
  const payload = makePayload(runtime, {}, { idempotencyKey: 'claim-write-before' });
  const first = runtime.invokePost(payload);
  expectFailure(first, 'SHEET_WRITE_FAILED');
  assert.equal(first.retryable, true);
  assert.equal(runtime.records('IdempotencyKeys').length, 0);
  const second = runtime.invokePost(payload);
  assert.equal(second.success, true, JSON.stringify(second));
  assert.equal(runtime.records('Bookings').length, 1);
});

test('idempotency claim write failure after side effect leaves PROCESSING and blocks duplicate creation', () => {
  const runtime = createRuntime({ failWrite: { sheetName: 'IdempotencyKeys', afterWrite: true } });
  const payload = makePayload(runtime, {}, { idempotencyKey: 'claim-write-after' });
  const first = runtime.invokePost(payload);
  expectFailure(first, 'SHEET_WRITE_FAILED');
  assert.equal(runtime.records('IdempotencyKeys')[0].state, 'PROCESSING');
  expectFailure(runtime.invokePost(payload), 'DUPLICATE_REQUEST');
  assert.equal(runtime.records('Bookings').length, 0);
});


test('API rejects unknown pet and client quote fields before any write', () => {
  const petRuntime = createRuntime();
  const petPayload = makePayload(petRuntime);
  petPayload.form.pets[0].adminOverride = true;
  expectFailure(petRuntime.invokePost(petPayload), 'VALIDATION_FAILED');
  assert.equal(petRuntime.records('Bookings').length, 0);

  const quoteRuntime = createRuntime();
  const quotePayload = makePayload(quoteRuntime);
  quotePayload.clientQuote.spreadsheetId = 'production-id';
  expectFailure(quoteRuntime.invokePost(quotePayload), 'PRICE_CLIENT_MISMATCH');
  assert.equal(quoteRuntime.records('Bookings').length, 0);
});

test('untrusted strings are forced to literal text before mock TEST Sheet writes', () => {
  const runtime = createRuntime();
  const maliciousFormula = '=HYPERLINK("https://example.invalid","click")';
  const payload = makePayload(runtime, {
    parentName: maliciousFormula,
    emergency1: '+852 6123 4567'
  });
  const response = runtime.invokePost(payload);
  assert.equal(response.success, true, JSON.stringify(response));
  const booking = runtime.records('Bookings')[0];
  assert.equal(booking.parentName, "'" + maliciousFormula);
  assert.equal(booking.emergency1, "'+852 6123 4567");
});


test('rechecks the idempotency key after acquiring the script lock and replays a concurrent winner', () => {
  const options = {};
  const runtime = createRuntime(options);
  const payload = makePayload(runtime, {}, { idempotencyKey: 'concurrent-winner' });
  const bookingId = 'TEST-LL-20261201-CONCUR01';
  let injected = false;

  options.onLockAcquired = () => {
    if (injected) return;
    injected = true;
    const validated = runtime.context.littlelandValidateBookingRequest_(payload);
    const pricing = runtime.context.LittleLandPricing.calculatePricing(validated.pricingInput);
    const timestamp = '2026-12-01T00:00:00.000Z';
    const booking = runtime.context.littlelandBuildBookingRecord_(validated, pricing, ['A1'], bookingId, timestamp);
    const pets = runtime.context.littlelandBuildPetRecords_(validated, bookingId, timestamp);
    const log = runtime.context.littlelandBuildCreationLog_(validated, bookingId, 'winner-request', timestamp);
    const winner = runtime.context.littlelandBookingSuccess_(bookingId, validated.form, pricing, 'winner-request');

    runtime.addRecord('Bookings', booking);
    pets.forEach((pet) => runtime.addRecord('Pets', pet));
    runtime.addRecord('Logs', log);
    runtime.addRecord('IdempotencyKeys', {
      idempotencyKey: validated.idempotencyKey,
      operation: validated.operation,
      payloadHash: runtime.context.littlelandPayloadHash_(validated),
      state: 'COMPLETED',
      bookingId,
      requestId: 'winner-request',
      responseCode: 'OK',
      responseSnapshotJson: JSON.stringify({
        success: true,
        code: 'OK',
        message: winner.message,
        data: winner.data
      }),
      createdAt: timestamp,
      updatedAt: timestamp
    });
  };

  const response = runtime.invokePost(payload);
  assert.equal(injected, true);
  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.data.bookingId, bookingId);
  assert.equal(runtime.getWriteCount(), 0);
  assert.equal(runtime.records('Bookings').length, 1);
  assert.equal(runtime.records('Pets').length, 1);
  assert.equal(runtime.records('Logs').length, 1);
  assert.equal(runtime.records('IdempotencyKeys').length, 1);
});
