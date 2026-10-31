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
    return littlelandSuccessResponse_(
      littlelandStaffMutate_(action, body, auth, requestId),
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
  ];
  if (allowed.indexOf(action) < 0) return null;
  var bookings = littlelandReadTable_("Bookings").rows.map(function (x) {
      return x.record;
    }),
    pets = littlelandReadTable_("Pets").rows.map(function (x) {
      return x.record;
    }),
    payments = littlelandReadTable_("Payments").rows.map(function (x) {
      return x.record;
    }),
    logs = littlelandReadTable_("Logs").rows.map(function (x) {
      return x.record;
    });
  var roomConflictInventory = null,
    roomConflictInventoryValid = true,
    roomAvailabilityCache = {};
  try {
    roomConflictInventory = littlelandReadInventory_();
  } catch (inventoryError) {
    roomConflictInventoryValid = false;
  }
  function hasRoomConflict(b) {
    if (b.bookingStatus !== "PENDING_DEPOSIT") return false;
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
    return pets.filter(function (p) {
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
            Number(b.cashDepositAmount || 0) -
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
    var bl = logs.filter(function (x) {
        return String(x.entityId) === String(id);
      }),
      fh = bl
        .filter(function (x) {
          return String(x.action || "").indexOf("staff.followup") === 0;
        })
        .map(function (x) {
          return {
            time: x.createdAt,
            actorId: x.actorStaffId,
            action: x.action,
            summary: String(x.summary || ""),
          };
        });
    return {
      booking: bookingCard,
      detail: bookingCard,
      pets: linkedPets(b),
      payments: payments.filter(function (x) {
        return String(x.bookingId) === String(id);
      }),
      logs: bl,
      followupHistory: fh,
    };
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
    payments.forEach(function (p) {
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
    return { summary: s, items: items, payments: payments };
  }
  if (action === "staff.customers") {
    var term = String(body.search || "").toLowerCase(),
      groups = {},
      emailKeys = {},
      phoneKeys = {};
    bookings.forEach(function (b) {
      var email = String(b.email || "").trim().toLowerCase(),
        phone = String(b.phone || "")
          .replace(/\D/g, "")
          .replace(/^852(?=\d{8}$)/, ""),
        emailKey = email ? emailKeys[email] : "",
        phoneKey = phone ? phoneKeys[phone] : "";
      if (emailKey && phoneKey && emailKey !== phoneKey) {
        var from = phoneKey,
          into = emailKey,
          source = groups[from],
          target = groups[into];
        if (source && target) {
          target.bookings = target.bookings.concat(source.bookings);
          Object.keys(source.pets).forEach(function (petName) {
            target.pets[petName] = true;
          });
          Object.keys(emailKeys).forEach(function (value) {
            if (emailKeys[value] === from) emailKeys[value] = into;
          });
          Object.keys(phoneKeys).forEach(function (value) {
            if (phoneKeys[value] === from) phoneKeys[value] = into;
          });
          delete groups[from];
        }
        phoneKey = into;
      }
      var key = emailKey || phoneKey || (email ? "email:" + email :
        phone ? "phone:" + phone : "booking:" + b.bookingId);
      var group = groups[key] || (groups[key] = {
        name: b.parentName,
        phone: b.phone,
        email: b.email,
        pets: {},
        bookings: [],
      });
      group.bookings.push(card(b));
      if (email) emailKeys[email] = key;
      if (phone) phoneKeys[phone] = key;
      linkedPets(b).forEach(function (p) {
        if (p.name) group.pets[p.name] = true;
      });
    });
    var cs = Object.keys(groups)
      .map(function (k) {
        var g = groups[k];
        return {
          name: g.name,
          phone: g.phone,
          email: g.email,
          petNames: Object.keys(g.pets),
          pets: Object.keys(g.pets),
          bookings: g.bookings,
        };
      })
      .filter(function (c) {
        return (
          !term ||
          [c.name, c.phone, c.email].join(" ").toLowerCase().indexOf(term) >= 0
        );
      });
    return { customers: cs };
  }
  var month = String(
      body.month ||
        Utilities.formatDate(new Date(), "Asia/Hong_Kong", "yyyy-MM"),
    ).slice(0, 7),
    sums = {
      monthDepositsReceived: 0,
      monthBalancesReceived: 0,
      monthAccommodationRevenue: 0,
      byRoomType: {},
      bySpecies: {},
    };
  payments.forEach(function (p) {
    if (
      p.paymentStatus !== "PAID" ||
      ["DEPOSIT", "BALANCE"].indexOf(p.paymentType) < 0 ||
      String(p.paidAt || "").slice(0, 7) !== month
    )
      return;
    var amt = Number(p.amount || 0),
      b = bookings.filter(function (x) {
        return String(x.bookingId) === String(p.bookingId);
      })[0];
    if (p.paymentType === "DEPOSIT") sums.monthDepositsReceived += amt;
    else sums.monthBalancesReceived += amt;
    sums.monthAccommodationRevenue += amt;
    if (b) {
      var rt = String(b.roomTypeId || "");
      sums.byRoomType[rt] = (sums.byRoomType[rt] || 0) + amt;
      var species = String(b.species || "");
      sums.bySpecies[species] = (sums.bySpecies[species] || 0) + amt;
    }
  });
  function pairs(o) {
    return Object.keys(o).map(function (k) {
      return { name: k, amount: o[k] };
    });
  }
  sums.byRoomType = pairs(sums.byRoomType);
  sums.bySpecies = pairs(sums.bySpecies);
  return sums;
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
      b.bookingStatus === "CHECKED_IN" && b.balanceStatus === "UNPAID",
      "BOOKING_STATUS_INVALID",
      "目前狀態不可記錄尾數。",
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
          Number(b.cashDepositAmount) -
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
