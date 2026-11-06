'use strict';

/**
 * TEST-only, single-purpose migration.
 * Creates only the StaffRoomLocks tab with its approved 15-column header.
 * It intentionally does not inspect or modify any other sheet.
 * Safe to call only after explicit operator approval.
 *
 * The script property must point to the dedicated TEST spreadsheet, and its
 * title must be exactly LittleLand_TEST. If StaffRoomLocks already exists,
 * this function stops without changing or clearing it.
 *
 * @return {{spreadsheetName:string,sheetName:string,columns:number,created:boolean}}
 */
function migrateLittleLandTestStaffRoomLocksOnly() {
  var propertyName = 'LITTLELAND_TEST_SPREADSHEET_ID';
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!spreadsheetId) {
    throw new Error('TEST_MIGRATION_STOP: missing ' + propertyName + ' Script Property.');
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  if (!spreadsheet || spreadsheet.getName() !== 'LittleLand_TEST') {
    throw new Error('TEST_MIGRATION_STOP: target spreadsheet must be exactly LittleLand_TEST.');
  }

  var sheetName = 'StaffRoomLocks';
  if (spreadsheet.getSheetByName(sheetName)) {
    throw new Error('TEST_MIGRATION_STOP: StaffRoomLocks already exists; no changes made.');
  }

  var headers = [
    'roomLockId', 'roomId', 'startDate', 'endDate', 'reason', 'status',
    'createdAt', 'createdByStaffId', 'createdByStaffNameSnapshot',
    'releasedAt', 'releasedByStaffId', 'releasedByStaffNameSnapshot',
    'releaseReason', 'recordVersion', 'idempotencyKey'
  ];

  var sheet = spreadsheet.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  return {
    spreadsheetName: spreadsheet.getName(),
    sheetName: sheetName,
    columns: headers.length,
    created: true
  };
}
