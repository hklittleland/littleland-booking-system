/**
 * Server-side validation for the current LittleLand booking form contract.
 * The API accepts {idempotencyKey, form, terms, clientQuote}; it never trusts prices.
 */
var LITTLELAND_PRICE_VERSION = '6f002fd9ea921c313ecf90502091f1de051f332c';
var LITTLELAND_POLICY_VERSION = 'V3.0';
var LITTLELAND_ROOM_RULE_VERSION = 'V3.0';
var LITTLELAND_MINIMUM_AGE_MONTHS = Object.freeze({ rabbit: 3, guineaPig: 3, hamster: 2 });
var LITTLELAND_CHECKIN_TIMES = Object.freeze(['14:30–15:30', '15:30–16:30', '16:30–17:00']);
var LITTLELAND_CHECKOUT_TIMES = Object.freeze(['14:30–15:30', '15:30–16:30', '16:30–17:00']);
var LITTLELAND_FORM_KEYS = Object.freeze([
  'checkin', 'checkout', 'checkinTime', 'checkoutTime', 'species', 'roomId', 'quantity', 'pets',
  'parentName', 'phone', 'email', 'emergency1', 'emergency2', 'vet',
  'foodMain', 'hay', 'feeding', 'vegetables', 'groomingOnce', 'groomingDaily', 'medicine',
  'earlyCheckin', 'lateCheckout'
]);
var LITTLELAND_PET_KEYS = Object.freeze([
  'name', 'breed', 'ageValue', 'ageUnit', 'sex', 'sterilized', 'pregnant', 'recentSurgery',
  'vetVisit', 'vetDetails', 'infectiousDisease', 'infectiousDetails', 'chronicDisease',
  'chronicDetails', 'medication', 'medicationDetails', 'specialCare', 'fleaTreatment'
]);
var LITTLELAND_CLIENT_QUOTE_KEYS = Object.freeze([
  'priceVersion', 'roomPrice', 'nights', 'baseRoomFee', 'extraPetFee', 'weekendFee',
  'serviceFees', 'totalSurcharges', 'estimatedTotal', 'depositAmount', 'remainingBalance', 'cashDeposit'
]);

function littlelandValidateBookingRequest_(request) {
  littlelandRequire_(littlelandIsObject_(request), 'VALIDATION_FAILED', '請求資料格式不正確。', false);
  littlelandRequire_(
    littlelandExactKeys_(request, ['idempotencyKey', 'form', 'terms', 'clientQuote']),
    'VALIDATION_FAILED',
    '請求欄位不符合預約格式。',
    false
  );
  littlelandRequire_(
    littlelandIsObject_(request.clientQuote) && littlelandKeysAllowed_(request.clientQuote, LITTLELAND_CLIENT_QUOTE_KEYS),
    'PRICE_CLIENT_MISMATCH',
    '費用預覽欄位不符合 API 格式。',
    false
  );

  var key = typeof request.idempotencyKey === 'string' ? request.idempotencyKey.trim() : '';
  littlelandRequire_(key.length > 0 && key.length <= 200, 'VALIDATION_FAILED', '缺少有效的防重複提交 key。', false);
  var form = request.form;
  littlelandRequire_(littlelandIsObject_(form), 'VALIDATION_FAILED', '預約表格資料格式不正確。', false);
  littlelandRequire_(littlelandKeysAllowed_(form, LITTLELAND_FORM_KEYS), 'VALIDATION_FAILED', '預約表格含不支援欄位。', false);

  var species = form.species;
  littlelandRequire_(
    species === 'rabbit' || species === 'guineaPig' || species === 'hamster',
    'VALIDATION_FAILED',
    '請選擇有效的寵物種類。',
    false
  );

  var roomId = littlelandTrimString_(form.roomId);
  var quantity = littlelandParseInteger_(form.quantity);
  littlelandRequire_(quantity !== null && quantity >= 1, 'PET_QTY_INVALID', '寵物數量必須是大於或等於 1 的整數。', false);
  var speciesRooms = LittleLandPricing.ROOM_CATALOG[species];
  var roomDefinition = speciesRooms && speciesRooms[roomId];
  littlelandRequire_(Boolean(roomDefinition), 'ROOM_INVALID_ALLOCATION', '指定物種與房型組合無效。', false);
  littlelandRequire_(quantity <= roomDefinition.maxPets, 'PET_QTY_EXCEEDS_LIMIT', '寵物數量超過此房型入住上限。', false);

  littlelandValidateDateRange_(form.checkin, form.checkout, new Date());
  littlelandRequire_(
    LITTLELAND_CHECKIN_TIMES.indexOf(form.checkinTime) !== -1 &&
      LITTLELAND_CHECKOUT_TIMES.indexOf(form.checkoutTime) !== -1,
    'VALIDATION_FAILED',
    '請選擇有效的入住及退房時段。',
    false
  );

  var normalizedForm = littlelandNormalizeForm_(form, species, roomId, quantity);
  var terms = request.terms;
  littlelandRequire_(
    Array.isArray(terms) && terms.length === 6 && terms.every(function (value) { return value === true; }),
    'VALIDATION_FAILED',
    '提交前必須勾選全部六項同意事項。',
    false
  );

  var pricingInput = littlelandPricingInput_(normalizedForm);

  var hasHealthReview = normalizedForm.pets.some(littlelandPetNeedsHealthReview_);
  return {
    idempotencyKey: key,
    operation: 'CREATE_BOOKING',
    form: normalizedForm,
    terms: terms.slice(),
    pricingInput: pricingInput,
    clientQuote: request.clientQuote,
    healthReviewRequired: hasHealthReview
  };
}

function littlelandNormalizeForm_(form, species, roomId, quantity) {
  var normalized = {};
  LITTLELAND_FORM_KEYS.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(form, key)) normalized[key] = form[key];
  });
  normalized.species = species;
  normalized.roomId = roomId;
  normalized.quantity = quantity;
  normalized.checkin = littlelandTrimString_(form.checkin);
  normalized.checkout = littlelandTrimString_(form.checkout);
  normalized.checkinTime = form.checkinTime;
  normalized.checkoutTime = form.checkoutTime;

  littlelandValidateContact_(form);
  normalized.parentName = littlelandTrimString_(form.parentName);
  normalized.phone = littlelandTrimString_(form.phone);
  normalized.email = littlelandTrimString_(form.email);
  normalized.emergency1 = littlelandTrimString_(form.emergency1);
  normalized.emergency2 = littlelandTrimString_(form.emergency2);
  normalized.vet = littlelandTrimString_(form.vet);

  ['groomingOnce', 'groomingDaily', 'earlyCheckin', 'lateCheckout'].forEach(function (key) {
    littlelandRequire_(typeof form[key] === 'boolean', 'VALIDATION_FAILED', '額外服務資料格式不正確。', false);
    normalized[key] = form[key];
  });
  littlelandRequire_(
    ['none', 'once', 'twice'].indexOf(form.medicine) !== -1,
    'PRICE_DUPLICATE_SERVICE',
    '餵藥服務選項不正確。',
    false
  );
  normalized.medicine = form.medicine;

  littlelandValidateFood_(form, species);
  normalized.foodMain = littlelandTrimString_(form.foodMain);
  normalized.hay = species === 'hamster' ? '' : littlelandTrimString_(form.hay);
  normalized.feeding = species === 'hamster' ? '' : littlelandTrimString_(form.feeding);
  normalized.vegetables = species === 'hamster' ? '' : littlelandTrimString_(form.vegetables);

  littlelandRequire_(
    Array.isArray(form.pets) && form.pets.length === quantity,
    'VALIDATION_FAILED',
    '寵物資料數量必須與預約數量一致。',
    false
  );
  normalized.pets = form.pets.map(function (pet, index) {
    return littlelandNormalizePet_(pet, species, index + 1);
  });
  return normalized;
}

function littlelandNormalizePet_(pet, species, petNumber) {
  littlelandRequire_(littlelandIsObject_(pet), 'VALIDATION_FAILED', '寵物資料格式不正確。', false);
  littlelandRequire_(littlelandKeysAllowed_(pet, LITTLELAND_PET_KEYS), 'VALIDATION_FAILED', '寵物資料含不支援欄位。', false);
  var name = littlelandTrimString_(pet.name);
  var breed = littlelandTrimString_(pet.breed);
  var sex = littlelandTrimString_(pet.sex);
  var ageValue = littlelandParsePositiveNumber_(pet.ageValue);
  var ageUnit = pet.ageUnit;
  littlelandRequire_(name !== '' && breed !== '' && ageValue !== null, 'VALIDATION_FAILED', '請填寫寵物名稱、品種及有效年齡。', false);
  littlelandRequire_(sex === 'male' || sex === 'female', 'VALIDATION_FAILED', '請選擇寵物性別。', false);
  littlelandRequire_(ageUnit === 'month' || ageUnit === 'year', 'VALIDATION_FAILED', '年齡單位只可選月或歲。', false);

  var ageInMonths = ageValue * (ageUnit === 'year' ? 12 : 1);
  if (ageInMonths < LITTLELAND_MINIMUM_AGE_MONTHS[species]) {
    throw littlelandApiError_('PET_AGE_BELOW_MINIMUM', '寵物未達此物種的最低入住年齡。', false);
  }

  var normalized = {
    petNumber: petNumber,
    name: name,
    breed: breed,
    ageValue: ageValue,
    ageUnit: ageUnit,
    ageInMonths: ageInMonths,
    sex: sex,
    sterilized: '',
    pregnant: '',
    recentSurgery30Days: false,
    vetVisit: '',
    vetDetails: '',
    infectiousDisease: '',
    infectiousDetails: '',
    chronicDisease: '',
    chronicDetails: '',
    medication: '',
    medicationDetails: '',
    specialCare: littlelandTrimString_(pet.specialCare),
    fleaTreatment: '',
    healthReviewStatus: ''
  };

  if (species !== 'hamster') {
    normalized.sterilized = littlelandRequireYesNo_(pet.sterilized, '請填寫寵物的絕育情況。');
    if (sex === 'female') {
      normalized.pregnant = littlelandRequireYesNo_(pet.pregnant, '請回答是否懷孕。');
      if (normalized.pregnant === 'yes') {
        throw littlelandApiError_('PET_PREGNANT_NOT_ACCEPTED', '懷孕中的毛孩不可接受一般入住。', false);
      }
    } else {
      littlelandRequire_(
        pet.pregnant === '' || pet.pregnant === undefined || pet.pregnant === null,
        'VALIDATION_FAILED',
        '男孩子不接受懷孕欄位。',
        false
      );
    }
    normalized.fleaTreatment = littlelandRequireYesNo_(pet.fleaTreatment, '請回答一個月內杜蝨處理情況。');
  } else {
    littlelandRequire_(
      [pet.sterilized, pet.pregnant, pet.fleaTreatment].every(function (value) {
        return value === '' || value === undefined || value === null;
      }),
      'VALIDATION_FAILED',
      '倉鼠不使用絕育、懷孕或杜蝨欄位。',
      false
    );
  }

  var surgeryAnswer = littlelandRequireYesNo_(pet.recentSurgery, '請回答最近 30 日是否接受過手術。');
  if (surgeryAnswer === 'yes') {
    throw littlelandApiError_('PET_RECENT_SURGERY_NOT_ACCEPTED', '最近 30 日內接受手術的毛孩不可接受一般入住。', false);
  }
  normalized.recentSurgery30Days = surgeryAnswer === 'yes';

  var healthPairs = [
    ['vetVisit', 'vetDetails', '最近看獸醫'],
    ['infectiousDisease', 'infectiousDetails', '傳染病'],
    ['chronicDisease', 'chronicDetails', '慢性疾病'],
    ['medication', 'medicationDetails', '正在服用藥物']
  ];
  healthPairs.forEach(function (pair) {
    var answer = littlelandRequireYesNo_(pet[pair[0]], '請回答' + pair[2] + '情況。');
    var details = littlelandTrimString_(pet[pair[1]]);
    if (answer === 'yes' && details === '') {
      throw littlelandApiError_('VALIDATION_FAILED', '請補充' + pair[2] + '詳情。', false);
    }
    normalized[pair[0]] = answer;
    normalized[pair[1]] = details;
  });
  if (littlelandPetNeedsHealthReview_(normalized)) normalized.healthReviewStatus = 'HEALTH_REVIEW_REQUIRED';
  return normalized;
}

function littlelandValidateContact_(form) {
  littlelandRequire_(littlelandTrimString_(form.parentName) !== '', 'VALIDATION_FAILED', '請填寫家長姓名。', false);
  littlelandRequire_(/^\d{8}$/.test(littlelandTrimString_(form.phone)), 'VALIDATION_FAILED', '請輸入有效的香港 8 位電話號碼。', false);
  littlelandRequire_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(littlelandTrimString_(form.email)), 'VALIDATION_FAILED', '請輸入有效的 Email 地址。', false);
  littlelandRequire_(littlelandTrimString_(form.emergency1) !== '', 'VALIDATION_FAILED', '請填寫第 1 位緊急聯絡人。', false);
  littlelandRequire_(littlelandTrimString_(form.emergency2) !== '', 'VALIDATION_FAILED', '請填寫第 2 位緊急聯絡人。', false);
}

function littlelandValidateFood_(form, species) {
  var mainOptions = {
    rabbit: ['', 'Oxbow 成兔糧', 'Momi T（成兔）', 'Momi A（幼兔）', '自行攜帶'],
    guineaPig: ['', 'Oxbow 天竺鼠糧', 'Momi 天竺鼠糧', '自行攜帶'],
    hamster: ['', 'BUNNY 倉鼠糧', '自行攜帶']
  };
  littlelandRequire_(mainOptions[species].indexOf(littlelandTrimString_(form.foodMain)) !== -1, 'VALIDATION_FAILED', '主糧選項不正確。', false);
  if (species === 'hamster') {
    littlelandRequire_(
      [form.hay, form.feeding, form.vegetables].every(function (value) { return !value; }),
      'VALIDATION_FAILED',
      '倉鼠不使用牧草、餵食頻率或蔬菜欄位。',
      false
    );
    return;
  }
  var optionalHay = ['', 'Joy & Fibre 1st cut', 'Momi 1st cut', 'Chewbo 1st cut', '自行攜帶'];
  var optionalFeeding = ['', '每日一次', '每日兩次／早晚各一次'];
  var optionalVegetables = ['', '是', '否'];
  littlelandRequire_(optionalHay.indexOf(littlelandTrimString_(form.hay)) !== -1, 'VALIDATION_FAILED', '牧草選項不正確。', false);
  littlelandRequire_(optionalFeeding.indexOf(littlelandTrimString_(form.feeding)) !== -1, 'VALIDATION_FAILED', '餵食頻率選項不正確。', false);
  littlelandRequire_(optionalVegetables.indexOf(littlelandTrimString_(form.vegetables)) !== -1, 'VALIDATION_FAILED', '新鮮蔬菜選項不正確。', false);
}

function littlelandValidateDateRange_(checkin, checkout, now) {
  littlelandRequire_(littlelandIsIsoDate_(checkin) && littlelandIsIsoDate_(checkout), 'DATE_INVALID_FORMAT', '日期必須使用有效的 YYYY-MM-DD 格式。', false);
  littlelandRequire_(checkout > checkin, 'DATE_CHECKOUT_NOT_AFTER_CHECKIN', '退房日期必須晚於入住日期，最少入住一晚。', false);
  var today = littlelandHongKongDate_(now || new Date());
  littlelandRequire_(checkin >= today, 'DATE_CHECKIN_IN_PAST', '入住日期不可早於香港今日日期。', false);
}

function littlelandIsIsoDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split('-').map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function littlelandHongKongDate_(date) {
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    return Utilities.formatDate(date, 'Asia/Hong_Kong', 'yyyy-MM-dd');
  }
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  var values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}

function littlelandPricingInput_(form) {
  var services = [];
  if (form.groomingOnce) services.push('GROOMING_ONCE');
  if (form.groomingDaily) services.push('GROOMING_DAILY');
  if (form.medicine === 'once') services.push('MEDICINE_ONCE');
  if (form.medicine === 'twice') services.push('MEDICINE_TWICE');
  if (form.earlyCheckin) services.push('EARLY_CHECKIN');
  if (form.lateCheckout) services.push('LATE_CHECKOUT');
  return {
    species: form.species,
    roomId: form.roomId,
    checkin: form.checkin,
    checkout: form.checkout,
    quantity: form.quantity,
    services: services
  };
}

function littlelandAssertClientQuote_(quote, pricing) {
  littlelandRequire_(littlelandIsObject_(quote), 'PRICE_CLIENT_MISMATCH', '缺少前端費用預覽快照。', false);
  if (quote.priceVersion !== LITTLELAND_PRICE_VERSION) {
    throw littlelandApiError_('PRICE_VERSION_EXPIRED', '費用預覽版本已更新，請重新計算費用。', false);
  }
  var expected = {
    roomPrice: pricing.roomPrice,
    nights: pricing.nights,
    baseRoomFee: pricing.baseRoomFee,
    extraPetFee: pricing.extraPetFee,
    weekendFee: pricing.weekendFee,
    serviceFees: pricing.serviceFees,
    totalSurcharges: pricing.totalSurcharges,
    estimatedTotal: pricing.estimatedTotal,
    depositAmount: pricing.depositAmount,
    remainingBalance: pricing.remainingBalance,
    cashDeposit: pricing.cashDeposit
  };
  Object.keys(expected).forEach(function (key) {
    var actual = Number(quote[key]);
    littlelandRequire_(
      quote[key] !== undefined && Number.isFinite(actual) && Math.abs(actual - expected[key]) < 0.000001,
      'PRICE_CLIENT_MISMATCH',
      '費用預覽與後端重新計算結果不一致，請重新計算。',
      false
    );
  });
}

function littlelandMapPricingError_(error) {
  var code = error && error.code ? error.code : 'PRICE_CALCULATION_FAILED';
  if (code === 'DATE_INVALID_FORMAT' || code === 'DATE_CHECKOUT_NOT_AFTER_CHECKIN' ||
      code === 'PET_QTY_INVALID' || code === 'PET_QTY_EXCEEDS_LIMIT' ||
      code === 'ROOM_INVALID_ALLOCATION' || code === 'PRICE_DUPLICATE_SERVICE' ||
      code === 'PRICE_CALCULATION_FAILED') {
    return littlelandApiError_(code, error.message, false);
  }
  return littlelandApiError_('PRICE_CALCULATION_FAILED', '後端重新計算費用時發生錯誤。', false);
}

function littlelandPetNeedsHealthReview_(pet) {
  return ['vetVisit', 'infectiousDisease', 'chronicDisease', 'medication'].some(function (key) {
    return pet && pet[key] === 'yes';
  });
}

function littlelandRequireYesNo_(value, message) {
  littlelandRequire_(value === 'yes' || value === 'no', 'VALIDATION_FAILED', message, false);
  return value;
}

function littlelandParseInteger_(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  var parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function littlelandParsePositiveNumber_(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  var parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function littlelandTrimString_(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function littlelandIsObject_(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function littlelandKeysAllowed_(object, allowedKeys) {
  return Object.keys(object).every(function (key) { return allowedKeys.indexOf(key) !== -1; });
}

function littlelandExactKeys_(object, expectedKeys) {
  return Object.keys(object).length === expectedKeys.length && littlelandKeysAllowed_(object, expectedKeys);
}
