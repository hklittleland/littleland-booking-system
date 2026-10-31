/**
 * LittleLand TEST Apps Script API source.
 * This is the deployed TEST Web App source; automated tests use mocked Apps Script services.
 */
var LITTLELAND_API_RETRYABLE_CODES = Object.freeze([
  'LOCK_TIMEOUT', 'SHEET_READ_FAILED', 'SHEET_WRITE_FAILED', 'QUOTA_EXCEEDED',
  'EXECUTION_TIMEOUT', 'SYSTEM_UNAVAILABLE'
]);

function doGet(event) {
  var requestId = littlelandNewRequestId_();
  try {
    var parameters = event && event.parameter ? event.parameter : {};
    littlelandRequire_(parameters.action === 'availability', 'VALIDATION_FAILED', '不支援的查詢 action。', false);
    littlelandRequire_(
      !Object.prototype.hasOwnProperty.call(parameters, 'spreadsheetId'),
      'VALIDATION_FAILED',
      'API 不接受 Spreadsheet ID。',
      false
    );
    var checkin = String(parameters.checkin || '');
    var checkout = String(parameters.checkout || '');
    var species = String(parameters.species || '');
    var roomTypeId = String(parameters.roomTypeId || '');
    var quantity = littlelandParseInteger_(parameters.quantity);
    littlelandValidateDateRange_(checkin, checkout, new Date());
    littlelandRequire_(quantity !== null && quantity >= 1, 'PET_QTY_INVALID', '寵物數量必須是大於或等於 1 的整數。', false);

    var checkPricing;
    try {
      checkPricing = LittleLandPricing.calculatePricing({
        species: species,
        roomId: roomTypeId,
        checkin: checkin,
        checkout: checkout,
        quantity: quantity,
        services: []
      });
    } catch (pricingError) {
      throw littlelandMapPricingError_(pricingError);
    }
    littlelandRequire_(Boolean(checkPricing), 'PRICE_CALCULATION_FAILED', '無法驗證房型資料。', false);

    var inventory = littlelandReadInventory_();
    var result = littlelandAvailability_({
      roomTypeId: roomTypeId,
      checkin: checkin,
      checkout: checkout
    }, inventory);
    return littlelandJsonOutput_(littlelandSuccessResponse_({ available: result.available }, requestId, '操作成功'));
  } catch (error) {
    return littlelandJsonOutput_(littlelandFailureResponse_(littlelandNormalizeError_(error, 'read'), requestId));
  }
}

function doPost(event) {
  var requestId = littlelandNewRequestId_();
  var lock = null;
  var request = null;
  var payloadHash = '';
  var claimWritten = false;
  var businessWritesStarted = false;
  var stage = 'parse';

  try {
    var rawBody = event && event.postData && event.postData.contents;
    littlelandRequire_(typeof rawBody === 'string' && rawBody.length > 0, 'VALIDATION_FAILED', '缺少 JSON 預約資料。', false);
    try {
      request = JSON.parse(rawBody);
    } catch (jsonError) {
      throw littlelandApiError_('VALIDATION_FAILED', '請求 JSON 格式不正確。', false);
    }

    stage = 'validate';
    var validated = littlelandValidateBookingRequest_(request);
    payloadHash = littlelandPayloadHash_(validated);
    var idempotencyKey = validated.idempotencyKey;

    stage = 'idempotency-read';
    var firstCheck = littlelandCheckIdempotency_(idempotencyKey, validated.operation, payloadHash);
    var immediateResponse = littlelandExistingRequestResponse_(firstCheck, requestId);
    if (immediateResponse) return littlelandJsonOutput_(immediateResponse);

    stage = 'lock';
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw littlelandApiError_('LOCK_TIMEOUT', '系統正處理另一項預約，請稍後重試。', true);
    }

    try {
      stage = 'idempotency-read';
      var lockedCheck = littlelandCheckIdempotency_(idempotencyKey, validated.operation, payloadHash);
      immediateResponse = littlelandExistingRequestResponse_(lockedCheck, requestId);
      if (immediateResponse) return littlelandJsonOutput_(immediateResponse);

      stage = 'idempotency-write';
      if (lockedCheck.disposition === 'NEW') {
        littlelandClaimIdempotency_(idempotencyKey, validated.operation, payloadHash, requestId, littlelandNowIso_());
        claimWritten = true;
      } else if (lockedCheck.disposition === 'RETRY_FAILED') {
        littlelandRetryFailedIdempotency_(idempotencyKey, requestId);
        claimWritten = true;
      } else {
        throw littlelandApiError_('DUPLICATE_REQUEST', '相同預約申請已在處理或須人工核對，沒有再次建立資料。', false);
      }

      stage = 'pricing';
      var pricing;
      try {
        pricing = LittleLandPricing.calculatePricing(validated.pricingInput);
      } catch (pricingError) {
        throw littlelandMapPricingError_(pricingError);
      }
      littlelandAssertClientQuote_(validated.clientQuote, pricing);

      stage = 'inventory-read';
      var inventory = littlelandReadInventory_();
      var availability = littlelandAvailability_({
        roomTypeId: validated.form.roomId,
        checkin: validated.form.checkin,
        checkout: validated.form.checkout
      }, inventory);
      if (!availability.available) {
        throw littlelandApiError_('ROOM_NO_LONGER_AVAILABLE', '所選日期的房型已不可預訂，請重新查詢。', false);
      }

      var bookingId = littlelandCreateBookingId_(inventory.bookings);
      littlelandSetIdempotencyBookingId_(idempotencyKey, bookingId);
      var timestamp = littlelandNowIso_();
      var booking = littlelandBuildBookingRecord_(validated, pricing, bookingId, timestamp);
      var pets = littlelandBuildPetRecords_(validated, bookingId, timestamp);
      var log = littlelandBuildCreationLog_(validated, bookingId, requestId, timestamp);
      var response = littlelandBookingSuccess_(bookingId, validated.form, pricing, requestId);

      stage = 'business-write';
      businessWritesStarted = true;
      littlelandAppendRecord_('Bookings', booking);
      pets.forEach(function (pet) { littlelandAppendRecord_('Pets', pet); });
      littlelandAppendRecord_('Logs', log);
      littlelandClearAvailabilityCache_();
      littlelandCompleteIdempotency_(idempotencyKey, requestId, bookingId, response);
      return littlelandJsonOutput_(response);
    } catch (lockedError) {
      var normalizedLockedError = littlelandNormalizeError_(lockedError, stage);
      if (claimWritten && !businessWritesStarted) {
        try {
          littlelandMarkIdempotencyFailed_(idempotencyKey, requestId, normalizedLockedError);
        } catch (markFailedError) {
          // Fail closed: a still-PROCESSING key prevents duplicate writes for reconciliation.
        }
        try {
          littlelandAppendRecord_('Logs', littlelandBuildRejectionLog_(normalizedLockedError, requestId, littlelandNowIso_()));
        } catch (rejectionLogError) {
          // Preserve the original API failure; the IdempotencyKeys row remains the fallback audit.
        }
      }
      throw normalizedLockedError;
    } finally {
      if (lock) {
        try { lock.releaseLock(); } catch (releaseError) { /* Apps Script releases on request exit. */ }
        lock = null;
      }
    }
  } catch (error) {
    var finalError = littlelandNormalizeError_(error, stage);
    return littlelandJsonOutput_(littlelandFailureResponse_(finalError, requestId));
  }
}

function littlelandExistingRequestResponse_(check, requestId) {
  if (check.disposition === 'REPLAY_SUCCESS' || check.disposition === 'REPLAY_FAILURE' || check.disposition === 'IN_PROGRESS') {
    return littlelandIdempotencyDispositionResponse_(check, requestId);
  }
  return null;
}

function littlelandBuildBookingRecord_(validated, pricing, bookingId, timestamp) {
  var form = validated.form;
  var terms = validated.terms;
  var consentedAt = timestamp;
  return {
    bookingId: bookingId,
    createdAt: timestamp,
    updatedAt: timestamp,
    recordVersion: 1,
    bookingStatus: 'PENDING_CONFIRMATION',
    checkinDate: form.checkin,
    checkinTime: form.checkinTime,
    earlyCheckin: form.earlyCheckin,
    checkoutDate: form.checkout,
    checkoutTime: form.checkoutTime,
    lateCheckout: form.lateCheckout,
    nights: pricing.nights,
    species: form.species,
    roomTypeId: form.roomId,
    quantity: form.quantity,
    allocatedRoomIdsJson: JSON.stringify([]),
    parentName: form.parentName,
    phone: form.phone,
    email: form.email,
    emergency1: form.emergency1,
    emergency2: form.emergency2,
    vet: form.vet,
    foodMain: form.foodMain,
    hay: form.hay,
    feeding: form.feeding,
    vegetables: form.vegetables,
    groomingOnce: form.groomingOnce,
    groomingDaily: form.groomingDaily,
    medicine: form.medicine,
    serviceItemsJson: JSON.stringify(pricing.serviceItems),
    roomPrice: pricing.roomPrice,
    priceVersion: LITTLELAND_PRICE_VERSION,
    policyVersion: LITTLELAND_POLICY_VERSION,
    roomRuleVersion: LITTLELAND_ROOM_RULE_VERSION,
    baseRoomFee: pricing.baseRoomFee,
    extraPetFee: pricing.extraPetFee,
    weekendFee: pricing.weekendFee,
    serviceFees: pricing.serviceFees,
    totalSurcharges: pricing.totalSurcharges,
    estimatedTotal: pricing.estimatedTotal,
    depositAmount: pricing.depositAmount,
    remainingBalance: pricing.remainingBalance,
    cashDepositAmount: pricing.cashDeposit,
    depositStatus: 'UNPAID',
    balanceStatus: 'UNPAID',
    cashDepositStatus: 'NOT_COLLECTED',
    cashDepositCollected: false,
    cashDepositCollectedAt: '',
    cashDepositUsedAmount: 0,
    cashDepositRefundedAmount: 0,
    cashDepositRefundedAt: '',
    cashDepositNote: '',
    consentCashDeposit: terms[0],
    consentDepositAndBalance: terms[1],
    consentDepositNonRefundable: terms[2],
    consentBoardingTerms: terms[3],
    consentHealthDeclaration: terms[4],
    consentEmergencyVet: terms[5],
    consentedAt: consentedAt,
    followUpRequired: false,
    lastContactedAt: '',
    lastContactedBy: '',
    followUpNote: ''
  };
}

function littlelandBuildPetRecords_(validated, bookingId, timestamp) {
  return validated.form.pets.map(function (pet) {
    var petId = bookingId + '-PET-' + ('0' + pet.petNumber).slice(-2);
    return {
      petId: petId,
      bookingId: bookingId,
      petNumber: pet.petNumber,
      name: pet.name,
      breed: pet.breed,
      ageValue: pet.ageValue,
      ageUnit: pet.ageUnit,
      ageInMonths: pet.ageInMonths,
      sex: pet.sex,
      sterilized: pet.sterilized,
      pregnant: pet.pregnant,
      recentSurgery30Days: pet.recentSurgery30Days,
      vetVisit: pet.vetVisit,
      vetDetails: pet.vetDetails,
      infectiousDisease: pet.infectiousDisease,
      infectiousDetails: pet.infectiousDetails,
      chronicDisease: pet.chronicDisease,
      chronicDetails: pet.chronicDetails,
      medication: pet.medication,
      medicationDetails: pet.medicationDetails,
      specialCare: pet.specialCare,
      fleaTreatment: pet.fleaTreatment,
      healthReviewStatus: pet.healthReviewStatus,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });
}

function littlelandBuildCreationLog_(validated, bookingId, requestId, timestamp) {
  return {
    logId: bookingId + '-LOG-01',
    createdAt: timestamp,
    actorType: 'SYSTEM',
    actorStaffId: '',
    action: 'CREATE_BOOKING',
    entityType: 'BOOKING',
    entityId: bookingId,
    requestId: requestId,
    summary: 'TEST booking created with status PENDING_CONFIRMATION.',
    changedFieldsJson: JSON.stringify({
      bookingStatus: 'PENDING_CONFIRMATION',
      petCount: validated.form.quantity,
      roomTypeId: validated.form.roomId
    })
  };
}

function littlelandBuildRejectionLog_(error, requestId, timestamp) {
  var errorCode = String(error && error.code ? error.code : 'INTERNAL_ERROR');
  return {
    logId: 'REJECT-' + requestId,
    createdAt: timestamp,
    actorType: 'SYSTEM',
    actorStaffId: '',
    action: 'REJECT_BOOKING',
    entityType: 'BOOKING_REQUEST',
    entityId: requestId,
    requestId: requestId,
    summary: 'TEST booking request rejected (' + errorCode + ').',
    changedFieldsJson: JSON.stringify({ errorCode: errorCode })
  };
}

function littlelandBookingSuccess_(bookingId, form, pricing, requestId) {
  return littlelandSuccessResponse_({
    bookingId: bookingId,
    bookingStatus: 'PENDING_CONFIRMATION',
    roomTypeId: form.roomId,
    price: {
      roomPrice: pricing.roomPrice,
      nights: pricing.nights,
      baseRoomFee: pricing.baseRoomFee,
      extraPetFee: pricing.extraPetFee,
      weekendFee: pricing.weekendFee,
      serviceItems: pricing.serviceItems,
      serviceFees: pricing.serviceFees,
      totalSurcharges: pricing.totalSurcharges,
      estimatedTotal: pricing.estimatedTotal,
      depositAmount: pricing.depositAmount,
      remainingBalance: pricing.remainingBalance,
      cashDeposit: pricing.cashDeposit
    }
  }, requestId, '已收到預約申請，尚待 LittleLand 確認。');
}

function littlelandCreateBookingId_(existingBookings) {
  var existingIds = {};
  existingBookings.forEach(function (booking) { existingIds[String(booking.bookingId || '')] = true; });
  for (var attempt = 0; attempt < 5; attempt += 1) {
    var datePart = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyyMMdd');
    var uuidPart = Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
    var bookingId = 'TEST-LL-' + datePart + '-' + uuidPart;
    if (!existingIds[bookingId]) return bookingId;
  }
  throw littlelandApiError_('SYSTEM_UNAVAILABLE', '無法產生唯一 TEST Booking ID。', true);
}

function littlelandClearAvailabilityCache_() {
  // Availability caching is intentionally disabled; there is nothing to invalidate.
}

function littlelandNewRequestId_() {
  try {
    return Utilities.getUuid();
  } catch (error) {
    return 'request-' + String(new Date().getTime());
  }
}

function littlelandSuccessResponse_(data, requestId, message) {
  return {
    success: true,
    code: 'OK',
    message: message || '操作成功',
    requestId: requestId,
    timestamp: littlelandNowIso_(),
    data: data || {}
  };
}

function littlelandFailureResponse_(error, requestId) {
  return {
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || '系統暫時無法處理，請稍後再試。',
    requestId: requestId,
    timestamp: littlelandNowIso_(),
    retryable: Boolean(error.retryable)
  };
}

function littlelandNormalizeError_(error, stage) {
  if (error && error.code) return error;
  var fallback = stage === 'business-write' || stage === 'idempotency-write' ? 'SHEET_WRITE_FAILED'
    : (stage === 'idempotency-read' || stage === 'inventory-read' ? 'SHEET_READ_FAILED'
      : (stage === 'lock' ? 'LOCK_TIMEOUT' : 'INTERNAL_ERROR'));
  var retryable = LITTLELAND_API_RETRYABLE_CODES.indexOf(fallback) !== -1;
  return littlelandApiError_(fallback, '系統暫時無法處理，請稍後再試。', retryable);
}

function littlelandJsonOutput_(response) {
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
