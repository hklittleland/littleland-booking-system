(function (root, factory) {
  "use strict";
  const pricing = root.LittleLandPricing || (typeof require === "function" ? require("../booking/pricing.js") : null);
  const api = factory(pricing);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LittleLandStaffBookingForm = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Pricing) {
  "use strict";

  const PRICE_VERSION = "6f002fd9ea921c313ecf90502091f1de051f332c";
  const SPECIES = Object.freeze([
    Object.freeze({ id: "rabbit", label: "兔子", icon: "🐰", minimumAgeMonths: 3 }),
    Object.freeze({ id: "guineaPig", label: "天竺鼠", icon: "🐽", minimumAgeMonths: 3 }),
    Object.freeze({ id: "hamster", label: "倉鼠", icon: "🐹", minimumAgeMonths: 2 }),
  ]);
  const TERMS = Object.freeze([
    "已向客人說明每隻寵物須於入住當日準備 HK$1,000 現金備用金／按金；不計入住宿總額。",
    "已向客人說明訂金為基本房費 50%，附加費及尾數按既定方式收取。",
    "已向客人說明訂金不設退款；如有例外退款，須由員工人工輸入金額及原因並另行記錄。",
    "客人已閱讀並同意入住須知及寄養條款。",
    "客人確認寵物健康資料屬實。",
    "客人同意緊急情況下 LittleLand 可安排獸醫，並承擔醫療、交通及陪診費。",
  ]);
  const FOOD = Object.freeze({
    rabbit: Object.freeze({
      main: Object.freeze(["", "Oxbow 成兔糧", "Momi T（成兔）", "Momi A（幼兔）", "自行攜帶"]),
      hay: Object.freeze(["", "Joy & Fibre 1st cut", "Momi 1st cut", "Chewbo 1st cut", "自行攜帶"]),
    }),
    guineaPig: Object.freeze({
      main: Object.freeze(["", "Oxbow 天竺鼠糧", "Momi 天竺鼠糧", "自行攜帶"]),
      hay: Object.freeze(["", "Joy & Fibre 1st cut", "Momi 1st cut", "Chewbo 1st cut", "自行攜帶"]),
    }),
    hamster: Object.freeze({ main: Object.freeze(["", "BUNNY 倉鼠糧", "自行攜帶"]), hay: Object.freeze([]) }),
  });
  const YES_NO = Object.freeze(["yes", "no"]);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_SLOTS = Object.freeze(["14:30–15:30", "15:30–16:30", "16:30–17:00"]);

  function speciesDefinition(species) {
    return SPECIES.find((item) => item.id === species) || null;
  }

  function roomOptions(species) {
    if (!Pricing || !Pricing.ROOM_CATALOG || !Pricing.ROOM_CATALOG[species]) return [];
    return Object.values(Pricing.ROOM_CATALOG[species]).map((room) => ({
      id: room.id,
      label: room.name,
      pricePerNight: room.pricePerNight,
      maxPets: room.maxPets,
    }));
  }

  function normalizePhone(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("00852")) digits = digits.slice(5);
    else if (digits.length === 11 && digits.startsWith("852")) digits = digits.slice(3);
    return digits;
  }

  function hongKongToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function validIsoDate(value) {
    if (typeof value !== "string" || !ISO_RE.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function selectedServices(draft) {
    const services = [];
    if (draft.groomingOnce === true) services.push("GROOMING_ONCE");
    if (draft.groomingDaily === true) services.push("GROOMING_DAILY");
    if (draft.medicine === "once") services.push("MEDICINE_ONCE");
    if (draft.medicine === "twice") services.push("MEDICINE_TWICE");
    if (draft.earlyCheckin === true) services.push("EARLY_CHECKIN");
    if (draft.lateCheckout === true) services.push("LATE_CHECKOUT");
    return services;
  }

  function availabilityInput(draft) {
    return {
      checkin: String(draft.checkin || ""),
      checkout: String(draft.checkout || ""),
      species: String(draft.species || ""),
      roomTypeId: String(draft.roomId || ""),
      quantity: Number(draft.quantity),
    };
  }

  function validateAvailabilityInput(draft, today = hongKongToday()) {
    const input = availabilityInput(draft);
    if (!validIsoDate(input.checkin) || !validIsoDate(input.checkout)) return "請先選擇有效入住及退房日期。";
    if (input.checkin < today) return "入住日期不可早於香港今日日期。";
    if (input.checkout <= input.checkin) return "退房日期必須晚於入住日期，最少入住一晚。";
    if (!speciesDefinition(input.species)) return "請選擇有效的寵物種類。";
    const room = roomOptions(input.species).find((item) => item.id === input.roomTypeId);
    if (!room) return "請選擇該寵物種類適用的房型。";
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > room.maxPets) return "寵物數量必須符合房型入住上限。";
    return null;
  }

  function validateDraft(draft, options = {}) {
    const today = options.today || hongKongToday();
    const availabilityError = validateAvailabilityInput(draft, today);
    if (availabilityError) return availabilityError;
    if (!TIME_SLOTS.includes(draft.checkinTime) || !TIME_SLOTS.includes(draft.checkoutTime)) return "請選擇有效的入住及退房時段。";
    const room = roomOptions(draft.species).find((item) => item.id === draft.roomId);
    if (!String(draft.parentName || "").trim()) return "請填寫家長姓名。";
    if (!/^\d{8}$/.test(normalizePhone(draft.phone))) return "請輸入有效的香港 8 位電話號碼。";
    if (!EMAIL_RE.test(String(draft.email || "").trim())) return "請輸入有效的 Email 地址。";
    if (!String(draft.emergency1 || "").trim()) return "請填寫第 1 位緊急聯絡人。";
    if (!String(draft.emergency2 || "").trim()) return "請填寫第 2 位緊急聯絡人。";
    if (!Array.isArray(draft.pets) || draft.pets.length !== Number(draft.quantity)) return "寵物資料數量必須與預約數量一致。";

    for (let i = 0; i < draft.pets.length; i += 1) {
      const pet = draft.pets[i] || {}, prefix = `第 ${i + 1} 隻寵物`;
      if (!String(pet.name || "").trim() || !String(pet.breed || "").trim()) return `${prefix}請填寫名稱及品種。`;
      const age = Number(pet.ageValue), ageUnit = pet.ageUnit;
      if (!Number.isFinite(age) || age <= 0 || !["month", "year"].includes(ageUnit)) return `${prefix}請填寫有效年齡。`;
      const minimum = speciesDefinition(draft.species).minimumAgeMonths;
      if (age * (ageUnit === "year" ? 12 : 1) < minimum) return `${prefix}未達最低入住年齡 ${minimum} 個月。`;
      if (!["male", "female"].includes(pet.sex)) return `${prefix}請選擇性別。`;
      if (draft.species !== "hamster") {
        if (!YES_NO.includes(pet.sterilized)) return `${prefix}請回答絕育情況。`;
        if (!YES_NO.includes(pet.fleaTreatment)) return `${prefix}請回答一個月內杜蝨處理情況。`;
        if (pet.sex === "female") {
          if (!YES_NO.includes(pet.pregnant)) return `${prefix}請回答是否懷孕。`;
          if (pet.pregnant === "yes") return `${prefix}懷孕中的毛孩不可接受一般入住。`;
        }
      }
      if (!YES_NO.includes(pet.recentSurgery)) return `${prefix}請回答最近 30 日是否接受過手術。`;
      if (pet.recentSurgery === "yes") return `${prefix}最近 30 日內接受過手術，不可接受一般入住。`;
      for (const [key, label] of [["vetVisit", "最近看獸醫"], ["infectiousDisease", "傳染病"], ["chronicDisease", "慢性疾病"], ["medication", "正在服用藥物"]]) {
        if (!YES_NO.includes(pet[key])) return `${prefix}請回答${label}情況。`;
        if (pet[key] === "yes" && !String(pet[`${key}Details`] || "").trim()) return `${prefix}請補充${label}詳情。`;
      }
    }

    if (!Array.isArray(draft.terms) || draft.terms.length !== TERMS.length || draft.terms.some((value) => value !== true)) return "提交前必須確認全部六項同意事項。";
    if (!["none", "once", "twice"].includes(draft.medicine)) return "請選擇有效的餵藥服務。";
    if (draft.species !== "hamster" && !["", "每日一次", "每日兩次／早晚各一次"].includes(String(draft.feeding || ""))) return "請選擇有效餵食頻率。";
    if (draft.foodMain && !FOOD[draft.species].main.includes(String(draft.foodMain))) return "主糧選項不正確。";
    if (draft.species !== "hamster" && draft.hay && !FOOD[draft.species].hay.includes(String(draft.hay))) return "牧草選項不正確。";
    if (draft.species !== "hamster" && !["", "是", "否"].includes(String(draft.vegetables || ""))) return "蔬菜選項不正確。";
    if (!Pricing || !Pricing.calculatePricing) return "計價元件未載入，請重新整理後重試。";
    try {
      calculateQuote(draft);
    } catch (error) {
      return error.message || "費用預覽暫時無法計算。";
    }
    return null;
  }

  function calculateQuote(draft) {
    if (!Pricing || typeof Pricing.calculatePricing !== "function") throw new Error("計價元件未載入。");
    const input = availabilityInput(draft);
    const quote = Pricing.calculatePricing({
      species: input.species,
      roomId: input.roomTypeId,
      checkin: input.checkin,
      checkout: input.checkout,
      quantity: input.quantity,
      services: selectedServices(draft),
    });
    return Object.freeze({
      priceVersion: PRICE_VERSION,
      roomPrice: quote.roomPrice,
      nights: quote.nights,
      baseRoomFee: quote.baseRoomFee,
      extraPetFee: quote.extraPetFee,
      weekendFee: quote.weekendFee,
      serviceFees: quote.serviceFees,
      totalSurcharges: quote.totalSurcharges,
      estimatedTotal: quote.estimatedTotal,
      depositAmount: quote.depositAmount,
      remainingBalance: quote.remainingBalance,
      cashDeposit: quote.cashDeposit,
      serviceItems: quote.serviceItems,
    });
  }

  function clientQuote(quote) {
    const keys = ["priceVersion", "roomPrice", "nights", "baseRoomFee", "extraPetFee", "weekendFee", "serviceFees", "totalSurcharges", "estimatedTotal", "depositAmount", "remainingBalance", "cashDeposit"];
    const result = {};
    keys.forEach((key) => { result[key] = quote[key]; });
    return result;
  }

  function buildPet(pet, species) {
    const result = {
      name: String(pet.name || "").trim(),
      breed: String(pet.breed || "").trim(),
      ageValue: Number(pet.ageValue),
      ageUnit: String(pet.ageUnit || ""),
      sex: String(pet.sex || ""),
      recentSurgery: String(pet.recentSurgery || ""),
      vetVisit: String(pet.vetVisit || ""),
      vetDetails: String(pet.vetDetails || "").trim(),
      infectiousDisease: String(pet.infectiousDisease || ""),
      infectiousDetails: String(pet.infectiousDetails || "").trim(),
      chronicDisease: String(pet.chronicDisease || ""),
      chronicDetails: String(pet.chronicDetails || "").trim(),
      medication: String(pet.medication || ""),
      medicationDetails: String(pet.medicationDetails || "").trim(),
      specialCare: String(pet.specialCare || "").trim(),
    };
    if (species !== "hamster") {
      result.sterilized = String(pet.sterilized || "");
      result.fleaTreatment = String(pet.fleaTreatment || "");
      if (pet.sex === "female") result.pregnant = String(pet.pregnant || "");
    }
    return result;
  }

  function buildRequest(draft, idempotencyKey, quote = calculateQuote(draft)) {
    const error = validateDraft(draft);
    if (error) throw Object.assign(new Error(error), { code: "VALIDATION_FAILED" });
    const form = {
      checkin: String(draft.checkin),
      checkout: String(draft.checkout),
      checkinTime: String(draft.checkinTime),
      checkoutTime: String(draft.checkoutTime),
      species: String(draft.species),
      roomId: String(draft.roomId),
      quantity: Number(draft.quantity),
      pets: draft.pets.map((pet) => buildPet(pet, draft.species)),
      parentName: String(draft.parentName).trim(),
      phone: normalizePhone(draft.phone),
      email: String(draft.email).trim(),
      emergency1: String(draft.emergency1).trim(),
      emergency2: String(draft.emergency2).trim(),
      vet: String(draft.vet || "").trim(),
      foodMain: String(draft.foodMain || ""),
      hay: draft.species === "hamster" ? "" : String(draft.hay || ""),
      feeding: draft.species === "hamster" ? "" : String(draft.feeding || ""),
      vegetables: draft.species === "hamster" ? "" : String(draft.vegetables || ""),
      groomingOnce: draft.groomingOnce === true,
      groomingDaily: draft.groomingDaily === true,
      medicine: String(draft.medicine || "none"),
      earlyCheckin: draft.earlyCheckin === true,
      lateCheckout: draft.lateCheckout === true,
    };
    return {
      idempotencyKey: String(idempotencyKey || ""),
      form,
      terms: draft.terms.slice(),
      clientQuote: clientQuote(quote),
    };
  }

  return Object.freeze({
    PRICE_VERSION,
    SPECIES,
    TERMS,
    FOOD,
    YES_NO,
    TIME_SLOTS,
    speciesDefinition,
    roomOptions,
    normalizePhone,
    hongKongToday,
    availabilityInput,
    validateAvailabilityInput,
    validateDraft,
    selectedServices,
    calculateQuote,
    clientQuote,
    buildPet,
    buildRequest,
  });
});
