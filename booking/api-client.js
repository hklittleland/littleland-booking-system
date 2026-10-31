(function (root, factory) {
  'use strict';

  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LittleLandBookingApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i/exec';
  const PRICE_VERSION = '6f002fd9ea921c313ecf90502091f1de051f332c';
  const REQUEST_TIMEOUT_MS = 60000;
  const BOOKING_ID_PATTERN = /^TEST-LL-\d{8}-[A-F0-9]{8}$/;

  class ApiError extends Error {
    constructor(code, message, retryable, status) {
      super(message || 'TEST API 暫時未能處理要求。');
      this.name = 'LittleLandApiError';
      this.code = code || 'API_ERROR';
      this.retryable = Boolean(retryable);
      this.status = Number.isFinite(status) ? status : null;
    }
  }

  function validBookingId(value) {
    return typeof value === 'string' && BOOKING_ID_PATTERN.test(value);
  }

  function resolveFetch(fetchImpl) {
    const candidate = fetchImpl || (root && root.fetch);
    if (typeof candidate !== 'function') {
      throw new ApiError('NETWORK_ERROR', '瀏覽器無法連接 TEST API。', true);
    }
    return candidate;
  }

  async function requestJson(url, init, fetchImpl) {
    const fetcher = resolveFetch(fetchImpl);
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS)
      : null;

    try {
      const response = await fetcher(url, Object.assign({}, init, controller ? { signal: controller.signal } : {}));
      let envelope;
      try {
        envelope = await response.json();
      } catch (error) {
        throw new ApiError('INVALID_RESPONSE', 'TEST API 回應格式無法讀取，請重試。', true, response.status);
      }

      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || typeof envelope.success !== 'boolean') {
        throw new ApiError('INVALID_RESPONSE', 'TEST API 回應格式不完整，請重試。', true, response.status);
      }
      if (!response.ok) {
        throw new ApiError(
          typeof envelope.code === 'string' ? envelope.code : 'HTTP_ERROR',
          typeof envelope.message === 'string' ? envelope.message : 'TEST API 暫時未能處理要求。',
          Boolean(envelope.retryable) || response.status >= 500,
          response.status
        );
      }
      if (!envelope.success) {
        throw new ApiError(
          typeof envelope.code === 'string' ? envelope.code : 'API_ERROR',
          typeof envelope.message === 'string' ? envelope.message : 'TEST API 暫時未能處理要求。',
          Boolean(envelope.retryable),
          response.status
        );
      }
      if (envelope.code !== 'OK' || !envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
        throw new ApiError('INVALID_RESPONSE', 'TEST API 成功回應資料不完整，請重試。', true, response.status);
      }
      return envelope;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message = error && error.name === 'AbortError'
        ? 'TEST API 查詢逾時，已保留你填寫的資料，請重試。'
        : '暫時無法連接 TEST API，已保留你填寫的資料，請重試。';
      throw new ApiError('NETWORK_ERROR', message, true);
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  async function getAvailability(input, fetchImpl) {
    if (!input || typeof input !== 'object') {
      throw new ApiError('VALIDATION_FAILED', '房態查詢資料不完整。', false);
    }
    const url = new URL(API_URL);
    url.searchParams.set('action', 'availability');
    url.searchParams.set('checkin', String(input.checkin || ''));
    url.searchParams.set('checkout', String(input.checkout || ''));
    url.searchParams.set('species', String(input.species || ''));
    url.searchParams.set('roomTypeId', String(input.roomTypeId || ''));
    url.searchParams.set('quantity', '1');

    const envelope = await requestJson(url.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      headers: { Accept: 'application/json' }
    }, fetchImpl);

    if (typeof envelope.data.available !== 'boolean') {
      throw new ApiError('INVALID_RESPONSE', 'TEST API 房態回應格式不正確，請重試。', true);
    }
    return envelope.data.available;
  }

  async function createBooking(payload, fetchImpl) {
    if (!payload || typeof payload !== 'object' || typeof payload.idempotencyKey !== 'string' || !payload.idempotencyKey) {
      throw new ApiError('VALIDATION_FAILED', '預約申請資料不完整。', false);
    }

    const envelope = await requestJson(API_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    }, fetchImpl);

    const data = envelope.data;
    if (!validBookingId(data.bookingId) || data.bookingStatus !== 'PENDING_CONFIRMATION') {
      throw new ApiError('INVALID_BOOKING_RESPONSE', 'TEST API 未回傳有效預約編號，沒有顯示成功頁。', true);
    }
    return data;
  }

  return Object.freeze({
    API_URL,
    PRICE_VERSION,
    ApiError,
    validBookingId,
    getAvailability,
    createBooking
  });
});
