/** Read-only Production schema constants extracted from accepted TEST V3.2 source. No initializer/migration functions. */
var LITTLELAND_PROD_SPREADSHEET_NAME = 'LittleLand_PROD';
var LITTLELAND_PROD_SPREADSHEET_ID_PROPERTY = 'LITTLELAND_PROD_SPREADSHEET_ID';

var LITTLELAND_PROD_SHEET_DEFINITIONS = [
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
      'cashDepositCollectedAmount', 'internalAssignment', 'extensionStartDate',
      'internalAssignmentNote', 'lastExtensionFromDate', 'lastExtensionAddedNights',
      'lastExtensionAddedBaseRoomFee'
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
    name: 'ScheduleEmployees',
    headers: [
      'scheduleEmployeeId', 'displayName', 'isActive', 'sortOrder',
      'createdAt', 'updatedAt', 'createdByStaffId', 'updatedByStaffId'
    ]
  },
  {
    name: 'BookingAdjustments',
    headers: [
      'adjustmentId', 'bookingId', 'type', 'description', 'amount', 'currency',
      'status', 'sourcePaymentId', 'paymentId', 'reason', 'effectiveDate',
      'reversesAdjustmentId', 'createdAt', 'updatedAt', 'createdByStaffId',
      'updatedByStaffId', 'idempotencyKey', 'petId', 'petNameSnapshot', 'groupId',
      'billingBasis', 'unitRate', 'nightsCharged'
    ]
  },
  {
    name: 'StaffRoomLocks',
    headers: [
      'roomLockId', 'roomId', 'startDate', 'endDate', 'reason', 'status',
      'createdAt', 'createdByStaffId', 'createdByStaffNameSnapshot',
      'releasedAt', 'releasedByStaffId', 'releasedByStaffNameSnapshot',
      'releaseReason', 'recordVersion', 'idempotencyKey'
    ]
  }
];


// Physical and virtual Room Master; EXT is a booking assignment, not a room.
var LITTLELAND_PROD_ROOM_MASTER = [
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

