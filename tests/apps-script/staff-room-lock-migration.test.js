'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MIGRATION_FILE = path.resolve(__dirname, '../../apps-script/MigrateStaffRoomLocksOnly.gs');
const EXPECTED_HEADERS = [
  'roomLockId', 'roomId', 'startDate', 'endDate', 'reason', 'status',
  'createdAt', 'createdByStaffId', 'createdByStaffNameSnapshot',
  'releasedAt', 'releasedByStaffId', 'releasedByStaffNameSnapshot',
  'releaseReason', 'recordVersion', 'idempotencyKey'
];

function makeSheet(name, rows) {
  const values = rows.map((row) => row.slice());
  let frozenRows = 0;
  let writeCount = 0;
  return {
    getName: () => name,
    getRange(row, column, rowCount, columnCount) {
      return {
        setValues(nextRows) {
          writeCount += 1;
          nextRows.forEach((nextRow, rowOffset) => {
            const targetIndex = row - 1 + rowOffset;
            while (values.length <= targetIndex) values.push([]);
            nextRow.forEach((value, columnOffset) => {
              values[targetIndex][column - 1 + columnOffset] = value;
            });
          });
          return this;
        }
      };
    },
    setFrozenRows: (count) => { frozenRows = count; },
    rows: () => values.map((row) => row.slice()),
    frozenRows: () => frozenRows,
    writeCount: () => writeCount
  };
}

function setup({ spreadsheetName = 'LittleLand_TEST', existingLocks = false, missingProperty = false } = {}) {
  const untouched = [
    makeSheet('Bookings', [['bookingId'], ['KEEP-BOOKING']]),
    makeSheet('Pets', [['petId'], ['KEEP-PET']]),
    makeSheet('Payments', [['paymentId'], ['KEEP-PAYMENT']]),
    makeSheet('Rooms', [['roomId'], ['KEEP-ROOM']]),
    makeSheet('Logs', [['logId'], ['KEEP-LOG']]),
    makeSheet('IdempotencyKeys', [['idempotencyKey'], ['KEEP-IDEMPOTENCY']]),
    makeSheet('Staff', [['staffId'], ['KEEP-STAFF']]),
    makeSheet('Sessions', [['sessionId'], ['KEEP-SESSION']]),
    makeSheet('OtherExistingTab', [['keep'], ['KEEP-OTHER']])
  ];
  const initialSnapshots = new Map(untouched.map((sheet) => [sheet.getName(), sheet.rows()]));
  const locks = existingLocks ? makeSheet('StaffRoomLocks', [['oldHeader'], ['KEEP-LOCK-ROW']]) : null;
  const allSheets = locks ? untouched.concat(locks) : untouched.slice();
  let insertCalls = 0;
  const spreadsheet = {
    getName: () => spreadsheetName,
    getSheetByName(name) { return allSheets.find((sheet) => sheet.getName() === name) || null; },
    insertSheet(name) {
      insertCalls += 1;
      const sheet = makeSheet(name, []);
      allSheets.push(sheet);
      return sheet;
    },
    allSheets: () => allSheets.slice()
  };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty(name) {
        assert.equal(name, 'LITTLELAND_TEST_SPREADSHEET_ID');
        return missingProperty ? null : 'test-only-id';
      }
    }) },
    SpreadsheetApp: { openById(id) { assert.equal(id, 'test-only-id'); return spreadsheet; } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(MIGRATION_FILE, 'utf8'), context, { filename: MIGRATION_FILE });
  return { context, spreadsheet, initialSnapshots, locks, insertCalls: () => insertCalls };
}

test('creates only an empty StaffRoomLocks tab with the exact 15 headers and frozen first row', () => {
  const s = setup();
  const beforeCount = s.spreadsheet.allSheets().length;
  const result = s.context.migrateLittleLandTestStaffRoomLocksOnly();
  const lockSheet = s.spreadsheet.getSheetByName('StaffRoomLocks');

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    spreadsheetName: 'LittleLand_TEST', sheetName: 'StaffRoomLocks', columns: 15, created: true
  });
  assert.equal(s.insertCalls(), 1);
  assert.equal(s.spreadsheet.allSheets().length, beforeCount + 1);
  assert.deepEqual(lockSheet.rows(), [EXPECTED_HEADERS]);
  assert.equal(lockSheet.frozenRows(), 1);
  assert.equal(lockSheet.writeCount(), 1);
  for (const [name, rows] of s.initialSnapshots) {
    const sheet = s.spreadsheet.getSheetByName(name);
    assert.deepEqual(sheet.rows(), rows, `${name} data and headers must remain unchanged`);
    assert.equal(sheet.writeCount(), 0, `${name} must not be written`);
  }
});

test('stops if StaffRoomLocks already exists without rewriting or clearing it', () => {
  const s = setup({ existingLocks: true });
  const before = s.locks.rows();
  assert.throws(
    () => s.context.migrateLittleLandTestStaffRoomLocksOnly(),
    /StaffRoomLocks already exists; no changes made/
  );
  assert.equal(s.insertCalls(), 0);
  assert.deepEqual(s.locks.rows(), before);
  assert.equal(s.locks.writeCount(), 0);
  for (const [name, rows] of s.initialSnapshots) {
    const sheet = s.spreadsheet.getSheetByName(name);
    assert.deepEqual(sheet.rows(), rows);
    assert.equal(sheet.writeCount(), 0);
  }
});

test('stops before any spreadsheet access when the TEST property is missing', () => {
  const s = setup({ missingProperty: true });
  assert.throws(() => s.context.migrateLittleLandTestStaffRoomLocksOnly(), /missing LITTLELAND_TEST_SPREADSHEET_ID/);
  assert.equal(s.insertCalls(), 0);
  assert.equal(s.spreadsheet.getSheetByName('StaffRoomLocks'), null);
});

test('stops before any sheet changes if target spreadsheet title is not LittleLand_TEST', () => {
  const s = setup({ spreadsheetName: 'Production' });
  assert.throws(() => s.context.migrateLittleLandTestStaffRoomLocksOnly(), /exactly LittleLand_TEST/);
  assert.equal(s.insertCalls(), 0);
  assert.equal(s.spreadsheet.getSheetByName('StaffRoomLocks'), null);
  for (const [name, rows] of s.initialSnapshots) {
    assert.deepEqual(s.spreadsheet.getSheetByName(name).rows(), rows);
  }
});
