/**
 * TEST inventory and physical-room allocation rules.
 * Only the ten physical room IDs below can ever be allocated; SS1/SSR1 are virtual.
 */
var LITTLELAND_OCCUPYING_BOOKING_STATUSES = Object.freeze([
  'CONFIRMED', 'CHECKED_IN'
]);
var LITTLELAND_BOOKING_STATUSES = Object.freeze([
  'PENDING_CONFIRMATION', 'PENDING_DEPOSIT', 'CONFIRMED', 'CHECKED_IN',
  'CHECKED_OUT', 'COMPLETED', 'CANCELLED'
]);
var LITTLELAND_ROOM_PLANS = Object.freeze({
  PRIVATE_SUITE: Object.freeze([['S1'], ['S2'], ['S3']]),
  DELUXE_SUITE: Object.freeze([['S1', 'S2'], ['S2', 'S3']]),
  VERY_DELUXE_SUITE: Object.freeze([['S1', 'S2', 'S3']]),
  DELUXE_ROOM: Object.freeze([['A1'], ['A2'], ['A3']]),
  STANDARD_ROOM: Object.freeze([['B1'], ['B2']]),
  HAMSTER_BOX: Object.freeze([['C1']]),
  OWN_CAGE: Object.freeze([['F1']])
});

function littlelandReadInventory_() {
  var roomTable = littlelandReadTable_('Rooms');
  var bookingTable = littlelandReadTable_('Bookings');
  littlelandValidateRoomMaster_(roomTable.rows.map(function (row) { return row.record; }));
  var bookings = bookingTable.rows.map(function (row) { return row.record; });
  var occupying = littlelandBuildOccupancy_(bookings);
  return { bookings: bookings, occupying: occupying };
}

function littlelandAvailability_(input, inventory) {
  var roomTypeId = input.roomTypeId || input.roomId;
  var plans = LITTLELAND_ROOM_PLANS[roomTypeId];
  littlelandRequire_(Boolean(plans), 'ROOM_INVALID_ALLOCATION', '指定房型沒有有效的實體房配置。', false);
  var checkin = input.checkin;
  var checkout = input.checkout;
  littlelandRequire_(
    littlelandIsIsoDate_(checkin) && littlelandIsIsoDate_(checkout) && checkout > checkin,
    'DATE_CHECKOUT_NOT_AFTER_CHECKIN',
    '入住及退房日期不正確。',
    false
  );
  var occupied = inventory.occupying;
  for (var index = 0; index < plans.length; index += 1) {
    var plan = plans[index];
    var inUse = occupied.some(function (booking) {
      return littlelandDateRangesOverlap_(checkin, checkout, booking.checkinDate, booking.checkoutDate) &&
        littlelandArraysIntersect_(plan, booking.roomIds);
    });
    if (!inUse) return { available: true, roomIds: plan.slice() };
  }
  return { available: false, roomIds: [] };
}

function littlelandAllocateRoom_(input, inventory) {
  var result = littlelandAvailability_(input, inventory);
  if (!result.available) {
    throw littlelandApiError_('ROOM_NO_LONGER_AVAILABLE', '所選日期的房型已不可預訂，請重新查詢。', false);
  }
  return result.roomIds;
}

function littlelandBuildOccupancy_(bookings) {
  var occupying = [];
  bookings.forEach(function (booking) {
    var status = String(booking.bookingStatus || '');
    littlelandRequire_(
      LITTLELAND_BOOKING_STATUSES.indexOf(status) !== -1,
      'ROOM_INVALID_ALLOCATION',
      'Booking 狀態不符合 V3.0，房態已停止確認。',
      false
    );
    if (LITTLELAND_OCCUPYING_BOOKING_STATUSES.indexOf(status) === -1) return;

    var checkin = String(booking.checkinDate || '');
    var checkout = String(booking.checkoutDate || '');
    littlelandRequire_(
      littlelandIsIsoDate_(checkin) && littlelandIsIsoDate_(checkout) && checkout > checkin,
      'ROOM_INVALID_ALLOCATION',
      '佔房 Booking 的日期資料無效，房態已停止確認。',
      false
    );
    var roomIds;
    try {
      roomIds = JSON.parse(String(booking.allocatedRoomIdsJson || ''));
    } catch (error) {
      throw littlelandApiError_('ROOM_INVALID_ALLOCATION', '佔房 Booking 的實體房配置無效。', false);
    }
    littlelandRequire_(
      Array.isArray(roomIds) && roomIds.length > 0 && roomIds.every(function (roomId) { return typeof roomId === 'string'; }),
      'ROOM_INVALID_ALLOCATION',
      '佔房 Booking 缺少有效的實體房配置。',
      false
    );
    var normalizedIds = roomIds.map(function (roomId) { return roomId.trim(); });
    littlelandRequire_(
      new Set(normalizedIds).size === normalizedIds.length &&
        littlelandIsAllowedAllocation_(booking.roomTypeId, normalizedIds),
      'ROOM_INVALID_ALLOCATION',
      '佔房 Booking 的配置含未知房間、虛擬房或非法組合。',
      false
    );
    occupying.push({
      bookingId: String(booking.bookingId || ''),
      bookingStatus: status,
      roomTypeId: String(booking.roomTypeId || ''),
      checkinDate: checkin,
      checkoutDate: checkout,
      roomIds: normalizedIds
    });
  });

  for (var left = 0; left < occupying.length; left += 1) {
    for (var right = left + 1; right < occupying.length; right += 1) {
      var a = occupying[left];
      var b = occupying[right];
      if (littlelandDateRangesOverlap_(a.checkinDate, a.checkoutDate, b.checkinDate, b.checkoutDate) &&
          littlelandArraysIntersect_(a.roomIds, b.roomIds)) {
        throw littlelandApiError_('ROOM_OVERLAP_DETECTED', 'TEST inventory 已存在重疊的實體房配置，房態已停止確認。', false);
      }
    }
  }
  return occupying;
}

function littlelandValidateRoomMaster_(roomRows) {
  littlelandRequire_(
    typeof LITTLELAND_TEST_ROOM_SEED !== 'undefined' &&
      roomRows.length === LITTLELAND_TEST_ROOM_SEED.length,
    'ROOM_INVALID_ALLOCATION',
    'Rooms 主檔筆數與 V3.0 不符。',
    false
  );
  var byId = {};
  roomRows.forEach(function (room) {
    var roomId = String(room.roomId || '');
    littlelandRequire_(
      roomId && !byId[roomId],
      'ROOM_INVALID_ALLOCATION',
      'Rooms 主檔含空白或重複 roomId。',
      false
    );
    byId[roomId] = room;
  });

  LITTLELAND_TEST_ROOM_SEED.forEach(function (seed) {
    var room = byId[seed[0]];
    littlelandRequire_(Boolean(room), 'ROOM_INVALID_ALLOCATION', 'Rooms 主檔缺少 V3.0 固定房間。', false);
    var expected = {
      roomId: seed[0], roomTypeId: seed[1], displayName: seed[2], roomKind: seed[3],
      compositionOptionsJson: seed[4], allocationPriority: seed[5], isActive: seed[6]
    };
    Object.keys(expected).forEach(function (key) {
      var actual = room[key];
      var equal = key === 'isActive'
        ? actual === expected[key] || String(actual).toLowerCase() === String(expected[key])
        : String(actual) === String(expected[key]);
      littlelandRequire_(equal, 'ROOM_INVALID_ALLOCATION', 'Rooms 主檔與 V3.0 固定資料不符。', false);
    });
  });
}

function littlelandIsAllowedAllocation_(roomTypeId, roomIds) {
  var plans = LITTLELAND_ROOM_PLANS[roomTypeId];
  if (!plans) return false;
  return plans.some(function (plan) { return littlelandArraysEqual_(plan, roomIds); });
}

function littlelandDateRangesOverlap_(startA, endA, startB, endB) {
  return endA > startB && startA < endB;
}

function littlelandArraysIntersect_(left, right) {
  var set = {};
  left.forEach(function (value) { set[value] = true; });
  return right.some(function (value) { return Boolean(set[value]); });
}
