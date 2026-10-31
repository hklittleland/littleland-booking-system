'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const APPS_SCRIPT_FILES = [
  'apps-script/InitializeTestSheets.gs',
  'apps-script/TestSpreadsheetAccess.gs',
  'apps-script/PricingEngine.gs',
  'apps-script/BookingValidation.gs',
  'apps-script/RoomAvailability.gs',
  'apps-script/IdempotencyService.gs',
  'apps-script/StaffCrypto.gs',
  'apps-script/StaffAuth.gs',
  'apps-script/StaffOperations.gs',
  'apps-script/BookingApi.gs'
];

function createRuntime(options = {}) {
  let uuidCounter = 1;
  let writeCount = 0;
  let readFailureUsed = false;
  let writeFailureUsed = false;
  const cacheValues = new Map();
  const testId = options.testId || 'test-spreadsheet-id';
  const allowedProperty = options.allowedSpreadsheetId === undefined ? testId : options.allowedSpreadsheetId;
  const initializer = readInitializer();
  const definitions = initializer.definitions;
  const roomSeed = initializer.roomSeed;
  const sheets = definitions.map((definition) => {
    const rows = [definition.headers.slice()];
    if (definition.name === 'Rooms') {
      rows.push(...roomSeed.map((room) => room.slice()));
    }
    return new FakeSheet(definition.name, rows, {
      shouldFailRead(sheetName, row, rows, columns) {
        if (readFailureUsed || !options.failRead) return false;
        const failure = options.failRead;
        if (failure.sheetName && failure.sheetName !== sheetName) return false;
        if (failure.minRows && rows < failure.minRows) return false;
        readFailureUsed = true;
        return true;
      },
      shouldFailWrite(sheetName, row, values) {
        if (writeFailureUsed || !options.failWrite) return null;
        const failure = options.failWrite;
        if (failure.sheetName && failure.sheetName !== sheetName) return null;
        writeFailureUsed = true;
        return failure.afterWrite ? 'after' : 'before';
      },
      onWrite() { writeCount += 1; }
    });
  });
  if (options.extraSheetName) sheets.push(new FakeSheet(options.extraSheetName, [['unexpected']], {}));

  const fakeSpreadsheet = new FakeSpreadsheet(options.spreadsheetName || 'LittleLand_TEST', testId, sheets);
  const lockState = { locked: false, shouldTimeout: Boolean(options.lockTimeout), calls: 0 };
  const scriptLock = {
    tryLock() {
      lockState.calls += 1;
      if (lockState.shouldTimeout || lockState.locked) return false;
      lockState.locked = true;
      if (typeof options.onLockAcquired === 'function') options.onLockAcquired();
      return true;
    },
    releaseLock() { lockState.locked = false; }
  };

  const properties = {
    getProperty(name) {
      if (name !== 'LITTLELAND_TEST_SPREADSHEET_ID') return null;
      return allowedProperty;
    },
    setProperty(name, value) {
      if (name === 'LITTLELAND_TEST_SPREADSHEET_ID') return value;
      return null;
    }
  };

  const context = {
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Set,
    Map,
    RegExp,
    Error,
    JSON,
    parseInt,
    isFinite,
    PropertiesService: { getScriptProperties: () => properties },
    SpreadsheetApp: {
      openById(id) {
        if (options.openThrows || id !== testId) throw new Error('Mock refuses non-TEST spreadsheet ID');
        return fakeSpreadsheet;
      }
    },
    LockService: { getScriptLock: () => scriptLock },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA-256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest(algorithm, value) {
        return Array.from(crypto.createHash(algorithm).update(String(value), 'utf8').digest())
          .map((byte) => (byte > 127 ? byte - 256 : byte));
      },
      computeHmacSha256Signature(value, key) {
        const bytes = (input) => Array.isArray(input)
          ? Buffer.from(input.map((b) => (b + 256) % 256))
          : Buffer.from(String(input), 'utf8');
        const message = bytes(value);
        return Array.from(crypto.createHmac('sha256', bytes(key)).update(message).digest())
          .map((byte) => (byte > 127 ? byte - 256 : byte));
      },
      base64Decode(value) { return Array.from(Buffer.from(String(value), 'base64')).map((byte) => byte > 127 ? byte - 256 : byte); },
      base64Encode(value, charset) {
        const input = Array.isArray(value)
          ? Buffer.from(value.map((b) => (b + 256) % 256))
          : Buffer.from(String(value), charset || 'utf8');
        return input.toString('base64');
      },
      getUuid() {
        const number = uuidCounter++;
        const head = number.toString(16).padStart(8, '0');
        const suffix = String(number).padStart(12, '0');
        return `${head}-0000-4000-8000-${suffix}`;
      },
      formatDate(date, timeZone, pattern) {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(new Date(date.getTime()));
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        if (pattern === 'yyyyMMdd') return `${values.year}${values.month}${values.day}`;
        if (pattern === 'yyyy-MM-dd') return `${values.year}-${values.month}-${values.day}`;
        throw new Error(`Unsupported mock date format: ${pattern}`);
      }
    },
    CacheService: { getScriptCache: () => ({
      get(key) { const item = cacheValues.get(key); return item && item.expires > Date.now() ? item.value : null; },
      put(key, value, seconds) { cacheValues.set(key, { value: String(value), expires: Date.now() + Number(seconds) * 1000 }); },
      remove(key) { cacheValues.delete(key); }
    }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text: String(text),
          mimeType: null,
          setMimeType(mimeType) { this.mimeType = mimeType; return this; },
          getContent() { return this.text; },
          getMimeType() { return this.mimeType; }
        };
      }
    }
  };
  vm.createContext(context);
  APPS_SCRIPT_FILES.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  });

  return {
    context,
    spreadsheet: fakeSpreadsheet,
    lockState,
    getWriteCount: () => writeCount,
    sheet(name) { return fakeSpreadsheet.getSheetByName(name); },
    records(name) { return fakeSpreadsheet.getSheetByName(name).records(); },
    addRecord(name, record) { fakeSpreadsheet.getSheetByName(name).appendObject(record); },
    invokeGet(parameters = {}) {
      return parseOutput(context.doGet({ parameter: parameters }));
    },
    invokePost(payload) {
      return parseOutput(context.doPost({ postData: { contents: JSON.stringify(payload) } }));
    },
    invokeStaff(payload) { return parseOutput(context.doPost({ postData: { contents: JSON.stringify(payload) } })); }
  };
}

class FakeSpreadsheet {
  constructor(name, id, sheets) {
    this.name = name;
    this.id = id;
    this.sheets = sheets;
  }
  getName() { return this.name; }
  getId() { return this.id; }
  getSheets() { return this.sheets.slice(); }
  getSheetByName(name) { return this.sheets.find((sheet) => sheet.getName() === name) || null; }
}

class FakeSheet {
  constructor(name, values, hooks) {
    this.name = name;
    this.values = values.map((row) => row.slice());
    this.hooks = hooks || {};
  }
  getName() { return this.name; }
  getLastRow() { return this.values.length; }
  getLastColumn() { return this.values[0] ? this.values[0].length : 0; }
  getRange(row, column, rowCount, columnCount) {
    const sheet = this;
    return {
      getValues() {
        if (sheet.hooks.shouldFailRead && sheet.hooks.shouldFailRead(sheet.name, row, rowCount, columnCount)) {
          throw new Error('Mock read failure');
        }
        return Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) => {
            const source = sheet.values[row - 1 + rowOffset] || [];
            const value = source[column - 1 + columnOffset];
            return value === undefined ? '' : value;
          })
        );
      },
      getDisplayValues() {
        return this.getValues().map((values) => values.map((value) => value === null ? '' : String(value)));
      },
      setValues(values) {
        const failure = sheet.hooks.shouldFailWrite && sheet.hooks.shouldFailWrite(sheet.name, row, values);
        if (failure === 'before') throw new Error('Mock write failure before side effect');
        values.forEach((valuesRow, rowOffset) => {
          const targetRow = row - 1 + rowOffset;
          while (sheet.values.length <= targetRow) sheet.values.push(Array(sheet.getLastColumn()).fill(''));
          sheet.values[targetRow] = valuesRow.slice();
        });
        if (sheet.hooks.onWrite) sheet.hooks.onWrite();
        if (failure === 'after') throw new Error('Mock write failure after side effect');
        return this;
      }
    };
  }
  records() {
    const headers = this.values[0] || [];
    return this.values.slice(1).filter((row) => row.some((value) => value !== '' && value !== null)).map((row) => {
      const record = {};
      headers.forEach((header, index) => { record[header] = row[index] === undefined ? '' : row[index]; });
      return record;
    });
  }
  appendObject(record) {
    const headers = this.values[0];
    this.values.push(headers.map((header) => record[header] === undefined ? '' : record[header]));
  }
}

function readInitializer() {
  const bootstrap = {};
  vm.createContext(bootstrap);
  const source = fs.readFileSync(path.join(PROJECT_ROOT, 'apps-script/InitializeTestSheets.gs'), 'utf8');
  vm.runInContext(source, bootstrap, { filename: 'InitializeTestSheets.gs' });
  return {
    definitions: JSON.parse(JSON.stringify(bootstrap.LITTLELAND_TEST_SHEET_DEFINITIONS)),
    roomSeed: JSON.parse(JSON.stringify(bootstrap.LITTLELAND_TEST_ROOM_SEED))
  };
}

function parseOutput(output) {
  assert.equal(output.mimeType, 'application/json');
  return JSON.parse(output.getContent());
}

function hkDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function makePet(species = 'rabbit', overrides = {}) {
  const pet = {
    name: 'Momo',
    breed: 'Mini Rex',
    ageValue: '1',
    ageUnit: 'year',
    sex: 'female',
    sterilized: 'yes',
    pregnant: 'no',
    recentSurgery: 'no',
    vetVisit: 'no',
    vetDetails: '',
    infectiousDisease: 'no',
    infectiousDetails: '',
    chronicDisease: 'no',
    chronicDetails: '',
    medication: 'no',
    medicationDetails: '',
    specialCare: '',
    fleaTreatment: 'no'
  };
  if (species === 'hamster') {
    pet.sex = 'male';
    pet.sterilized = '';
    pet.pregnant = '';
    pet.fleaTreatment = '';
    pet.breed = 'Syrian hamster';
  }
  return Object.assign(pet, overrides);
}

function makeForm(context, overrides = {}) {
  const species = overrides.species || 'rabbit';
  const defaultsBySpecies = {
    rabbit: { roomId: 'DELUXE_ROOM', foodMain: 'Oxbow 成兔糧', hay: 'Momi 1st cut', feeding: '每日一次', vegetables: '否' },
    guineaPig: { roomId: 'STANDARD_ROOM', foodMain: 'Oxbow 天竺鼠糧', hay: 'Joy & Fibre 1st cut', feeding: '每日一次', vegetables: '否' },
    hamster: { roomId: 'STANDARD_ROOM', foodMain: 'BUNNY 倉鼠糧', hay: '', feeding: '', vegetables: '' }
  };
  const checkin = addDays(hkDateString(), 14);
  const base = Object.assign({
    checkin,
    checkout: addDays(checkin, 2),
    checkinTime: '14:30–15:30',
    checkoutTime: '14:30–15:30',
    species,
    roomId: defaultsBySpecies[species].roomId,
    quantity: 1,
    pets: [makePet(species)],
    parentName: 'Test Parent',
    phone: '61234567',
    email: 'test@example.com',
    emergency1: 'Emergency One 61234568',
    emergency2: 'Emergency Two 61234569',
    vet: '',
    foodMain: defaultsBySpecies[species].foodMain,
    hay: defaultsBySpecies[species].hay,
    feeding: defaultsBySpecies[species].feeding,
    vegetables: defaultsBySpecies[species].vegetables,
    groomingOnce: false,
    groomingDaily: false,
    medicine: 'none',
    earlyCheckin: false,
    lateCheckout: false
  }, overrides);
  if (overrides.species && !Object.prototype.hasOwnProperty.call(overrides, 'roomId')) base.roomId = defaultsBySpecies[species].roomId;
  if (overrides.species && !Object.prototype.hasOwnProperty.call(overrides, 'foodMain')) base.foodMain = defaultsBySpecies[species].foodMain;
  if (overrides.species === 'hamster') {
    if (!Object.prototype.hasOwnProperty.call(overrides, 'hay')) base.hay = '';
    if (!Object.prototype.hasOwnProperty.call(overrides, 'feeding')) base.feeding = '';
    if (!Object.prototype.hasOwnProperty.call(overrides, 'vegetables')) base.vegetables = '';
  }
  if (Array.isArray(overrides.pets)) {
    const defaults = Array.isArray(base.pets) ? base.pets : [];
    base.pets = overrides.pets.map((pet, index) =>
      makePet(species, Object.assign({}, defaults[index] || makePet(species), pet))
    );
  }
  if (overrides.quantity && overrides.quantity > base.pets.length) {
    base.pets = Array.from({ length: overrides.quantity }, (_, index) => makePet(species, { name: `Pet ${index + 1}` }));
  }
  return base;
}

function quoteFor(context, form) {
  const input = context.littlelandPricingInput_(form);
  const price = context.LittleLandPricing.calculatePricing(input);
  return {
    priceVersion: context.LITTLELAND_PRICE_VERSION,
    roomPrice: price.roomPrice,
    nights: price.nights,
    baseRoomFee: price.baseRoomFee,
    extraPetFee: price.extraPetFee,
    weekendFee: price.weekendFee,
    serviceFees: price.serviceFees,
    totalSurcharges: price.totalSurcharges,
    estimatedTotal: price.estimatedTotal,
    depositAmount: price.depositAmount,
    remainingBalance: price.remainingBalance,
    cashDeposit: price.cashDeposit
  };
}

function makePayload(runtime, formOverrides = {}, options = {}) {
  const form = makeForm(runtime.context, formOverrides);
  const clientQuote = Object.assign(quoteFor(runtime.context, form), options.quoteOverrides || {});
  return Object.assign({
    idempotencyKey: options.idempotencyKey || 'test-key-0001',
    form,
    terms: [true, true, true, true, true, true],
    clientQuote
  }, options.topLevelOverrides || {});
}

module.exports = {
  assert,
  crypto,
  fs,
  path,
  PROJECT_ROOT,
  APPS_SCRIPT_FILES,
  createRuntime,
  hkDateString,
  addDays,
  makePet,
  makeForm,
  quoteFor,
  makePayload
};
