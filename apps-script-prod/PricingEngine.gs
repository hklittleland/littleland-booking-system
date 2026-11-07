(function (root, factory) {
  'use strict';

  const pricing = factory();
  if (typeof module === 'object' && module.exports) module.exports = pricing;
  if (root) root.LittleLandPricing = pricing;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROOM_CATALOG = Object.freeze({
    rabbit: Object.freeze({
      DELUXE_ROOM: Object.freeze({ id: 'DELUXE_ROOM', name: '豪華房', pricePerNight: 178, maxPets: 1 }),
      PRIVATE_SUITE: Object.freeze({ id: 'PRIVATE_SUITE', name: '獨立套房', pricePerNight: 278, maxPets: 2 }),
      DELUXE_SUITE: Object.freeze({ id: 'DELUXE_SUITE', name: '豪華套房', pricePerNight: 350, maxPets: 3 }),
      VERY_DELUXE_SUITE: Object.freeze({ id: 'VERY_DELUXE_SUITE', name: '非常.豪華套房', pricePerNight: 600, maxPets: 3 })
    }),
    guineaPig: Object.freeze({
      STANDARD_ROOM: Object.freeze({ id: 'STANDARD_ROOM', name: '標準房', pricePerNight: 98, maxPets: 1 }),
      DELUXE_ROOM: Object.freeze({ id: 'DELUXE_ROOM', name: '豪華房', pricePerNight: 178, maxPets: 3 }),
      PRIVATE_SUITE: Object.freeze({ id: 'PRIVATE_SUITE', name: '獨立套房', pricePerNight: 278, maxPets: 3 }),
      DELUXE_SUITE: Object.freeze({ id: 'DELUXE_SUITE', name: '豪華套房', pricePerNight: 350, maxPets: 5 }),
      VERY_DELUXE_SUITE: Object.freeze({ id: 'VERY_DELUXE_SUITE', name: '非常.豪華套房', pricePerNight: 600, maxPets: 5 })
    }),
    hamster: Object.freeze({
      STANDARD_ROOM: Object.freeze({ id: 'STANDARD_ROOM', name: '標準房', pricePerNight: 98, maxPets: 1 }),
      HAMSTER_BOX: Object.freeze({ id: 'HAMSTER_BOX', name: '整理箱', pricePerNight: 65, maxPets: 1 }),
      OWN_CAGE: Object.freeze({ id: 'OWN_CAGE', name: '自備籠', pricePerNight: 50, maxPets: 1 })
    })
  });

  const SERVICE_CATALOG = Object.freeze({
    GROOMING_ONCE: Object.freeze({ label: '單次梳毛', kind: 'fixed', amount: 70 }),
    GROOMING_DAILY: Object.freeze({ label: '每日梳毛', kind: 'perNight', amount: 50 }),
    MEDICINE_ONCE: Object.freeze({ label: '每日餵藥 1 次', kind: 'perNight', amount: 80, exclusiveGroup: 'medicine' }),
    MEDICINE_TWICE: Object.freeze({ label: '每日餵藥 2 次', kind: 'perNight', amount: 150, exclusiveGroup: 'medicine' }),
    EARLY_CHECKIN: Object.freeze({ label: '提早入住（一次性）', kind: 'fixed', amount: 200 }),
    LATE_CHECKOUT: Object.freeze({ label: '延遲退房（17:00 後，一次性）', kind: 'fixed', amount: 200 })
  });

  const ERROR_CODES = Object.freeze({
    INVALID_INPUT: 'PRICE_CALCULATION_FAILED',
    INVALID_DATE: 'DATE_INVALID_FORMAT',
    INVALID_STAY: 'DATE_CHECKOUT_NOT_AFTER_CHECKIN',
    INVALID_ROOM: 'ROOM_INVALID_ALLOCATION',
    INVALID_QUANTITY: 'PET_QTY_INVALID',
    QUANTITY_EXCEEDS_LIMIT: 'PET_QTY_EXCEEDS_LIMIT',
    DUPLICATE_SERVICE: 'PRICE_DUPLICATE_SERVICE'
  });

  class PricingError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'PricingError';
      this.code = code;
    }
  }

  function fail(code, message) {
    throw new PricingError(code, message);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function parseIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      fail(ERROR_CODES.INVALID_DATE, '日期必須使用 YYYY-MM-DD 格式。');
    }
    const [year, month, day] = value.split('-').map(Number);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      fail(ERROR_CODES.INVALID_DATE, '日期不存在。');
    }
    return timestamp;
  }

  function resolveStay(checkin, checkout) {
    const checkinTimestamp = parseIsoDate(checkin);
    const checkoutTimestamp = parseIsoDate(checkout);
    if (checkoutTimestamp <= checkinTimestamp) {
      fail(ERROR_CODES.INVALID_STAY, '退房日期必須晚於入住日期。');
    }
    return {
      nights: (checkoutTimestamp - checkinTimestamp) / 86400000,
      checkinDay: new Date(checkinTimestamp).getUTCDay()
    };
  }

  function resolveServices(services, nights) {
    if (services === undefined) services = [];
    if (!Array.isArray(services) || services.some((service) => typeof service !== 'string')) {
      fail(ERROR_CODES.INVALID_INPUT, 'services 必須是服務代碼陣列。');
    }

    const seen = new Set();
    const exclusiveGroups = new Set();
    const serviceItems = [];

    for (const serviceId of services) {
      if (seen.has(serviceId)) {
        fail(ERROR_CODES.DUPLICATE_SERVICE, `服務 ${serviceId} 不可重複收費。`);
      }
      seen.add(serviceId);

      if (!hasOwn(SERVICE_CATALOG, serviceId)) fail(ERROR_CODES.INVALID_INPUT, `不支援的服務：${serviceId}`);
      const definition = SERVICE_CATALOG[serviceId];
      if (definition.exclusiveGroup && exclusiveGroups.has(definition.exclusiveGroup)) {
        fail(ERROR_CODES.DUPLICATE_SERVICE, '每日餵藥 1 次與 2 次不可同時選取。');
      }
      if (definition.exclusiveGroup) exclusiveGroups.add(definition.exclusiveGroup);

      const amount = definition.kind === 'perNight' ? definition.amount * nights : definition.amount;
      const label = definition.kind === 'perNight' ? `${definition.label}（${nights} 晚）` : definition.label;
      serviceItems.push(Object.freeze({ id: serviceId, label, amount }));
    }

    return serviceItems;
  }

  function calculatePricing(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      fail(ERROR_CODES.INVALID_INPUT, '必須提供計價輸入資料。');
    }

    const { species, roomId, checkin, checkout, quantity } = input;
    const stay = resolveStay(checkin, checkout);
    const speciesRooms = hasOwn(ROOM_CATALOG, species) ? ROOM_CATALOG[species] : null;
    const room = speciesRooms && hasOwn(speciesRooms, roomId) ? speciesRooms[roomId] : null;
    if (!room) fail(ERROR_CODES.INVALID_ROOM, '指定物種與房型組合無效。');

    if (!Number.isInteger(quantity) || quantity < 1) {
      fail(ERROR_CODES.INVALID_QUANTITY, '寵物數量必須是大於或等於 1 的整數。');
    }
    if (quantity > room.maxPets) {
      fail(ERROR_CODES.QUANTITY_EXCEEDS_LIMIT, '寵物數量超過此物種與房型的入住上限。');
    }

    const serviceItems = resolveServices(input.services, stay.nights);
    const baseRoomFee = room.pricePerNight * stay.nights;
    const extraPetFee = Math.max(0, quantity - 1) * 50 * stay.nights;
    const weekendFee = stay.nights === 1 && [0, 5, 6].includes(stay.checkinDay) ? 250 : 0;
    const serviceFees = serviceItems.reduce((sum, item) => sum + item.amount, 0);
    const totalSurcharges = extraPetFee + weekendFee + serviceFees;
    const estimatedTotal = baseRoomFee + totalSurcharges;
    const depositAmount = baseRoomFee * 0.5;
    const remainingBalance = estimatedTotal - depositAmount;
    const cashDeposit = quantity * 1000;

    return Object.freeze({
      species,
      room: Object.freeze({ id: room.id, name: room.name, pricePerNight: room.pricePerNight, maxPets: room.maxPets }),
      roomId: room.id,
      roomPrice: room.pricePerNight,
      quantity,
      checkin,
      checkout,
      nights: stay.nights,
      baseRoomFee,
      extraPetFee,
      weekendFee,
      serviceItems: Object.freeze(serviceItems),
      serviceFees,
      totalSurcharges,
      estimatedTotal,
      depositAmount,
      remainingBalance,
      cashDeposit
    });
  }

  return Object.freeze({
    ROOM_CATALOG,
    SERVICE_CATALOG,
    ERROR_CODES,
    PricingError,
    calculatePricing
  });
});
