'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../booking/pricing.js');
const extensionView = require('../staff/extension-view.js');

function deluxeBooking(overrides = {}) {
  return Object.assign({
    bookingId: 'TEST-EXT-VIEW-001',
    bookingStatus: 'CONFIRMED',
    species: 'rabbit',
    roomTypeId: 'DELUXE_ROOM',
    checkinDate: '2026-11-03',
    checkoutDate: '2026-11-05',
    quantity: 1,
    roomPrice: 178,
    nights: 2,
    baseRoomFee: 356,
    serviceFees: 370,
    estimatedTotal: 726,
    depositAmount: 178,
    depositStatus: 'PAID',
    remainingBalance: 478,
    cashDepositAmount: 1000,
    allocatedRoomIdsJson: '["A1"]',
    groomingOnce: true,
    groomingDaily: true,
    medicine: 'none',
    earlyCheckin: true,
    lateCheckout: false,
    internalAssignment: '',
    extensionStartDate: '',
    internalAssignmentNote: '',
  }, overrides);
}

function paidDeposit(bookingId, amount = 178) {
  return [{
    paymentId: 'PAY-EXT-VIEW-DEPOSIT', bookingId, paymentType: 'DEPOSIT',
    amount, paymentStatus: 'PAID', paymentMethod: 'MANUAL',
  }];
}

function onceAdjustment(bookingId) {
  return [{
    adjustmentId: 'ADJ-EXT-VIEW-ONCE', bookingId, type: 'SURCHARGE',
    description: '一次性人工減項', amount: -70, billingBasis: 'ONCE', unitRate: -70,
    nightsCharged: 1, status: 'ACTIVE',
  }];
}

test('extension preview reprices using the original charged room and preserves paid deposit, one-time service, cash deposit, and one-time adjustment', () => {
  const booking = deluxeBooking();
  const adjustments = onceAdjustment(booking.bookingId);
  const result = extensionView.preview({ booking, payments: paidDeposit(booking.bookingId), adjustments }, '2026-11-07', pricing);

  assert.equal(result.ok, true);
  assert.equal(result.addedNights, 2);
  assert.equal(result.addedBaseRoomFee, 356);
  assert.equal(result.quote.roomId, 'DELUXE_ROOM');
  assert.equal(result.quote.roomPrice, 178);
  assert.equal(result.quote.nights, 4);
  assert.equal(result.quote.baseRoomFee, 712);
  assert.equal(result.quote.serviceFees, 470);
  assert.equal(result.quote.estimatedTotal, 1182);
  assert.equal(result.previousManualTotal, -70);
  assert.equal(result.nextManualTotal, -70);
  assert.equal(result.total, 1112);
  assert.equal(result.paid, 178);
  assert.equal(result.deposit, 178);
  assert.equal(result.remaining, 934);
  assert.equal(result.cashDeposit, 1000);
});

test('extension preview recalculates per-night manual fees but does not repeat ONCE adjustments', () => {
  const booking = deluxeBooking({ groomingOnce: false, groomingDaily: false, earlyCheckin: false, serviceFees: 0, estimatedTotal: 356 });
  const adjustments = [
    ...onceAdjustment(booking.bookingId),
    {
      adjustmentId: 'ADJ-EXT-VIEW-DAILY', bookingId: booking.bookingId, type: 'SURCHARGE',
      description: '每晚逐寵物服務', amount: 40, billingBasis: 'PER_NIGHT', unitRate: 20,
      nightsCharged: 2, status: 'ACTIVE',
    },
  ];
  const result = extensionView.preview({ booking, payments: paidDeposit(booking.bookingId), adjustments }, '2026-11-07', pricing);

  assert.equal(result.ok, true);
  assert.equal(result.quote.baseRoomFee, 712);
  assert.equal(result.previousManualTotal, -30);
  assert.equal(result.nextManualTotal, 10);
  assert.equal(result.total, 722);
  assert.equal(result.remaining, 544);
});

test('EXT detail keeps the charged room type and shows an editable internal note without adding a room type', () => {
  const booking = deluxeBooking({
    internalAssignment: 'EXT', extensionStartDate: '2026-11-05', checkoutDate: '2026-11-07',
    internalAssignmentNote: '因原房型滿房，部分延期日免費升級 S1',
    nights: 4, baseRoomFee: 712, serviceFees: 470, estimatedTotal: 1182, remainingBalance: 934,
    lastExtensionFromDate: '2026-11-05', lastExtensionAddedNights: 2, lastExtensionAddedBaseRoomFee: 356,
  });
  const html = extensionView.render({ booking, payments: paidDeposit(booking.bookingId), adjustments: onceAdjustment(booking.bookingId), roomNames: { DELUXE_ROOM: '豪華房' } });

  assert.match(html, /原訂房型／收費房型/);
  assert.match(html, /EXT 延期客／實際房間由員工安排/);
  assert.match(html, /2026-11-05/);
  assert.match(html, /2026-11-07/);
  assert.match(html, /原房型滿房/);
  assert.match(html, /internalAssignmentNoteForm/);
  assert.match(html, /HK\$356\.00/);
  assert.match(html, /HK\$1,112\.00/);
  assert.doesNotMatch(html, /EXT 房型收入/);
});

test('extension preview rejects a checkout date that is not later than the current checkout', () => {
  const booking = deluxeBooking();
  assert.equal(extensionView.preview({ booking, payments: [], adjustments: [] }, '2026-11-05', pricing).ok, false);
  assert.equal(extensionView.preview({ booking, payments: [], adjustments: [] }, 'not-a-date', pricing).ok, false);
});
