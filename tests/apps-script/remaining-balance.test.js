'use strict';

const test = require('node:test');
const {
  assert, createRuntime, makePayload, makePet, addDays, hkDateString
} = require('./harness');

// All spreadsheet access is the harness's in-memory FakeSpreadsheet. Synthetic
// Staff/Sessions fixtures deliberately avoid login and password handling.
const STAFF_ID = 'staff-remaining-balance';
const TOKEN = 'synthetic-remaining-balance-session';
const LEDGER_SHEETS = ['Bookings', 'Pets', 'Payments', 'BookingAdjustments', 'Logs', 'IdempotencyKeys'];

function staffRuntime(options = {}) {
  const r = createRuntime(options);
  r.addRecord('Staff', {
    staffId: STAFF_ID, username: 'balance-fixture', displayName: 'Balance Fixture',
    role: 'ADMIN', isActive: true
  });
  r.addRecord('Sessions', {
    sessionId: 'session-remaining-balance', staffId: STAFF_ID,
    tokenHash: r.context.littlelandStaffHash_(TOKEN),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), revokedAt: ''
  });
  return r;
}

function futureTuesday() {
  const start = addDays(hkDateString(), 60);
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (new Date(day + 'T00:00:00Z').getUTCDay() === 2) return day;
  }
  throw new Error('Unable to construct a future Tuesday fixture.');
}

function payloadFor(r, key, overrides = {}) {
  const checkin = futureTuesday();
  return makePayload(r, Object.assign({
    checkin, checkout: addDays(checkin, 2), roomId: 'DELUXE_ROOM'
  }, overrides), { idempotencyKey: key });
}

function addBooking(r, overrides = {}, formOverrides = {}) {
  const payload = payloadFor(r, 'balance-fixture-booking', formOverrides);
  const validated = r.context.littlelandValidateBookingRequest_(payload);
  const pricing = r.context.LittleLandPricing.calculatePricing(validated.pricingInput);
  const record = Object.assign(
    r.context.littlelandBuildBookingRecord_(validated, pricing, 'TEST-BALANCE-001', new Date().toISOString()),
    {
      bookingStatus: 'CHECKED_IN', allocatedRoomIdsJson: '["A1"]',
      remainingBalance: pricing.estimatedTotal, followUpRequired: true
    }, overrides
  );
  r.addRecord('Bookings', record);
  r.context.littlelandBuildPetRecords_(validated, record.bookingId, record.createdAt)
    .forEach((pet) => r.addRecord('Pets', pet));
  return record;
}

function current(r, id = 'TEST-BALANCE-001') {
  const record = r.records('Bookings').find((b) => b.bookingId === id);
  assert.ok(record, 'fixture booking must exist');
  return record;
}

function addPayment(r, b, id, type, amount, overrides = {}) {
  r.addRecord('Payments', Object.assign({
    paymentId: id, bookingId: b.bookingId, paymentType: type, amount,
    currency: 'HKD', paymentStatus: 'PAID', paymentMethod: 'MANUAL',
    transactionReference: 'TEST-' + id, paidAt: new Date().toISOString(),
    recordedByStaffId: STAFF_ID, refundAmount: 0, refundedAt: '',
    note: 'synthetic preserved receipt', createdAt: new Date().toISOString(), sourcePaymentId: ''
  }, overrides));
}

function seedDeposit(r, b) {
  addPayment(r, b, 'PAY-ORIGINAL-DEPOSIT', 'DEPOSIT', b.depositAmount);
  r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, {
    depositStatus: 'PAID', remainingBalance: b.estimatedTotal - b.depositAmount
  });
}

function seedFullyPaid(r, b) {
  seedDeposit(r, b);
  addPayment(r, b, 'PAY-ORIGINAL-BALANCE', 'BALANCE', b.estimatedTotal - b.depositAmount);
  r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, {
    remainingBalance: 0, balanceStatus: 'PAID'
  });
}

function requestFor(r, action, key, data = {}, overrides = {}) {
  const b = current(r);
  return Object.assign({
    action, token: TOKEN, bookingId: b.bookingId,
    expectedRecordVersion: b.recordVersion, expectedStatus: b.bookingStatus,
    idempotencyKey: key, data
  }, overrides);
}

function success(response) {
  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.code, 'OK');
  return response.data;
}

function snapshot(r) {
  return LEDGER_SHEETS.map((name) => structuredClone(r.records(name)));
}

function assertOldPaymentsPreserved(r, before) {
  before.forEach((payment) => {
    assert.deepEqual(r.records('Payments').find((row) => row.paymentId === payment.paymentId), payment,
      'every earlier Payment must be preserved exactly: ' + payment.paymentId);
  });
}

function assertDue(r, expected) {
  const b = current(r);
  assert.equal(b.remainingBalance, expected, 'persisted balance must be actual current debt');
  assert.equal(b.balanceStatus, expected === 0 ? 'PAID' : 'UNPAID');
}

function assertReadBalances(r, expected) {
  const b = current(r), before = snapshot(r), writes = r.getWriteCount();
  const detail = success(r.invokeStaff({ action: 'staff.bookingDetail', token: TOKEN, bookingId: b.bookingId }));
  assert.equal(detail.booking.remainingBalance, expected, 'bookingDetail.booking actual balance');
  assert.equal(detail.detail.remainingBalance, expected, 'bookingDetail.detail alias actual balance');
  const list = success(r.invokeStaff({ action: 'staff.bookings', token: TOKEN }));
  assert.equal(list.bookings.find((row) => row.bookingId === b.bookingId).remainingBalance, expected, 'booking list actual balance');
  const dashboard = success(r.invokeStaff({ action: 'staff.dashboard', token: TOKEN }));
  assert.equal(dashboard.recent.find((row) => row.bookingId === b.bookingId).remainingBalance, expected, 'dashboard actual balance');
  const calendar = success(r.invokeStaff({ action: 'staff.calendar', token: TOKEN, month: b.checkinDate.slice(0, 7) }));
  assert.equal(calendar.bookings.find((row) => row.bookingId === b.bookingId).remainingBalance, expected, 'calendar actual balance');
  const followups = success(r.invokeStaff({ action: 'staff.followups', token: TOKEN }));
  const followup = followups.bookings.find((row) => row.bookingId === b.bookingId);
  if (b.followUpRequired === true || b.followUpRequired === 'true') {
    assert.ok(followup, 'flagged fixture must appear in follow-ups');
    assert.equal(followup.remainingBalance, expected, 'follow-up actual balance');
  } else if (b.bookingStatus === 'CONFIRMED') {
    assert.equal(followup, undefined, 'successful deposit confirmation clears follow-up status');
  }
  const customers = success(r.invokeStaff({ action: 'staff.customers', token: TOKEN }));
  const customerBooking = customers.customers.flatMap((row) => row.bookings).find((row) => row.bookingId === b.bookingId);
  assert.equal(customerBooking.remainingBalance, expected, 'customer booking actual balance');
  const payments = success(r.invokeStaff({ action: 'staff.payments', token: TOKEN }));
  const paymentItem = payments.items.find((row) => row.bookingId === b.bookingId);
  // CHECKED_IN fixtures always have uncollected cash, so this row must be present,
  // even when the accommodation balance is fully paid.
  if (b.bookingStatus === 'CHECKED_IN' && b.cashDepositStatus === 'NOT_COLLECTED') {
    assert.ok(paymentItem, 'uncollected cash fixture must remain in payment list');
    assert.equal(paymentItem.remainingBalance, expected, 'payments item actual balance');
    assert.equal(payments.summary.pendingBalancesTotal, expected, 'summary must not use stale cached due/status');
  }
  assert.deepEqual(snapshot(r), before, 'read APIs must reconcile in their response without mutating any ledger');
  assert.equal(r.getWriteCount(), writes, 'read APIs must remain read-only');
}

function collect(r, key) {
  const before = structuredClone(r.records('Payments'));
  const due = current(r).remainingBalance, version = current(r).recordVersion;
  const out = success(r.invokeStaff(requestFor(r, 'staff.recordBalance', key, {
    method: 'BANK_TRANSFER', reference: 'TEST-' + key
  })));
  assert.equal(out.detail.remainingBalance, 0, 'successful collection response must immediately show zero');
  assert.equal(out.detail.balanceStatus, 'PAID');
  assertDue(r, 0);
  assert.equal(current(r).recordVersion, version + 1);
  assert.equal(r.records('Payments').length, before.length + 1, 'collection appends exactly one receipt');
  const payment = r.records('Payments').at(-1);
  assert.equal(payment.paymentType, 'BALANCE');
  assert.equal(payment.paymentStatus, 'PAID');
  assert.equal(payment.amount, due, 'collect only this cycle\'s actual outstanding amount');
  assert.equal(payment.bookingId, current(r).bookingId);
  assertOldPaymentsPreserved(r, before);
  return payment;
}

function surcharge(r, key, amount) {
  return success(r.invokeStaff(requestFor(r, 'staff.surchargeAdd', key, {
    amount, description: 'Synthetic additional care', reason: 'Regression fee', billingBasis: 'ONCE'
  })));
}

function extension(r, key, checkout) {
  return success(r.invokeStaff(requestFor(r, 'staff.extendStay', key, {
    newCheckoutDate: checkout, internalAssignment: 'EXT',
    reason: 'Regression extension', internalAssignmentNote: 'Synthetic onsite allocation'
  })));
}

function canonicalQuote(r, b, overrides = {}) {
  const input = Object.assign({
    species: b.species, roomId: b.roomTypeId, checkin: b.checkinDate, checkout: b.checkoutDate,
    quantity: b.quantity, groomingOnce: b.groomingOnce, groomingDaily: b.groomingDaily,
    medicine: b.medicine, earlyCheckin: b.earlyCheckin, lateCheckout: b.lateCheckout
  }, overrides);
  return r.context.LittleLandPricing.calculatePricing(r.context.littlelandPricingInput_(input));
}

// Seven acceptance criteria. Each uses public mocked API actions where applicable;
// repeated collection is not simulated by manually setting balanceStatus to PAID.
for (const route of ['public', 'staff']) {
  test('criterion 1: ' + route + ' creation with no paid receipts owes the full total, while quote/snapshot remains projected', () => {
    const r = staffRuntime(), payload = payloadFor(r, 'balance-create-' + route, {
      groomingOnce: true, groomingDaily: true, earlyCheckin: true
    });
    const out = success(route === 'public' ? r.invokePost(payload) : r.invokeStaff({
      action: 'staff.createBooking', token: TOKEN, request: payload
    }));
    const b = r.records('Bookings')[0], projected = payload.clientQuote;
    assert.equal(b.remainingBalance, projected.estimatedTotal, 'no receipt means no deposit may be deducted');
    assert.equal(b.depositStatus, 'UNPAID');
    assert.equal(b.balanceStatus, 'UNPAID');
    assert.equal(r.records('Payments').length, 0);
    if (route === 'public') {
      assert.equal(out.price.remainingBalance, projected.remainingBalance, 'public price is the unchanged pricing-engine quote');
      assert.equal(out.price.remainingBalance, projected.estimatedTotal - projected.depositAmount);
      assert.notEqual(out.price.remainingBalance, b.remainingBalance);
      const idem = r.records('IdempotencyKeys').find((row) => row.idempotencyKey === payload.idempotencyKey);
      const frozenPrice = JSON.parse(idem.responseSnapshotJson).data.price;
      assert.deepEqual(frozenPrice, out.price, 'idempotency snapshot must retain original projected quote');
      const replay = success(r.invokePost(payload));
      assert.deepEqual(replay.price, frozenPrice);
      assert.equal(r.records('Bookings').length, 1);
      assert.equal(r.records('Payments').length, 0);
    }
  });
}

test('criterion 2: confirming a paid deposit changes actual debt to total minus the receipt', () => {
  const r = staffRuntime(), b = addBooking(r, { bookingStatus: 'PENDING_DEPOSIT', allocatedRoomIdsJson: '[]' });
  const out = success(r.invokeStaff(requestFor(r, 'staff.confirmDeposit', 'balance-deposit-confirm')));
  assert.equal(out.confirmed, true);
  assert.equal(out.detail.remainingBalance, b.estimatedTotal - b.depositAmount);
  assert.equal(out.detail.depositStatus, 'PAID');
  assertDue(r, b.estimatedTotal - b.depositAmount);
  assert.equal(r.records('Payments').length, 1);
  assert.equal(r.records('Payments')[0].paymentType, 'DEPOSIT');
  assert.equal(r.records('Payments')[0].amount, b.depositAmount);
  assertReadBalances(r, b.estimatedTotal - b.depositAmount);
});

test('criterion 2: received deposit still reduces debt when room conflict leaves the booking pending', () => {
  const r = staffRuntime(), b = addBooking(r, { bookingStatus: 'PENDING_DEPOSIT', allocatedRoomIdsJson: '[]' });
  ['A1', 'A2', 'A3'].forEach((room, i) => r.addRecord('Bookings', {
    bookingId: 'BUSY-' + i, bookingStatus: 'CONFIRMED', recordVersion: 1,
    checkinDate: b.checkinDate, checkoutDate: b.checkoutDate, roomTypeId: b.roomTypeId,
    allocatedRoomIdsJson: JSON.stringify([room])
  }));
  const out = success(r.invokeStaff(requestFor(r, 'staff.confirmDeposit', 'balance-deposit-room-conflict')));
  assert.equal(out.confirmed, false);
  assert.equal(out.roomConflict, true);
  assert.equal(out.detail.bookingStatus, 'PENDING_DEPOSIT');
  assert.equal(out.detail.remainingBalance, b.estimatedTotal - b.depositAmount);
  assert.equal(r.records('Payments').length, 1);
  assertDue(r, b.estimatedTotal - b.depositAmount);
});

test('criterion 3: full balance collection immediately persists and returns zero, and a new key cannot collect again', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedDeposit(r, b);
  collect(r, 'balance-first-full-collection');
  assertReadBalances(r, 0);
  const before = snapshot(r), writes = r.getWriteCount();
  const duplicate = r.invokeStaff(requestFor(r, 'staff.recordBalance', 'balance-duplicate-new-key'));
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.code, 'BOOKING_STATUS_INVALID');
  assert.deepEqual(snapshot(r), before, 'zero-due rejection must not claim a key, bump version or append payment/log');
  assert.equal(r.getWriteCount(), writes);
});

test('criterion 3: collecting without a deposit receipt collects the full actual debt, not the projected quote balance', () => {
  const r = staffRuntime(), b = addBooking(r);
  const receipt = collect(r, 'balance-no-deposit-collect');
  assert.equal(receipt.amount, b.estimatedTotal);
  assert.equal(r.records('Payments').filter((p) => p.paymentType === 'DEPOSIT').length, 0);
  assert.equal(current(r).depositAmount, b.depositAmount);
  assertReadBalances(r, 0);
});

test('criterion 4: extension after full payment creates only the newly repriced fee as actual debt', () => {
  const r = staffRuntime(), b = addBooking(r, {}, { groomingOnce: true, groomingDaily: true, earlyCheckin: true });
  seedFullyPaid(r, b);
  const before = structuredClone(r.records('Payments')), old = current(r);
  const checkout = addDays(old.checkoutDate, 2);
  const quote = canonicalQuote(r, old, { checkout });
  const addedFee = quote.estimatedTotal - old.estimatedTotal;
  assert.ok(addedFee > 0);
  const out = extension(r, 'balance-extension-after-paid', checkout);
  assert.equal(out.remainingBalance, addedFee);
  assert.equal(out.paidAmount, old.estimatedTotal);
  assertDue(r, addedFee);
  assert.equal(current(r).estimatedTotal, quote.estimatedTotal);
  assert.equal(current(r).depositAmount, old.depositAmount, 'paid deposit must not be repriced');
  assert.equal(current(r).depositStatus, 'PAID');
  assert.deepEqual(r.records('Payments'), before, 'extension cannot create or rewrite any Payment');
  collect(r, 'balance-extension-new-fee-collect');
  assertReadBalances(r, 0);
});

test('criterion 4: surcharge after full payment reopens only the new fee, including cents', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedFullyPaid(r, b);
  const before = structuredClone(r.records('Payments'));
  const out = surcharge(r, 'balance-surcharge-after-paid', 37.25);
  assert.equal(out.remainingBalance, 37.25);
  assert.equal(out.creditDue, 0);
  assertDue(r, 37.25);
  assert.equal(current(r).estimatedTotal, b.estimatedTotal, 'manual fees remain a separate signed adjustment ledger');
  assert.deepEqual(r.records('Payments'), before);
  assertReadBalances(r, 37.25);
  assert.equal(collect(r, 'balance-surcharge-new-fee-collect').amount, 37.25);
});

test('criteria 5, 6 and 7: six extension/add-fee/pay-again cycles stay unlimited, preserve receipts/deposit, and never double revenue or include cash', () => {
  const r = staffRuntime(), b = addBooking(r, {}, { groomingDaily: true });
  seedFullyPaid(r, b);
  const originalPayments = structuredClone(r.records('Payments'));
  const deposit = current(r).depositAmount;
  let expectedCollected = b.estimatedTotal, manualFees = 0;
  const initialCash = success(r.invokeStaff(requestFor(r, 'staff.cashDepositCollect', 'balance-cycles-cash-collect')));
  assert.equal(initialCash.detail.remainingBalance, 0);
  assertDue(r, 0);
  for (const [action, amount, key] of [
    ['staff.cashDepositUse', 120, 'balance-cycles-cash-use'],
    ['staff.cashDepositRefund', 80, 'balance-cycles-cash-refund']
  ]) {
    success(r.invokeStaff(requestFor(r, action, key, { amount })));
    assertDue(r, 0);
  }
  for (let cycle = 1; cycle <= 6; cycle += 1) {
    const before = structuredClone(r.records('Payments')), old = current(r);
    let newFee;
    if (cycle % 2 === 1) {
      const checkout = addDays(old.checkoutDate, 2);
      const quote = canonicalQuote(r, old, { checkout });
      newFee = quote.estimatedTotal - old.estimatedTotal;
      assert.equal(extension(r, 'balance-cycle-extension-' + cycle, checkout).remainingBalance, newFee);
    } else {
      newFee = cycle * 10 + 0.25;
      manualFees += newFee;
      assert.equal(surcharge(r, 'balance-cycle-surcharge-' + cycle, newFee).remainingBalance, newFee);
    }
    assertDue(r, newFee);
    assert.deepEqual(r.records('Payments'), before, 'a fee change must not rewrite any prior ledger row');
    const receipt = collect(r, 'balance-cycle-collection-' + cycle);
    assert.equal(receipt.amount, newFee);
    expectedCollected += newFee;
    assert.equal(current(r).depositAmount, deposit);
    assert.equal(current(r).depositStatus, 'PAID');
    assertOldPaymentsPreserved(r, originalPayments);
    assertOldPaymentsPreserved(r, before);
    const receiptsMonth = hkDateString().slice(0, 7);
    const received = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: receiptsMonth }));
    assert.equal(received.monthCollectedRevenue, expectedCollected, 'collected revenue is each receipt once and excludes all cash movement');
    assert.equal(received.monthDepositsReceived, deposit);
    assert.equal(received.monthBalancesReceived, expectedCollected - deposit);
    assert.equal(received.monthSurchargesReceived, 0, 'an adjustment charge is not a second receipt');
    assert.equal(received.monthRefunds, 0, 'cash refund is not an accommodation refund');
    const booked = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: b.checkinDate.slice(0, 7) }));
    assert.equal(booked.monthBookedRevenue, current(r).estimatedTotal + manualFees);
    assert.equal(booked.monthAccommodationRevenue, current(r).estimatedTotal + manualFees);
    assert.equal(booked.byRoomType.find((row) => row.name === b.roomTypeId).amount, current(r).estimatedTotal + manualFees);
  }
  assert.equal(r.records('Payments').filter((p) => p.paymentType === 'BALANCE').length, 7, 'original balance plus all six collections');
  assert.equal(r.records('Payments').filter((p) => p.paymentType === 'DEPOSIT').length, 1);
  assert.equal(r.records('Payments').filter((p) => p.paymentType.startsWith('CASH_DEPOSIT')).length, 3);
  assertDue(r, 0);
  assertReadBalances(r, 0);
});

for (const stale of [0, 99999]) {
  test('ledger read reconciliation: no payment owes full total despite stale remainingBalance=' + stale, () => {
    const r = staffRuntime(), b = addBooking(r, { remainingBalance: stale, balanceStatus: 'PAID', depositStatus: 'PAID' });
    assertReadBalances(r, b.estimatedTotal);
  });
}

test('ledger read reconciliation: only this booking\'s PAID applicable receipts count; pending/failed/void and all cash types do not', () => {
  const r = staffRuntime(), b = addBooking(r, { remainingBalance: 99999 });
  addPayment(r, b, 'ledger-paid-deposit', 'DEPOSIT', 100);
  addPayment(r, b, 'ledger-paid-balance', 'BALANCE', 30);
  addPayment(r, b, 'ledger-paid-adjustment', 'ADJUSTMENT', 10);
  for (const status of ['PENDING', 'UNPAID', 'FAILED', 'VOID']) {
    addPayment(r, b, 'ledger-' + status, 'BALANCE', 5000, { paymentStatus: status });
  }
  for (const type of ['CASH_DEPOSIT', 'CASH_DEPOSIT_USE', 'CASH_DEPOSIT_REFUND']) {
    addPayment(r, b, 'ledger-' + type, type, 5000);
  }
  addPayment(r, b, 'ledger-other-booking', 'BALANCE', 5000, { bookingId: 'OTHER-BOOKING' });
  addPayment(r, b, 'ledger-other-refund', 'REFUND', 5000, { bookingId: 'OTHER-BOOKING' });
  assertReadBalances(r, b.estimatedTotal - 140);
});

for (const status of ['UNPAID', 'PAID']) {
  test('legacy stale positive due with fully paid ledger and balanceStatus=' + status + ' returns zero and cannot create duplicate payment', () => {
    const r = staffRuntime(), b = addBooking(r);
    seedFullyPaid(r, b);
    r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, {
      remainingBalance: 99999, balanceStatus: status
    });
    assertReadBalances(r, 0);
    const before = snapshot(r), writes = r.getWriteCount();
    const out = r.invokeStaff(requestFor(r, 'staff.recordBalance', 'balance-legacy-duplicate-' + status));
    assert.equal(out.success, false);
    assert.equal(out.code, 'BOOKING_STATUS_INVALID');
    assert.deepEqual(snapshot(r), before);
    assert.equal(r.getWriteCount(), writes);
  });
}

test('balance collection recomputes real ledger debt instead of charging a stale positive cached amount', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedDeposit(r, b);
  const owed = b.estimatedTotal - b.depositAmount;
  r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, { remainingBalance: 99999 });
  const before = structuredClone(r.records('Payments'));
  const out = success(r.invokeStaff(requestFor(r, 'staff.recordBalance', 'balance-stale-amount-collect')));
  assert.equal(r.records('Payments').at(-1).amount, owed, 'must never charge the stale cache');
  assert.equal(out.detail.remainingBalance, 0);
  assertDue(r, 0);
  assertOldPaymentsPreserved(r, before);
});

test('unpaid extension owes the full repriced total without subtracting an unreceived required deposit', () => {
  const r = staffRuntime(), b = addBooking(r, { bookingStatus: 'CONFIRMED' });
  const checkout = addDays(b.checkoutDate, 2), quote = canonicalQuote(r, b, { checkout });
  const out = extension(r, 'balance-extension-without-deposit', checkout);
  assert.equal(out.remainingBalance, quote.estimatedTotal);
  assert.equal(out.paidAmount, 0);
  assert.equal(out.depositAmount, quote.depositAmount);
  assertDue(r, quote.estimatedTotal);
  assert.equal(r.records('Payments').length, 0);
});

test('pet-count repricing without a paid deposit owes the full total rather than a projected balance', () => {
  const r = staffRuntime(), b = addBooking(r, {
    bookingStatus: 'PENDING_CONFIRMATION', allocatedRoomIdsJson: '[]'
  }, { roomId: 'DELUXE_SUITE' });
  const quote = canonicalQuote(r, b, { quantity: 2 });
  const out = success(r.invokeStaff(requestFor(r, 'staff.petCountUpdate', 'balance-pet-count-unpaid', {
    removePetIds: [], newPets: [makePet('rabbit', { name: 'Second synthetic pet' })], reason: 'Regression new pet'
  })));
  assert.equal(out.remainingBalance, quote.estimatedTotal);
  assertDue(r, quote.estimatedTotal);
  assert.equal(current(r).depositAmount, quote.depositAmount);
  assert.equal(r.records('Payments').length, 0);
});

test('idempotent balance retry returns the existing compact success snapshot with one receipt, one version bump and one log', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedDeposit(r, b);
  const request = requestFor(r, 'staff.recordBalance', 'balance-idempotent-success', { method: 'BANK_TRANSFER', reference: 'TEST-RETRY' });
  const beforePayments = structuredClone(r.records('Payments')), version = current(r).recordVersion;
  const first = success(r.invokeStaff(request));
  assert.equal(first.detail.remainingBalance, 0);
  const beforeReplay = snapshot(r), writes = r.getWriteCount();
  const retry = success(r.invokeStaff(request));
  // Existing Staff mutation snapshots deliberately omit detail/PII on replay.
  assert.deepEqual(retry, { bookingId: first.bookingId, status: first.status },
    'same key must replay the existing compact success despite stale expected version');
  assert.deepEqual(snapshot(r), beforeReplay);
  assert.equal(r.getWriteCount(), writes);
  assert.equal(current(r).recordVersion, version + 1);
  assert.equal(r.records('Payments').length, beforePayments.length + 1);
  assert.equal(r.records('Logs').filter((row) => row.action === 'staff.recordBalance').length, 1);
  assert.equal(r.records('IdempotencyKeys').filter((row) => row.idempotencyKey === request.idempotencyKey).length, 1);
  assert.equal(r.records('IdempotencyKeys')[0].state, 'COMPLETED');
  assertOldPaymentsPreserved(r, beforePayments);
  const changed = r.invokeStaff(Object.assign({}, request, { data: { method: 'BANK_TRANSFER', reference: 'CHANGED' } }));
  assert.equal(changed.success, false);
  assert.equal(changed.code, 'DUPLICATE_REQUEST');
  assert.deepEqual(snapshot(r), beforeReplay);
});

test('surcharge reversal after that surcharge was paid produces credit, not new debt or an automatic refund, and cannot double reverse', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedFullyPaid(r, b);
  const fee = surcharge(r, 'balance-paid-reversal-fee', 45);
  collect(r, 'balance-paid-reversal-collect');
  const beforePayments = structuredClone(r.records('Payments'));
  const source = structuredClone(r.records('BookingAdjustments').find((row) => row.adjustmentId === fee.adjustmentId));
  const out = success(r.invokeStaff(requestFor(r, 'staff.surchargeReverse', 'balance-paid-reversal', {
    adjustmentId: source.adjustmentId, reason: 'Service cancelled after collection'
  })));
  assert.equal(out.remainingBalance, 0);
  assert.equal(out.creditDue, 45);
  assertDue(r, 0);
  assert.deepEqual(r.records('Payments'), beforePayments, 'fee reversal is not a payment refund');
  assert.deepEqual(r.records('BookingAdjustments').find((row) => row.adjustmentId === source.adjustmentId), source);
  const reversal = r.records('BookingAdjustments').find((row) => row.type === 'REVERSAL');
  assert.equal(reversal.amount, -45);
  assert.equal(reversal.reversesAdjustmentId, source.adjustmentId);
  const beforeDuplicate = snapshot(r);
  const duplicate = r.invokeStaff(requestFor(r, 'staff.surchargeReverse', 'balance-paid-reversal-again', {
    adjustmentId: source.adjustmentId, reason: 'Duplicate reversal'
  }));
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.code, 'BOOKING_STATUS_INVALID');
  assert.deepEqual(snapshot(r), beforeDuplicate);
  assertReadBalances(r, 0);
  const collected = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: hkDateString().slice(0, 7) }));
  assert.equal(collected.monthCollectedRevenue, b.estimatedTotal + 45, 'credit is not cash returned until refund is explicitly recorded');
  const booked = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: b.checkinDate.slice(0, 7) }));
  assert.equal(booked.monthBookedRevenue, b.estimatedTotal);
});

test('paid balance refund reopens actual debt once, preserves receipt amount, and recollection settles to zero without double refund/revenue', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedFullyPaid(r, b);
  const original = structuredClone(r.records('Payments').find((p) => p.paymentType === 'BALANCE'));
  const deposit = structuredClone(r.records('Payments').find((p) => p.paymentType === 'DEPOSIT'));
  const request = requestFor(r, 'staff.depositRefund', 'balance-partial-refund', {
    sourcePaymentId: original.paymentId, amount: 30, confirmRefund: true, reason: 'Synthetic approved refund'
  });
  const out = success(r.invokeStaff(request));
  assert.equal(out.remainingBalance, 30);
  assertDue(r, 30);
  const updated = r.records('Payments').find((p) => p.paymentId === original.paymentId);
  assert.deepEqual(updated, Object.assign({}, original, { refundAmount: 30, refundedAt: updated.refundedAt }),
    'existing semantics update only refund metadata, never the receipt amount or other historical fields');
  assert.ok(updated.refundedAt);
  assert.deepEqual(r.records('Payments').find((p) => p.paymentId === deposit.paymentId), deposit);
  const refund = r.records('Payments').find((p) => p.paymentType === 'REFUND');
  assert.equal(refund.amount, 30);
  assert.equal(refund.paymentStatus, 'PAID');
  assert.equal(refund.sourcePaymentId, original.paymentId);
  assert.equal(refund.transactionReference, original.paymentId);
  assertReadBalances(r, 30); // metadata + linked REFUND row must not deduct twice.
  const beforeReplay = snapshot(r);
  assert.deepEqual(success(r.invokeStaff(request)), out);
  assert.deepEqual(snapshot(r), beforeReplay);
  const revenueBefore = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: hkDateString().slice(0, 7) }));
  assert.equal(revenueBefore.monthCollectedRevenue, b.estimatedTotal - 30);
  assert.equal(revenueBefore.monthRefunds, 30);
  collect(r, 'balance-refund-recollect');
  assertReadBalances(r, 0);
  const revenueAfter = success(r.invokeStaff({ action: 'staff.revenue', token: TOKEN, month: hkDateString().slice(0, 7) }));
  assert.equal(revenueAfter.monthCollectedRevenue, b.estimatedTotal);
  assert.equal(revenueAfter.monthRefunds, 30);
  assert.equal(revenueAfter.monthDepositsReceived, b.depositAmount);
  assert.equal(revenueAfter.monthBalancesReceived, b.estimatedTotal - b.depositAmount + 30);
  const beforeExcess = snapshot(r);
  const excess = r.invokeStaff(requestFor(r, 'staff.depositRefund', 'balance-refund-over-limit', {
    sourcePaymentId: original.paymentId, amount: original.amount - 30 + 0.01,
    confirmRefund: true, reason: 'Over remaining net receipt'
  }));
  assert.equal(excess.success, false);
  assert.equal(excess.code, 'BOOKING_STATUS_INVALID');
  assert.deepEqual(snapshot(r), beforeExcess);
});

test('cancelled-booking refund retains the existing closed settlement semantics instead of reopening debt', () => {
  const r = staffRuntime(), b = addBooking(r);
  seedFullyPaid(r, b);
  r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, { bookingStatus: 'CANCELLED' });
  const out = success(r.invokeStaff(requestFor(r, 'staff.depositRefund', 'balance-cancelled-refund', {
    sourcePaymentId: 'PAY-ORIGINAL-DEPOSIT', amount: 30, confirmRefund: true, reason: 'Cancelled booking refund'
  })));
  assert.equal(out.remainingBalance, 0);
  assertDue(r, 0);
  assert.equal(current(r).bookingStatus, 'CANCELLED');
  assert.equal(r.records('Payments').filter((p) => p.paymentType === 'REFUND').length, 1);
});

for (const mismatch of ['version', 'status']) {
  test('existing ' + mismatch + ' optimistic concurrency conflict rejects collection before any write or idempotency claim', () => {
    const r = staffRuntime(), b = addBooking(r);
    seedDeposit(r, b);
    const before = snapshot(r), writes = r.getWriteCount();
    const out = r.invokeStaff(requestFor(r, 'staff.recordBalance', 'balance-conflict-' + mismatch, {},
      mismatch === 'version' ? { expectedRecordVersion: 99 } : { expectedStatus: 'COMPLETED' }));
    assert.equal(out.success, false);
    assert.equal(out.code, 'BOOKING_VERSION_CONFLICT');
    assert.deepEqual(snapshot(r), before);
    assert.equal(r.getWriteCount(), writes);
  });
}

test('collection lock timeout preserves existing retryable error and performs no writes', () => {
  const r = staffRuntime({ lockTimeout: true }), b = addBooking(r);
  seedDeposit(r, b);
  const before = snapshot(r), writes = r.getWriteCount();
  const out = r.invokeStaff(requestFor(r, 'staff.recordBalance', 'balance-lock-timeout'));
  assert.equal(out.success, false);
  assert.equal(out.code, 'STAFF_LOCK_TIMEOUT');
  assert.equal(out.retryable, true);
  assert.deepEqual(snapshot(r), before);
  assert.equal(r.getWriteCount(), writes);
});

test('version is rechecked after acquiring the lock when a competing balance collection wins', () => {
  const options = {}, r = staffRuntime(options), b = addBooking(r);
  seedDeposit(r, b);
  const request = requestFor(r, 'staff.recordBalance', 'balance-race-losing-request');
  let winnerSnapshot;
  options.onLockAcquired = () => {
    addPayment(r, b, 'PAY-CONCURRENT-WINNER', 'BALANCE', b.estimatedTotal - b.depositAmount);
    r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, {
      recordVersion: b.recordVersion + 1, balanceStatus: 'PAID', remainingBalance: 0
    });
    winnerSnapshot = snapshot(r);
  };
  const out = r.invokeStaff(request);
  assert.equal(out.success, false);
  assert.equal(out.code, 'BOOKING_VERSION_CONFLICT');
  assert.ok(winnerSnapshot, 'lock-acquired race fixture must have run');
  assert.deepEqual(snapshot(r), winnerSnapshot, 'loser must not append a second receipt or claim an idempotency key');
  assert.equal(r.lockState.locked, false);
  assertReadBalances(r, 0);
});

test('partial receipt write failure keeps PROCESSING and blocks same-key duplicate receipt for manual reconciliation', () => {
  const r = staffRuntime({ failWrite: { sheetName: 'Payments', afterWrite: true } }), b = addBooking(r);
  seedDeposit(r, b);
  const request = requestFor(r, 'staff.recordBalance', 'balance-partial-write-retry');
  const before = structuredClone(r.records('Payments'));
  const first = r.invokeStaff(request);
  assert.equal(first.success, false);
  // The current Staff dispatch normalizes raw mock write errors at stage=staff.
  assert.equal(first.code, 'INTERNAL_ERROR');
  assert.equal(first.retryable, false);
  assert.equal(r.records('Payments').length, before.length + 1, 'mock failure occurs after receipt side effect');
  assert.equal(r.records('Payments').at(-1).amount, b.estimatedTotal - b.depositAmount);
  assert.equal(r.records('IdempotencyKeys')[0].state, 'PROCESSING');
  assertOldPaymentsPreserved(r, before);
  const beforeRetry = snapshot(r), writes = r.getWriteCount();
  const retry = r.invokeStaff(request);
  assert.equal(retry.success, false);
  assert.equal(retry.code, 'DUPLICATE_REQUEST');
  assert.deepEqual(snapshot(r), beforeRetry);
  assert.equal(r.getWriteCount(), writes);
  assertReadBalances(r, 0); // Receipt exists even though the Booking write did not finish.
});


test('legitimate nonfinancial mutations persist canonical debt in the same Booking write, not only in response', () => {
  const cases = [
    ['staff.confirmData', 'PENDING_CONFIRMATION', false, {}],
    ['staff.edit', 'PENDING_CONFIRMATION', false, { phone: '65123456' }],
    ['staff.checkIn', 'CONFIRMED', true, {}],
    ['staff.checkOut', 'CHECKED_IN', true, {}],
    ['staff.complete', 'CHECKED_OUT', true, {}],
    ['staff.followup', 'CHECKED_IN', true, { note: 'Synthetic followup' }],
    ['staff.cashDepositCollect', 'CHECKED_IN', true, { method: 'CASH' }],
  ];
  for (const [action, bookingStatus, paid, data] of cases) {
    const r = staffRuntime();
    const b = addBooking(r, { bookingStatus, allocatedRoomIdsJson: bookingStatus === 'PENDING_CONFIRMATION' ? '[]' : '["A1"]' });
    if (paid) seedFullyPaid(r, b);
    r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, { remainingBalance: b.depositAmount, balanceStatus: 'UNPAID' });
    const previous = structuredClone(r.records('Payments'));
    const result = success(r.invokeStaff(requestFor(r, action, 'legacy-sync-' + action, data)));
    const expected = paid ? 0 : b.estimatedTotal;
    assertDue(r, expected);
    assert.equal(result.detail.remainingBalance, expected, action + ' persisted and returned debt must agree');
    assert.equal(current(r).recordVersion, 2);
    assertOldPaymentsPreserved(r, previous);
    assert.equal(r.records('Payments').length, previous.length + (action === 'staff.cashDepositCollect' ? 1 : 0));
  }
});

test('EXT internal note updates and assignment switches persist current zero debt without changing historical payments or charged room', () => {
  for (const action of ['staff.internalAssignmentNoteUpdate', 'staff.internalAssignmentUpdate']) {
    const r = staffRuntime();
    const b = addBooking(r, { internalAssignment: 'EXT' });
    r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, { extensionStartDate: addDays(b.checkinDate, 1) });
    seedFullyPaid(r, b);
    r.context.littlelandUpdateRecordByKey_('Bookings', 'bookingId', b.bookingId, { remainingBalance: b.depositAmount, balanceStatus: 'UNPAID' });
    const previous = structuredClone(r.records('Payments'));
    const data = action === 'staff.internalAssignmentNoteUpdate'
      ? { note: 'Synthetic internal note', reason: 'QA current debt sync' }
      : { internalAssignment: 'ORIGINAL_ROOM', reason: 'QA current debt sync' };
    success(r.invokeStaff(requestFor(r, action, 'legacy-ext-sync-' + action, data)));
    assertDue(r, 0);
    assert.equal(current(r).roomTypeId, b.roomTypeId);
    assert.equal(current(r).depositAmount, b.depositAmount);
    assertOldPaymentsPreserved(r, previous);
    assert.equal(r.records('Payments').length, previous.length);
  }
});
