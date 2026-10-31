"use strict";
const test = require("node:test");
const { assert, createRuntime } = require("./harness");
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
test("Customers group duplicate email or phone into one customer", () => {
  const r = staffRuntime(),
    token = loggedIn(r);
  addBooking(r, {
    bookingId: "A",
    email: "same@example.com",
    parentName: "One",
  });
  addBooking(r, {
    bookingId: "B",
    email: "same@example.com",
    parentName: "One",
  });
  const out = r.invokeStaff({ action: "staff.customers", token });
  assert.equal(out.data.customers.length, 1);
  assert.equal(out.data.customers[0].bookings.length, 2);
});
test("Revenue excludes all cash deposit payment types", () => {
  const r = staffRuntime(),
    token = loggedIn(r);
  addBooking(r);
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
  assert.equal(out.data.monthAccommodationRevenue, 20);
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
