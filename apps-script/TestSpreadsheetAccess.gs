/**
 * Runtime access helpers for the dedicated LittleLand TEST spreadsheet.
 * This source never accepts a spreadsheet ID from an API request.
 */
var LITTLELAND_REQUEST_SPREADSHEET_CACHE_ = null;
var LITTLELAND_REQUEST_SPREADSHEET_CACHE_ID_ = '';

function littlelandResetTestSpreadsheetRequestCache_() {
  LITTLELAND_REQUEST_SPREADSHEET_CACHE_ = null;
  LITTLELAND_REQUEST_SPREADSHEET_CACHE_ID_ = '';
}

var LITTLELAND_API_WRITE_SHEETS = Object.freeze({
  Bookings: true,
  Pets: true,
  Payments: true,
  Logs: true,
  IdempotencyKeys: true,
  Staff: true,
  Sessions: true,
  StaffSchedules: true,
  BookingAdjustments: true
});

function littlelandApiError_(code, message, retryable) {
  var error = new Error(message || code || '系統暫時無法處理，請稍後再試。');
  error.name = 'LittleLandApiError';
  error.code = code || 'INTERNAL_ERROR';
  error.retryable = Boolean(retryable);
  return error;
}

function littlelandRequire_(condition, code, message, retryable) {
  if (!condition) throw littlelandApiError_(code, message, retryable);
}

function littlelandTestSpreadsheet_() {
  littlelandRequire_(
      typeof LITTLELAND_TEST_SHEET_DEFINITIONS !== 'undefined' &&
      Array.isArray(LITTLELAND_TEST_SHEET_DEFINITIONS) &&
      LITTLELAND_TEST_SHEET_DEFINITIONS.length === 10,
    'SYSTEM_UNAVAILABLE',
    'TEST schema 未載入。',
    false
  );

  var propertyName = LITTLELAND_TEST_SPREADSHEET_ID_PROPERTY || 'LITTLELAND_TEST_SPREADSHEET_ID';
  var allowedId = PropertiesService.getScriptProperties().getProperty(propertyName);
  littlelandRequire_(
    typeof allowedId === 'string' && allowedId.trim() !== '',
    'SYSTEM_UNAVAILABLE',
    'TEST spreadsheet allow-list 未設定。',
    false
  );

  if (
    LITTLELAND_REQUEST_SPREADSHEET_CACHE_ &&
    LITTLELAND_REQUEST_SPREADSHEET_CACHE_ID_ === allowedId
  ) return LITTLELAND_REQUEST_SPREADSHEET_CACHE_;

  var spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(allowedId);
  } catch (error) {
    throw littlelandApiError_('SYSTEM_UNAVAILABLE', '無法開啟已核准的 TEST spreadsheet。', true);
  }

  var expectedTitle = LITTLELAND_TEST_SPREADSHEET_NAME || 'LittleLand_TEST';
  littlelandRequire_(
    spreadsheet.getName() === expectedTitle,
    'SYSTEM_UNAVAILABLE',
    'TEST spreadsheet 名稱不符，已停止處理。',
    false
  );

  var expectedNames = LITTLELAND_TEST_SHEET_DEFINITIONS.map(function (definition) {
    return definition.name;
  }).sort();
  var actualNames = spreadsheet.getSheets().map(function (sheet) {
    return sheet.getName();
  }).sort();
  littlelandRequire_(
    actualNames.length === expectedNames.length &&
      actualNames.every(function (name, index) { return name === expectedNames[index]; }),
    'SHEET_READ_FAILED',
    'TEST spreadsheet 分頁結構不符，已停止處理。',
    false
  );

  LITTLELAND_TEST_SHEET_DEFINITIONS.forEach(function (definition) {
    var sheet = spreadsheet.getSheetByName(definition.name);
    littlelandRequire_(
      Boolean(sheet) && sheet.getLastRow() >= 1 &&
        sheet.getLastColumn() === definition.headers.length,
      'SHEET_READ_FAILED',
      'TEST spreadsheet 表頭結構不符，已停止處理。',
      false
    );
    var headers = sheet.getRange(1, 1, 1, definition.headers.length).getDisplayValues()[0];
    littlelandRequire_(
      littlelandArraysEqual_(headers, definition.headers),
      'SHEET_READ_FAILED',
      'TEST spreadsheet 表頭結構不符，已停止處理。',
      false
    );
  });

  LITTLELAND_REQUEST_SPREADSHEET_CACHE_ = spreadsheet;
  LITTLELAND_REQUEST_SPREADSHEET_CACHE_ID_ = allowedId;
  return spreadsheet;
}

function littlelandReadTable_(sheetName) {
  var definition = littlelandSheetDefinition_(sheetName);
  var spreadsheet = littlelandTestSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(1, 1, lastRow, definition.headers.length).getValues();
  var headers = values[0];
  var rows = [];

  for (var index = 1; index < values.length; index += 1) {
    var row = values[index];
    if (row.every(function (value) { return value === '' || value === null; })) continue;
    var record = {};
    headers.forEach(function (header, column) {
      record[header] = row[column];
    });
    rows.push({ rowNumber: index + 1, values: row.slice(), record: record });
  }

  return { sheet: sheet, headers: headers.slice(), rows: rows };
}

function littlelandAppendRecord_(sheetName, record) {
  littlelandRequire_(
    Boolean(LITTLELAND_API_WRITE_SHEETS[sheetName]),
    'SHEET_WRITE_FAILED',
    '此 API 不允許寫入指定的 TEST 分頁。',
    false
  );
  var table = littlelandReadTable_(sheetName);
  var rowValues = table.headers.map(function (header) {
    var value = record[header];
    return littlelandSafeSheetValue_(value === undefined || value === null ? '' : value);
  });
  var rowNumber = table.sheet.getLastRow() + 1;
  table.sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
  return rowNumber;
}

function littlelandUpdateRecordByKey_(sheetName, keyColumn, keyValue, updates) {
  littlelandRequire_(
    Boolean(LITTLELAND_API_WRITE_SHEETS[sheetName]),
    'SHEET_WRITE_FAILED',
    '此 API 不允許更新指定的 TEST 分頁。',
    false
  );
  var table = littlelandReadTable_(sheetName);
  var matches = table.rows.filter(function (row) {
    return String(row.record[keyColumn]) === String(keyValue);
  });
  littlelandRequire_(
    matches.length === 1,
    'SHEET_WRITE_FAILED',
    'TEST 記錄不存在或主鍵重複，已停止更新。',
    false
  );
  var target = matches[0];
  var merged = Object.assign({}, target.record, updates);
  var rowValues = table.headers.map(function (header) {
    var value = merged[header];
    return littlelandSafeSheetValue_(value === undefined || value === null ? '' : value);
  });
  table.sheet.getRange(target.rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
  return target.rowNumber;
}

function littlelandSheetDefinition_(sheetName) {
  var definitions = typeof LITTLELAND_TEST_SHEET_DEFINITIONS === 'undefined'
    ? []
    : LITTLELAND_TEST_SHEET_DEFINITIONS;
  var definition = definitions.filter(function (item) { return item.name === sheetName; })[0];
  littlelandRequire_(
    Boolean(definition),
    'SHEET_READ_FAILED',
    '要求的 TEST 分頁不存在於核准 schema。',
    false
  );
  return definition;
}

function littlelandArraysEqual_(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (var index = 0; index < left.length; index += 1) {
    if (String(left[index]) !== String(right[index])) return false;
  }
  return true;
}

function littlelandSafeSheetValue_(value) {
  if (typeof value !== 'string') return value;
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function littlelandNowIso_() {
  return new Date().toISOString();
}
