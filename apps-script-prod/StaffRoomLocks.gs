/** Staff-only physical room locks. All mutations run under the dispatcher Script Lock. */
function littlelandStaffRoomLockMutation_(action, body, auth, requestId) {
  littlelandRequire_(action === 'staff.roomLockCreate' || action === 'staff.roomLockRelease',
    'VALIDATION_FAILED', '不支援的房間鎖定操作。', false);
  var claim = littlelandStaffIdempotency_(action, body);
  if (!claim.key) return claim;

  var data = body.data || {};
  var now = littlelandNowIso_();
  if (action === 'staff.roomLockCreate') {
    var roomId = String(data.roomId || '').trim();
    var startDate = String(data.startDate || '').trim();
    var endDate = String(data.endDate || '').trim();
    var reason = String(data.reason || '').trim();
    littlelandRequire_(roomId && littlelandIsIsoDate_(startDate) && littlelandIsIsoDate_(endDate) && endDate > startDate,
      'VALIDATION_FAILED', '請選擇實體房及有效日期區間；退房日必須晚於起始日。', false);
    littlelandRequire_(reason && reason.length <= 500, 'VALIDATION_FAILED', '請填寫 500 字以內的鎖房原因。', false);

    var inventory = littlelandReadInventory_();
    var room = inventory.rooms.filter(function (item) {
      return String(item.roomId) === roomId && String(item.roomKind) === 'PHYSICAL' &&
        (item.isActive === true || String(item.isActive).toLowerCase() === 'true');
    });
    littlelandRequire_(room.length === 1, 'VALIDATION_FAILED', '只可鎖定有效的實體房，不能鎖定虛擬房或 EXT。', false);
    var occupiedConflict = inventory.occupying.some(function (booking) {
      return booking.roomIds.indexOf(roomId) >= 0 &&
        littlelandDateRangesOverlap_(startDate, endDate, booking.checkinDate, booking.checkoutDate);
    });
    var existingLockConflict = inventory.activeRoomLocks.some(function (lock) {
      return lock.roomId === roomId &&
        littlelandDateRangesOverlap_(startDate, endDate, lock.startDate, lock.endDate);
    });
    littlelandRequire_(!occupiedConflict && !existingLockConflict, 'ROOM_LOCK_CONFLICT',
      '所選實體房於該日期已被已確認預約使用或已鎖定；未建立新鎖房，請重新查看房間月曆。', false);

    var lockId = 'ROOMLOCK-' + Utilities.getUuid();
    var lockRecord = {
      roomLockId: lockId,
      roomId: roomId,
      startDate: startDate,
      endDate: endDate,
      reason: littlelandSafeSheetValue_(reason),
      status: 'ACTIVE',
      createdAt: now,
      createdByStaffId: auth.staff.staffId,
      createdByStaffNameSnapshot: auth.staff.displayName,
      releasedAt: '',
      releasedByStaffId: '',
      releasedByStaffNameSnapshot: '',
      releaseReason: '',
      recordVersion: 1,
      idempotencyKey: claim.key
    };
    var projectedInventory = {
      bookings: inventory.bookings,
      occupying: inventory.occupying,
      rooms: inventory.rooms,
      roomLocks: inventory.roomLocks.concat([lockRecord]),
      activeRoomLocks: inventory.activeRoomLocks.concat([lockRecord])
    };
    var pendingConflicts = inventory.bookings.filter(function (booking) {
      if (['PENDING_CONFIRMATION', 'PENDING_DEPOSIT'].indexOf(String(booking.bookingStatus)) < 0 ||
        !littlelandDateRangesOverlap_(startDate, endDate, booking.checkinDate, booking.checkoutDate)) return false;
      try {
        return !littlelandAvailability_({
          roomTypeId: String(booking.roomTypeId),
          checkin: booking.checkinDate,
          checkout: booking.checkoutDate
        }, projectedInventory).available;
      } catch (availabilityError) {
        return true;
      }
    }).map(function (booking) { return String(booking.bookingId); });

    littlelandStaffClaim_(claim, action, body, requestId, now);
    littlelandAppendRecord_('StaffRoomLocks', lockRecord);
    var result = Object.assign({}, lockRecord, {
      pendingConflictBookingIds: pendingConflicts,
      logSummary: '員工鎖定實體房 ' + roomId + '（' + startDate + ' 至 ' + endDate + '，退房日不鎖）。'
    });
    littlelandStaffFinish_(claim, action, body, auth, requestId, now, result, 'ROOM_LOCK', lockId, {
      roomLockId: lockId,
      roomId: roomId,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      status: 'ACTIVE',
      pendingConflictBookingIds: pendingConflicts
    });
    return result;
  }

  var roomLockId = String(data.roomLockId || body.roomLockId || '').trim();
  var matches = littlelandReadTable_('StaffRoomLocks').rows.filter(function (row) {
    return String(row.record.roomLockId) === roomLockId;
  });
  littlelandRequire_(roomLockId && matches.length === 1, 'ROOM_LOCK_NOT_FOUND', '找不到唯一的鎖房紀錄。', false);
  var current = matches[0].record;
  littlelandRequire_(Number(current.recordVersion) === Number(body.expectedRecordVersion),
    'ROOM_LOCK_VERSION_CONFLICT', '鎖房資料已更新，請重新載入月曆。', false);
  littlelandRequire_(String(current.status) === 'ACTIVE', 'ROOM_LOCK_NOT_ACTIVE', '此鎖房已解除，請重新載入月曆。', false);
  var releaseReason = String(data.releaseReason || '').trim();
  littlelandRequire_(releaseReason.length <= 500, 'VALIDATION_FAILED', '解除原因不可超過 500 字。', false);

  littlelandStaffClaim_(claim, action, body, requestId, now);
  var update = {
    status: 'RELEASED',
    releasedAt: now,
    releasedByStaffId: auth.staff.staffId,
    releasedByStaffNameSnapshot: auth.staff.displayName,
    releaseReason: littlelandSafeSheetValue_(releaseReason),
    recordVersion: Number(current.recordVersion) + 1
  };
  littlelandUpdateRecordByKey_('StaffRoomLocks', 'roomLockId', roomLockId, update);
  var released = Object.assign({}, current, update);
  var releaseResult = Object.assign({}, released, {
    logSummary: '員工解除實體房 ' + String(current.roomId) + ' 的鎖定。'
  });
  littlelandStaffFinish_(claim, action, body, auth, requestId, now, releaseResult, 'ROOM_LOCK', roomLockId, {
    roomLockId: roomLockId,
    roomId: String(current.roomId),
    startDate: littlelandSheetDateOnly_(current.startDate),
    endDate: littlelandSheetDateOnly_(current.endDate),
    previousStatus: 'ACTIVE',
    status: 'RELEASED',
    reason: String(current.reason || ''),
    releaseReason: releaseReason,
    recordVersion: update.recordVersion
  });
  return releaseResult;
}
