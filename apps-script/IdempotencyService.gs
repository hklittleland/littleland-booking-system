/**
 * TEST Create Booking idempotency protocol. No TTL or automatic row deletion.
 */
var LITTLELAND_CREATE_BOOKING_OPERATION = 'CREATE_BOOKING';
var LITTLELAND_IDEMPOTENCY_STATES = Object.freeze(['PROCESSING', 'COMPLETED', 'FAILED']);

function littlelandPayloadHash_(validatedRequest) {
  var canonical = littlelandCanonicalJson_({
    operation: validatedRequest.operation,
    form: validatedRequest.form,
    terms: validatedRequest.terms,
    clientQuote: validatedRequest.clientQuote
  });
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    canonical,
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    var unsignedByte = byte < 0 ? byte + 256 : byte;
    return ('0' + unsignedByte.toString(16)).slice(-2);
  }).join('');
}

function littlelandCanonicalJson_(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    littlelandRequire_(Number.isFinite(value), 'VALIDATION_FAILED', '請求包含無效數值。', false);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return littlelandCanonicalJson_(item); }).join(',') + ']';
  }
  littlelandRequire_(littlelandIsObject_(value), 'VALIDATION_FAILED', '請求包含不支援資料。', false);
  var keys = Object.keys(value).sort();
  return '{' + keys.map(function (key) {
    return JSON.stringify(key) + ':' + littlelandCanonicalJson_(value[key]);
  }).join(',') + '}';
}

function littlelandCheckIdempotency_(idempotencyKey, operation, payloadHash) {
  var table = littlelandReadTable_('IdempotencyKeys');
  var matches = table.rows.filter(function (row) {
    return String(row.record.idempotencyKey) === String(idempotencyKey);
  });
  littlelandRequire_(
    matches.length <= 1,
    'SHEET_READ_FAILED',
    'IdempotencyKeys 存在重複主鍵，已停止處理。',
    false
  );
  if (!matches.length) return { disposition: 'NEW', record: null };

  var record = matches[0].record;
  littlelandRequire_(
    record.operation === operation && record.payloadHash === payloadHash,
    'DUPLICATE_REQUEST',
    '此防重複提交 key 已用於不同操作或資料。',
    false
  );
  littlelandRequire_(
    LITTLELAND_IDEMPOTENCY_STATES.indexOf(String(record.state)) !== -1,
    'SHEET_READ_FAILED',
    'IdempotencyKeys 狀態無效，已停止處理。',
    false
  );

  if (record.state === 'COMPLETED') return { disposition: 'REPLAY_SUCCESS', record: record };
  if (record.state === 'PROCESSING') {
    return { disposition: 'IN_PROGRESS', record: record };
  }

  var failedSnapshot = littlelandReadSnapshot_(record.responseSnapshotJson);
  return failedSnapshot.retryable
    ? { disposition: 'RETRY_FAILED', record: record, snapshot: failedSnapshot }
    : { disposition: 'REPLAY_FAILURE', record: record, snapshot: failedSnapshot };
}

function littlelandClaimIdempotency_(idempotencyKey, operation, payloadHash, requestId, createdAt) {
  var now = createdAt || littlelandNowIso_();
  littlelandAppendRecord_('IdempotencyKeys', {
    idempotencyKey: idempotencyKey,
    operation: operation,
    payloadHash: payloadHash,
    state: 'PROCESSING',
    bookingId: '',
    requestId: requestId,
    responseCode: '',
    responseSnapshotJson: '',
    createdAt: now,
    updatedAt: now
  });
}

function littlelandRetryFailedIdempotency_(idempotencyKey, requestId) {
  littlelandUpdateRecordByKey_('IdempotencyKeys', 'idempotencyKey', idempotencyKey, {
    state: 'PROCESSING',
    bookingId: '',
    requestId: requestId,
    responseCode: '',
    responseSnapshotJson: '',
    updatedAt: littlelandNowIso_()
  });
}

function littlelandSetIdempotencyBookingId_(idempotencyKey, bookingId) {
  littlelandUpdateRecordByKey_('IdempotencyKeys', 'idempotencyKey', idempotencyKey, {
    bookingId: bookingId,
    updatedAt: littlelandNowIso_()
  });
}

function littlelandMarkIdempotencyFailed_(idempotencyKey, requestId, error) {
  var snapshot = {
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || '系統暫時無法處理，請稍後再試。',
    retryable: Boolean(error.retryable)
  };
  littlelandUpdateRecordByKey_('IdempotencyKeys', 'idempotencyKey', idempotencyKey, {
    state: 'FAILED',
    requestId: requestId,
    responseCode: snapshot.code,
    responseSnapshotJson: JSON.stringify(snapshot),
    updatedAt: littlelandNowIso_()
  });
}

function littlelandCompleteIdempotency_(idempotencyKey, requestId, bookingId, response) {
  var snapshot = {
    success: true,
    code: response.code,
    message: response.message,
    data: response.data
  };
  littlelandUpdateRecordByKey_('IdempotencyKeys', 'idempotencyKey', idempotencyKey, {
    state: 'COMPLETED',
    bookingId: bookingId,
    requestId: requestId,
    responseCode: response.code,
    responseSnapshotJson: JSON.stringify(snapshot),
    updatedAt: littlelandNowIso_()
  });
}

function littlelandReadSnapshot_(json) {
  try {
    var snapshot = JSON.parse(String(json || ''));
    littlelandRequire_(littlelandIsObject_(snapshot), 'SHEET_READ_FAILED', 'Idempotency response snapshot 無效。', false);
    return snapshot;
  } catch (error) {
    if (error && error.code) throw error;
    throw littlelandApiError_('SHEET_READ_FAILED', 'Idempotency response snapshot 無法讀取。', false);
  }
}

function littlelandIdempotencyDispositionResponse_(check, requestId) {
  if (check.disposition === 'REPLAY_SUCCESS') {
    var success = littlelandReadSnapshot_(check.record.responseSnapshotJson);
    return littlelandSuccessResponse_(success.data, requestId, success.message);
  }
  if (check.disposition === 'REPLAY_FAILURE') {
    var failure = check.snapshot;
    return littlelandFailureResponse_(
      littlelandApiError_(failure.code, failure.message, failure.retryable),
      requestId
    );
  }
  if (check.disposition === 'IN_PROGRESS') {
    return littlelandFailureResponse_(
      littlelandApiError_('DUPLICATE_REQUEST', '相同預約申請仍在處理或需要人工核對，沒有再次建立資料。', false),
      requestId
    );
  }
  return null;
}
