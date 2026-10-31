const test = require('node:test');
const assert = require('node:assert/strict');
const Api = require('../booking/api-client.js');

function jsonResponse(envelope, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => envelope
  };
}

function success(data) {
  return { success: true, code: 'OK', message: '操作成功', data };
}

test('Availability calls the TEST API with selected dates and room type, returning only a boolean', async () => {
  let requestUrl = '';
  let requestOptions;
  const available = await Api.getAvailability({
    checkin: '2026-11-23',
    checkout: '2026-11-24',
    species: 'rabbit',
    roomTypeId: 'DELUXE_ROOM'
  }, async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return jsonResponse(success({ available: true }));
  });

  const parsed = new URL(requestUrl);
  assert.equal(parsed.origin, 'https://script.google.com');
  assert.match(parsed.pathname, /\/macros\/s\/.+\/exec$/);
  assert.equal(parsed.searchParams.get('action'), 'availability');
  assert.equal(parsed.searchParams.get('checkin'), '2026-11-23');
  assert.equal(parsed.searchParams.get('checkout'), '2026-11-24');
  assert.equal(parsed.searchParams.get('species'), 'rabbit');
  assert.equal(parsed.searchParams.get('roomTypeId'), 'DELUXE_ROOM');
  assert.equal(parsed.searchParams.get('quantity'), '1');
  assert.equal(requestOptions.method, 'GET');
  assert.equal(requestOptions.credentials, 'omit');
  assert.equal(available, true);
});

test('Availability preserves a genuine unavailable result', async () => {
  const available = await Api.getAvailability({
    checkin: '2026-11-23', checkout: '2026-11-24', species: 'rabbit', roomTypeId: 'DELUXE_ROOM'
  }, async () => jsonResponse(success({ available: false })));
  assert.equal(available, false);
});

test('Availability API failure exposes a stable code but not a successful status', async () => {
  await assert.rejects(
    Api.getAvailability({ checkin: '2026-11-23', checkout: '2026-11-24', species: 'rabbit', roomTypeId: 'DELUXE_ROOM' }, async () => jsonResponse({
      success: false, code: 'SHEET_READ_FAILED', message: 'private internal detail', retryable: true
    })),
    (error) => error instanceof Api.ApiError && error.code === 'SHEET_READ_FAILED' && error.retryable === true
  );
});

test('Create Booking uses the expected TEST endpoint, simple text/plain JSON POST and returns verified server data', async () => {
  const payload = {
    idempotencyKey: 'test-key-1',
    form: { species: 'rabbit', roomId: 'DELUXE_ROOM' },
    terms: [true, true, true, true, true, true],
    clientQuote: { priceVersion: Api.PRICE_VERSION }
  };
  let requestUrl = '';
  let requestOptions;
  const result = await Api.createBooking(payload, async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return jsonResponse(success({
      bookingId: 'TEST-LL-20261031-A1B2C3D4',
      bookingStatus: 'PENDING_CONFIRMATION',
      roomTypeId: 'DELUXE_ROOM',
      price: { estimatedTotal: 178 }
    }));
  });

  assert.equal(requestUrl, Api.API_URL);
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.credentials, 'omit');
  assert.equal(requestOptions.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(requestOptions.body), payload);
  assert.equal(result.bookingId, 'TEST-LL-20261031-A1B2C3D4');
});

test('Create Booking rejects invalid IDs and statuses before a completion page can be shown', async () => {
  for (const data of [
    { bookingId: 'DEMO-LL-20261031-ABCD', bookingStatus: 'PENDING_CONFIRMATION' },
    { bookingId: 'TEST-LL-20261031-A1B2C3D4', bookingStatus: 'CONFIRMED' },
    { bookingId: '', bookingStatus: 'PENDING_CONFIRMATION' }
  ]) {
    await assert.rejects(
      Api.createBooking({ idempotencyKey: 'test-key', form: {}, terms: [], clientQuote: {} }, async () => jsonResponse(success(data))),
      (error) => error instanceof Api.ApiError && error.code === 'INVALID_BOOKING_RESPONSE'
    );
  }
});

test('Create Booking keeps stable server error code and retryability for the room-race path', async () => {
  await assert.rejects(
    Api.createBooking({ idempotencyKey: 'test-key', form: {}, terms: [], clientQuote: {} }, async () => jsonResponse({
      success: false,
      code: 'ROOM_NO_LONGER_AVAILABLE',
      message: '所選日期的房型已不可預訂，請重新查詢。',
      retryable: false
    })),
    (error) => error instanceof Api.ApiError && error.code === 'ROOM_NO_LONGER_AVAILABLE' && error.retryable === false
  );
});

test('Network and malformed JSON failures are retryable errors, not booking success', async () => {
  await assert.rejects(
    Api.getAvailability({ checkin: '2026-11-23', checkout: '2026-11-24', species: 'rabbit', roomTypeId: 'DELUXE_ROOM' }, async () => {
      throw new TypeError('offline');
    }),
    (error) => error instanceof Api.ApiError && error.code === 'NETWORK_ERROR' && error.retryable === true
  );
  await assert.rejects(
    Api.createBooking({ idempotencyKey: 'test-key', form: {}, terms: [], clientQuote: {} }, async () => ({
      ok: true, status: 200, json: async () => { throw new SyntaxError('not JSON'); }
    })),
    (error) => error instanceof Api.ApiError && error.code === 'INVALID_RESPONSE' && error.retryable === true
  );
});

test('Only a backend-shaped TEST Booking ID is considered valid', () => {
  assert.equal(Api.validBookingId('TEST-LL-20261031-A1B2C3D4'), true);
  assert.equal(Api.validBookingId('DEMO-LL-20261031-A1B2C3D4'), false);
  assert.equal(Api.validBookingId('TEST-LL-20261031-not-valid'), false);
  assert.equal(Api.validBookingId('TEST-LL-20261031-A1B2C3D4-extra'), false);
});


test('Create Booking allows 60 seconds for Sheets-backed TEST writes', async () => {
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  let observedTimeout = null;
  globalThis.setTimeout = (callback, delay) => {
    observedTimeout = delay;
    return 1;
  };
  globalThis.clearTimeout = () => {};

  try {
    await Api.createBooking({ idempotencyKey: 'test-key-timeout' }, async () => jsonResponse(success({
      bookingId: 'TEST-LL-20261031-A1B2C3D4',
      bookingStatus: 'PENDING_CONFIRMATION'
    })));
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }

  assert.equal(observedTimeout, 60000);
});
