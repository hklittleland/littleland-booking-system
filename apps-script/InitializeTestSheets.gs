/**
 * LittleLand TEST Sheets initializer.
 *
 * Safety: the Script Property LITTLELAND_TEST_SPREADSHEET_ID must be set to the
 * exact ID of the dedicated LittleLand_TEST spreadsheet. The target ID and
 * spreadsheet name are both verified before any sheet is created or changed.
 * This file initializes schema only; it is not a booking, staff, payment, or
 * availability API. It never clears or deletes spreadsheet content.
 */
var LITTLELAND_TEST_SPREADSHEET_NAME = 'LittleLand_TEST';
var LITTLELAND_TEST_SPREADSHEET_ID_PROPERTY = 'LITTLELAND_TEST_SPREADSHEET_ID';

var LITTLELAND_TEST_SHEET_DEFINITIONS = [
  {
    name: 'Bookings',
    headers: [
      'bookingId', 'createdAt', 'updatedAt', 'recordVersion', 'bookingStatus',
      'checkinDate', 'checkinTime', 'earlyCheckin', 'checkoutDate', 'checkoutTime',
      'lateCheckout', 'nights', 'species', 'roomTypeId', 'quantity',
      'allocatedRoomIdsJson', 'parentName', 'phone', 'email', 'emergency1',
      'emergency2', 'vet', 'foodMain', 'hay', 'feeding', 'vegetables',
      'groomingOnce', 'groomingDaily', 'medicine', 'serviceItemsJson',
      'roomPrice', 'priceVersion', 'policyVersion', 'roomRuleVersion',
      'baseRoomFee', 'extraPetFee', 'weekendFee', 'serviceFees',
      'totalSurcharges', 'estimatedTotal', 'depositAmount', 'remainingBalance',
      'cashDepositAmount', 'depositStatus', 'balanceStatus', 'cashDepositStatus',
      'cashDepositCollected', 'cashDepositCollectedAt', 'cashDepositUsedAmount',
      'cashDepositRefundedAmount', 'cashDepositRefundedAt', 'cashDepositNote',
      'consentCashDeposit', 'consentDepositAndBalance',
      'consentDepositNonRefundable', 'consentBoardingTerms',
      'consentHealthDeclaration', 'consentEmergencyVet', 'consentedAt',
      'followUpRequired', 'lastContactedAt', 'lastContactedBy', 'followUpNote',
      'cashDepositCollectedAmount'
    ]
  },
  {
    name: 'Pets',
    headers: [
      'petId', 'bookingId', 'petNumber', 'name', 'breed', 'ageValue', 'ageUnit',
      'ageInMonths', 'sex', 'sterilized', 'pregnant', 'recentSurgery30Days',
      'vetVisit', 'vetDetails', 'infectiousDisease', 'infectiousDetails',
      'chronicDisease', 'chronicDetails', 'medication', 'medicationDetails',
      'specialCare', 'fleaTreatment', 'healthReviewStatus', 'createdAt', 'updatedAt',
      'petStatus', 'removedAt', 'removedByStaffId', 'removeReason'
    ]
  },
  {
    name: 'Payments',
    headers: [
      'paymentId', 'bookingId', 'paymentType', 'amount', 'currency', 'paymentStatus',
      'paymentMethod', 'transactionReference', 'paidAt', 'recordedByStaffId',
      'refundAmount', 'refundedAt', 'note', 'createdAt', 'sourcePaymentId'
    ]
  },
  {
    name: 'Rooms',
    headers: [
      'roomId', 'roomTypeId', 'displayName', 'roomKind', 'compositionOptionsJson',
      'allocationPriority', 'isActive'
    ]
  },
  {
    name: 'Logs',
    headers: [
      'logId', 'createdAt', 'actorType', 'actorStaffId', 'action', 'entityType',
      'entityId', 'requestId', 'summary', 'changedFieldsJson', 'actorStaffNameSnapshot'
    ]
  },
  {
    name: 'IdempotencyKeys',
    headers: [
      'idempotencyKey', 'operation', 'payloadHash', 'state', 'bookingId', 'requestId',
      'responseCode', 'responseSnapshotJson', 'createdAt', 'updatedAt'
    ]
  },
  {
    name: 'Staff',
    headers: [
      'staffId', 'username', 'displayName', 'role', 'passwordHash', 'passwordSalt',
      'isActive', 'createdAt', 'updatedAt', 'lastLoginAt'
    ]
  },
  {
    name: 'Sessions',
    headers: [
      'sessionId', 'staffId', 'tokenHash', 'roleSnapshot', 'createdAt', 'expiresAt',
      'revokedAt', 'lastSeenAt'
    ]
  },
  {
    name: 'StaffSchedules',
    headers: [
      'scheduleId', 'workDate', 'staffId', 'staffNameSnapshot', 'status',
      'startTime', 'endTime', 'swapGroupId', 'swappedFromStaffId', 'notes',
      'createdAt', 'updatedAt', 'createdByStaffId', 'updatedByStaffId', 'idempotencyKey'
    ]
  },
  {
    name: 'BookingAdjustments',
    headers: [
      'adjustmentId', 'bookingId', 'type', 'description', 'amount', 'currency',
      'status', 'sourcePaymentId', 'paymentId', 'reason', 'effectiveDate',
      'reversesAdjustmentId', 'createdAt', 'updatedAt', 'createdByStaffId',
      'updatedByStaffId', 'idempotencyKey', 'petId', 'petNameSnapshot', 'groupId'
    ]
  }
];

// Existing TEST headers may be upgraded only by appending these known columns.
var LITTLELAND_TEST_ADDITIVE_COLUMNS = Object.freeze({
  Bookings: Object.freeze(['cashDepositCollectedAmount']),
  Pets: Object.freeze(['petStatus', 'removedAt', 'removedByStaffId', 'removeReason']),
  Payments: Object.freeze(['sourcePaymentId']),
  Logs: Object.freeze(['actorStaffNameSnapshot']),
  BookingAdjustments: Object.freeze(['petId', 'petNameSnapshot', 'groupId'])
});

// Only static room master data is seeded. SS1 and SSR1 are virtual combinations.
var LITTLELAND_TEST_ROOM_SEED = [
  ['S1', 'PRIVATE_SUITE', '獨立套房空間', 'PHYSICAL', '[]', 1, true],
  ['S2', 'PRIVATE_SUITE', '獨立套房空間', 'PHYSICAL', '[]', 2, true],
  ['S3', 'PRIVATE_SUITE', '獨立套房空間', 'PHYSICAL', '[]', 3, true],
  ['A1', 'DELUXE_ROOM', '豪華房', 'PHYSICAL', '[]', 1, true],
  ['A2', 'DELUXE_ROOM', '豪華房', 'PHYSICAL', '[]', 2, true],
  ['A3', 'DELUXE_ROOM', '豪華房', 'PHYSICAL', '[]', 3, true],
  ['B1', 'STANDARD_ROOM', '標準房', 'PHYSICAL', '[]', 1, true],
  ['B2', 'STANDARD_ROOM', '標準房', 'PHYSICAL', '[]', 2, true],
  ['C1', 'HAMSTER_BOX', '整理箱', 'PHYSICAL', '[]', 1, true],
  ['F1', 'OWN_CAGE', '自備籠', 'PHYSICAL', '[]', 1, true],
  ['SS1', 'DELUXE_SUITE', '豪華套房', 'VIRTUAL', '[["S1","S2"],["S2","S3"]]', 1, true],
  ['SSR1', 'VERY_DELUXE_SUITE', '非常.豪華套房', 'VIRTUAL', '[["S1","S2","S3"]]', 1, true]
];

/**
 * Creates missing schema tabs/headers and idempotently seeds the fixed Rooms
 * master. Set Script Property LITTLELAND_TEST_SPREADSHEET_ID first. The
 * argument is optional for manual Apps Script execution; if supplied it must
 * equal the allow-listed TEST spreadsheet ID.
 *
 * @param {string=} spreadsheetId Optional, allow-listed TEST spreadsheet ID.
 * @return {{spreadsheetId:string,spreadsheetName:string,sheetsCreated:string[],headersCreated:string[],columnsAdded:string[],roomIdsAdded:string[],roomIdsAlreadyPresent:string[]}}
 */
function initializeLittleLandTestSheets(spreadsheetId) {
  var scriptProperties = PropertiesService.getScriptProperties();
  var allowedSpreadsheetId = scriptProperties.getProperty(
    LITTLELAND_TEST_SPREADSHEET_ID_PROPERTY
  );

  if (!allowedSpreadsheetId) {
    throw new Error(
      'Safety stop: set Script Property ' +
      LITTLELAND_TEST_SPREADSHEET_ID_PROPERTY +
      ' to the dedicated TEST spreadsheet ID before running the initializer.'
    );
  }

  var targetSpreadsheetId = spreadsheetId || allowedSpreadsheetId;
  if (targetSpreadsheetId !== allowedSpreadsheetId) {
    throw new Error('Safety stop: target ID does not match the allow-listed TEST spreadsheet ID.');
  }

  var spreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
  if (spreadsheet.getName() !== LITTLELAND_TEST_SPREADSHEET_NAME) {
    throw new Error('Safety stop: spreadsheet name must be exactly LittleLand_TEST.');
  }

  var definitions = LITTLELAND_TEST_SHEET_DEFINITIONS;
  var expectedNames = {};
  definitions.forEach(function (definition) {
    expectedNames[definition.name] = true;
  });

  var unexpectedSheetNames = spreadsheet.getSheets()
    .map(function (sheet) { return sheet.getName(); })
    .filter(function (name) { return !expectedNames[name]; });
  if (unexpectedSheetNames.length) {
    throw new Error(
      'Safety stop: unexpected tabs found; nothing was deleted: ' +
      unexpectedSheetNames.join(', ')
    );
  }

  var existingSheets = {};
  var plannedColumnMigrations = [];
  definitions.forEach(function (definition) {
    var sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) return;

    existingSheets[definition.name] = sheet;
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (lastRow === 0 && lastColumn === 0) return;

    var existingHeaders = sheet.getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];
    if (!littlelandTestArraysEqual_(existingHeaders, definition.headers)) {
      var allowedAppend = LITTLELAND_TEST_ADDITIVE_COLUMNS[definition.name] || [];
      var isKnownPrefix = existingHeaders.length < definition.headers.length &&
        existingHeaders.every(function (header, index) {
          return String(header) === String(definition.headers[index]);
        });
      var missingHeaders = definition.headers.slice(existingHeaders.length);
      var onlyKnownAdditions = missingHeaders.length > 0 && missingHeaders.every(function (header) {
        return allowedAppend.indexOf(header) >= 0;
      });
      if (!isKnownPrefix || !onlyKnownAdditions) {
        throw new Error(
          'Safety stop: header mismatch in ' + definition.name +
          '; nothing was cleared or overwritten.'
        );
      }
      plannedColumnMigrations.push({
        sheet: sheet,
        startColumn: existingHeaders.length + 1,
        headers: missingHeaders
      });
    }
  });

  // Preflight all existing Rooms rows before creating tabs or writing anything.
  var roomsDefinition = definitions.filter(function (definition) {
    return definition.name === 'Rooms';
  })[0];
  var roomsSheet = existingSheets.Rooms || null;
  var existingRoomIds = {};
  if (roomsSheet && roomsSheet.getLastRow() > 1) {
    var existingRows = roomsSheet.getRange(
      2, 1, roomsSheet.getLastRow() - 1, roomsDefinition.headers.length
    ).getValues();
    existingRows.forEach(function (row) {
      if (row.every(function (value) { return value === '' || value === null; })) return;

      var roomId = String(row[0] || '').trim();
      if (!roomId) throw new Error('Safety stop: a Rooms row has no roomId.');
      if (existingRoomIds[roomId]) {
        throw new Error('Safety stop: duplicate roomId in Rooms: ' + roomId);
      }

      var seedRow = LITTLELAND_TEST_ROOM_SEED.filter(function (candidate) {
        return candidate[0] === roomId;
      })[0];
      if (!seedRow) {
        throw new Error('Safety stop: unrecognized Rooms row; preserved without changes: ' + roomId);
      }
      if (!littlelandTestArraysEqual_(row, seedRow)) {
        throw new Error('Safety stop: Rooms seed differs from V3.0 for ' + roomId + '; no overwrite performed.');
      }
      existingRoomIds[roomId] = true;
    });
  }

  var columnsAdded = [];
  plannedColumnMigrations.forEach(function (migration) {
    migration.sheet.getRange(1, migration.startColumn, 1, migration.headers.length)
      .setValues([migration.headers]);
    migration.headers.forEach(function (header) { columnsAdded.push(header); });
  });

  var sheetsCreated = [];
  var headersCreated = [];
  definitions.forEach(function (definition) {
    var sheet = existingSheets[definition.name];
    if (!sheet) {
      sheet = spreadsheet.insertSheet(definition.name);
      existingSheets[definition.name] = sheet;
      sheetsCreated.push(definition.name);
    }

    if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
      sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
      headersCreated.push(definition.name);
    }
    sheet.setFrozenRows(1);
  });

  roomsSheet = existingSheets.Rooms;
  var roomIdsAdded = [];
  var roomIdsAlreadyPresent = [];
  var rowsToAdd = [];
  LITTLELAND_TEST_ROOM_SEED.forEach(function (seedRow) {
    var roomId = seedRow[0];
    if (existingRoomIds[roomId]) {
      roomIdsAlreadyPresent.push(roomId);
    } else {
      rowsToAdd.push(seedRow);
      roomIdsAdded.push(roomId);
    }
  });

  if (rowsToAdd.length) {
    roomsSheet.getRange(
      roomsSheet.getLastRow() + 1,
      1,
      rowsToAdd.length,
      roomsDefinition.headers.length
    ).setValues(rowsToAdd);
  }

  return {
    spreadsheetId: targetSpreadsheetId,
    spreadsheetName: spreadsheet.getName(),
    sheetsCreated: sheetsCreated,
    headersCreated: headersCreated,
    columnsAdded: columnsAdded,
    roomIdsAdded: roomIdsAdded,
    roomIdsAlreadyPresent: roomIdsAlreadyPresent
  };
}

function littlelandTestArraysEqual_(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  for (var index = 0; index < left.length; index += 1) {
    if (String(left[index]) !== String(right[index])) return false;
  }
  return true;
}
