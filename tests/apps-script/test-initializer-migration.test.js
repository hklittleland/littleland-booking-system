'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./harness');

function makeSheet(name, rows) {
  const values = rows.map((row) => row.slice());
  let frozenRows = 0;
  return {
    getName() { return name; },
    getLastRow() { return values.length; },
    getLastColumn() { return Math.max(0, ...values.map((row) => row.length)); },
    getFrozenRows() { return frozenRows; },
    setFrozenRows(count) { frozenRows = count; },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getValues() {
          return Array.from({ length: rowCount }, (_, rowOffset) =>
            Array.from({ length: columnCount }, (_, columnOffset) => {
              const row = values[startRow - 1 + rowOffset] || [];
              const value = row[startColumn - 1 + columnOffset];
              return value === undefined ? '' : value;
            })
          );
        },
        getDisplayValues() {
          return this.getValues().map((row) => row.map((value) => value == null ? '' : String(value)));
        },
        setValues(nextValues) {
          nextValues.forEach((nextRow, rowOffset) => {
            const targetIndex = startRow - 1 + rowOffset;
            while (values.length <= targetIndex) values.push([]);
            const target = values[targetIndex];
            while (target.length < startColumn - 1) target.push('');
            nextRow.forEach((value, columnOffset) => {
              target[startColumn - 1 + columnOffset] = value;
            });
          });
          return this;
        }
      };
    },
    rows() { return values.map((row) => row.slice()); }
  };
}

function makeSpreadsheet(runtime, options = {}) {
  const definitions = runtime.context.LITTLELAND_TEST_SHEET_DEFINITIONS;
  const roomSeed = runtime.context.LITTLELAND_TEST_ROOM_SEED;
  const additiveColumns = runtime.context.LITTLELAND_TEST_ADDITIVE_COLUMNS;
  const oldDefinitions = definitions.slice(0, 8).map((definition) => ({
    name: definition.name,
    headers: definition.headers.filter((header) => !(additiveColumns[definition.name] || []).includes(header))
  }));
  const sheets = oldDefinitions.map((definition) => {
    const rows = [definition.headers.slice()];
    if (definition.name === 'Rooms') rows.push(...roomSeed.map((row) => row.slice()));
    if (definition.name === 'Bookings') {
      rows.push(['KEEP-THIS-BOOKING']);
    }
    return makeSheet(definition.name, rows);
  });
  if (options.extraSheet) sheets.push(makeSheet(options.extraSheet, [['unexpected']]));

  const spreadsheet = {
    getName() { return options.name || 'LittleLand_TEST'; },
    getSheets() { return sheets.slice(); },
    getSheetByName(name) { return sheets.find((sheet) => sheet.getName() === name) || null; },
    insertSheet(name) {
      const sheet = makeSheet(name, []);
      sheets.push(sheet);
      return sheet;
    },
    sheets
  };
  runtime.context.PropertiesService.getScriptProperties = () => ({
    getProperty(name) {
      return name === 'LITTLELAND_TEST_SPREADSHEET_ID' ? 'test-spreadsheet-id' : null;
    }
  });
  runtime.context.SpreadsheetApp.openById = (id) => {
    assert.equal(id, 'test-spreadsheet-id');
    return spreadsheet;
  };
  return spreadsheet;
}

test('TEST initializer additively creates V3 tabs, preserves existing data, and is repeatable', () => {
  const runtime = createRuntime();
  const spreadsheet = makeSpreadsheet(runtime);
  const beforeBookingRows = spreadsheet.getSheetByName('Bookings').rows();

  const first = runtime.context.initializeLittleLandTestSheets();
  assert.deepEqual(JSON.parse(JSON.stringify(first.sheetsCreated)), ['StaffSchedules', 'ScheduleEmployees', 'BookingAdjustments']);
  assert.deepEqual(JSON.parse(JSON.stringify(first.headersCreated)), ['StaffSchedules', 'ScheduleEmployees', 'BookingAdjustments']);
  assert.deepEqual(JSON.parse(JSON.stringify(first.columnsAdded)), [
    'cashDepositCollectedAmount',
    'petStatus', 'removedAt', 'removedByStaffId', 'removeReason',
    'sourcePaymentId', 'actorStaffNameSnapshot'
  ]);
  const bookingsAfterMigration = spreadsheet.getSheetByName('Bookings').rows();
  const bookingHeaders = runtime.context.LITTLELAND_TEST_SHEET_DEFINITIONS.find((item) => item.name === 'Bookings').headers;
  assert.deepEqual(JSON.parse(JSON.stringify(bookingsAfterMigration[0])), JSON.parse(JSON.stringify(bookingHeaders)));
  assert.equal(bookingsAfterMigration.length, beforeBookingRows.length);
  beforeBookingRows.slice(1).forEach((row, index) => {
    assert.deepEqual(bookingsAfterMigration[index + 1].slice(0, row.length), row);
    assert.ok(bookingsAfterMigration[index + 1].slice(row.length).every((value) => value === "" || value === null));
  });
  assert.equal(spreadsheet.getSheets().length, 11);

  const definitions = runtime.context.LITTLELAND_TEST_SHEET_DEFINITIONS;
  const adjustments = spreadsheet.getSheetByName('BookingAdjustments');
  const schedule = spreadsheet.getSheetByName('StaffSchedules');
  const scheduleEmployees = spreadsheet.getSheetByName('ScheduleEmployees');
  assert.deepEqual(JSON.parse(JSON.stringify(adjustments.rows()[0])), JSON.parse(JSON.stringify(definitions.find((item) => item.name === 'BookingAdjustments').headers)));
  assert.ok(adjustments.rows()[0].includes('effectiveDate'));
  assert.ok(adjustments.rows()[0].includes('petId'));
  assert.ok(spreadsheet.getSheetByName('Pets').rows()[0].includes('petStatus'));
  assert.ok(spreadsheet.getSheetByName('Payments').rows()[0].includes('sourcePaymentId'));
  assert.ok(spreadsheet.getSheetByName('Logs').rows()[0].includes('actorStaffNameSnapshot'));
  assert.deepEqual(JSON.parse(JSON.stringify(schedule.rows()[0])), JSON.parse(JSON.stringify(definitions.find((item) => item.name === 'StaffSchedules').headers)));
  assert.deepEqual(JSON.parse(JSON.stringify(scheduleEmployees.rows()[0])), JSON.parse(JSON.stringify(definitions.find((item) => item.name === 'ScheduleEmployees').headers)));
  assert.equal(adjustments.getFrozenRows(), 1);
  assert.equal(schedule.getFrozenRows(), 1);
  assert.equal(scheduleEmployees.getFrozenRows(), 1);

  const second = runtime.context.initializeLittleLandTestSheets();
  assert.deepEqual(JSON.parse(JSON.stringify(second.sheetsCreated)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(second.headersCreated)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(second.columnsAdded)), []);
  assert.deepEqual(JSON.parse(JSON.stringify(second.roomIdsAdded)), []);
  const bookingsAfterSecondRun = spreadsheet.getSheetByName('Bookings').rows();
  assert.deepEqual(JSON.parse(JSON.stringify(bookingsAfterSecondRun[0])), JSON.parse(JSON.stringify(bookingHeaders)));
  assert.equal(bookingsAfterSecondRun.length, beforeBookingRows.length);
  beforeBookingRows.slice(1).forEach((row, index) => {
    assert.deepEqual(bookingsAfterSecondRun[index + 1].slice(0, row.length), row);
    assert.ok(bookingsAfterSecondRun[index + 1].slice(row.length).every((value) => value === "" || value === null));
  });
});

test('TEST initializer refuses an unexpected sheet before creating tabs or changing data', () => {
  const runtime = createRuntime();
  const spreadsheet = makeSpreadsheet(runtime, { extraSheet: 'ProductionData' });
  const beforeNames = spreadsheet.getSheets().map((sheet) => sheet.getName());
  const beforeBookingRows = spreadsheet.getSheetByName('Bookings').rows();

  assert.throws(
    () => runtime.context.initializeLittleLandTestSheets(),
    /unexpected tabs found/i
  );
  assert.deepEqual(spreadsheet.getSheets().map((sheet) => sheet.getName()), beforeNames);
  assert.deepEqual(spreadsheet.getSheetByName('Bookings').rows(), beforeBookingRows);
});

test('TEST initializer refuses an unknown header before applying any planned additive migrations', () => {
  const runtime = createRuntime();
  const spreadsheet = makeSpreadsheet(runtime);
  const pets = spreadsheet.getSheetByName('Pets');
  const beforePets = pets.rows();
  pets.getRange(1, 2, 1, 1).setValues([['UnexpectedProductionField']]);
  const beforeBookings = spreadsheet.getSheetByName('Bookings').rows();
  const beforeLogs = spreadsheet.getSheetByName('Logs').rows();

  assert.throws(
    () => runtime.context.initializeLittleLandTestSheets(),
    /header mismatch in Pets/i
  );
  assert.deepEqual(pets.rows()[0].slice(-4), beforePets[0].slice(-4));
  assert.deepEqual(spreadsheet.getSheetByName('Bookings').rows(), beforeBookings);
  assert.deepEqual(spreadsheet.getSheetByName('Logs').rows(), beforeLogs);
  assert.equal(spreadsheet.getSheets().some((sheet) => sheet.getName() === 'StaffSchedules'), false);
});
