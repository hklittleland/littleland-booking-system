/** Staff-only API. Every data read is reached only after session validation. */
function littlelandStaffDispatch_(body, requestId) {
  var action = String(body.action || "");
  if (action === "staff.login")
    return littlelandSuccessResponse_(
      littlelandStaffLogin_(body, requestId),
      requestId,
      "登入成功",
    );
  var auth = littlelandStaffAuthenticate_(body.token);
  if (action === "staff.logout")
    return littlelandSuccessResponse_(
      littlelandStaffLogout_(auth),
      requestId,
      "已登出",
    );
  if (action === "staff.session" || action === "staff.settings") {
    return littlelandSuccessResponse_(
      {
        staff: {
          staffId: auth.staff.staffId,
          displayName: auth.staff.displayName,
          role: auth.role,
        },
        expiresAt: auth.session.expiresAt,
      },
      requestId,
      "操作成功",
    );
  }
  var data = littlelandStaffReadAction_(action, body, auth);
  if (data !== null)
    return littlelandSuccessResponse_(data, requestId, "操作成功");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000))
    throw littlelandApiError_(
      "STAFF_LOCK_TIMEOUT",
      "系統正處理另一項員工操作，請稍後重試。",
      true,
    );
  try {
    var mutationResult;
    if (action === "staff.createBooking")
      mutationResult = littlelandStaffCreateBooking_(body, auth, requestId);
    else if (action === "staff.scheduleSave" || action === "staff.scheduleSwap")
      mutationResult = littlelandStaffScheduleMutation_(action, body, auth, requestId);
    else
      mutationResult = littlelandStaffMutate_(action, body, auth, requestId);
    return littlelandSuccessResponse_(
      mutationResult,
      requestId,
      "操作已記錄",
    );
  } finally {
    lock.releaseLock();
  }
}
function littlelandStaffTruthy_(v) {
  return v === true || String(v).toLowerCase() === "true";
}
function littlelandStaffReadAction_(action, body, auth) {
  var allowed = [
    "staff.dashboard",
    "staff.bookings",
    "staff.calendar",
    "staff.bookingDetail",
    "staff.payments",
    "staff.followups",
    "staff.customers",
    "staff.revenue",
    "staff.schedules",
    "staff.availability",
  ];
  if (allowed.indexOf(action) < 0) return null;
  function readRecords(sheetName) {
    return littlelandReadTable_(sheetName).rows.map(function (row) {
      return row.record;
    });
  }
  var bookings = readRecords("Bookings");
  bookings.forEach(function (booking) {
    booking.checkinDate = littlelandSheetDateOnly_(booking.checkinDate);
    booking.checkoutDate = littlelandSheetDateOnly_(booking.checkoutDate);
  });
  var pets = null,
    payments = null,
    logs = null,
    roomConflictInventory = null,
    roomConflictInventoryLoaded = false,
    roomConflictInventoryValid = true,
    roomAvailabilityCache = {};
  function getPets() {
    if (pets === null) pets = readRecords("Pets");
    return pets;
  }
  function getPayments() {
    if (payments === null) payments = readRecords("Payments");
    return payments;
  }
  function getLogs() {
    if (logs === null) logs = readRecords("Logs");
    return logs;
  }
  var adjustments = null,
    schedules = null,
    staffRows = null;
  function getAdjustments() {
    if (adjustments === null) adjustments = readRecords("BookingAdjustments");
    return adjustments;
  }
  function getSchedules() {
    if (schedules === null) schedules = readRecords("StaffSchedules");
    return schedules;
  }
  function getActiveStaff() {
    if (staffRows === null)
      staffRows = readRecords("Staff").filter(function (staff) {
        return littlelandStaffTruthy_(staff.isActive);
      }).map(function (staff) {
        return { staffId: staff.staffId, displayName: staff.displayName };
      });
    return staffRows;
  }
  var staffDirectory = null;
  function staffNameForLog(staffId) {
    if (!staffId) return "";
    if (staffDirectory === null) staffDirectory = readRecords("Staff");
    var match = staffDirectory.filter(function (staff) {
      return String(staff.staffId) === String(staffId);
    })[0];
    return match ? String(match.displayName || "") : "";
  }
  function ensureRoomConflictInventory() {
    if (roomConflictInventoryLoaded) return;
    roomConflictInventoryLoaded = true;
    try {
      var roomRows = readRecords("Rooms");
      littlelandValidateRoomMaster_(roomRows);
      roomConflictInventory = {
        bookings: bookings,
        occupying: littlelandBuildOccupancy_(bookings),
      };
    } catch (inventoryError) {
      roomConflictInventoryValid = false;
    }
  }
  function hasRoomConflict(b) {
    if (b.bookingStatus !== "PENDING_DEPOSIT") return false;
    ensureRoomConflictInventory();
    if (!roomConflictInventoryValid) return true;
    var checkin = littlelandSheetDateOnly_(b.checkinDate),
      checkout = littlelandSheetDateOnly_(b.checkoutDate),
      key = [b.roomTypeId, checkin, checkout].join("|");
    if (roomAvailabilityCache[key] === undefined) {
      try {
        roomAvailabilityCache[key] = littlelandAvailability_(
          {
            roomTypeId: b.roomTypeId,
            checkin: checkin,
            checkout: checkout,
          },
          roomConflictInventory,
        ).available;
      } catch (availabilityError) {
        roomAvailabilityCache[key] = false;
      }
    }
    return !roomAvailabilityCache[key];
  }
  function linkedPets(b) {
    return getPets().filter(function (p) {
      return String(p.bookingId) === String(b.bookingId);
    });
  }
  function card(b) {
    var names = linkedPets(b)
        .map(function (p) {
          return p.name;
        })
        .filter(Boolean),
      c = {};
    Object.keys(b).forEach(function (k) {
      c[k] = b[k];
    });
    c.customerName = b.parentName;
    c.bookingReference = littlelandDisplayBookingReference_(b.bookingId);
    c.petNames = names;
    c.petsSummary = names.join("、");
    if (b.bookingStatus === "PENDING_DEPOSIT")
      c.roomConflict = hasRoomConflict(b);
    try {
      c.allocatedRoomIds = JSON.parse(b.allocatedRoomIdsJson || "[]");
      if (!Array.isArray(c.allocatedRoomIds)) c.allocatedRoomIds = [];
    } catch (e) {
      c.allocatedRoomIds = [];
    }
    c.cashDepositRefundDue =
      ["COLLECTED", "PARTIALLY_USED"].indexOf(String(b.cashDepositStatus)) >= 0
        ? Math.max(
            0,
            Number(b.cashDepositCollectedAmount || b.cashDepositAmount || 0) -
              Number(b.cashDepositUsedAmount || 0) -
              Number(b.cashDepositRefundedAmount || 0),
          )
        : 0;
    return c;
  }
  function detail(id) {
    var b = bookings.filter(function (x) {
      return String(x.bookingId) === String(id);
    })[0];
    littlelandRequire_(!!b, "BOOKING_NOT_FOUND", "找不到預約。", false);
    var bookingCard = card(b);
    var bl = getLogs().filter(function (x) {
        return String(x.entityId) === String(id);
      }).map(function (log) {
        var snapshot = String(log.actorStaffNameSnapshot || "").trim();
        if (!snapshot && log.actorStaffId) snapshot = staffNameForLog(log.actorStaffId);
        return Object.assign({}, log, {
          actorStaffNameSnapshot: snapshot || String(log.actorStaffId || ""),
        });
      }),
      fh = bl
        .filter(function (x) {
          return String(x.action || "").indexOf("staff.followup") === 0;
        })
        .map(function (x) {
          return {
            time: x.createdAt,
            actorId: x.actorStaffId,
            staffName: x.actorStaffNameSnapshot,
            action: x.action,
            summary: String(x.summary || ""),
          };
        });
    return {
      booking: bookingCard,
      detail: bookingCard,
      pets: linkedPets(b),
      payments: getPayments().filter(function (x) {
        return String(x.bookingId) === String(id);
      }),
      logs: bl,
      followupHistory: fh,
      adjustments: getAdjustments().filter(function (x) {
        return String(x.bookingId) === String(id);
      }).map(function (entry) {
        return Object.assign({}, entry, {
          createdByStaffName: staffNameForLog(entry.createdByStaffId) || String(entry.createdByStaffId || ""),
        });
      }),
    };
  }
  if (action === "staff.availability") {
    var checkin = String(body.checkin || ""), checkout = String(body.checkout || ""), roomTypeId = String(body.roomTypeId || "");
    var pricingInput = { species: body.species, roomId: roomTypeId, checkin: checkin, checkout: checkout,
      quantity: Number(body.quantity || 1), services: [] };
    var pricing;
    try { pricing = LittleLandPricing.calculatePricing(pricingInput); }
    catch (e) { throw littlelandMapPricingError_(e); }
    var result = littlelandAvailability_({roomTypeId:roomTypeId, checkin:checkin, checkout:checkout}, littlelandReadInventory_());
    return { available: !!result.available, status: result.available ? "AVAILABLE" : "UNAVAILABLE", roomTypeId: roomTypeId, checkedAt: littlelandNowIso_() };
  }
  if (action === "staff.bookingDetail") return detail(body.bookingId);
  if (action === "staff.bookings") {
    var q = String(body.search || "").toLowerCase();
    return {
      bookings: bookings
        .filter(function (b) {
          var p = linkedPets(b),
            match =
              !q ||
              [
                b.bookingId,
                littlelandDisplayBookingReference_(b.bookingId),
                b.parentName,
                b.phone,
                b.email,
                b.checkinDate,
                b.checkoutDate,
                b.roomTypeId,
                b.bookingStatus,
              ]
                .join(" ")
                .toLowerCase()
                .indexOf(q) >= 0 ||
              p.some(function (x) {
                return (
                  String(x.name || "")
                    .toLowerCase()
                    .indexOf(q) >= 0
                );
              });
          return (
            match &&
            (!body.status || b.bookingStatus === body.status) &&
            (!body.roomTypeId || b.roomTypeId === body.roomTypeId) &&
            (!body.checkinDate || b.checkinDate === body.checkinDate) &&
            (!body.checkoutDate || b.checkoutDate === body.checkoutDate)
          );
        })
        .map(card),
    };
  }
  if (action === "staff.dashboard") {
    var today = Utilities.formatDate(
        new Date(),
        "Asia/Hong_Kong",
        "yyyy-MM-dd",
      ),
      counts = {
        todayCheckins: 0,
        todayCheckouts: 0,
        pendingConfirmation: 0,
        pendingDeposit: 0,
        confirmed: 0,
        followUp: 0,
      };
    bookings.forEach(function (b) {
      if (b.checkinDate === today) counts.todayCheckins++;
      if (b.checkoutDate === today) counts.todayCheckouts++;
      if (b.bookingStatus === "PENDING_CONFIRMATION")
        counts.pendingConfirmation++;
      if (b.bookingStatus === "PENDING_DEPOSIT") counts.pendingDeposit++;
      if (b.bookingStatus === "CONFIRMED") counts.confirmed++;
      if (littlelandStaffTruthy_(b.followUpRequired) || hasRoomConflict(b))
        counts.followUp++;
    });
    var roomConflicts = bookings
      .filter(hasRoomConflict)
      .map(function (b) {
        return { bookingId: b.bookingId, roomConflict: true };
      });
    var sorted = bookings.slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return {
      counts: counts,
      roomConflictsCount: roomConflicts.length,
      roomConflicts: roomConflicts,
      todaySchedule: bookings
        .filter(function (b) {
          return b.checkinDate === today || b.checkoutDate === today;
        })
        .map(card),
      recent: sorted.slice(0, 10).map(card),
      followups: bookings
        .filter(function (b) {
          return littlelandStaffTruthy_(b.followUpRequired) || hasRoomConflict(b);
        })
        .map(card),
      staffSchedules: getSchedules().filter(function (row) {
        return String(row.workDate) === today;
      }),
      staff: getActiveStaff(),
      monthRevenue: littlelandStaffRevenue_(
        { year: today.slice(0, 4) },
        bookings,
        getPayments(),
        getAdjustments(),
      ).monthly.filter(function (row) { return row.month === today.slice(0, 7); })[0],
    };
  }
  if (action === "staff.calendar") {
    var month = String(body.month || ""),
      first = month + "-01",
      d = new Date(first + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    var next = d.toISOString().slice(0, 10);
    return {
      month: month,
      bookings: bookings
        .filter(function (b) {
          return (
            String(b.checkinDate || "") < next &&
            String(b.checkoutDate || "") > first
          );
        })
        .map(card),
      staffSchedules: getSchedules().filter(function (row) {
        return String(row.workDate || "").slice(0, 7) === month;
      }).map(function (row) {
        return {
          date: littlelandSheetDateOnly_(row.workDate),
          staffId: row.staffId,
          displayName: row.staffNameSnapshot,
          status: row.status,
          shiftTime: [row.startTime, row.endTime].filter(Boolean).join("–"),
        };
      }),
      staff: getActiveStaff(),
    };
  }
  if (action === "staff.followups")
    return {
      bookings: bookings
        .filter(function (b) {
          return littlelandStaffTruthy_(b.followUpRequired) || hasRoomConflict(b);
        })
        .map(card),
    };
  if (action === "staff.payments") {
    var todayHK = Utilities.formatDate(
        new Date(),
        "Asia/Hong_Kong",
        "yyyy-MM-dd",
      ),
      s = {
        pendingDepositsTotal: 0,
        pendingBalancesTotal: 0,
        pendingCashDepositsTotal: 0,
        cashDepositsToRefundTotal: 0,
        receivedTodayTotal: 0,
      };
    bookings.forEach(function (b) {
      if (b.bookingStatus === "PENDING_DEPOSIT" && b.depositStatus !== "PAID")
        s.pendingDepositsTotal += Number(b.depositAmount || 0);
      if (b.bookingStatus === "CHECKED_IN" && b.balanceStatus !== "PAID")
        s.pendingBalancesTotal += Number(b.remainingBalance || 0);
      if (
        b.bookingStatus === "CHECKED_IN" &&
        b.cashDepositStatus === "NOT_COLLECTED"
      )
        s.pendingCashDepositsTotal += Number(b.cashDepositAmount || 0);
      if (
        ["CHECKED_OUT", "COMPLETED"].indexOf(b.bookingStatus) >= 0 &&
        ["COLLECTED", "PARTIALLY_USED"].indexOf(String(b.cashDepositStatus)) >= 0
      )
        s.cashDepositsToRefundTotal += Math.max(
          0,
          Number(b.cashDepositAmount || 0) -
            Number(b.cashDepositUsedAmount || 0) -
            Number(b.cashDepositRefundedAmount || 0),
        );
    });
    getPayments().forEach(function (p) {
      if (
        p.paymentStatus === "PAID" &&
        ["DEPOSIT", "BALANCE", "CASH_DEPOSIT"].indexOf(p.paymentType) >= 0 &&
        Utilities.formatDate(
          new Date(p.paidAt),
          "Asia/Hong_Kong",
          "yyyy-MM-dd",
        ) === todayHK
      )
        s.receivedTodayTotal += Number(p.amount || 0);
    });
    var items = bookings
      .filter(function (b) {
        return (
          (b.bookingStatus === "PENDING_DEPOSIT" && b.depositStatus !== "PAID") ||
          (b.bookingStatus === "CHECKED_IN" &&
            (b.balanceStatus !== "PAID" ||
              b.cashDepositStatus === "NOT_COLLECTED")) ||
          (["CHECKED_OUT", "COMPLETED"].indexOf(b.bookingStatus) >= 0 &&
            card(b).cashDepositRefundDue > 0)
        );
      })
      .map(card);
    return { summary: s, items: items, payments: getPayments() };
  }
  if (action === "staff.customers")
    return littlelandStaffCustomers_(body, bookings, getPets(), card);
  if (action === "staff.revenue")
    return littlelandStaffRevenue_(body, bookings, getPayments(), getAdjustments());
  if (action === "staff.schedules")
    return littlelandStaffSchedules_(body, getSchedules(), getActiveStaff());
  return null;
}
function littlelandStaffNormalizePhone_(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (digits.indexOf("00852") === 0 && digits.length === 13)
    digits = digits.slice(5);
  else if (digits.indexOf("852") === 0 && digits.length === 11)
    digits = digits.slice(3);
  return digits;
}
function littlelandDisplayBookingReference_(bookingId) {
  var value = String(bookingId || ""),
    match = value.match(/^TEST-LL-\d{8}-([A-Z0-9]{8})$/i);
  return match ? match[1].toUpperCase() : value;
}
function littlelandStaffCustomers_(body, bookings, pets, card) {
  var rawSearch = String(body.search || "").trim(),
    term = littlelandStaffNormalizePhone_(rawSearch),
    groups = {};
  bookings.forEach(function (booking) {
    var phone = littlelandStaffNormalizePhone_(booking.phone),
      key = phone ? "phone:" + phone : "booking:" + booking.bookingId,
      group = groups[key] || (groups[key] = {
        name: booking.parentName,
        phone: booking.phone,
        phoneNormalized: phone,
        email: booking.email,
        latestCreatedAt: String(booking.createdAt || ""),
        pets: {},
        species: {},
        bookings: [],
      });
    if (String(booking.createdAt || "") >= group.latestCreatedAt) {
      group.name = booking.parentName;
      group.phone = booking.phone;
      group.email = booking.email;
      group.latestCreatedAt = String(booking.createdAt || "");
    }
    group.bookings.push(card(booking));
    pets.filter(function (pet) {
      return String(pet.bookingId) === String(booking.bookingId);
    }).forEach(function (pet) {
      var petName = String(pet.name || "").trim(),
        species = String(booking.species || "");
      if (petName) group.pets[species + "|" + petName] = petName;
      if (species) group.species[species] = true;
    });
  });
  var customers = Object.keys(groups).map(function (key) {
    var group = groups[key],
      petNames = Object.keys(group.pets).map(function (petKey) {
        return group.pets[petKey];
      });
    return {
      name: group.name,
      phone: group.phone,
      phoneNormalized: group.phoneNormalized,
      email: group.email,
      petNames: petNames,
      petCount: petNames.length,
      species: Object.keys(group.species),
      bookings: group.bookings,
      bookingCount: group.bookings.length,
    };
  }).filter(function (customer) {
    if (!rawSearch) return true;
    return !!term && customer.phoneNormalized.indexOf(term) >= 0;
  }).sort(function (a, b) {
    return String(a.phoneNormalized || a.phone).localeCompare(
      String(b.phoneNormalized || b.phone),
    );
  });
  return { customers: customers };
}
function littlelandStaffHkMonth_(value) {
  if (value instanceof Date && !isNaN(value.getTime()))
    return Utilities.formatDate(value, "Asia/Hong_Kong", "yyyy-MM-dd").slice(0, 7);
  var text = String(value || ""),
    dateOnly = text.match(/^(\d{4}-\d{2})-\d{2}$/);
  if (dateOnly) return dateOnly[1];
  if (!text) return "";
  var date = new Date(text);
  return isNaN(date.getTime())
    ? ""
    : Utilities.formatDate(date, "Asia/Hong_Kong", "yyyy-MM-dd").slice(0, 7);
}
function littlelandStaffMoney_(value) {
  var amount = Number(value || 0);
  return isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}
function littlelandStaffNightsInMonth_(checkin, checkout, month) {
  var parts = String(month || "").split("-").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return 0;
  var monthStart = Date.UTC(parts[0], parts[1] - 1, 1),
    monthEnd = Date.UTC(parts[0], parts[1], 1),
    stayStart = Date.parse(String(checkin || "") + "T00:00:00Z"),
    stayEnd = Date.parse(String(checkout || "") + "T00:00:00Z");
  if (!isFinite(stayStart) || !isFinite(stayEnd) || stayEnd <= stayStart)
    return 0;
  return Math.max(
    0,
    Math.floor((Math.min(monthEnd, stayEnd) - Math.max(monthStart, stayStart)) / 86400000),
  );
}
function littlelandStaffSchedules_(body, schedules, staff) {
  var month = String(body.month || "").slice(0, 7);
  return {
    month: month,
    staff: staff,
    schedules: schedules.filter(function (row) {
      return !month || String(row.workDate || "").slice(0, 7) === month;
    }),
  };
}
function littlelandStaffRevenue_(body, bookings, payments, adjustments) {
  var currentMonth = Utilities.formatDate(new Date(), "Asia/Hong_Kong", "yyyy-MM-dd").slice(0, 7),
    requestedMonth = String(body.month || currentMonth).slice(0, 7),
    year = String(body.year || requestedMonth.slice(0, 4) || currentMonth.slice(0, 4));
  if (!/^\d{4}$/.test(year))
    throw littlelandApiError_("VALIDATION_FAILED", "營收年份格式不正確。", false);
  var months = [],
    byMonth = {},
    bookingById = {},
    adjustmentsByBooking = {},
    bookedStatuses = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"],
    occupancyStatuses = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"];
  for (var monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
    var monthKey = year + "-" + (monthNumber < 10 ? "0" : "") + monthNumber;
    byMonth[monthKey] = {
      month: monthKey,
      accommodationRevenue: 0,
      bookedRevenue: 0,
      collected: 0,
      deposits: 0,
      balances: 0,
      surcharges: 0,
      refunds: 0,
      occupancyNights: 0,
      confirmedBookings: 0,
    };
    months.push(byMonth[monthKey]);
  }
  bookings.forEach(function (booking) {
    bookingById[String(booking.bookingId)] = booking;
  });
  adjustments.forEach(function (entry) {
    var type = String(entry.type || "").toUpperCase(),
      status = String(entry.status || "").toUpperCase(),
      bookingId = String(entry.bookingId || "");
    if (type === "SURCHARGE" && ["ACTIVE", "PAID", "REVERSED"].indexOf(status) < 0) return;
    if (type === "REVERSAL" && ["ACTIVE", "PAID", "RECORDED"].indexOf(status) < 0) return;
    if (["SURCHARGE", "REVERSAL"].indexOf(type) < 0) return;
    adjustmentsByBooking[bookingId] =
      (adjustmentsByBooking[bookingId] || 0) + Number(entry.amount || 0);
  });
  var byRoomType = {},
    bySpecies = {};
  bookings.forEach(function (booking) {
    var status = String(booking.bookingStatus || "").toUpperCase(),
      checkin = littlelandSheetDateOnly_(booking.checkinDate),
      checkout = littlelandSheetDateOnly_(booking.checkoutDate),
      month = String(checkin || "").slice(0, 7);
    if (bookedStatuses.indexOf(status) < 0 || !byMonth[month]) return;
    var amount = littlelandStaffMoney_(
        Number(booking.estimatedTotal || 0) +
          Number(adjustmentsByBooking[String(booking.bookingId)] || 0),
      ),
      item = byMonth[month],
      roomType = String(booking.roomTypeId || "未分類"),
      species = String(booking.species || "未分類");
    item.bookedRevenue += amount;
    item.accommodationRevenue = item.bookedRevenue;
    byRoomType[roomType] = byRoomType[roomType] || { name: roomType, amount: 0 };
    bySpecies[species] = bySpecies[species] || { name: species, amount: 0 };
    byRoomType[roomType].amount += amount;
    bySpecies[species].amount += amount;
    if (occupancyStatuses.indexOf(status) >= 0) {
      item.occupancyNights += littlelandStaffNightsInMonth_(checkin, checkout, month);
      item.confirmedBookings += 1;
    }
  });
  payments.forEach(function (payment) {
    var status = String(payment.paymentStatus || "").toUpperCase(),
      type = String(payment.paymentType || "").toUpperCase(),
      paidMonth = littlelandStaffHkMonth_(payment.paidAt),
      row = byMonth[paidMonth],
      amount = littlelandStaffMoney_(payment.amount);
    if (!row || status !== "PAID") return;
    if (type === "REFUND") row.refunds += amount;
    else if (type === "DEPOSIT") row.deposits += amount;
    else if (type === "BALANCE") row.balances += amount;
    else if (type === "ADJUSTMENT") row.surcharges += amount;
  });
  months.forEach(function (row) {
    row.bookedRevenue = littlelandStaffMoney_(row.bookedRevenue);
    row.accommodationRevenue = row.bookedRevenue;
    row.deposits = littlelandStaffMoney_(row.deposits);
    row.balances = littlelandStaffMoney_(row.balances);
    row.surcharges = littlelandStaffMoney_(row.surcharges);
    row.refunds = littlelandStaffMoney_(row.refunds);
    row.collected = littlelandStaffMoney_(
      row.deposits + row.balances + row.surcharges - row.refunds,
    );
  });
  var selected = byMonth[requestedMonth] || byMonth[year + "-01"],
    annual = months.reduce(function (totals, row) {
      totals.bookedRevenue += row.bookedRevenue;
      totals.collected += row.collected;
      totals.deposits += row.deposits;
      totals.balances += row.balances;
      totals.surcharges += row.surcharges;
      totals.refunds += row.refunds;
      return totals;
    }, { bookedRevenue: 0, collected: 0, deposits: 0, balances: 0, surcharges: 0, refunds: 0 });
  return {
    year: year,
    month: requestedMonth,
    monthDepositsReceived: selected.deposits,
    monthBalancesReceived: selected.balances,
    monthSurchargesReceived: selected.surcharges,
    monthRefunds: selected.refunds,
    monthCollectedRevenue: selected.collected,
    monthAccommodationRevenue: selected.bookedRevenue,
    monthBookedRevenue: selected.bookedRevenue,
    monthOccupancyNights: selected.occupancyNights,
    annual: annual,
    byRoomType: Object.keys(byRoomType).map(function (key) { return byRoomType[key]; }),
    bySpecies: Object.keys(bySpecies).map(function (key) { return bySpecies[key]; }),
    monthly: months,
    months: months,
  };
}
function littlelandStaffCanonical_(v) {
  if (
    v === null ||
    typeof v === "string" ||
    typeof v === "boolean" ||
    typeof v === "number"
  )
    return JSON.stringify(v);
  if (Array.isArray(v))
    return "[" + v.map(littlelandStaffCanonical_).join(",") + "]";
  var keys = Object.keys(v).sort();
  return (
    "{" +
    keys
      .map(function (k) {
        return JSON.stringify(k) + ":" + littlelandStaffCanonical_(v[k]);
      })
      .join(",") +
    "}"
  );
}
function littlelandStaffMutate_(action, body, auth, requestId) {
  if (["staff.surchargeAdd", "staff.surchargeReverse", "staff.earlyCheckout", "staff.depositRefund", "staff.petCountUpdate"].indexOf(action) >= 0)
    return littlelandStaffAdjustmentMutation_(action, body, auth, requestId);

  var key = String(body.idempotencyKey || "");
  littlelandRequire_(
    key.length >= 8 && key.length <= 128,
    "VALIDATION_FAILED",
    "員工操作需要穩定 idempotencyKey。",
    false,
  );
  var hash = littlelandStaffHash_(
    littlelandStaffCanonical_({
      action: action,
      bookingId: body.bookingId,
      expectedRecordVersion: body.expectedRecordVersion,
      expectedStatus: body.expectedStatus,
      data: body.data || {},
      reason: body.reason || "",
    }),
  );
  var prior = littlelandReadTable_("IdempotencyKeys").rows.filter(function (r) {
    return r.record.idempotencyKey === key;
  });
  if (prior.length) {
    littlelandRequire_(
      prior.length === 1,
      "IDEMPOTENCY_RECONCILIATION_REQUIRED",
      "操作 key 存在多筆紀錄，請先人工核對。",
      false,
    );
    var p = prior[0].record;
    littlelandRequire_(
      p.operation === action && p.payloadHash === hash,
      "DUPLICATE_REQUEST",
      "操作 key 已用於不同資料。",
      false,
    );
    if (p.state === "COMPLETED") return JSON.parse(p.responseSnapshotJson).data;
    throw littlelandApiError_(
      "DUPLICATE_REQUEST",
      "此操作曾開始處理，須人工核對。",
      false,
    );
  }
  var table = littlelandReadTable_("Bookings"),
    hits = table.rows.filter(function (r) {
      return String(r.record.bookingId) === String(body.bookingId);
    });
  littlelandRequire_(
    hits.length === 1,
    "BOOKING_NOT_FOUND",
    "找不到預約。",
    false,
  );
  var row = hits[0],
    b = row.record;
  littlelandRequire_(
    Number(b.recordVersion) === Number(body.expectedRecordVersion) &&
      String(b.bookingStatus) === String(body.expectedStatus),
    "BOOKING_VERSION_CONFLICT",
    "預約資料已更新，請重新載入。",
    false,
  );
  var now = littlelandNowIso_(),
    updates = { updatedAt: now, recordVersion: Number(b.recordVersion) + 1 },
    payment = null,
    logAction = action,
    inventory = null,
    allocated = null,
    petEdits = null;
  var transitions = {
    "staff.confirmData": ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"],
    "staff.checkIn": ["CONFIRMED", "CHECKED_IN"],
    "staff.checkOut": ["CHECKED_IN", "CHECKED_OUT"],
    "staff.complete": ["CHECKED_OUT", "COMPLETED"],
  };
  if (action === "staff.confirmData") {
    var pendingAllocation;
    try {
      pendingAllocation = JSON.parse(String(b.allocatedRoomIdsJson || "[]"));
    } catch (error) {
      pendingAllocation = null;
    }
    littlelandRequire_(
      Array.isArray(pendingAllocation) && pendingAllocation.length === 0,
      "ROOM_INVALID_ALLOCATION",
      "待確認預約必須保持空房間分配，請先人工核對資料。",
      false,
    );
    updates.allocatedRoomIdsJson = "[]";
  }
  if (action === "staff.confirmDeposit") {
    littlelandRequire_(
      b.bookingStatus === "PENDING_DEPOSIT" &&
        (b.depositStatus === "UNPAID" || b.depositStatus === "PAID"),
      "BOOKING_STATUS_INVALID",
      "只有待付訂金的預約可確認。",
      false,
    );
    var priorDepositPayments = littlelandReadTable_("Payments").rows.filter(
      function (paymentRow) {
        return (
          String(paymentRow.record.bookingId) === String(b.bookingId) &&
          paymentRow.record.paymentType === "DEPOSIT" &&
          paymentRow.record.paymentStatus === "PAID"
        );
      },
    );
    if (b.depositStatus === "PAID") {
      littlelandRequire_(
        priorDepositPayments.length === 1 &&
          Number(priorDepositPayments[0].record.amount) === Number(b.depositAmount),
        "PAYMENT_RECONCILIATION_REQUIRED",
        "已付訂金資料未能唯一核對，請先人工核對付款紀錄。",
        false,
      );
    } else {
      littlelandRequire_(
        priorDepositPayments.length === 0,
        "PAYMENT_RECONCILIATION_REQUIRED",
        "付款狀態與既有訂金紀錄不一致，請先人工核對。",
        false,
      );
    }
    inventory = littlelandReadInventory_();
    allocated = littlelandAvailability_(
      {
        roomTypeId: b.roomTypeId,
        checkin: littlelandSheetDateOnly_(b.checkinDate),
        checkout: littlelandSheetDateOnly_(b.checkoutDate),
      },
      inventory,
    );
    if (b.depositStatus !== "PAID")
      payment = littlelandStaffPayment_(
        b,
        "DEPOSIT",
        Number(b.depositAmount),
        auth,
        now,
        body,
      );
  } else if (transitions[action])
    littlelandRequire_(
      b.bookingStatus === transitions[action][0],
      "BOOKING_STATUS_INVALID",
      "此預約狀態不允許該操作。",
      false,
    );
  else if (action === "staff.cancel")
    littlelandRequire_(
      String(body.reason || "").trim().length > 0 &&
        ["PENDING_CONFIRMATION", "PENDING_DEPOSIT", "CONFIRMED"].indexOf(
          b.bookingStatus,
        ) >= 0,
      "BOOKING_STATUS_INVALID",
      "取消需有效原因且目前狀態可取消。",
      false,
    );
  else if (action === "staff.recordBalance")
    littlelandRequire_(
      ["CHECKED_IN", "CHECKED_OUT", "COMPLETED"].indexOf(String(b.bookingStatus)) >= 0 &&
        Number(b.remainingBalance || 0) > 0,
      "BOOKING_STATUS_INVALID",
      "只有有應收尾數的入住／退房／完成預約可記錄尾數。",
      false,
    );
  else if (action === "staff.cashDepositCollect")
    littlelandRequire_(
      b.bookingStatus === "CHECKED_IN" &&
        b.cashDepositStatus === "NOT_COLLECTED",
      "BOOKING_STATUS_INVALID",
      "只可入住後收取未收現金按金。",
      false,
    );
  else if (
    action === "staff.cashDepositUse" ||
    action === "staff.cashDepositRefund"
  ) {
    var amount = Number((body.data || {}).amount);
    littlelandRequire_(
      amount > 0 &&
        b.cashDepositStatus !== "NOT_COLLECTED" &&
        b.cashDepositStatus !== "REFUNDED" &&
        amount <=
          Number(b.cashDepositCollectedAmount || b.cashDepositAmount || 0) -
            Number(b.cashDepositUsedAmount || 0) -
            Number(b.cashDepositRefundedAmount || 0),
      "BOOKING_STATUS_INVALID",
      "現金按金狀態或金額不允許此操作。",
      false,
    );
  } else if (action === "staff.followup")
    littlelandRequire_(
      String((body.data || {}).note || "").trim().length > 0,
      "VALIDATION_FAILED",
      "跟進備註不可為空。",
      false,
    );
  else if (action === "staff.edit") {
    var editData = body.data || {};
    if (Object.prototype.hasOwnProperty.call(editData, "pets")) {
      littlelandRequire_(Array.isArray(editData.pets), "VALIDATION_FAILED", "寵物資料格式不正確。", false);
      var petRows = littlelandReadTable_("Pets").rows.filter(function (r) {
        return String(r.record.bookingId) === String(b.bookingId);
      });
      littlelandRequire_(editData.pets.length === Number(b.quantity) && petRows.length === Number(b.quantity), "VALIDATION_FAILED", "寵物資料數量必須與預約數量一致。", false);
      var byPetId = {};
      petRows.forEach(function (r) {
        var id = String(r.record.petId || "");
        littlelandRequire_(!!id && !byPetId[id], "VALIDATION_FAILED", "寵物資料無法唯一核對。", false);
        byPetId[id] = r.record;
      });
      var seenPetIds = {}, normalizedPetEdits = [], petChangedFields = {};
      var petFieldMap = {
        name: "name", breed: "breed", ageValue: "ageValue", ageUnit: "ageUnit",
        sex: "sex", sterilized: "sterilized", pregnant: "pregnant",
        recentSurgery30Days: "recentSurgery30Days", vetVisit: "vetVisit", vetDetails: "vetDetails",
        infectiousDisease: "infectiousDisease", infectiousDetails: "infectiousDetails",
        chronicDisease: "chronicDisease", chronicDetails: "chronicDetails",
        medication: "medication", medicationDetails: "medicationDetails",
        specialCare: "specialCare", fleaTreatment: "fleaTreatment",
        ageInMonths: "ageInMonths", healthReviewStatus: "healthReviewStatus"
      };
      editData.pets.forEach(function (pet) {
        littlelandRequire_(littlelandIsObject_(pet) && typeof pet.petId === "string" && !!pet.petId, "VALIDATION_FAILED", "寵物資料格式不正確。", false);
        littlelandRequire_(littlelandKeysAllowed_(pet, ["petId"].concat(LITTLELAND_PET_KEYS)), "VALIDATION_FAILED", "寵物資料含不支援欄位。", false);
        var id = pet.petId;
        littlelandRequire_(!!byPetId[id] && !seenPetIds[id], "VALIDATION_FAILED", "寵物資料無法唯一核對。", false);
        seenPetIds[id] = true;
        var petInput = {};
        LITTLELAND_PET_KEYS.forEach(function (field) {
          if (Object.prototype.hasOwnProperty.call(pet, field)) petInput[field] = pet[field];
        });
        var normalized = littlelandNormalizePet_(petInput, b.species, Number(byPetId[id].petNumber));
        var petUpdate = {};
        Object.keys(petFieldMap).forEach(function (field) {
          var storedField = petFieldMap[field];
          if (String(byPetId[id][storedField] == null ? "" : byPetId[id][storedField]) !== String(normalized[field] == null ? "" : normalized[field])) {
            petUpdate[storedField] = normalized[field];
            (petChangedFields[id] || (petChangedFields[id] = [])).push(storedField);
          }
        });
        normalizedPetEdits.push({ petId: id, updates: petUpdate });
      });
      littlelandRequire_(Object.keys(seenPetIds).length === petRows.length, "VALIDATION_FAILED", "寵物資料數量必須與預約數量一致。", false);
      petEdits = { edits: normalizedPetEdits, changedFields: petChangedFields };
    }
    var allowed = [
      "checkinTime",
      "checkoutTime",
      "earlyCheckin",
      "lateCheckout",
      "parentName",
      "phone",
      "email",
      "emergency1",
      "emergency2",
      "vet",
      "foodMain",
      "hay",
      "feeding",
      "vegetables",
    ];
    Object.keys(editData).forEach(function (k) {
      littlelandRequire_(
        allowed.indexOf(k) >= 0 || k === "pets",
        "VALIDATION_FAILED",
        "不可編輯指定欄位。",
        false,
      );
    });
  } else
    throw littlelandApiError_(
      "VALIDATION_FAILED",
      "不支援的 Staff action。",
      false,
    );
  // Claim is deliberately delayed until every read/preflight/validation above succeeds.
  littlelandAppendRecord_("IdempotencyKeys", {
    idempotencyKey: key,
    operation: action,
    payloadHash: hash,
    state: "PROCESSING",
    bookingId: String(body.bookingId || ""),
    requestId: requestId,
    responseCode: "",
    responseSnapshotJson: "",
    createdAt: now,
    updatedAt: now,
  });
  if (action === "staff.confirmDeposit") {
    if (payment) {
      littlelandAppendRecord_("Payments", payment);
      updates.depositStatus = "PAID";
    }
    if (allocated.available) {
      updates.allocatedRoomIdsJson = JSON.stringify(allocated.roomIds);
      updates.bookingStatus = "CONFIRMED";
      updates.followUpRequired = false;
      updates.followUpNote = "";
    } else {
      updates.allocatedRoomIdsJson = "[]";
      updates.followUpRequired = true;
      updates.followUpNote = "已收訂金但房態衝突，需人工跟進。";
    }
    littlelandUpdateRecordByKey_("Bookings", "bookingId", b.bookingId, updates);
    littlelandStaffWriteLog_(
      auth,
      b,
      requestId,
      action,
      allocated.available
        ? "訂金已收及房間已確認。"
        : "已收訂金但無合法房間，保留待付訂金並需跟進。",
      { depositStatus: "PAID", confirmed: allocated.available },
    );
    return littlelandStaffFinishMutation_(key, requestId, b.bookingId, {
      bookingId: b.bookingId,
      confirmed: allocated.available,
      roomConflict: !allocated.available,
      status: allocated.available ? "CONFIRMED" : "PENDING_DEPOSIT",
      detail: littlelandStaffFreshBooking_(b.bookingId),
    });
  }
  if (transitions[action]) updates.bookingStatus = transitions[action][1];
  else if (action === "staff.cancel") {
    updates.bookingStatus = "CANCELLED";
    updates.followUpRequired = true;
    updates.followUpNote = "取消原因：" + String(body.reason).trim();
  } else if (action === "staff.recordBalance") {
    payment = littlelandStaffPayment_(
      b,
      "BALANCE",
      Number(b.remainingBalance),
      auth,
      now,
      body,
    );
    littlelandAppendRecord_("Payments", payment);
    updates.balanceStatus = "PAID";
  } else if (action === "staff.cashDepositCollect") {
    payment = littlelandStaffPayment_(
      b,
      "CASH_DEPOSIT",
      Number(b.cashDepositAmount),
      auth,
      now,
      body,
    );
    littlelandAppendRecord_("Payments", payment);
    updates.cashDepositStatus = "COLLECTED";
    updates.cashDepositCollected = true;
    updates.cashDepositCollectedAt = now;
    updates.cashDepositCollectedAmount = Number(b.cashDepositAmount);
  } else if (
    action === "staff.cashDepositUse" ||
    action === "staff.cashDepositRefund"
  ) {
    var a = Number((body.data || {}).amount),
      used = Number(b.cashDepositUsedAmount || 0),
      refunded = Number(b.cashDepositRefundedAmount || 0);
    payment = littlelandStaffPayment_(
      b,
      action === "staff.cashDepositUse"
        ? "CASH_DEPOSIT_USE"
        : "CASH_DEPOSIT_REFUND",
      a,
      auth,
      now,
      body,
    );
    littlelandAppendRecord_("Payments", payment);
    if (action === "staff.cashDepositUse") {
      updates.cashDepositUsedAmount = used + a;
      updates.cashDepositStatus = "PARTIALLY_USED";
    } else {
      updates.cashDepositRefundedAmount = refunded + a;
      updates.cashDepositRefundedAt = now;
      updates.cashDepositStatus =
        refunded + a + used >= Number(b.cashDepositAmount)
          ? "REFUNDED"
          : "PARTIALLY_USED";
    }
  } else if (action === "staff.followup") {
    updates.followUpRequired = (body.data || {}).required !== false;
    updates.lastContactedAt = now;
    updates.lastContactedBy = auth.staff.displayName;
    updates.followUpNote = String(body.data.note).trim();
  } else if (action === "staff.edit") {
    var editable = [
      "checkinTime",
      "checkoutTime",
      "earlyCheckin",
      "lateCheckout",
      "parentName",
      "phone",
      "email",
      "emergency1",
      "emergency2",
      "vet",
      "foodMain",
      "hay",
      "feeding",
      "vegetables",
    ];
    Object.keys(body.data || {}).forEach(function (k) {
      if (editable.indexOf(k) >= 0)
        updates[k] = littlelandSafeSheetValue_(body.data[k]);
    });
    if (petEdits) {
      petEdits.edits.forEach(function (edit) {
        if (Object.keys(edit.updates).length)
          littlelandUpdateRecordByKey_("Pets", "petId", edit.petId, edit.updates);
      });
    }
  }
  littlelandUpdateRecordByKey_("Bookings", "bookingId", b.bookingId, updates);
  var changedLog = {
    bookingStatus: updates.bookingStatus || b.bookingStatus,
    recordVersion: updates.recordVersion,
  };
  if (petEdits) {
    changedLog.petIds = Object.keys(petEdits.changedFields);
    changedLog.petChangedFieldNames = petEdits.changedFields;
  }
  littlelandStaffWriteLog_(auth, b, requestId, action, "員工操作已記錄。", changedLog);
  return littlelandStaffFinishMutation_(key, requestId, b.bookingId, {
    bookingId: b.bookingId,
    status: updates.bookingStatus || b.bookingStatus,
    detail: littlelandStaffFreshBooking_(b.bookingId),
  });
}
function littlelandStaffFreshBooking_(id) {
  var rows = littlelandReadTable_("Bookings").rows.filter(function (r) {
    return String(r.record.bookingId) === String(id);
  });
  return rows.length ? rows[0].record : null;
}
function littlelandStaffPayment_(b, type, amount, auth, now, body) {
  return {
    paymentId: "PAY-" + Utilities.getUuid(),
    bookingId: b.bookingId,
    paymentType: type,
    amount: amount,
    currency: "HKD",
    paymentStatus: "PAID",
    paymentMethod: String((body.data || {}).method || ""),
    transactionReference: String((body.data || {}).reference || ""),
    paidAt: now,
    recordedByStaffId: auth.staff.staffId,
    refundAmount: 0,
    refundedAt: "",
    note: "",
    createdAt: now,
  };
}
function littlelandStaffWriteLog_(
  auth,
  b,
  requestId,
  action,
  summary,
  changed,
) {
  littlelandAppendRecord_("Logs", {
    logId: "STAFF-" + Utilities.getUuid(),
    createdAt: littlelandNowIso_(),
    actorType: "STAFF",
    actorStaffId: auth.staff.staffId,
    actorStaffNameSnapshot: auth.staff.displayName,
    action: action,
    entityType: "BOOKING",
    entityId: b.bookingId,
    requestId: requestId,
    summary: summary,
    changedFieldsJson: JSON.stringify(changed),
  });
}
function littlelandStaffFinishMutation_(key, requestId, bookingId, data) {
  var compact = {};
  ["bookingId", "status", "confirmed", "roomConflict"].forEach(function (k) {
    if (data[k] !== undefined) compact[k] = data[k];
  });
  var snapshot = { data: compact };
  littlelandUpdateRecordByKey_("IdempotencyKeys", "idempotencyKey", key, {
    state: "COMPLETED",
    responseCode: "OK",
    responseSnapshotJson: JSON.stringify(snapshot),
    requestId: requestId,
    bookingId: bookingId,
    updatedAt: littlelandNowIso_(),
  });
  return data;
}

function littlelandStaffIdempotency_(action, body) {
  var key=String(body.idempotencyKey||"");
  littlelandRequire_(key.length>=8 && key.length<=128,"VALIDATION_FAILED","員工操作需要穩定 idempotencyKey。",false);
  var hash=littlelandStaffHash_(littlelandStaffCanonical_({action:action,bookingId:body.bookingId||"",expectedRecordVersion:body.expectedRecordVersion==null?null:body.expectedRecordVersion,
    expectedStatus:body.expectedStatus||"",data:body.data||{},reason:body.reason||"",schedule:body.schedule||{}}));
  var rows=littlelandReadTable_("IdempotencyKeys").rows.filter(function(x){return String(x.record.idempotencyKey)===key;});
  if(rows.length){littlelandRequire_(rows.length===1,"IDEMPOTENCY_RECONCILIATION_REQUIRED","操作 key 存在多筆紀錄。",false);var prev=rows[0].record;
    littlelandRequire_(prev.operation===action&&prev.payloadHash===hash,"DUPLICATE_REQUEST","操作 key 已用於不同資料。",false);
    if(prev.state==="COMPLETED")return JSON.parse(prev.responseSnapshotJson).data;
    throw littlelandApiError_("DUPLICATE_REQUEST","此操作曾開始處理，須人工核對。",false);
  }
  return {key:key,hash:hash};
}
function littlelandStaffClaim_(claim,action,body,requestId,now){
  littlelandAppendRecord_("IdempotencyKeys",{idempotencyKey:claim.key,operation:action,payloadHash:claim.hash,state:"PROCESSING",bookingId:String(body.bookingId||""),requestId:requestId,responseCode:"",responseSnapshotJson:"",createdAt:now,updatedAt:now});
}
function littlelandStaffFinish_(claim,action,body,auth,requestId,now,data,entityType,entityId,changed){
  littlelandStaffWriteLog_(auth,{bookingId:String(body.bookingId||entityId||"")},requestId,action,"員工操作已記錄。",changed||{});
  littlelandUpdateRecordByKey_("IdempotencyKeys","idempotencyKey",claim.key,{state:"COMPLETED",responseCode:"OK",responseSnapshotJson:JSON.stringify({data:data}),requestId:requestId,updatedAt:now});
  littlelandClearAvailabilityCache_(); return data;
}
function littlelandStaffCreateBooking_(body,auth,requestId){
  var request=body.request||body.data||{};
  var validated=littlelandValidateBookingRequest_(request), hash=littlelandPayloadHash_(validated), key=validated.idempotencyKey;
  var existing=littlelandReadTable_("IdempotencyKeys").rows.filter(function(x){return String(x.record.idempotencyKey)===key;});
  if(existing.length){littlelandRequire_(existing.length===1,"IDEMPOTENCY_RECONCILIATION_REQUIRED","操作 key 存在多筆紀錄。",false);var e=existing[0].record;
    littlelandRequire_(e.operation==="CREATE_BOOKING"&&e.payloadHash===hash,"DUPLICATE_REQUEST","操作 key 已用於不同資料。",false);
    if(e.state==="COMPLETED")return JSON.parse(e.responseSnapshotJson).data;
    throw littlelandApiError_("DUPLICATE_REQUEST","此操作曾開始處理，須人工核對。",false);}
  var pricing;try{pricing=LittleLandPricing.calculatePricing(validated.pricingInput);}catch(err){throw littlelandMapPricingError_(err);}
  littlelandAssertClientQuote_(validated.clientQuote,pricing);
  var inventory=littlelandReadInventory_(), availability=littlelandAvailability_({roomTypeId:validated.form.roomId,checkin:validated.form.checkin,checkout:validated.form.checkout},inventory);
  var now=littlelandNowIso_(), id=littlelandCreateBookingId_(inventory.bookings), claim={key:key,hash:hash};
  littlelandStaffClaim_(claim,"CREATE_BOOKING",{bookingId:id},requestId,now);
  var booking=littlelandBuildBookingRecord_(validated,pricing,id,now); booking.createdByStaffId=auth.staff.staffId;
  if(!availability.available){booking.followUpRequired=true;booking.followUpNote="員工建單時房態不可用，需人工跟進；申請仍未佔用房間。";}
  var pets=littlelandBuildPetRecords_(validated,id,now);
  littlelandAppendRecord_("Bookings",booking); pets.forEach(function(p){littlelandAppendRecord_("Pets",p);});
  var data={bookingId:id,bookingStatus:"PENDING_CONFIRMATION",allocatedRoomIds:[],followUpRequired:!availability.available,roomConflict:!availability.available};
  littlelandStaffWriteLog_(auth,{bookingId:id},requestId,"staff.createBooking","員工建立待確認預約。",{bookingStatus:"PENDING_CONFIRMATION",petCount:validated.form.quantity,roomTypeId:validated.form.roomId,roomConflict:!availability.available});
  littlelandUpdateRecordByKey_("IdempotencyKeys","idempotencyKey",key,{state:"COMPLETED",bookingId:id,responseCode:"OK",responseSnapshotJson:JSON.stringify({data:data}),requestId:requestId,updatedAt:now});
  littlelandClearAvailabilityCache_(); return data;
}
function littlelandStaffScheduleMutation_(action,body,auth,requestId){
  var claim=littlelandStaffIdempotency_(action,body);if(!claim.key)return claim;
  var d=body.data||body.schedule||{}, date=String(d.workDate||d.date||""), staffId=String(d.staffId||""), status=String(d.status||"WORK").toUpperCase();
  littlelandRequire_(littlelandIsIsoDate_(date)&&["WORK","REST"].indexOf(status)>=0,"VALIDATION_FAILED","排班日期或狀態無效。",false);
  var active=littlelandReadTable_("Staff").rows.filter(function(x){return String(x.record.staffId)===staffId&&littlelandStaffTruthy_(x.record.isActive);});
  littlelandRequire_(active.length===1,"VALIDATION_FAILED","只能指派有效員工。",false);
  var rows=littlelandReadTable_("StaffSchedules").rows.map(function(x){return x.record;}), now=littlelandNowIso_();
  if(action==="staff.scheduleSwap"){
    var target=String(d.targetStaffId||d.toStaffId||"");
    var targetRows=littlelandReadTable_("Staff").rows.filter(function(x){return String(x.record.staffId)===target&&littlelandStaffTruthy_(x.record.isActive);});
    littlelandRequire_(target&&target!==staffId&&targetRows.length===1,"VALIDATION_FAILED","交換對象必須是另一位有效員工。",false);
    var src=rows.filter(function(x){return String(x.workDate)===date&&String(x.staffId)===staffId&&x.status==="WORK";})[0];
    littlelandRequire_(!!src,"VALIDATION_FAILED","找不到可交換的工作班次。",false);
    littlelandRequire_(!rows.some(function(x){return String(x.workDate)===date&&String(x.staffId)===target;}),"VALIDATION_FAILED","交換對象於該日期已有工作或休息安排。",false);
    littlelandStaffClaim_(claim,action,body,requestId,now);
    var id="SCH-"+Utilities.getUuid(); littlelandUpdateRecordByKey_("StaffSchedules","scheduleId",src.scheduleId,{staffId:target,staffNameSnapshot:targetRows[0].record.displayName,swapGroupId:id,swappedFromStaffId:staffId,updatedAt:now,updatedByStaffId:auth.staff.staffId,idempotencyKey:claim.key});
    var out={scheduleId:src.scheduleId,workDate:date,staffId:target,status:"WORK"}; littlelandStaffWriteLog_(auth,{bookingId:"SCHEDULE:"+date},requestId,action,"員工班次交換已記錄。",{scheduleId:src.scheduleId,workDate:date,fromStaffId:staffId,toStaffId:target});littlelandUpdateRecordByKey_("IdempotencyKeys","idempotencyKey",claim.key,{state:"COMPLETED",responseCode:"OK",responseSnapshotJson:JSON.stringify({data:out}),updatedAt:now,requestId:requestId});littlelandClearAvailabilityCache_();return out;
  }
  var existing=rows.filter(function(x){return String(x.workDate)===date&&String(x.staffId)===staffId;});
  littlelandRequire_(existing.length<=1,"SHEET_READ_FAILED","排班重複資料，請人工核對。",false);
  littlelandStaffClaim_(claim,action,body,requestId,now);
  var rec={scheduleId:existing.length?existing[0].scheduleId:"SCH-"+Utilities.getUuid(),workDate:date,staffId:staffId,staffNameSnapshot:active[0].record.displayName,status:status,startTime:status==="WORK"?String(d.startTime||""):"",endTime:status==="WORK"?String(d.endTime||""):"",swapGroupId:"",swappedFromStaffId:"",notes:String(d.notes||""),createdAt:existing.length?existing[0].createdAt:now,updatedAt:now,createdByStaffId:auth.staff.staffId,updatedByStaffId:auth.staff.staffId,idempotencyKey:claim.key};
  if(existing.length)littlelandUpdateRecordByKey_("StaffSchedules","scheduleId",rec.scheduleId,rec);else littlelandAppendRecord_("StaffSchedules",rec);
  var result={scheduleId:rec.scheduleId,workDate:date,staffId:staffId,status:status};littlelandStaffWriteLog_(auth,{bookingId:"SCHEDULE:"+date},requestId,action,"員工排班已記錄。",{scheduleId:rec.scheduleId,workDate:date,staffId:staffId,status:status});littlelandUpdateRecordByKey_("IdempotencyKeys","idempotencyKey",claim.key,{state:"COMPLETED",responseCode:"OK",responseSnapshotJson:JSON.stringify({data:result}),updatedAt:now,requestId:requestId});littlelandClearAvailabilityCache_();return result;
}
function littlelandStaffAdjustmentMutation_(action, body, auth, requestId) {
  var claim = littlelandStaffIdempotency_(action, body);
  if (!claim.key) return claim;

  var hits = littlelandReadTable_("Bookings").rows.filter(function (row) {
    return String(row.record.bookingId) === String(body.bookingId);
  });
  littlelandRequire_(hits.length === 1, "BOOKING_NOT_FOUND", "找不到預約。", false);
  var b = hits[0].record;
  littlelandRequire_(
    Number(b.recordVersion) === Number(body.expectedRecordVersion) &&
      String(b.bookingStatus) === String(body.expectedStatus),
    "BOOKING_VERSION_CONFLICT",
    "預約資料已更新，請重新載入。",
    false,
  );

  var d = body.data || {};
  var now = littlelandNowIso_();
  var update = { updatedAt: now, recordVersion: Number(b.recordVersion) + 1 };
  var reason = String(d.reason || body.reason || "").trim();
  var desc = String(d.description || "").trim();
  var entries = littlelandReadTable_("BookingAdjustments").rows.map(function (row) {
    return row.record;
  });
  var payments = littlelandReadTable_("Payments").rows.map(function (row) {
    return row.record;
  });
  var createdAdjustments = [];
  var payment = null;
  var type = "";
  var amount = 0;
  var source = null;
  var settlement = null;

  if (action === "staff.earlyCheckout") {
    littlelandRequire_(b.bookingStatus === "CHECKED_IN", "BOOKING_STATUS_INVALID", "只有已入住預約可提早退房。", false);
    var actual = String(d.actualCheckoutDate || "");
    littlelandRequire_(
      littlelandIsIsoDate_(actual) && actual >= littlelandSheetDateOnly_(b.checkinDate) && actual <= littlelandSheetDateOnly_(b.checkoutDate),
      "VALIDATION_FAILED",
      "實際退房日期必須介乎入住日與原定退房日。",
      false,
    );
    if (actual < littlelandSheetDateOnly_(b.checkoutDate)) {
      littlelandRequire_(reason !== "", "VALIDATION_FAILED", "提早退房需填寫原因。", false);
      type = "EARLY_CHECKOUT";
      desc = desc || "提早退房";
      createdAdjustments.push({
        adjustmentId: "ADJ-" + Utilities.getUuid(),
        bookingId: b.bookingId,
        type: type,
        description: desc,
        amount: 0,
        currency: "HKD",
        status: "RECORDED",
        sourcePaymentId: "",
        paymentId: "",
        reason: reason,
        effectiveDate: actual,
        reversesAdjustmentId: "",
        createdAt: now,
        updatedAt: now,
        createdByStaffId: auth.staff.staffId,
        updatedByStaffId: auth.staff.staffId,
        idempotencyKey: claim.key,
      });
    }
    update.bookingStatus = "CHECKED_OUT";
    update.actualCheckoutDate = actual;
  } else if (action === "staff.surchargeAdd") {
    littlelandRequire_(b.bookingStatus !== "CANCELLED", "BOOKING_STATUS_INVALID", "已取消預約不可更改費用。", false);
    littlelandRequire_(desc !== "" && reason !== "", "VALIDATION_FAILED", "附加費需填寫說明及原因。", false);
    amount = littlelandStaffMoney_(Number(d.amount));
    littlelandRequire_(isFinite(amount) && amount !== 0, "VALIDATION_FAILED", "金額不可為零且必須是有效數值。", false);
    type = "SURCHARGE";

    var requestedPetIds = Array.isArray(d.petIds) ? d.petIds.map(String) : [];
    littlelandRequire_(new Set(requestedPetIds).size === requestedPetIds.length, "VALIDATION_FAILED", "不可重複選擇同一隻寵物。", false);
    var petRows = littlelandReadTable_("Pets").rows.map(function (row) { return row.record; }).filter(function (pet) {
      return String(pet.bookingId) === String(b.bookingId) && ["", "ACTIVE", "STAYING"].indexOf(String(pet.petStatus || "").toUpperCase()) >= 0;
    });
    var targetPets = requestedPetIds.length ? petRows.filter(function (pet) {
      return requestedPetIds.indexOf(String(pet.petId)) >= 0;
    }) : [];
    littlelandRequire_(!requestedPetIds.length || targetPets.length === requestedPetIds.length, "VALIDATION_FAILED", "部分指定寵物不存在或已移除。", false);
    var targets = targetPets.length ? targetPets : [null];
    var groupId = targets.length > 1 ? "ADJG-" + Utilities.getUuid() : "";
    targets.forEach(function (pet) {
      var lineAmount = littlelandStaffMoney_(amount);
      var id = "ADJ-" + Utilities.getUuid();
      var line = {
        adjustmentId: id,
        bookingId: b.bookingId,
        type: "SURCHARGE",
        description: desc,
        amount: lineAmount,
        currency: "HKD",
        status: "ACTIVE",
        sourcePaymentId: "",
        paymentId: "",
        reason: reason,
        effectiveDate: "",
        reversesAdjustmentId: "",
        createdAt: now,
        updatedAt: now,
        createdByStaffId: auth.staff.staffId,
        updatedByStaffId: auth.staff.staffId,
        idempotencyKey: claim.key,
        petId: pet ? String(pet.petId) : "",
        petNameSnapshot: pet ? String(pet.name || "") : "",
        groupId: groupId,
      };
      createdAdjustments.push(line);
    });
    amount = littlelandStaffMoney_(amount * targets.length);
    settlement = littlelandStaffBalanceAfterChange_(b, Number(b.estimatedTotal || 0), payments, entries.concat(createdAdjustments), update);
  } else if (action === "staff.surchargeReverse") {
    littlelandRequire_(b.bookingStatus !== "CANCELLED", "BOOKING_STATUS_INVALID", "已取消預約不可更改費用。", false);
    var originals = entries.filter(function (entry) {
      return String(entry.adjustmentId) === String(d.adjustmentId) &&
        String(entry.bookingId) === String(b.bookingId) && entry.type === "SURCHARGE";
    });
    littlelandRequire_(originals.length === 1, "VALIDATION_FAILED", "找不到唯一附加費紀錄。", false);
    source = originals[0];
    var openAdjustmentAmount = littlelandStaffAdjustmentOpenAmount_(source, entries);
    littlelandRequire_(isFinite(openAdjustmentAmount) && Math.abs(openAdjustmentAmount) >= 0.01, "BOOKING_STATUS_INVALID", "此附加費已全數更正或不能撤銷。", false);
    reason = String(d.reason || body.reason || "").trim();
    littlelandRequire_(reason !== "", "VALIDATION_FAILED", "撤銷需填寫原因。", false);
    type = "REVERSAL";
    amount = littlelandStaffMoney_(-openAdjustmentAmount);
    desc = "撤銷：" + String(source.description || "附加費");
    var reversal = {
      adjustmentId: "ADJ-" + Utilities.getUuid(),
      bookingId: b.bookingId,
      type: type,
      description: desc,
      amount: amount,
      currency: "HKD",
      status: "RECORDED",
      sourcePaymentId: "",
      paymentId: "",
      reason: reason,
      effectiveDate: "",
      reversesAdjustmentId: source.adjustmentId,
      createdAt: now,
      updatedAt: now,
      createdByStaffId: auth.staff.staffId,
      updatedByStaffId: auth.staff.staffId,
      idempotencyKey: claim.key,
      petId: source.petId || "",
      petNameSnapshot: source.petNameSnapshot || "",
      groupId: source.groupId || "",
    };
    createdAdjustments.push(reversal);
    update.remainingBalance = undefined;
    settlement = littlelandStaffBalanceAfterChange_(b, Number(b.estimatedTotal || 0), payments, entries.concat(createdAdjustments), update);
  } else if (action === "staff.depositRefund") {
    littlelandRequire_(d.confirmRefund === true, "VALIDATION_FAILED", "退款必須由員工明確確認已在系統外完成。", false);
    amount = littlelandStaffMoney_(Number(d.amount));
    reason = String(d.reason || "").trim();
    var paymentId = String(d.sourcePaymentId || "");
    littlelandRequire_(isFinite(amount) && amount > 0 && reason !== "", "VALIDATION_FAILED", "退款金額須大於零並提供原因。", false);
    var found = payments.filter(function (candidate) {
      return String(candidate.paymentId) === paymentId &&
        String(candidate.bookingId) === String(b.bookingId) &&
        ["DEPOSIT", "BALANCE", "ADJUSTMENT"].indexOf(String(candidate.paymentType)) >= 0 &&
        candidate.paymentStatus === "PAID";
    });
    littlelandRequire_(found.length === 1, "PAYMENT_RECONCILIATION_REQUIRED", "找不到唯一已收住宿付款。", false);
    source = found[0];
    var refundedFromLedger = payments.filter(function (candidate) {
      return candidate.paymentType === "REFUND" && String(candidate.bookingId) === String(b.bookingId) &&
        (String(candidate.transactionReference) === paymentId || String(candidate.sourcePaymentId) === paymentId);
    }).reduce(function (sum, candidate) { return sum + Number(candidate.amount || 0); }, 0);
    var refunded = Math.max(Number(source.refundAmount || 0), refundedFromLedger);
    littlelandRequire_(amount <= littlelandStaffMoney_(Number(source.amount) - refunded), "BOOKING_STATUS_INVALID", "退款金額超過該筆住宿付款尚未退回的實收餘額。", false);
    type = "REFUND";
    payment = {
      paymentId: "PAY-" + Utilities.getUuid(),
      bookingId: b.bookingId,
      paymentType: "REFUND",
      amount: littlelandStaffMoney_(amount),
      currency: "HKD",
      paymentStatus: "PAID",
      paymentMethod: "MANUAL",
      transactionReference: source.paymentId,
      paidAt: now,
      recordedByStaffId: auth.staff.staffId,
      refundAmount: 0,
      refundedAt: "",
      note: reason,
      createdAt: now,
      sourcePaymentId: source.paymentId,
    };
    createdAdjustments.push({
      adjustmentId: "ADJ-" + Utilities.getUuid(),
      bookingId: b.bookingId,
      type: "REFUND",
      description: "人工部分退款：" + String(source.paymentType),
      amount: -littlelandStaffMoney_(amount),
      currency: "HKD",
      status: "RECORDED",
      sourcePaymentId: source.paymentId,
      paymentId: payment.paymentId,
      reason: reason,
      effectiveDate: "",
      reversesAdjustmentId: "",
      createdAt: now,
      updatedAt: now,
      createdByStaffId: auth.staff.staffId,
      updatedByStaffId: auth.staff.staffId,
      idempotencyKey: claim.key,
      petId: "",
      petNameSnapshot: "",
      groupId: "",
    });
    settlement = b.bookingStatus === "CANCELLED"
      ? null
      : littlelandStaffBalanceAfterChange_(b, Number(b.estimatedTotal || 0), payments.concat([payment]), entries.concat(createdAdjustments), update);
  } else if (action === "staff.petCountUpdate") {
    littlelandRequire_(b.bookingStatus !== "CANCELLED", "BOOKING_STATUS_INVALID", "已取消預約不可更改入住寵物。", false);
    littlelandRequire_(reason !== "", "VALIDATION_FAILED", "寵物數量變更需填寫原因。", false);
    var removePetIds = Array.isArray(d.removePetIds) ? d.removePetIds.map(String) : [];
    var newPetInputs = Array.isArray(d.newPets) ? d.newPets : [];
    littlelandRequire_(new Set(removePetIds).size === removePetIds.length, "VALIDATION_FAILED", "不可重複選擇移除的寵物。", false);
    littlelandRequire_(removePetIds.length + newPetInputs.length > 0, "VALIDATION_FAILED", "請新增或選擇移除寵物。", false);
    var allPetRows = littlelandReadTable_("Pets").rows.filter(function (row) {
      return String(row.record.bookingId) === String(b.bookingId);
    });
    var activePets = allPetRows.map(function (row) { return row.record; }).filter(function (pet) {
      return ["", "ACTIVE", "STAYING"].indexOf(String(pet.petStatus || "").toUpperCase()) >= 0;
    });
    littlelandRequire_(activePets.length === Number(b.quantity), "PAYMENT_RECONCILIATION_REQUIRED", "寵物資料數量與 Booking 不一致，請先人工核對。", false);
    var removeRows = activePets.filter(function (pet) { return removePetIds.indexOf(String(pet.petId)) >= 0; });
    littlelandRequire_(removeRows.length === removePetIds.length, "VALIDATION_FAILED", "部分指定移除的寵物不存在或已移除。", false);
    var nextQuantity = activePets.length - removeRows.length + newPetInputs.length;
    littlelandRequire_(nextQuantity >= 1, "PET_QTY_INVALID", "預約至少保留一隻入住寵物。", false);
    var maxPetNumber = allPetRows.reduce(function (maxValue, row) {
      return Math.max(maxValue, Number(row.record.petNumber) || 0);
    }, 0);
    var normalizedNewPets = newPetInputs.map(function (petInput, index) {
      return littlelandNormalizePet_(petInput, String(b.species), maxPetNumber + index + 1);
    });
    var pricingForm = {
      species: String(b.species),
      roomId: String(b.roomTypeId),
      checkin: littlelandSheetDateOnly_(b.checkinDate),
      checkout: littlelandSheetDateOnly_(b.checkoutDate),
      quantity: nextQuantity,
      groomingOnce: littlelandStaffTruthy_(b.groomingOnce),
      groomingDaily: littlelandStaffTruthy_(b.groomingDaily),
      medicine: String(b.medicine || "none"),
      earlyCheckin: littlelandStaffTruthy_(b.earlyCheckin),
      lateCheckout: littlelandStaffTruthy_(b.lateCheckout),
    };
    var repriced;
    try {
      repriced = LittleLandPricing.calculatePricing(littlelandPricingInput_(pricingForm));
    } catch (pricingError) {
      throw littlelandMapPricingError_(pricingError);
    }
    if (["CONFIRMED", "CHECKED_IN"].indexOf(String(b.bookingStatus)) >= 0) {
      var currentAllocation = [];
      try { currentAllocation = JSON.parse(String(b.allocatedRoomIdsJson || "[]")); } catch (allocationError) { currentAllocation = null; }
      littlelandRequire_(Array.isArray(currentAllocation) && currentAllocation.length > 0 && littlelandIsAllowedAllocation_(b.roomTypeId, currentAllocation), "ROOM_INVALID_ALLOCATION", "目前實體房間配置無效；停止變更，請先人工核對。", false);
      var inventory = littlelandReadInventory_();
      var competing = inventory.occupying.filter(function (booking) { return String(booking.bookingId) !== String(b.bookingId); });
      var overlap = competing.some(function (booking) {
        return littlelandDateRangesOverlap_(pricingForm.checkin, pricingForm.checkout, booking.checkinDate, booking.checkoutDate) &&
          littlelandArraysIntersect_(currentAllocation, booking.roomIds);
      });
      littlelandRequire_(!overlap, "ROOM_NO_LONGER_AVAILABLE", "目前房間已與其他確認訂單衝突，寵物數量未更改。", false);
    }
    update.quantity = nextQuantity;
    update.nights = repriced.nights;
    update.roomPrice = repriced.roomPrice;
    update.baseRoomFee = repriced.baseRoomFee;
    update.extraPetFee = repriced.extraPetFee;
    update.weekendFee = repriced.weekendFee;
    update.serviceFees = repriced.serviceFees;
    update.totalSurcharges = repriced.totalSurcharges;
    update.estimatedTotal = repriced.estimatedTotal;
    update.cashDepositAmount = repriced.cashDeposit;
    var depositPaid = payments.some(function (candidate) {
      return String(candidate.bookingId) === String(b.bookingId) && candidate.paymentType === "DEPOSIT" && candidate.paymentStatus === "PAID";
    });
    if (depositPaid && littlelandStaffTruthy_(b.cashDepositCollected) && !Number(b.cashDepositCollectedAmount || 0)) {
      update.cashDepositCollectedAmount = Number(b.cashDepositAmount || 0);
    }
    if (!depositPaid) update.depositAmount = repriced.depositAmount;
    var removedIdMap = {};
    removePetIds.forEach(function (petId) { removedIdMap[petId] = true; });
    var petFeeSources = entries.filter(function (entry) {
      return String(entry.bookingId) === String(b.bookingId) && entry.type === "SURCHARGE" &&
        removedIdMap[String(entry.petId || "")] &&
        Math.abs(littlelandStaffAdjustmentOpenAmount_(entry, entries)) >= 0.01;
    });
    petFeeSources.forEach(function (entry) {
      var openPetFeeAmount = littlelandStaffAdjustmentOpenAmount_(entry, entries);
      createdAdjustments.push({
        adjustmentId: "ADJ-" + Utilities.getUuid(),
        bookingId: b.bookingId,
        type: "REVERSAL",
        description: "移除寵物後更正附加費：" + String(entry.description || ""),
        amount: littlelandStaffMoney_(-openPetFeeAmount),
        currency: "HKD",
        status: "RECORDED",
        sourcePaymentId: "",
        paymentId: "",
        reason: reason,
        effectiveDate: "",
        reversesAdjustmentId: entry.adjustmentId,
        createdAt: now,
        updatedAt: now,
        createdByStaffId: auth.staff.staffId,
        updatedByStaffId: auth.staff.staffId,
        idempotencyKey: claim.key,
        petId: entry.petId || "",
        petNameSnapshot: entry.petNameSnapshot || "",
        groupId: entry.groupId || "",
      });
    });
    entries = entries.concat(createdAdjustments);
    settlement = littlelandStaffBalanceAfterChange_(b, repriced.estimatedTotal, payments, entries, update);
    update.remainingBalance = settlement.remainingBalance;
    update.balanceStatus = settlement.balanceStatus;
    var newPetRecords = littlelandBuildPetRecords_({ form: { pets: normalizedNewPets } }, b.bookingId, now);
    newPetRecords.forEach(function (petRecord) {
      petRecord.petStatus = "ACTIVE";
      petRecord.removedAt = "";
      petRecord.removedByStaffId = "";
      petRecord.removeReason = "";
    });
    littlelandStaffClaim_(claim, action, body, requestId, now);
    removeRows.forEach(function (pet) {
      littlelandUpdateRecordByKey_("Pets", "petId", pet.petId, {
        petStatus: "REMOVED",
        removedAt: now,
        removedByStaffId: auth.staff.staffId,
        removeReason: reason,
        updatedAt: now,
      });
    });
    newPetRecords.forEach(function (petRecord) { littlelandAppendRecord_("Pets", petRecord); });
    createdAdjustments.forEach(function (entry) { littlelandAppendRecord_("BookingAdjustments", entry); });
    var oldQuote = {
      quantity: Number(b.quantity),
      baseRoomFee: Number(b.baseRoomFee || 0),
      extraPetFee: Number(b.extraPetFee || 0),
      weekendFee: Number(b.weekendFee || 0),
      serviceFees: Number(b.serviceFees || 0),
      estimatedTotal: Number(b.estimatedTotal || 0),
      depositAmount: Number(b.depositAmount || 0),
      remainingBalance: Number(b.remainingBalance || 0),
    };
    var newQuote = {
      quantity: nextQuantity,
      baseRoomFee: repriced.baseRoomFee,
      extraPetFee: repriced.extraPetFee,
      weekendFee: repriced.weekendFee,
      serviceFees: repriced.serviceFees,
      estimatedTotal: repriced.estimatedTotal,
      depositAmount: Number(update.depositAmount !== undefined ? update.depositAmount : b.depositAmount),
      remainingBalance: settlement.remainingBalance,
    };
    update._changeAudit = { reason: reason, before: oldQuote, after: newQuote, addedPetIds: newPetRecords.map(function (pet) { return pet.petId; }), removedPetIds: removePetIds };
    type = "PET_COUNT_CHANGE";
    amount = 0;
  } else {
    throw littlelandApiError_("VALIDATION_FAILED", "不支援的 Staff adjustment action。", false);
  }

  if (action !== "staff.petCountUpdate") {
    littlelandStaffClaim_(claim, action, body, requestId, now);
    createdAdjustments.forEach(function (entry) { littlelandAppendRecord_("BookingAdjustments", entry); });
    if (type === "REFUND") {
      littlelandAppendRecord_("Payments", payment);
      littlelandUpdateRecordByKey_("Payments", "paymentId", source.paymentId, {
        refundAmount: littlelandStaffMoney_(Number(source.refundAmount || 0) + amount),
        refundedAt: now,
      });
    }
    if (settlement && settlement.remainingBalance !== undefined) {
      update.remainingBalance = settlement.remainingBalance;
      if (settlement.balanceStatus) update.balanceStatus = settlement.balanceStatus;
    }
  }

  if (update._changeAudit) {
    var changeAudit = update._changeAudit;
    delete update._changeAudit;
    update.recordVersion = Number(b.recordVersion) + 1;
    littlelandUpdateRecordByKey_("Bookings", "bookingId", b.bookingId, update);
    var petChangeData = {
      bookingId: b.bookingId,
      status: b.bookingStatus,
      quantity: update.quantity,
      remainingBalance: settlement.remainingBalance,
      creditDue: settlement.creditDue,
      addedPetIds: changeAudit.addedPetIds,
      removedPetIds: changeAudit.removedPetIds,
    };
    littlelandStaffFinish_(claim, action, body, auth, requestId, now, petChangeData, "BOOKING", b.bookingId, {
      reason: changeAudit.reason,
      before: changeAudit.before,
      after: changeAudit.after,
      addedPetIds: changeAudit.addedPetIds,
      removedPetIds: changeAudit.removedPetIds,
      recordVersion: update.recordVersion,
    });
    littlelandClearAvailabilityCache_();
    return petChangeData;
  }

  littlelandUpdateRecordByKey_("Bookings", "bookingId", b.bookingId, update);
  var idList = createdAdjustments.map(function (entry) { return entry.adjustmentId; });
  var adjustmentData = {
    bookingId: b.bookingId,
    status: update.bookingStatus || b.bookingStatus,
    adjustmentId: idList[0] || "",
    adjustmentIds: idList,
    amount: amount,
    remainingBalance: settlement ? settlement.remainingBalance : Number(b.remainingBalance || 0),
    creditDue: settlement ? settlement.creditDue : 0,
  };
  if (payment) adjustmentData.paymentId = payment.paymentId;
  littlelandStaffFinish_(claim, action, body, auth, requestId, now, adjustmentData, "BOOKING", b.bookingId, {
    adjustmentIds: idList,
    type: type,
    amount: amount,
    sourcePaymentId: source && source.paymentId || "",
    paymentId: payment && payment.paymentId || "",
    remainingBalance: adjustmentData.remainingBalance,
    creditDue: adjustmentData.creditDue,
    recordVersion: update.recordVersion,
  });
  return adjustmentData;
}

function littlelandStaffAdjustmentTotal_(bookingId, entries) {
  return littlelandStaffMoney_(entries.filter(function (entry) {
    return String(entry.bookingId) === String(bookingId) && ["SURCHARGE", "REVERSAL"].indexOf(String(entry.type)) >= 0;
  }).reduce(function (sum, entry) { return sum + Number(entry.amount || 0); }, 0));
}

function littlelandStaffAdjustmentOpenAmount_(source, entries) {
  var reversed = entries.filter(function (entry) {
    return String(entry.bookingId) === String(source.bookingId) &&
      entry.type === "REVERSAL" && String(entry.reversesAdjustmentId || "") === String(source.adjustmentId);
  }).reduce(function (sum, entry) {
    return sum + Number(entry.amount || 0);
  }, 0);
  return littlelandStaffMoney_(Number(source.amount || 0) + reversed);
}

function littlelandStaffNetAccommodationPaid_(bookingId, payments) {
  return littlelandStaffMoney_(payments.filter(function (payment) {
    return String(payment.bookingId) === String(bookingId) && payment.paymentStatus === "PAID" &&
      ["DEPOSIT", "BALANCE", "ADJUSTMENT", "REFUND"].indexOf(String(payment.paymentType)) >= 0;
  }).reduce(function (sum, payment) {
    return sum + (payment.paymentType === "REFUND" ? -1 : 1) * Number(payment.amount || 0);
  }, 0));
}

function littlelandStaffBalanceAfterChange_(booking, baseTotal, payments, entries, updates) {
  var total = littlelandStaffMoney_(Number(baseTotal || 0) + littlelandStaffAdjustmentTotal_(booking.bookingId, entries));
  var netPaid = littlelandStaffNetAccommodationPaid_(booking.bookingId, payments);
  var hasPaidDeposit = payments.some(function (payment) {
    return String(payment.bookingId) === String(booking.bookingId) && payment.paymentType === "DEPOSIT" && payment.paymentStatus === "PAID";
  });
  var requiredDeposit = hasPaidDeposit ? 0 : Number(updates.depositAmount !== undefined ? updates.depositAmount : booking.depositAmount || 0);
  var rawDue = littlelandStaffMoney_(total - netPaid - requiredDeposit);
  var remainingBalance = Math.max(0, rawDue);
  var balanceStatus = remainingBalance <= 0 ? "PAID" : "UNPAID";
  return {
    total: total,
    netPaid: netPaid,
    remainingBalance: littlelandStaffMoney_(remainingBalance),
    creditDue: littlelandStaffMoney_(Math.max(0, -rawDue)),
    balanceStatus: balanceStatus,
  };
}
