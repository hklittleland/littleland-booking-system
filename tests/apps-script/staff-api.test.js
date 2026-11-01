"use strict";
const test = require("node:test");
const { assert, createRuntime, makePayload } = require("./harness");
const crypto = require("node:crypto");
function staffRuntime(role = "STAFF") {
  const r = createRuntime();
  const c = r.context,
    salt = Buffer.from("test-salt").toString("base64");
  r.addRecord("Staff", {
    staffId: "staff-test-1",
    username: "teststaff",
    displayName: "Test Staff",
    role,
    passwordSalt: salt,
    passwordHash: c.littlelandStaffPasswordHash_("pass-test", salt),
    isActive: true,
  });
  return r;
}
test("Staff login accepts correct credentials and persists only tokenHash", () => {
  const r = staffRuntime();
  const out = r.invokeStaff({
    action: "staff.login",
    username: "teststaff",
    password: "pass-test",
  });
  assert.equal(out.success, true);
  assert.ok(out.data.token);
  assert.equal(r.records("Sessions").length, 1);
  assert.equal(
    r.records("Sessions")[0].tokenHash,
    r.context.littlelandStaffHash_(out.data.token),
  );
  assert.equal(
    JSON.stringify(r.records("Sessions")).includes(out.data.token),
    false,
  );
});
test("Staff password hash matches PBKDF2-HMAC-SHA256 at 120000 rounds", () => {
  const r = createRuntime();
  const saltBytes = Buffer.from("test-salt", "utf8");
  const saltB64 = saltBytes.toString("base64");
  const expected = crypto
    .pbkdf2Sync("pass-test", saltBytes, 120000, 32, "sha256")
    .toString("hex");
  assert.equal(
    r.context.LITTLELAND_STAFF_PBKDF2_ROUNDS,
    120000,
  );
  assert.equal(
    r.context.littlelandStaffPasswordHash_("pass-test", saltB64),
    expected,
  );
});
test("Staff login rejects wrong password and disabled account", () => {
  const r = staffRuntime();
  assert.equal(
    r.invokeStaff({
      action: "staff.login",
      username: "teststaff",
      password: "wrong",
    }).code,
    "STAFF_AUTH_INVALID",
  );
  r.records("Staff");
  r.context.littlelandUpdateRecordByKey_("Staff", "staffId", "staff-test-1", {
    isActive: false,
  });
  assert.equal(
    r.invokeStaff({
      action: "staff.login",
      username: "teststaff",
      password: "pass-test",
    }).code,
    "STAFF_AUTH_INVALID",
  );
});
test("Staff login reports safe rate-limiter failures without a session", () => {
  const r = staffRuntime();
  r.context.CacheService.getScriptCache = () => {
    throw new Error("private internal detail");
  };
  const out = r.invokeStaff({
    action: "staff.login",
    username: "teststaff",
    password: "pass-test",
  });
  assert.equal(out.code, "STAFF_LOGIN_RATE_LIMITER_FAILED");
  assert.equal(out.message.includes("private internal detail"), false);
  assert.equal(r.records("Sessions").length, 0);
});
test("Staff login reports safe password-hash failures without a session", () => {
  const r = staffRuntime();
  r.context.LittleLandStaffCrypto = {
    staffPasswordHash: () => {
      throw new Error("private internal detail");
    },
  };
  const out = r.invokeStaff({
    action: "staff.login",
    username: "teststaff",
    password: "pass-test",
  });
  assert.equal(out.code, "STAFF_LOGIN_PASSWORD_KDF_FAILED");
  assert.equal(out.message.includes("private internal detail"), false);
  assert.equal(r.records("Sessions").length, 0);
});
test("Staff login reports safe salt-decode failures without a session", () => {
  const r = staffRuntime();
  r.context.Utilities.base64Decode = () => {
    throw new Error("private internal detail");
  };
  const out = r.invokeStaff({
    action: "staff.login",
    username: "teststaff",
    password: "pass-test",
  });
  assert.equal(out.code, "STAFF_LOGIN_SALT_DECODE_FAILED");
  assert.equal(out.message.includes("private internal detail"), false);
  assert.equal(r.records("Sessions").length, 0);
});
test("Unauthenticated staff read cannot expose guest, pet or payment data", () => {
  const r = staffRuntime();
  for (const action of [
    "staff.dashboard",
    "staff.bookings",
    "staff.bookingDetail",
    "staff.payments",
    "staff.customers",
    "staff.revenue",
  ]) {
    const out = r.invokeStaff({ action, bookingId: "x" });
    assert.equal(out.success, false);
    assert.equal(out.code, "STAFF_AUTH_REQUIRED");
  }
});
test("Logout revokes session and expired session is rejected", () => {
  const r = staffRuntime(),
    login = r.invokeStaff({
      action: "staff.login",
      username: "teststaff",
      password: "pass-test",
    });
  const token = login.data.token;
  assert.equal(r.invokeStaff({ action: "staff.logout", token }).success, true);
  assert.equal(
    r.invokeStaff({ action: "staff.session", token }).code,
    "STAFF_AUTH_INVALID",
  );
  const session = r.records("Sessions")[0];
  r.context.littlelandUpdateRecordByKey_(
    "Sessions",
    "sessionId",
    session.sessionId,
    { revokedAt: "", expiresAt: "2000-01-01T00:00:00.000Z" },
  );
  assert.equal(
    r.invokeStaff({ action: "staff.session", token }).code,
    "STAFF_AUTH_INVALID",
  );
});
test("two active Staff accounts both receive complete ADMIN access regardless of legacy role", () => {
  const r = staffRuntime("VIEWER");
  const primary = r.records("Staff")[0];
  const salt = Buffer.from("synthetic-second-staff-salt").toString("base64");
  const second = Object.assign({}, primary, {
    staffId: "TEST-STAFF-002",
    username: "teststaff2",
    displayName: "Test Staff 2",
    role: "STAFF",
    passwordSalt: salt,
    passwordHash: r.context.littlelandStaffPasswordHash_("pass-test-2", salt),
    isActive: true,
  });
  r.addRecord("Staff", second);

  for (const credentials of [
    { username: "teststaff", password: "pass-test" },
    { username: "teststaff2", password: "pass-test-2" },
  ]) {
    const login = r.invokeStaff(Object.assign({ action: "staff.login" }, credentials));
    assert.equal(login.success, true);
    assert.equal(login.data.staff.role, "ADMIN");
    const session = r.invokeStaff({ action: "staff.session", token: login.data.token });
    assert.equal(session.success, true);
    assert.equal(session.data.staff.role, "ADMIN");
  }
});

test("disabling a Staff account blocks its existing session", () => {
  const r = staffRuntime("ADMIN");
  const token = loggedIn(r);
  const staff = r.records("Staff")[0];
  r.context.littlelandUpdateRecordByKey_("Staff", "staffId", staff.staffId, {
    isActive: false,
  });
  const result = r.invokeStaff({ action: "staff.session", token });
  assert.equal(result.success, false);
  assert.equal(result.code, "STAFF_AUTH_INVALID");
});

function addBooking(r, overrides = {}) {
  const headers = r.sheet("Bookings").values[0],
    record = {};
  headers.forEach((h) => (record[h] = ""));
  Object.assign(
    record,
    {
      bookingId: "TEST-LL-STAFF-001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordVersion: 1,
      bookingStatus: "PENDING_DEPOSIT",
      checkinDate: "2099-05-01",
      checkoutDate: "2099-05-03",
      roomTypeId: "DELUXE_SUITE",
      allocatedRoomIdsJson: "[]",
      depositAmount: 175,
      depositStatus: "UNPAID",
      balanceStatus: "UNPAID",
      cashDepositAmount: 1000,
      cashDepositStatus: "NOT_COLLECTED",
      followUpRequired: false,
    },
    overrides,
  );
  r.addRecord("Bookings", record);
  return record;
}
function loggedIn(r) {
  return r.invokeStaff({
    action: "staff.login",
    username: "teststaff",
    password: "pass-test",
  }).data.token;
}
function addStaffPet(r, bookingId, overrides = {}) {
  const record = {
    petId: bookingId + "-PET-01", bookingId, petNumber: 1,
    name: "Mochi", breed: "Lionhead", ageValue: 6, ageUnit: "month",
    ageInMonths: 6, sex: "female", sterilized: "yes", pregnant: "no",
    recentSurgery30Days: false, vetVisit: "no", vetDetails: "",
    infectiousDisease: "no", infectiousDetails: "", chronicDisease: "no",
    chronicDetails: "", medication: "no", medicationDetails: "",
    specialCare: "", fleaTreatment: "no", healthReviewStatus: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  Object.assign(record, overrides);
  r.addRecord("Pets", record);
  return record;
}
function editPetRequest(r, booking, pet, overrides = {}) {
  return Object.assign({
    action: "staff.edit", token: loggedIn(r),
    bookingId: booking.bookingId, expectedRecordVersion: Number(booking.recordVersion),
    expectedStatus: booking.bookingStatus, idempotencyKey: "pet-edit-0001",
    data: { pets: [Object.assign({ petId: pet.petId, name: "Mochi Updated", breed: "Lionhead", ageValue: 6,
      ageUnit: "month", sex: "female", sterilized: "yes", pregnant: "no", recentSurgery: "no",
      vetVisit: "no", vetDetails: "", infectiousDisease: "no", infectiousDetails: "",
      chronicDisease: "no", chronicDetails: "", medication: "no", medicationDetails: "",
      specialCare: "", fleaTreatment: "no" }, overrides)] },
  }, overrides.request || {});
}

test("staff.edit updates complete pet declaration, version once, and logs field names without PII", () => {
  const r = staffRuntime("ADMIN"), b = addBooking(r, { quantity: 1, species: "rabbit" }), p = addStaffPet(r, b.bookingId);
  const body = editPetRequest(r, b, p, { vetVisit: "yes", vetDetails: "synthetic clinic detail" });
  const out = r.invokeStaff(body);
  assert.equal(out.success, true, JSON.stringify(out));
  const saved = r.records("Pets")[0];
  assert.equal(saved.name, "Mochi Updated");
  assert.equal(saved.vetVisit, "yes");
  assert.equal(saved.vetDetails, "synthetic clinic detail");
  assert.equal(saved.healthReviewStatus, "HEALTH_REVIEW_REQUIRED");
  const booking = r.records("Bookings")[0];
  assert.equal(Number(booking.recordVersion), 2);
  assert.equal(booking.bookingStatus, "PENDING_DEPOSIT");
  assert.equal(booking.depositAmount, 175);
  assert.equal(booking.roomTypeId, "DELUXE_SUITE");
  assert.equal(booking.allocatedRoomIdsJson, "[]");
  const log = r.records("Logs")[0];
  assert.match(log.changedFieldsJson, /petIds/);
  assert.match(log.changedFieldsJson, /vetDetails/);
  assert.doesNotMatch(log.changedFieldsJson + log.summary, /Mochi Updated|synthetic clinic detail/);
});

test("staff.edit recomputes health review from corrected declaration", () => {
  const r = staffRuntime("ADMIN"), b = addBooking(r, { quantity: 1, species: "rabbit" }), p = addStaffPet(r, b.bookingId, {
    vetVisit: "yes", vetDetails: "old", healthReviewStatus: "HEALTH_REVIEW_REQUIRED",
  });
  const body = editPetRequest(r, b, p, { vetVisit: "no", vetDetails: "" });
  const out = r.invokeStaff(body);
  assert.equal(out.success, true, JSON.stringify(out));
  assert.equal(r.records("Pets")[0].healthReviewStatus, "");
});

test("staff.edit rejects pet quantity, species mutation, invalid age, pregnancy and recent surgery", () => {
  const cases = [
    { pets: [] },
    { species: "hamster" },
    { ageValue: 1 },
    { pregnant: "yes" },
    { recentSurgery: "yes" },
  ];
  for (let i = 0; i < cases.length; i++) {
    const r = staffRuntime("ADMIN"), b = addBooking(r, { quantity: 1, species: "rabbit" }), p = addStaffPet(r, b.bookingId);
    const body = editPetRequest(r, b, p);
    if (cases[i].pets) body.data.pets = cases[i].pets;
    else if (cases[i].species) body.data.pets[0].species = cases[i].species;
    else Object.assign(body.data.pets[0], cases[i]);
    const before = JSON.stringify(r.records("Pets"));
    const out = r.invokeStaff(body);
    assert.equal(out.success, false, "case " + i + ": " + JSON.stringify(out));
    assert.equal(JSON.stringify(r.records("Pets")), before);
    assert.equal(Number(r.records("Bookings")[0].recordVersion), 1);
    assert.equal(r.records("IdempotencyKeys").length, 0);
  }
});

test("staff.edit enforces hamster and male-pet conditional declaration rules", () => {
  const hamster = staffRuntime("ADMIN"), hb = addBooking(hamster, { quantity: 1, species: "hamster" });
  const hp = addStaffPet(hamster, hb.bookingId, {
    ageValue: 3, sex: "male", sterilized: "", pregnant: "", fleaTreatment: "",
  });
  const hamsterBody = editPetRequest(hamster, hb, hp, {
    ageValue: 3, sex: "male", sterilized: "", pregnant: "", fleaTreatment: "",
  });
  assert.equal(hamster.invokeStaff(hamsterBody).success, true);

  const male = staffRuntime("ADMIN"), mb = addBooking(male, { quantity: 1, species: "rabbit" });
  const mp = addStaffPet(male, mb.bookingId, { sex: "male", pregnant: "" });
  const maleBody = editPetRequest(male, mb, mp, { sex: "male", pregnant: "no" });
  const rejected = male.invokeStaff(maleBody);
  assert.equal(rejected.success, false);
  assert.equal(rejected.code, "VALIDATION_FAILED");
  assert.equal(male.records("Pets")[0].sex, "male");
  assert.equal(male.records("IdempotencyKeys").length, 0);
});

test("staff.edit rejects stale version but allows full access without password re-auth", () => {
  const r = staffRuntime("ADMIN"), b = addBooking(r, { quantity: 1, species: "rabbit" }), p = addStaffPet(r, b.bookingId);
  let body = editPetRequest(r, b, p);
  body.expectedRecordVersion = 99;
  assert.equal(r.invokeStaff(body).code, "BOOKING_VERSION_CONFLICT");
  assert.equal(r.records("IdempotencyKeys").length, 0);
  const legacyStaff = staffRuntime("VIEWER"), vb = addBooking(legacyStaff, { quantity: 1, species: "rabbit" }), vp = addStaffPet(legacyStaff, vb.bookingId);
  body = editPetRequest(legacyStaff, vb, vp);
  const edit = legacyStaff.invokeStaff(body);
  assert.equal(edit.success, true, JSON.stringify(edit));
  assert.equal(legacyStaff.records("Pets")[0].name, "Mochi Updated");
});

test("Confirm-data transition uses expected version/status and rejects illegal states", () => {
  const r = staffRuntime(),
    b = addBooking(r, { bookingStatus: "PENDING_CONFIRMATION" }),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmData",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_CONFIRMATION",
    idempotencyKey: "confirm-data-0001",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.detail.bookingStatus, "PENDING_DEPOSIT");
  assert.equal(Number(out.data.detail.recordVersion), 2);
  const bad = r.invokeStaff({
    action: "staff.confirmData",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 2,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "confirm-data-0002",
  });
  assert.equal(bad.code, "BOOKING_STATUS_INVALID");
});
test("Confirm deposit rechecks current inventory and records payment before confirmed allocation", () => {
  const r = staffRuntime(),
    b = addBooking(r),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-confirm-001",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.confirmed, true);
  assert.equal(out.data.detail.bookingStatus, "CONFIRMED");
  assert.equal(out.data.detail.depositStatus, "PAID");
  assert.deepEqual(JSON.parse(out.data.detail.allocatedRoomIdsJson), [
    "S1",
    "S2",
  ]);
  assert.equal(r.records("Payments").length, 1);
  assert.equal(r.records("Logs").length, 1);
});
test("Room conflict still records received deposit, leaves pending and follows up", () => {
  const r = staffRuntime(),
    b = addBooking(r),
    token = loggedIn(r);
  for (const [id, room] of [
    ["busy-s1", "S1"],
    ["busy-s2", "S2"],
  ])
    r.addRecord("Bookings", {
      bookingId: id,
      recordVersion: 1,
      bookingStatus: "CONFIRMED",
      checkinDate: b.checkinDate,
      checkoutDate: b.checkoutDate,
      roomTypeId: "PRIVATE_SUITE",
      allocatedRoomIdsJson: JSON.stringify([room]),
    });
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-conflict-01",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.confirmed, false);
  assert.equal(out.data.roomConflict, true);
  assert.equal(out.data.detail.bookingStatus, "PENDING_DEPOSIT");
  assert.equal(out.data.detail.depositStatus, "PAID");
  assert.deepEqual(JSON.parse(out.data.detail.allocatedRoomIdsJson), []);
  assert.equal(String(out.data.detail.followUpRequired), "true");
  assert.equal(r.records("Payments").length, 1);
});

test("Confirm deposit normalizes Google Sheets ISO timestamps to Hong Kong dates", () => {
  const r = staffRuntime(),
    b = addBooking(r, {
      checkinDate: "2026-11-14T16:00:00.000Z",
      checkoutDate: "2026-11-15T16:00:00.000Z",
    }),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-sheet-iso-date-01",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.confirmed, true);
  assert.equal(out.data.detail.bookingStatus, "CONFIRMED");
  assert.deepEqual(JSON.parse(out.data.detail.allocatedRoomIdsJson), [
    "S1",
    "S2",
  ]);
  assert.equal(r.records("Payments").length, 1);
});

test("ISO-dated confirmed rooms leave a paid booking pending and flagged for follow-up", () => {
  const checkinDate = "2026-11-14T16:00:00.000Z",
    checkoutDate = "2026-11-15T16:00:00.000Z",
    r = staffRuntime(),
    b = addBooking(r, {
      bookingId: "TEST-LL-STAFF-ISO-CONFLICT",
      roomTypeId: "PRIVATE_SUITE",
      checkinDate,
      checkoutDate,
    }),
    token = loggedIn(r);
  for (const room of ["S1", "S2", "S3"])
    r.addRecord("Bookings", {
      bookingId: "confirmed-iso-" + room,
      recordVersion: 1,
      bookingStatus: "CONFIRMED",
      checkinDate,
      checkoutDate,
      roomTypeId: "PRIVATE_SUITE",
      allocatedRoomIdsJson: JSON.stringify([room]),
    });
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-sheet-iso-conflict-01",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.confirmed, false);
  assert.equal(out.data.roomConflict, true);
  assert.equal(out.data.detail.bookingStatus, "PENDING_DEPOSIT");
  assert.equal(out.data.detail.depositStatus, "PAID");
  assert.deepEqual(JSON.parse(out.data.detail.allocatedRoomIdsJson), []);
  assert.equal(String(out.data.detail.followUpRequired), "true");
  assert.equal(r.records("Payments").length, 1);
});

test("Staff reads flag pending deposits conflicting with current inventory without mutation", () => {
  const r = staffRuntime(),
    pending = addBooking(r, { followUpRequired: false }),
    token = loggedIn(r);
  for (const [id, room] of [
    ["confirmed-s1", "S1"],
    ["confirmed-s3", "S3"],
  ])
    r.addRecord("Bookings", {
      bookingId: id,
      recordVersion: 1,
      bookingStatus: "CONFIRMED",
      checkinDate: pending.checkinDate,
      checkoutDate: pending.checkoutDate,
      roomTypeId: "PRIVATE_SUITE",
      allocatedRoomIdsJson: JSON.stringify([room]),
    });

  const beforePayments = r.records("Payments").length,
    beforeLogs = r.records("Logs").length,
    detail = r.invokeStaff({
      action: "staff.bookingDetail",
      token,
      bookingId: pending.bookingId,
    }),
    list = r.invokeStaff({ action: "staff.bookings", token }),
    dashboard = r.invokeStaff({ action: "staff.dashboard", token }),
    followups = r.invokeStaff({ action: "staff.followups", token });
  assert.equal(detail.data.booking.roomConflict, true);
  assert.equal(
    list.data.bookings.find((b) => b.bookingId === pending.bookingId).roomConflict,
    true,
  );
  assert.equal(dashboard.data.roomConflictsCount, 1);
  assert.equal(
    dashboard.data.roomConflicts[0].bookingId,
    pending.bookingId,
  );
  assert.ok(
    dashboard.data.followups.some((b) => b.bookingId === pending.bookingId),
  );
  assert.ok(followups.data.bookings.some((b) => b.bookingId === pending.bookingId));
  const unchanged = r.records("Bookings").find(
    (b) => b.bookingId === pending.bookingId,
  );
  assert.equal(unchanged.bookingStatus, "PENDING_DEPOSIT");
  assert.equal(unchanged.allocatedRoomIdsJson, "[]");
  assert.equal(r.records("Payments").length, beforePayments);
  assert.equal(r.records("Logs").length, beforeLogs);

  const available = staffRuntime(),
    availablePending = addBooking(available),
    availableToken = loggedIn(available);
  const availableDetail = available.invokeStaff({
    action: "staff.bookingDetail",
    token: availableToken,
    bookingId: availablePending.bookingId,
  });
  assert.equal(availableDetail.data.booking.roomConflict, false);
});

test("Repeated failed logins are rate limited for the username", () => {
  const r = staffRuntime();
  for (let i = 0; i < 5; i++)
    assert.equal(
      r.invokeStaff({
        action: "staff.login",
        username: "teststaff",
        password: "wrong",
      }).code,
      "STAFF_AUTH_INVALID",
    );
  assert.equal(
    r.invokeStaff({
      action: "staff.login",
      username: "teststaff",
      password: "pass-test",
    }).code,
    "STAFF_LOGIN_RATE_LIMIT",
  );
});

test("PBKDF2 password hash matches Node crypto RFC 8018", () => {
  const r = staffRuntime();
  const salt = Buffer.from("parity salt").toString("base64");
  const expected = crypto
    .pbkdf2Sync("secret", Buffer.from(salt, "base64"), 120000, 32, "sha256")
    .toString("hex");
  assert.equal(
    r.context.littlelandStaffPasswordHash_("secret", salt),
    expected,
  );
});
test("Session with missing expiry fails closed", () => {
  const r = staffRuntime(),
    token = loggedIn(r),
    session = r.records("Sessions")[0];
  r.context.littlelandUpdateRecordByKey_(
    "Sessions",
    "sessionId",
    session.sessionId,
    { expiresAt: "" },
  );
  assert.equal(
    r.invokeStaff({ action: "staff.session", token }).code,
    "STAFF_AUTH_INVALID",
  );
});

test("Staff calendar includes bookings overlapping month boundaries", () => {
  const r = staffRuntime(),
    b = addBooking(r, {
      checkinDate: "2099-04-29",
      checkoutDate: "2099-05-02",
    }),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.calendar",
    token,
    month: "2099-05",
  });
  assert.equal(out.success, true);
  assert.ok(out.data.bookings.some((x) => x.bookingId === b.bookingId));
});
test("Staff calendar normalizes Google Sheets Date cells to Hong Kong date-only values", () => {
  const r = staffRuntime(),
    b = addBooking(r, {
      bookingStatus: "PENDING_CONFIRMATION",
      checkinDate: new Date("2026-11-14T16:00:00.000Z"),
      checkoutDate: new Date("2026-11-15T16:00:00.000Z"),
    }),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.calendar",
    token,
    month: "2026-11",
  });
  assert.equal(out.success, true);
  const item = out.data.bookings.find((x) => x.bookingId === b.bookingId);
  assert.ok(item);
  assert.equal(item.checkinDate, "2026-11-15");
  assert.equal(item.checkoutDate, "2026-11-16");
});
test("Staff read request opens TEST spreadsheet once and Dashboard reads revenue inputs without Logs", () => {
  const r = staffRuntime(), token = loggedIn(r);
  let openCount = 0;
  const originalOpen = r.context.SpreadsheetApp.openById;
  r.context.SpreadsheetApp.openById = (id) => {
    openCount += 1;
    return originalOpen(id);
  };
  const readTables = [], originalRead = r.context.littlelandReadTable_;
  r.context.littlelandReadTable_ = function (name) {
    readTables.push(name);
    return originalRead.apply(null, arguments);
  };
  const before = openCount;
  const out = r.invokeStaff({ action: "staff.dashboard", token });
  assert.equal(out.success, true);
  assert.equal(openCount - before, 1);
  assert.ok(readTables.includes("Bookings"));
  assert.equal(readTables.includes("Payments"), true);
  assert.equal(readTables.includes("BookingAdjustments"), true);
  assert.equal(readTables.includes("Logs"), false);
});
test("Staff read response shapes include dashboard, payment and revenue summaries", () => {
  const r = staffRuntime(),
    token = loggedIn(r);
  addBooking(r);
  const dash = r.invokeStaff({ action: "staff.dashboard", token });
  assert.deepEqual(
    Object.keys(dash.data.counts).sort(),
    [
      "confirmed",
      "followUp",
      "pendingConfirmation",
      "pendingDeposit",
      "todayCheckins",
      "todayCheckouts",
    ].sort(),
  );
  const pay = r.invokeStaff({ action: "staff.payments", token });
  assert.equal(typeof pay.data.summary.pendingDepositsTotal, "number");
  assert.ok(Array.isArray(pay.data.items));
  assert.ok(Array.isArray(pay.data.payments));
  const rev = r.invokeStaff({
    action: "staff.revenue",
    token,
    month: "2099-05",
  });
  assert.equal(typeof rev.data.monthAccommodationRevenue, "number");
  assert.ok(Array.isArray(rev.data.byRoomType));
});
test("Customers merge only normalized phone numbers and search only by phone", () => {
  const r = staffRuntime(),
    token = loggedIn(r);
  addBooking(r, {
    bookingId: "A",
    phone: "+852 6123 4567",
    email: "same@example.com",
    parentName: "One",
  });
  addBooking(r, {
    bookingId: "B",
    phone: "6123-4567",
    email: "different@example.com",
    parentName: "Two",
  });
  addBooking(r, {
    bookingId: "C",
    phone: "",
    email: "same@example.com",
    parentName: "Three",
  });
  const out = r.invokeStaff({ action: "staff.customers", token });
  assert.equal(out.data.customers.length, 2);
  const merged = out.data.customers.find((customer) => customer.phoneNormalized === "61234567");
  assert.ok(merged);
  assert.equal(merged.bookings.length, 2);
  assert.equal(merged.bookingCount, 2);
  assert.equal(r.invokeStaff({ action: "staff.customers", token, search: "One" }).data.customers.length, 0);
  assert.equal(r.invokeStaff({ action: "staff.customers", token, search: "same@example.com" }).data.customers.length, 0);
  assert.equal(r.invokeStaff({ action: "staff.customers", token, search: "852 6123 4567" }).data.customers.length, 1);
});
test("Revenue separates accommodation booked revenue and excludes all cash deposit payment types", () => {
  const r = staffRuntime(),
    token = loggedIn(r);
  addBooking(r, {
    estimatedTotal: 500,
    baseRoomFee: 500,
    depositAmount: 250,
    remainingBalance: 250,
    bookingStatus: "CONFIRMED",
    checkinDate: "2099-05-15",
    checkoutDate: "2099-05-16",
  });
  for (const [id, type] of [
    ["d", "DEPOSIT"],
    ["b", "BALANCE"],
    ["c", "CASH_DEPOSIT"],
    ["u", "CASH_DEPOSIT_USE"],
    ["f", "CASH_DEPOSIT_REFUND"],
  ])
    r.addRecord("Payments", {
      paymentId: id,
      bookingId: "TEST-LL-STAFF-001",
      paymentType: type,
      amount: 10,
      paymentStatus: "PAID",
      paidAt: "2099-05-15T12:00:00Z",
    });
  const out = r.invokeStaff({
    action: "staff.revenue",
    token,
    month: "2099-05",
  });
  assert.equal(out.data.monthAccommodationRevenue, 500);
  assert.equal(out.data.monthBookedRevenue, 500);
  assert.equal(out.data.monthCollectedRevenue, 20);
  assert.equal(out.data.monthDepositsReceived, 10);
  assert.equal(out.data.monthBalancesReceived, 10);
});
test("Invalid version does not claim an idempotency PROCESSING row", () => {
  const r = staffRuntime(),
    b = addBooking(r, { bookingStatus: "PENDING_CONFIRMATION" }),
    token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmData",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 99,
    expectedStatus: "PENDING_CONFIRMATION",
    idempotencyKey: "bad-version-001",
  });
  assert.equal(out.success, false);
  assert.equal(r.records("IdempotencyKeys").length, 0);
});
test("Paid pending deposit can be rechecked and confirmed without duplicate payment", () => {
  const r = staffRuntime(),
    b = addBooking(r),
    token = loggedIn(r);
  for (const [id, room] of [
    ["busy-s1", "S1"],
    ["busy-s2", "S2"],
  ])
    r.addRecord("Bookings", {
      bookingId: id,
      recordVersion: 1,
      bookingStatus: "CONFIRMED",
      checkinDate: b.checkinDate,
      checkoutDate: b.checkoutDate,
      roomTypeId: "PRIVATE_SUITE",
      allocatedRoomIdsJson: JSON.stringify([room]),
    });
  r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-conflict-02",
  });
  r.context.littlelandUpdateRecordByKey_("Bookings", "bookingId", "busy-s1", {
    bookingStatus: "CANCELLED",
  });
  r.context.littlelandUpdateRecordByKey_("Bookings", "bookingId", "busy-s2", {
    bookingStatus: "CANCELLED",
  });
  const current = r
    .records("Bookings")
    .find((x) => x.bookingId === b.bookingId);
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: Number(current.recordVersion),
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "deposit-recheck-02",
  });
  assert.equal(out.success, true);
  assert.equal(out.data.detail.bookingStatus, "CONFIRMED");
  assert.equal(
    r.records("Payments").filter((x) => x.paymentType === "DEPOSIT").length,
    1,
  );
});


test("Unknown Staff username returns the same authentication error", () => {
  const r = staffRuntime();
  const out = r.invokeStaff({
    action: "staff.login",
    username: "missing-user",
    password: "pass-test",
  });
  assert.equal(out.success, false);
  assert.equal(out.code, "STAFF_AUTH_INVALID");
});

test("Uncollected cash deposit is never reported as refundable", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "CHECKED_OUT",
    cashDepositStatus: "NOT_COLLECTED",
  });
  const details = r.invokeStaff({
    action: "staff.bookingDetail",
    token,
    bookingId: b.bookingId,
  });
  assert.equal(details.data.detail.cashDepositRefundDue, 0);
  const payments = r.invokeStaff({ action: "staff.payments", token });
  assert.equal(payments.data.summary.cashDepositsToRefundTotal, 0);
  assert.equal(payments.data.items.length, 0);
});

test("Confirm-data refuses legacy room allocations before claiming idempotency", () => {
  const r = staffRuntime();
  const b = addBooking(r, {
    bookingStatus: "PENDING_CONFIRMATION",
    allocatedRoomIdsJson: '["S1"]',
  });
  const token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmData",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_CONFIRMATION",
    idempotencyKey: "pending-room-001",
  });
  assert.equal(out.success, false);
  assert.equal(out.code, "ROOM_INVALID_ALLOCATION");
  assert.equal(r.records("IdempotencyKeys").length, 0);
  assert.equal(r.records("Bookings").find((x) => x.bookingId === b.bookingId).bookingStatus, "PENDING_CONFIRMATION");
});

test("Paid booking without one matching deposit record fails closed before confirmation", () => {
  const r = staffRuntime();
  const b = addBooking(r, { depositStatus: "PAID" });
  const token = loggedIn(r);
  const out = r.invokeStaff({
    action: "staff.confirmDeposit",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_DEPOSIT",
    idempotencyKey: "missing-paid-row-01",
  });
  assert.equal(out.success, false);
  assert.equal(out.code, "PAYMENT_RECONCILIATION_REQUIRED");
  assert.equal(r.records("Payments").length, 0);
  assert.equal(r.records("IdempotencyKeys").length, 0);
});

test("Customers merge histories when the same phone has different emails", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  addBooking(r, {
    bookingId: "A-PHONE",
    email: "first@example.com",
    phone: "55555555",
    parentName: "One",
  });
  addBooking(r, {
    bookingId: "B-PHONE",
    email: "second@example.com",
    phone: "+852 5555 5555",
    parentName: "One",
  });
  const out = r.invokeStaff({ action: "staff.customers", token });
  assert.equal(out.data.customers.length, 1);
  assert.equal(out.data.customers[0].bookings.length, 2);
});


test("Duplicate idempotency rows fail closed before a Staff mutation", () => {
  const r = staffRuntime();
  const b = addBooking(r, { bookingStatus: "PENDING_CONFIRMATION" });
  const token = loggedIn(r);
  for (let i = 0; i < 2; i += 1) {
    r.addRecord("IdempotencyKeys", {
      idempotencyKey: "duplicate-rows-01",
      operation: "staff.confirmData",
      payloadHash: "fixture-hash",
      state: "COMPLETED",
      bookingId: b.bookingId,
      responseSnapshotJson: "{}",
    });
  }
  const out = r.invokeStaff({
    action: "staff.confirmData",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_CONFIRMATION",
    idempotencyKey: "duplicate-rows-01",
  });
  assert.equal(out.success, false);
  assert.equal(out.code, "IDEMPOTENCY_RECONCILIATION_REQUIRED");
  assert.equal(r.records("Bookings").find((x) => x.bookingId === b.bookingId).bookingStatus, "PENDING_CONFIRMATION");
  assert.equal(r.records("IdempotencyKeys").length, 2);
});


test("staff.availability is authenticated and returns a minimal non-identifying snapshot", () => {
  const r=staffRuntime(), token=loggedIn(r);
  const unauth=r.invokeStaff({action:"staff.availability",checkin:"2099-05-01",checkout:"2099-05-02",species:"rabbit",roomTypeId:"DELUXE_ROOM",quantity:1});
  assert.equal(unauth.code,"STAFF_AUTH_REQUIRED");
  const out=r.invokeStaff({action:"staff.availability",token,checkin:"2099-05-01",checkout:"2099-05-02",species:"rabbit",roomTypeId:"DELUXE_ROOM",quantity:1});
  assert.equal(out.success,true);
  assert.deepEqual(Object.keys(out.data).sort(),["available","checkedAt","roomTypeId","status"]);
  assert.equal(JSON.stringify(out.data).includes("S1"),false);
});

test("staff.createBooking validates and reprices, remains pending with empty allocation and logs STAFF", () => {
  const r=staffRuntime(), token=loggedIn(r), payload=makePayload(r,{}, {idempotencyKey:"staff-create-001"});
  const out=r.invokeStaff({action:"staff.createBooking",token,request:payload});
  assert.equal(out.success,true,JSON.stringify(out));
  const b=r.records("Bookings")[0];
  assert.equal(b.bookingStatus,"PENDING_CONFIRMATION");assert.equal(b.allocatedRoomIdsJson,"[]");
  assert.equal(r.records("Pets").length,1);assert.equal(r.records("Logs")[0].actorType,"STAFF");
  assert.equal(r.records("IdempotencyKeys")[0].state,"COMPLETED");
});

test("schedule save serializes work/rest per staff/date and logs each mutation", () => {
  const r=staffRuntime(),token=loggedIn(r),staff=r.records("Staff")[0];
  const base={action:"staff.scheduleSave",token,idempotencyKey:"schedule-save-01",data:{workDate:"2099-05-01",staffId:staff.staffId,status:"REST"}};
  const saved=r.invokeStaff(base);assert.equal(saved.success,true,JSON.stringify(saved));
  const changed=r.invokeStaff(Object.assign({},base,{idempotencyKey:"schedule-save-02",data:{workDate:"2099-05-01",staffId:staff.staffId,status:"WORK",startTime:"09:00",endTime:"17:00"}}));
  assert.equal(changed.success,true,JSON.stringify(changed));
  assert.equal(r.records("StaffSchedules").length,1);assert.equal(r.records("StaffSchedules")[0].status,"WORK");
  assert.equal(r.records("Logs").length,2);
});

test("surcharges are separate and paid deposits can only be manually refunded within net paid amount", () => {
  const r=staffRuntime(),token=loggedIn(r),b=addBooking(r,{bookingStatus:"CHECKED_IN",depositAmount:175,recordVersion:1});
  const charge=r.invokeStaff({action:"staff.surchargeAdd",token,bookingId:b.bookingId,expectedRecordVersion:1,expectedStatus:"CHECKED_IN",idempotencyKey:"surcharge-add-01",data:{amount:50,description:"Extra care",reason:"Manual fee"}});
  assert.equal(charge.success,true,JSON.stringify(charge));assert.equal(r.records("BookingAdjustments")[0].type,"SURCHARGE");
  const current=r.records("Bookings")[0];
  r.addRecord("Payments",{paymentId:"deposit-source",bookingId:b.bookingId,paymentType:"DEPOSIT",amount:175,paymentStatus:"PAID",refundAmount:0});
  const body={action:"staff.depositRefund",token,bookingId:b.bookingId,expectedRecordVersion:Number(current.recordVersion),expectedStatus:"CHECKED_IN",idempotencyKey:"deposit-refund-01",data:{sourcePaymentId:"deposit-source",amount:60,confirmRefund:true,reason:"Manual approved refund"}};
  const refund=r.invokeStaff(body);assert.equal(refund.success,true,JSON.stringify(refund));
  assert.equal(r.records("Payments").filter(x=>x.paymentType==="REFUND").length,1);
  assert.equal(Number(r.records("Payments").find(x=>x.paymentId==="deposit-source").refundAmount),60);
  assert.equal(r.records("BookingAdjustments").some(x=>x.type==="REFUND"),true);
  const changed=r.records("Bookings")[0];
  const excess=r.invokeStaff(Object.assign({},body,{expectedRecordVersion:Number(changed.recordVersion),idempotencyKey:"deposit-refund-02",data:{sourcePaymentId:"deposit-source",amount:116,confirmRefund:true,reason:"Too high"}}));
  assert.equal(excess.success,false);assert.equal(r.records("Payments").filter(x=>x.paymentType==="REFUND").length,1);
});

test("early checkout requires checked-in state, records effective date and does not reprice", () => {
  const r=staffRuntime(),token=loggedIn(r),b=addBooking(r,{bookingStatus:"CHECKED_IN",checkinDate:"2099-05-01",checkoutDate:"2099-05-03",estimatedTotal:999});
  const out=r.invokeStaff({action:"staff.earlyCheckout",token,bookingId:b.bookingId,expectedRecordVersion:1,expectedStatus:"CHECKED_IN",idempotencyKey:"early-checkout-01",data:{actualCheckoutDate:"2099-05-02",reason:"Family request"}});
  assert.equal(out.success,true,JSON.stringify(out));assert.equal(r.records("Bookings")[0].bookingStatus,"CHECKED_OUT");assert.equal(r.records("Bookings")[0].estimatedTotal,999);
  const adj=r.records("BookingAdjustments")[0];assert.equal(adj.type,"EARLY_CHECKOUT");assert.equal(adj.effectiveDate,"2099-05-02");assert.equal(adj.reason,"Family request");
});


function addPaidPayment(r, bookingId, paymentId, paymentType, amount) {
  r.addRecord("Payments", {
    paymentId,
    bookingId,
    paymentType,
    amount,
    currency: "HKD",
    paymentStatus: "PAID",
    paymentMethod: "MANUAL",
    transactionReference: "TEST-" + paymentId,
    paidAt: "2099-05-01T10:00:00.000Z",
    recordedByStaffId: "staff-test-1",
    refundAmount: 0,
    createdAt: "2099-05-01T10:00:00.000Z",
    sourcePaymentId: "",
  });
}

function validNewRabbit(name) {
  return {
    name,
    breed: "Lionhead",
    ageValue: 6,
    ageUnit: "month",
    sex: "male",
    sterilized: "no",
    pregnant: "",
    recentSurgery: "no",
    vetVisit: "no",
    vetDetails: "",
    infectiousDisease: "no",
    infectiousDetails: "",
    chronicDisease: "no",
    chronicDetails: "",
    medication: "no",
    medicationDetails: "",
    specialCare: "",
    fleaTreatment: "no",
  };
}

test("signed manual fees create separate per-pet rows and remain editable after completion", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "COMPLETED",
    species: "rabbit",
    roomTypeId: "DELUXE_SUITE",
    quantity: 2,
    estimatedTotal: 700,
    depositAmount: 350,
    depositStatus: "PAID",
  });
  const p1 = addStaffPet(r, b.bookingId);
  const p2 = addStaffPet(r, b.bookingId, { petId: b.bookingId + "-PET-02", petNumber: 2, name: "Pudding" });
  addPaidPayment(r, b.bookingId, "PAY-FEE-DEPOSIT", "DEPOSIT", 350);
  const addRequest = {
    action: "staff.surchargeAdd",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-per-pet-fee-01",
    data: { amount: 50, description: "梳毛", reason: "每隻各一次", petIds: [p1.petId, p2.petId] },
  };
  const added = r.invokeStaff(addRequest);
  assert.equal(added.success, true, JSON.stringify(added));
  let feeRows = r.records("BookingAdjustments").filter((entry) => entry.type === "SURCHARGE");
  assert.equal(feeRows.length, 2);
  assert.deepEqual(feeRows.map((entry) => entry.amount), [50, 50]);
  assert.deepEqual(feeRows.map((entry) => entry.petId).sort(), [p1.petId, p2.petId].sort());
  assert.equal(feeRows[0].groupId, feeRows[1].groupId);
  assert.ok(feeRows[0].groupId);
  assert.equal(r.records("Logs").at(-1).actorStaffNameSnapshot, "Test Staff");

  const replay = r.invokeStaff(addRequest);
  assert.equal(replay.success, true);
  assert.equal(r.records("BookingAdjustments").length, 2, "idempotent replay must not add rows");
  const changed = r.records("Bookings")[0];
  const reduced = r.invokeStaff({
    action: "staff.surchargeAdd",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: Number(changed.recordVersion),
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-per-pet-fee-02",
    data: { amount: -20, description: "梳毛減項", reason: "其中一隻不需梳毛", petIds: [p1.petId] },
  });
  assert.equal(reduced.success, true, JSON.stringify(reduced));
  feeRows = r.records("BookingAdjustments").filter((entry) => entry.type === "SURCHARGE");
  assert.deepEqual(feeRows.map((entry) => entry.amount), [50, 50, -20]);
  assert.equal(Number(r.records("Bookings")[0].remainingBalance), 430);
});

test("fee reversals append signed offsets, preserve source rows, and cannot double reverse", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "COMPLETED",
    checkinDate: "2099-05-03",
    checkoutDate: "2099-05-04",
    baseRoomFee: 100,
    estimatedTotal: 100,
    depositAmount: 50,
    remainingBalance: 50,
  });
  const pet = addStaffPet(r, b.bookingId);
  const add = r.invokeStaff({
    action: "staff.surchargeAdd",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-append-fee-add",
    data: { amount: 50, description: "單次梳毛", reason: "測試附加費", petIds: [pet.petId] },
  });
  assert.equal(add.success, true, JSON.stringify(add));
  const sourceBefore = JSON.parse(JSON.stringify(r.records("BookingAdjustments")[0]));
  const afterAdd = r.records("Bookings")[0];
  const reverse = r.invokeStaff({
    action: "staff.surchargeReverse",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: Number(afterAdd.recordVersion),
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-append-fee-reverse",
    data: { adjustmentId: sourceBefore.adjustmentId, reason: "服務取消" },
  });
  assert.equal(reverse.success, true, JSON.stringify(reverse));
  const rows = r.records("BookingAdjustments");
  assert.deepEqual(JSON.parse(JSON.stringify(rows.find((entry) => entry.adjustmentId === sourceBefore.adjustmentId))), sourceBefore);
  const reversal = rows.find((entry) => entry.type === "REVERSAL");
  assert.equal(Number(reversal.amount), -50);
  assert.equal(reversal.status, "RECORDED");
  assert.equal(reversal.reversesAdjustmentId, sourceBefore.adjustmentId);
  assert.equal(Number(r.records("Bookings")[0].remainingBalance), 50);

  const afterReverse = r.records("Bookings")[0];
  const duplicate = r.invokeStaff({
    action: "staff.surchargeReverse",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: Number(afterReverse.recordVersion),
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-append-fee-reverse-again",
    data: { adjustmentId: sourceBefore.adjustmentId, reason: "重複撤銷" },
  });
  assert.equal(duplicate.success, false);
  assert.equal(r.records("BookingAdjustments").length, 2);
  const revenue = r.invokeStaff({ action: "staff.revenue", token, year: "2099", month: "2099-05" });
  assert.equal(revenue.success, true, JSON.stringify(revenue));
  assert.equal(Number(revenue.data.monthly.find((row) => row.month === "2099-05").bookedRevenue), 100);
});

test("pet addition before deposit recalculates all canonical totals and required deposit", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "PENDING_CONFIRMATION",
    species: "rabbit",
    roomTypeId: "DELUXE_SUITE",
    checkinDate: "2099-05-03",
    checkoutDate: "2099-05-05",
    quantity: 1,
    baseRoomFee: 700,
    extraPetFee: 0,
    weekendFee: 0,
    serviceFees: 0,
    totalSurcharges: 0,
    estimatedTotal: 700,
    depositAmount: 350,
    remainingBalance: 350,
    cashDepositAmount: 1000,
  });
  addStaffPet(r, b.bookingId);
  const request = {
    action: "staff.petCountUpdate",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "PENDING_CONFIRMATION",
    idempotencyKey: "v31-pet-add-before-deposit",
    data: { removePetIds: [], newPets: [validNewRabbit("Hazel")], reason: "客人增加一隻兔兔" },
  };
  const result = r.invokeStaff(request);
  assert.equal(result.success, true, JSON.stringify(result));
  const updated = r.records("Bookings")[0];
  assert.equal(Number(updated.quantity), 2);
  assert.equal(Number(updated.baseRoomFee), 700);
  assert.equal(Number(updated.extraPetFee), 100);
  assert.equal(Number(updated.estimatedTotal), 800);
  assert.equal(Number(updated.depositAmount), 350, "deposit remains 50% of base room fee");
  assert.equal(Number(updated.remainingBalance), 450);
  assert.equal(Number(updated.cashDepositAmount), 2000);
  assert.equal(updated.allocatedRoomIdsJson, "[]", "pending booking must not receive physical allocation");
  assert.equal(r.records("Pets").filter((pet) => pet.petStatus !== "REMOVED").length, 2);
  assert.equal(r.records("Pets").find((pet) => pet.name === "Hazel").healthReviewStatus, "");
  assert.equal(r.records("Logs").at(-1).actorStaffNameSnapshot, "Test Staff");
  assert.equal(result.data.remainingBalance, 450);
  assert.equal(result.data.creditDue, 0);
  const replay = r.invokeStaff(request);
  assert.equal(replay.success, true);
  assert.equal(r.records("Pets").length, 2, "replayed request must not duplicate a new pet");
});

test("pet addition after deposit preserves paid deposit and recalculates only the due balance", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "CONFIRMED",
    species: "rabbit",
    roomTypeId: "DELUXE_SUITE",
    checkinDate: "2099-05-03",
    checkoutDate: "2099-05-05",
    quantity: 1,
    allocatedRoomIdsJson: '["S1","S2"]',
    baseRoomFee: 700,
    estimatedTotal: 700,
    depositAmount: 350,
    depositStatus: "PAID",
    remainingBalance: 350,
  });
  addStaffPet(r, b.bookingId);
  addPaidPayment(r, b.bookingId, "PAY-CONFIRMED-DEPOSIT", "DEPOSIT", 350);
  const result = r.invokeStaff({
    action: "staff.petCountUpdate",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "CONFIRMED",
    idempotencyKey: "v31-pet-add-after-deposit",
    data: { removePetIds: [], newPets: [validNewRabbit("Hazel")], reason: "客人加寵物" },
  });
  assert.equal(result.success, true, JSON.stringify(result));
  const updated = r.records("Bookings")[0];
  assert.equal(Number(updated.depositAmount), 350, "a paid deposit must not be recalculated");
  assert.equal(Number(updated.estimatedTotal), 800);
  assert.equal(Number(updated.remainingBalance), 450);
  assert.equal(Number(updated.cashDepositAmount), 2000);
  assert.equal(updated.allocatedRoomIdsJson, '["S1","S2"]', "pet update must not reassign rooms");
  assert.equal(result.data.creditDue, 0);
});

test("completed booking pet removal recalculates totals but preserves received deposit and cash", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "COMPLETED",
    species: "rabbit",
    roomTypeId: "DELUXE_SUITE",
    quantity: 2,
    estimatedTotal: 800,
    depositAmount: 350,
    depositStatus: "PAID",
    balanceStatus: "PAID",
    remainingBalance: 0,
    cashDepositAmount: 2000,
    cashDepositStatus: "COLLECTED",
    cashDepositCollected: true,
    cashDepositCollectedAmount: 2000,
  });
  const firstPet = addStaffPet(r, b.bookingId);
  const secondPet = addStaffPet(r, b.bookingId, { petId: b.bookingId + "-PET-02", petNumber: 2, name: "Pudding" });
  addPaidPayment(r, b.bookingId, "PAY-REMOVAL-DEPOSIT", "DEPOSIT", 350);
  addPaidPayment(r, b.bookingId, "PAY-REMOVAL-BALANCE", "BALANCE", 450);
  const fee = r.invokeStaff({
    action: "staff.surchargeAdd",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-pet-removal-fee",
    data: { amount: 25, description: "梳毛", reason: "Pudding 需要梳毛", petIds: [secondPet.petId] },
  });
  assert.equal(fee.success, true, JSON.stringify(fee));
  const sourceFee = JSON.parse(JSON.stringify(r.records("BookingAdjustments")[0]));
  const afterFee = r.records("Bookings")[0];
  const result = r.invokeStaff({
    action: "staff.petCountUpdate",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: Number(afterFee.recordVersion),
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-pet-remove-after-paid",
    data: { removePetIds: [secondPet.petId], newPets: [], reason: "客人減少一隻" },
  });
  assert.equal(result.success, true, JSON.stringify(result));
  const updated = r.records("Bookings")[0];
  assert.equal(Number(updated.quantity), 1);
  assert.equal(Number(updated.estimatedTotal), 700);
  assert.equal(Number(updated.depositAmount), 350);
  assert.equal(Number(updated.remainingBalance), 0);
  assert.equal(Number(updated.cashDepositAmount), 1000);
  assert.equal(Number(updated.cashDepositCollectedAmount), 2000, "received cash is not silently refunded");
  assert.equal(r.records("Pets").find((pet) => pet.petId === secondPet.petId).petStatus, "REMOVED");
  assert.equal(r.records("Pets").find((pet) => pet.petId === secondPet.petId).removeReason, "客人減少一隻");
  assert.equal(r.records("Pets").find((pet) => pet.petId === firstPet.petId).petStatus || "", "");
  assert.equal(result.data.creditDue, 100);
  const adjustmentRows = r.records("BookingAdjustments");
  assert.deepEqual(JSON.parse(JSON.stringify(adjustmentRows.find((entry) => entry.adjustmentId === sourceFee.adjustmentId))), sourceFee);
  const removedPetReversal = adjustmentRows.find((entry) => entry.type === "REVERSAL");
  assert.equal(Number(removedPetReversal.amount), -25);
  assert.equal(removedPetReversal.reversesAdjustmentId, sourceFee.adjustmentId);
  const details = r.invokeStaff({ action: "staff.bookingDetail", token, bookingId: b.bookingId });
  assert.equal(details.data.booking.cashDepositRefundDue, 2000);
  assert.equal(details.data.logs.at(-1).actorStaffNameSnapshot, "Test Staff");
});

test("partial refunds can target paid balance payments and enforce cumulative net limits", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "COMPLETED",
    estimatedTotal: 450,
    depositAmount: 350,
    depositStatus: "PAID",
    remainingBalance: 0,
  });
  addPaidPayment(r, b.bookingId, "PAY-REFUND-DEPOSIT", "DEPOSIT", 350);
  addPaidPayment(r, b.bookingId, "PAY-REFUND-BALANCE", "BALANCE", 100);
  const request = {
    action: "staff.depositRefund",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "COMPLETED",
    idempotencyKey: "v31-balance-refund-01",
    data: { sourcePaymentId: "PAY-REFUND-BALANCE", amount: 30, reason: "TEST 手動退款", confirmRefund: true },
  };
  const first = r.invokeStaff(request);
  assert.equal(first.success, true, JSON.stringify(first));
  assert.equal(Number(r.records("Payments").find((payment) => payment.paymentId === "PAY-REFUND-BALANCE").refundAmount), 30);
  const afterFirst = r.records("Bookings")[0];
  const excess = r.invokeStaff(Object.assign({}, request, {
    expectedRecordVersion: Number(afterFirst.recordVersion),
    idempotencyKey: "v31-balance-refund-excess",
    data: { sourcePaymentId: "PAY-REFUND-BALANCE", amount: 71, reason: "超出餘額", confirmRefund: true },
  }));
  assert.equal(excess.success, false);
  assert.equal(r.records("Payments").filter((payment) => payment.paymentType === "REFUND").length, 1);
  const last = r.invokeStaff(Object.assign({}, request, {
    expectedRecordVersion: Number(r.records("Bookings")[0].recordVersion),
    idempotencyKey: "v31-balance-refund-02",
    data: { sourcePaymentId: "PAY-REFUND-BALANCE", amount: 70, reason: "退回餘額", confirmRefund: true },
  }));
  assert.equal(last.success, true, JSON.stringify(last));
  assert.equal(Number(r.records("Payments").find((payment) => payment.paymentId === "PAY-REFUND-BALANCE").refundAmount), 100);
  assert.equal(r.records("Payments").filter((payment) => payment.paymentType === "REFUND").length, 2);
  assert.equal(Number(r.records("Bookings")[0].remainingBalance), 100);
  assert.ok(r.records("Logs").every((log) => log.actorStaffNameSnapshot === "Test Staff"));
});

test("cancelled bookings can record a bounded manual refund without reopening settlement", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r, {
    bookingStatus: "CANCELLED",
    estimatedTotal: 200,
    depositAmount: 100,
    remainingBalance: 0,
    balanceStatus: "PAID",
  });
  addPaidPayment(r, b.bookingId, "PAY-CANCELLED-DEPOSIT", "DEPOSIT", 100);
  const result = r.invokeStaff({
    action: "staff.depositRefund",
    token,
    bookingId: b.bookingId,
    expectedRecordVersion: 1,
    expectedStatus: "CANCELLED",
    idempotencyKey: "v31-cancelled-partial-refund",
    data: { sourcePaymentId: "PAY-CANCELLED-DEPOSIT", amount: 40, reason: "取消後酌情部分退款", confirmRefund: true },
  });
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(Number(r.records("Payments").find((payment) => payment.paymentId === "PAY-CANCELLED-DEPOSIT").refundAmount), 40);
  assert.equal(r.records("Payments").filter((payment) => payment.paymentType === "REFUND").length, 1);
  assert.equal(Number(r.records("Bookings")[0].remainingBalance), 0, "cancelled booking balance must not be recalculated");
  assert.equal(r.records("Bookings")[0].bookingStatus, "CANCELLED");
  assert.equal(r.records("Logs").at(-1).actorStaffNameSnapshot, "Test Staff");
});

test("legacy booking Logs resolve Staff name by actorStaffId", () => {
  const r = staffRuntime();
  const token = loggedIn(r);
  const b = addBooking(r);
  r.addRecord("Logs", {
    logId: "LEGACY-LOG-1",
    createdAt: "2099-05-01T10:00:00.000Z",
    actorType: "STAFF",
    actorStaffId: "staff-test-1",
    actorStaffNameSnapshot: "",
    action: "staff.edit",
    entityType: "BOOKING",
    entityId: b.bookingId,
    requestId: "LEGACY-REQUEST-1",
    summary: "舊紀錄",
    changedFieldsJson: "{}",
  });
  const detail = r.invokeStaff({ action: "staff.bookingDetail", token, bookingId: b.bookingId });
  assert.equal(detail.success, true);
  assert.equal(detail.data.logs[0].actorStaffNameSnapshot, "Test Staff");
});
