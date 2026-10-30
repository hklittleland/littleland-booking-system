(() => {
  'use strict';

  const DRAFT_KEY = 'littleland_booking_draft_v1';
  const AVAILABILITY = Object.freeze({
    checking: '查詢中',
    available: '可預訂',
    unavailable: '不可預訂',
    unknown: '暫時無法確認'
  });
  // Mock only. A future availability API can replace this resolver without changing the UI states.
  const roomAvailabilityFor = (datesAreValid) => datesAreValid ? 'available' : 'unknown';
  const SPECIES = {
    rabbit: { label: '兔子', image: '/manus-storage/async-images/HTx1dw7j7ReEg7PZJ4Uzms/image-1.webp', fallback: '🐇', minimumAge: 3 },
    guineaPig: { label: '天竺鼠', image: '/manus-storage/async-images/HTx1dw7j7ReEg7PZJ4Uzms/image-2.webp', fallback: '🐾', minimumAge: 3 },
    hamster: { label: '倉鼠', image: '/manus-storage/async-images/HTx1dw7j7ReEg7PZJ4Uzms/image-3.webp', fallback: '🐹', minimumAge: 2 }
  };
  const ROOMS = {
    rabbit: [
      { id: 'DELUXE_ROOM', name: '豪華房', price: 178, max: 1, icon: '🛏️', image: 'room-178.jpg', note: '舒適小窩' },
      { id: 'PRIVATE_SUITE', name: '獨立套房', price: 278, max: 2, icon: '🏠', image: 'room-278.jpg', note: '獨立套房空間' },
      { id: 'DELUXE_SUITE', name: '豪華套房', price: 350, max: 3, icon: '🏡', image: 'room-350.jpg', note: '寬敞套房' },
      { id: 'VERY_DELUXE_SUITE', name: '非常.豪華套房', price: 600, max: 3, icon: '✨', image: 'room-600.jpg', note: '超大舒適空間' }
    ],
    guineaPig: [
      { id: 'STANDARD_ROOM', name: '標準房', price: 98, max: 1, icon: '🧺', image: 'room-098.jpg', note: '可愛小房間' },
      { id: 'DELUXE_ROOM', name: '豪華房', price: 178, max: 3, icon: '🛏️', image: 'room-178.jpg', note: '舒適小窩' },
      { id: 'PRIVATE_SUITE', name: '獨立套房', price: 278, max: 3, icon: '🏠', image: 'room-278.jpg', note: '獨立套房空間' },
      { id: 'DELUXE_SUITE', name: '豪華套房', price: 350, max: 5, icon: '🏡', image: 'room-350.jpg', note: '寬敞套房' },
      { id: 'VERY_DELUXE_SUITE', name: '非常.豪華套房', price: 600, max: 5, icon: '✨', image: 'room-600.jpg', note: '超大舒適空間' }
    ],
    hamster: [
      { id: 'STANDARD_ROOM', name: '標準房', price: 98, max: 1, icon: '🧺', image: 'room-098.jpg', note: '可愛小房間' },
      { id: 'HAMSTER_BOX', name: '整理箱', price: 65, max: 1, icon: '📦', note: '整潔小天地' },
      { id: 'OWN_CAGE', name: '自備籠', price: 50, max: 1, icon: '🏕️', note: '入住自備籠' }
    ]
  };
  const FOOD = {
    rabbit: ['Oxbow 成兔糧', 'Momi T（成兔）', 'Momi A（幼兔）', '自行攜帶'],
    guineaPig: ['Oxbow 天竺鼠糧', 'Momi 天竺鼠糧', '自行攜帶'],
    hamster: ['BUNNY 倉鼠糧', '自行攜帶']
  };
  const HAY = ['Joy & Fibre 1st cut', 'Momi 1st cut', 'Chewbo 1st cut', '自行攜帶'];
  const INITIAL_FORM = {
    checkin: '', checkout: '', checkinTime: '', checkoutTime: '',
    species: '', roomId: '', quantity: '1', pets: [],
    parentName: '', phone: '', email: '', emergency1: '', emergency2: '', vet: '',
    foodMain: '', hay: '', feeding: '', vegetables: '',
    groomingOnce: false, groomingDaily: false, medicine: 'none',
    earlyCheckin: false, lateCheckout: false
  };

  const state = {
    step: 1,
    form: loadDraft(),
    terms: Array(6).fill(false),
    availability: 'unknown',
    mockBookingId: '',
    completed: false
  };

  const el = {
    stepContent: document.getElementById('stepContent'),
    stepper: document.getElementById('stepper'),
    stepProgress: document.getElementById('stepProgress'),
    formAlert: document.getElementById('formAlert'),
    backButton: document.getElementById('backButton'),
    nextButton: document.getElementById('nextButton'),
    actionHint: document.getElementById('actionHint'),
    wizardActions: document.getElementById('wizardActions'),
    summaryCard: document.getElementById('summaryCard'),
    summaryPreview: document.getElementById('summaryPreview'),
    summaryTotal: document.getElementById('summaryTotal'),
    summaryDeposit: document.getElementById('summaryDeposit'),
    toastRegion: document.getElementById('toastRegion'),
    confettiLayer: document.getElementById('confettiLayer')
  };

  function cloneInitialForm() {
    return { ...INITIAL_FORM, pets: [] };
  }

  function loadDraft() {
    const fresh = cloneInitialForm();
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return fresh;
      const allowed = Object.keys(INITIAL_FORM).filter((key) => key !== 'pets');
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(saved, key)) fresh[key] = saved[key];
      }
      fresh.pets = Array.isArray(saved.pets) ? saved.pets.slice(0, 8).map(normalizePet) : [];
      if (!Object.prototype.hasOwnProperty.call(SPECIES, fresh.species)) fresh.species = '';
      if (typeof fresh.quantity !== 'string' && typeof fresh.quantity !== 'number') fresh.quantity = '1';
      fresh.quantity = String(fresh.quantity);
      if (!['none', 'once', 'twice'].includes(fresh.medicine)) fresh.medicine = 'none';
      return fresh;
    } catch (_) {
      return fresh;
    }
  }

  function normalizePet(value) {
    const base = emptyPet();
    if (!value || typeof value !== 'object') return base;
    for (const key of Object.keys(base)) {
      if (Object.prototype.hasOwnProperty.call(value, key) && typeof value[key] === 'string') base[key] = value[key];
    }
    return base;
  }

  function emptyPet() {
    return {
      name: '', breed: '', ageValue: '', ageUnit: 'month', sex: '', sterilized: '',
      pregnant: '', recentSurgery: '', vetVisit: '', vetDetails: '',
      infectiousDisease: '', infectiousDetails: '', chronicDisease: '', chronicDetails: '',
      medication: '', medicationDetails: '', specialCare: '', fleaTreatment: ''
    };
  }

  function saveDraft() {
    const allowed = { ...state.form, pets: state.form.pets.map((pet) => ({ ...pet })) };
    // Terms, availability, payment data, employee sessions and mock booking IDs are never persisted.
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(allowed)); } catch (_) { /* Storage may be unavailable in private browsing. */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* No-op when storage is unavailable. */ }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function money(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    return `HK$${amount.toLocaleString('en-HK', { maximumFractionDigits: 2 })}`;
  }

  function localDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function utcDay(value) {
    const date = parseDate(value);
    return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : NaN;
  }

  function dateNights() {
    const start = utcDay(state.form.checkin);
    const end = utcDay(state.form.checkout);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.round((end - start) / 86400000);
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '尚未選擇';
    return new Intl.DateTimeFormat('zh-HK', { month: 'short', day: 'numeric', weekday: 'short' }).format(date);
  }

  function selectedRoom() {
    if (!state.form.species) return null;
    return (ROOMS[state.form.species] || []).find((room) => room.id === state.form.roomId) || null;
  }

  function quantityNumber() {
    if (String(state.form.quantity).trim() === '') return NaN;
    return Number(state.form.quantity);
  }

  function quantityIsValid() {
    const quantity = quantityNumber();
    const room = selectedRoom();
    return Number.isInteger(quantity) && quantity >= 1 && Boolean(room) && quantity <= room.max;
  }

  function ensurePetCount() {
    const quantity = quantityNumber();
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 8) return;
    while (state.form.pets.length < quantity) state.form.pets.push(emptyPet());
    if (state.form.pets.length > quantity) state.form.pets.length = quantity;
  }

  function datesAreValid() {
    const checkin = parseDate(state.form.checkin);
    const checkout = parseDate(state.form.checkout);
    const today = parseDate(localDateValue(new Date()));
    return Boolean(checkin && checkout && today && checkin >= today && checkout > checkin);
  }

  function refreshAvailability() {
    state.availability = roomAvailabilityFor(datesAreValid());
  }

  function currentPricing() {
    const nights = dateNights();
    const room = selectedRoom();
    const quantity = Number.isInteger(quantityNumber()) && quantityNumber() > 0 ? quantityNumber() : 0;
    const baseRoomFee = room && nights > 0 ? room.price * nights : 0;
    const extraPetFee = nights > 0 && quantity > 1 ? (quantity - 1) * 50 * nights : 0;
    const checkin = parseDate(state.form.checkin);
    const checkinDay = checkin ? checkin.getDay() : -1;
    const weekendFee = nights === 1 && [0, 5, 6].includes(checkinDay) ? 250 : 0;
    const serviceItems = [];
    if (state.form.groomingOnce) serviceItems.push({ label: '單次梳毛', amount: 70 });
    if (state.form.groomingDaily && nights > 0) serviceItems.push({ label: `每日梳毛（${nights} 晚）`, amount: 50 * nights });
    if (state.form.medicine === 'once' && nights > 0) serviceItems.push({ label: `每日餵藥 1 次（${nights} 晚）`, amount: 80 * nights });
    if (state.form.medicine === 'twice' && nights > 0) serviceItems.push({ label: `每日餵藥 2 次（${nights} 晚）`, amount: 150 * nights });
    if (state.form.earlyCheckin) serviceItems.push({ label: '提早入住（一次性）', amount: 200 });
    if (state.form.lateCheckout) serviceItems.push({ label: '延遲退房（17:00 後，一次性）', amount: 200 });
    const serviceFees = serviceItems.reduce((sum, item) => sum + item.amount, 0);
    const totalSurcharges = extraPetFee + weekendFee + serviceFees;
    const estimatedTotal = baseRoomFee + totalSurcharges;
    const depositAmount = baseRoomFee * 0.5;
    const remainingBalance = estimatedTotal - depositAmount;
    const cashDeposit = quantity * 1000;
    return { room, nights, quantity, baseRoomFee, extraPetFee, weekendFee, serviceItems, serviceFees, totalSurcharges, estimatedTotal, depositAmount, remainingBalance, cashDeposit };
  }

  function field(name, label, options = {}) {
    const required = options.required ? '<span class="required-mark">*</span>' : '<span class="optional-label">選填</span>';
    const type = options.type || 'text';
    const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
    const extra = options.extra || '';
    const value = escapeHtml(state.form[name] ?? '');
    const input = options.select
      ? `<select data-field="${name}" id="${name}" ${options.required ? 'required' : ''}>${options.select}</select>`
      : `<input type="${type}" id="${name}" data-field="${name}" value="${value}"${placeholder}${extra} ${options.required ? 'required' : ''}>`;
    return `<div class="field ${options.full ? 'full' : ''}"><label for="${name}">${label}${required}</label>${input}${options.help ? `<p class="field-help">${options.help}</p>` : ''}</div>`;
  }

  function selectOptions(values, selected, firstLabel = '請選擇') {
    return `<option value="">${firstLabel}</option>${values.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}`;
  }

  function sectionHeading(icon, title, subtitle, count = '') {
    const stage = count.match(/\d+/)?.[0] || 'LL';
    return `<div class="section-heading"><div class="section-title-wrap"><span class="section-icon" aria-hidden="true"><span>${stage}</span><i></i></span><div><h2>${title}</h2><p>${subtitle}</p></div></div>${count ? `<span class="section-count">${count}</span>` : ''}</div>`;
  }

  function notice(type, icon, text) {
    const marker = { yellow: '!', blue: 'i', green: '✓', pink: '♡' }[type] || 'i';
    return `<div class="notice notice-${type}"><span class="notice-icon" aria-hidden="true">${marker}</span><div>${text}</div></div>`;
  }

  function stepOne() {
    const checkinMin = localDateValue(new Date());
    const checkinDate = state.form.checkin;
    const checkoutMin = checkinDate && checkinDate >= checkinMin ? checkinDate : checkinMin;
    const statusLabel = AVAILABILITY[state.availability] || AVAILABILITY.unknown;
    return `${sectionHeading('🗓️', '選擇入住時間', '先告訴我們毛孩何時入住和回家。', 'STEP 01')}
      ${notice('yellow', '☀️', '<strong>入住日包括，退房日不包括。</strong> 例如 11 月 1 日入住、11 月 3 日退房，即住宿兩晚。最少入住一晚。')}
      <div class="field-grid">
        <div class="field"><label for="checkin">入住日期 <span class="required-mark">*</span></label><div class="input-wrap"><span class="input-icon" aria-hidden="true">📅</span><input type="date" id="checkin" data-field="checkin" min="${checkinMin}" value="${escapeHtml(checkinDate)}" required></div></div>
        <div class="field"><label for="checkout">退房日期 <span class="required-mark">*</span></label><div class="input-wrap"><span class="input-icon" aria-hidden="true">📅</span><input type="date" id="checkout" data-field="checkout" min="${checkoutMin}" value="${escapeHtml(state.form.checkout)}" required></div></div>
        <div class="field"><label for="checkinTime">入住時段 <span class="required-mark">*</span></label><select id="checkinTime" data-field="checkinTime" required>${selectOptions(['14:30–15:30', '15:30–16:30', '16:30–17:00'], state.form.checkinTime)}</select></div>
        <div class="field"><label for="checkoutTime">退房時段 <span class="required-mark">*</span></label><select id="checkoutTime" data-field="checkoutTime" required>${selectOptions(['14:30–15:30', '15:30–16:30', '16:30–17:00'], state.form.checkoutTime)}</select></div>
      </div>
      <div class="field-grid" style="margin-top:15px">
        <div class="toggle-line"><div class="toggle-copy"><strong>提早入住安排</strong><small>一次性附加費 HK$200；時間另行確認</small></div><span class="mini-fee">+HK$200</span><label class="switch" aria-label="選擇提早入住"><input type="checkbox" data-field="earlyCheckin" ${state.form.earlyCheckin ? 'checked' : ''}><span></span></label></div>
        <div class="toggle-line"><div class="toggle-copy"><strong>延遲退房安排</strong><small>17:00 後，一次性附加費 HK$200</small></div><span class="mini-fee">+HK$200</span><label class="switch" aria-label="選擇延遲退房"><input type="checkbox" data-field="lateCheckout" ${state.form.lateCheckout ? 'checked' : ''}><span></span></label></div>
      </div>
      <div class="availability-banner" id="availabilityBanner" data-status="${state.availability}"><div class="availability-copy"><span class="availability-pulse" aria-hidden="true"></span><span class="availability-label" id="availabilityLabel">${statusLabel}</span></div><span class="availability-meta" id="availabilityMeta">${datesAreValid() ? `${dateNights()} 晚 · 示範房態` : '選擇有效日期後顯示示範房態'}</span></div>`;
  }

  function stepTwo() {
    return `${sectionHeading('🐾', '毛孩是什麼種類？', '每張申請只可選一種寵物；不同物種需分開申請。', 'STEP 02')}
      <div class="choice-grid" role="radiogroup" aria-label="選擇寵物種類">
        ${Object.entries(SPECIES).map(([id, species]) => `<label class="choice-card ${state.form.species === id ? 'is-selected' : ''}"><input type="radio" name="species" data-field="species" value="${id}" ${state.form.species === id ? 'checked' : ''}><span class="selection-check" aria-hidden="true">✓</span><span class="choice-emoji" aria-hidden="true"><span class="species-fallback">${species.fallback}</span><img class="species-illustration" src="${species.image}" alt="" loading="lazy"></span><strong>${species.label}</strong><small class="species-min-age">最低入住年齡：${species.minimumAge} 個月</small></label>`).join('')}
      </div>
      ${notice('pink', '♡', '<strong>一張訂單 = 一個房間。</strong> 同一張申請可有多隻同種類寵物；不同物種不可混住。如需兩個房間，請分開建立兩張申請。')}`;
  }

  function stepThree() {
    if (!state.form.species) return `${sectionHeading('🏡', '挑選舒服的房間', '先選擇寵物種類，我們再為你顯示合適房型。', 'STEP 03')}${notice('blue', '💡', '選好種類後，就會看到適合毛孩的房型和每晚收費。')}`;
    const rooms = ROOMS[state.form.species] || [];
    const status = roomAvailabilityFor(datesAreValid());
    return `${sectionHeading('🏡', '挑選舒服的房間', `${SPECIES[state.form.species].label}適用房型 · 選擇一款最合適的小窩。`, 'STEP 03')}
      <div class="room-grid" role="radiogroup" aria-label="選擇房型">
        ${rooms.map((room) => `<label class="room-card ${state.form.roomId === room.id ? 'is-selected' : ''}"><input type="radio" name="roomId" data-field="roomId" value="${room.id}" ${state.form.roomId === room.id ? 'checked' : ''}><div class="room-photo-wrap">${room.image ? `<img class="room-photo" src="assets/${room.image}" alt="${room.name}房間實景" loading="lazy">` : `<span class="room-photo-fallback" aria-hidden="true">${room.icon}</span>`}<span class="room-check" aria-hidden="true">✓</span></div><strong>${room.name}</strong><span class="room-price">${money(room.price)} <small>/ 晚</small></span><span class="room-meta">最多 ${room.max} 隻 · ${room.note}</span><span class="room-status" data-status="${status}">${AVAILABILITY[status]}</span></label>`).join('')}
      </div>
      <div class="quantity-row"><div class="quantity-copy"><strong>入住毛孩數量 <span class="required-mark">*</span></strong><p>${state.form.roomId ? `此房型最多 ${selectedRoom()?.max || 0} 隻。` : '選擇房型後查看可入住數量。'}</p></div><div class="field"><label class="visually-hidden" for="quantity">毛孩數量</label><input type="number" id="quantity" data-field="quantity" min="1" max="${selectedRoom()?.max || 1}" step="1" inputmode="numeric" value="${escapeHtml(state.form.quantity)}" aria-describedby="quantityError"></div><p id="quantityError" class="quantity-error" ${quantityIsValid() || !state.form.roomId ? 'hidden' : ''}>${getQuantityError()}</p></div>
      ${notice('yellow', '🐾', '數量必須為整數，且不能超出所選房型上限。更改房型後請再次確認數量。')}`;
  }

  function getQuantityError() {
    const q = quantityNumber();
    const room = selectedRoom();
    if (!Number.isInteger(q)) return '請輸入整數數量。';
    if (q < 1) return '數量最少為 1 隻。';
    if (room && q > room.max) return `此房型最多入住 ${room.max} 隻，請更改數量或選擇其他房型。`;
    if (!room) return '請先選擇房型。';
    return '';
  }

  function healthSelect(petIndex, fieldName, label, value) {
    const id = `pet-${petIndex}-${fieldName}`;
    return `<div class="field"><label for="${id}">${label} <span class="required-mark">*</span></label><select id="${id}" data-pet-index="${petIndex}" data-pet-field="${fieldName}" required><option value="">請選擇</option><option value="no" ${value === 'no' ? 'selected' : ''}>否</option><option value="yes" ${value === 'yes' ? 'selected' : ''}>是</option></select></div>`;
  }

  function healthDetail(petIndex, yesField, detailsField, label, value) {
    const pet = state.form.pets[petIndex];
    if (pet[yesField] !== 'yes') return '';
    const id = `pet-${petIndex}-${detailsField}`;
    return `<div class="field full health-details"><label for="${id}">${label}詳情 <span class="required-mark">*</span></label><textarea id="${id}" data-pet-index="${petIndex}" data-pet-field="${detailsField}" placeholder="請簡單說明相關情況" required>${escapeHtml(value)}</textarea></div>`;
  }

  function renderPet(pet, index) {
    const hamster = state.form.species === 'hamster';
    const showPregnancy = !hamster && pet.sex === 'female';
    return `<article class="pet-profile" aria-labelledby="pet-title-${index}">
      <div class="pet-profile-head"><div class="pet-profile-title"><span class="pet-profile-number">${index + 1}</span><span id="pet-title-${index}">${SPECIES[state.form.species]?.label || '毛孩'}資料</span></div><span class="pet-profile-note">每隻毛孩都要填寫</span></div>
      <div class="field-grid">
        <div class="field"><label for="pet-${index}-name">寵物名稱 <span class="required-mark">*</span></label><input id="pet-${index}-name" data-pet-index="${index}" data-pet-field="name" value="${escapeHtml(pet.name)}" placeholder="毛孩的名字" required></div>
        <div class="field"><label for="pet-${index}-breed">品種 <span class="required-mark">*</span></label><input id="pet-${index}-breed" data-pet-index="${index}" data-pet-field="breed" value="${escapeHtml(pet.breed)}" placeholder="例如：侏儒兔" required></div>
        <div class="field"><label for="pet-${index}-ageValue">年齡 <span class="required-mark">*</span></label><div class="field-grid" style="grid-template-columns:1fr 100px;gap:8px"><input type="number" min="0" step="any" inputmode="decimal" id="pet-${index}-ageValue" data-pet-index="${index}" data-pet-field="ageValue" value="${escapeHtml(pet.ageValue)}" placeholder="數值" required><select id="pet-${index}-ageUnit" data-pet-index="${index}" data-pet-field="ageUnit"><option value="month" ${pet.ageUnit === 'month' ? 'selected' : ''}>月</option><option value="year" ${pet.ageUnit === 'year' ? 'selected' : ''}>歲</option></select></div><p class="field-help">系統會換算月齡；最低入住年齡為 ${SPECIES[state.form.species]?.minimumAge || 1} 個月。</p></div>
        <div class="field"><label for="pet-${index}-sex">性別 <span class="required-mark">*</span></label><select id="pet-${index}-sex" data-pet-index="${index}" data-pet-field="sex" required><option value="">請選擇</option><option value="male" ${pet.sex === 'male' ? 'selected' : ''}>男孩子</option><option value="female" ${pet.sex === 'female' ? 'selected' : ''}>女孩子</option></select></div>
        ${hamster ? '' : `<div class="field"><label for="pet-${index}-sterilized">絕育 <span class="required-mark">*</span></label><select id="pet-${index}-sterilized" data-pet-index="${index}" data-pet-field="sterilized" required><option value="">請選擇</option><option value="yes" ${pet.sterilized === 'yes' ? 'selected' : ''}>已絕育</option><option value="no" ${pet.sterilized === 'no' ? 'selected' : ''}>未絕育</option></select></div>`}
        ${showPregnancy ? `<div class="field"><label for="pet-${index}-pregnant">是否懷孕 <span class="required-mark">*</span></label><select id="pet-${index}-pregnant" data-pet-index="${index}" data-pet-field="pregnant" required><option value="">請選擇</option><option value="no" ${pet.pregnant === 'no' ? 'selected' : ''}>否</option><option value="yes" ${pet.pregnant === 'yes' ? 'selected' : ''}>是</option></select></div>` : ''}
        ${healthSelect(index, 'recentSurgery', '最近 30 日是否接受過手術？', pet.recentSurgery)}
        ${healthSelect(index, 'vetVisit', '最近看獸醫', pet.vetVisit)}
        ${healthDetail(index, 'vetVisit', 'vetDetails', '獸醫診治', pet.vetDetails)}
        ${healthSelect(index, 'infectiousDisease', '傳染病', pet.infectiousDisease)}
        ${healthDetail(index, 'infectiousDisease', 'infectiousDetails', '傳染病', pet.infectiousDetails)}
        ${healthSelect(index, 'chronicDisease', '慢性疾病', pet.chronicDisease)}
        ${healthDetail(index, 'chronicDisease', 'chronicDetails', '慢性疾病', pet.chronicDetails)}
        ${healthSelect(index, 'medication', '正在服用藥物', pet.medication)}
        ${healthDetail(index, 'medication', 'medicationDetails', '藥物', pet.medicationDetails)}
        ${hamster ? '' : healthSelect(index, 'fleaTreatment', '一個月內杜蝨處理', pet.fleaTreatment)}
        <div class="field full"><label for="pet-${index}-specialCare">特殊照顧需求 <span class="optional-label">選填</span></label><textarea id="pet-${index}-specialCare" data-pet-index="${index}" data-pet-field="specialCare" placeholder="例如：喜歡安靜的角落、需要特別留意的習慣">${escapeHtml(pet.specialCare)}</textarea></div>
      </div>
    </article>`;
  }

  function stepFour() {
    if (!state.form.species || !quantityIsValid()) return `${sectionHeading('🩺', '認識每一位毛孩', '先選好種類、房型及有效數量。', 'STEP 04')}${notice('blue', '💡', '完成房型與數量選擇後，這裡會按毛孩數量準備相同份數的資料表。')}`;
    ensurePetCount();
    const petCount = quantityNumber();
    const reviewRequired = state.form.pets.some((pet) => ['vetVisit', 'infectiousDisease', 'chronicDisease', 'medication'].some((key) => pet[key] === 'yes'));
    return `${sectionHeading('🩺', '認識每一位毛孩', '請為每隻毛孩填寫資料與健康情況。', `${petCount} 隻毛孩`)}
      ${notice('yellow', '💛', '懷孕或最近 30 日內接受手術的毛孩不可入住；其他健康情況會交由 LittleLand 人工確認。')}
      ${state.form.pets.map((pet, index) => renderPet(pet, index)).join('')}
      ${reviewRequired ? notice('yellow', '🔔', '<strong>需要人工確認健康情況。</strong> 你提供的資料已標記為 HEALTH_REVIEW_REQUIRED 示範狀態；這不是自動批准入住。') : ''}`;
  }

  function contactFoodServices() {
    const mainOptions = FOOD[state.form.species] || [];
    const hamster = state.form.species === 'hamster';
    const foodSection = `<section class="form-section"><h3 class="form-section-title"><span aria-hidden="true">🥬</span>飲食習慣</h3>
      <div class="field-grid">
        <div class="field"><label for="foodMain">主糧 <span class="optional-label">按需要選擇</span></label><select id="foodMain" data-field="foodMain">${selectOptions(mainOptions, state.form.foodMain, '請選擇主糧安排')}</select></div>
        ${hamster ? '' : `<div class="field"><label for="hay">牧草 <span class="optional-label">按需要選擇</span></label><select id="hay" data-field="hay">${selectOptions(HAY, state.form.hay, '請選擇牧草安排')}</select></div>`}
        <div class="field"><label for="feeding">餵食頻率 <span class="optional-label">按需要選擇</span></label><select id="feeding" data-field="feeding">${selectOptions(['每日一次', '每日兩次／早晚各一次'], state.form.feeding, '請選擇')}</select></div>
        ${hamster ? '' : `<div class="field"><label for="vegetables">新鮮蔬菜 <span class="optional-label">按需要選擇</span></label><select id="vegetables" data-field="vegetables">${selectOptions(['是', '否'], state.form.vegetables, '請選擇')}</select></div>`}
      </div>
      ${notice('yellow', '🌼', '逢星期日或假期只能餵一次，但會提供雙倍份量。飲食選項未標示必填，可按毛孩習慣填寫。')}
    </section>`;
    const serviceSection = `<section class="form-section"><h3 class="form-section-title"><span aria-hidden="true">🫧</span>額外服務 <span class="optional-label">選填</span></h3>
      <div class="field-grid">
        <div class="toggle-line"><div class="toggle-copy"><strong>單次梳毛</strong><small>住宿期間一次</small></div><span class="mini-fee">HK$70</span><label class="switch" aria-label="加選單次梳毛"><input type="checkbox" data-field="groomingOnce" ${state.form.groomingOnce ? 'checked' : ''}><span></span></label></div>
        <div class="toggle-line"><div class="toggle-copy"><strong>每日梳毛</strong><small>HK$50 × 晚數</small></div><span class="mini-fee">${money(50 * dateNights())}</span><label class="switch" aria-label="加選每日梳毛"><input type="checkbox" data-field="groomingDaily" ${state.form.groomingDaily ? 'checked' : ''}><span></span></label></div>
        <div class="field full"><span class="field-label">每日餵藥（1 次與 2 次互斥）</span><div class="radio-row">
          <label class="radio-tile"><input type="radio" name="medicine" data-field="medicine" value="none" ${state.form.medicine === 'none' ? 'checked' : ''}><span>不需要</span></label>
          <label class="radio-tile"><input type="radio" name="medicine" data-field="medicine" value="once" ${state.form.medicine === 'once' ? 'checked' : ''}><span>每日 1 次 · HK$80 × 晚數</span></label>
          <label class="radio-tile"><input type="radio" name="medicine" data-field="medicine" value="twice" ${state.form.medicine === 'twice' ? 'checked' : ''}><span>每日 2 次 · HK$150 × 晚數</span></label>
        </div></div>
      </div>
    </section>`;
    return `${foodSection}${serviceSection}`;
  }

  const TERMS = [
    '已知悉入住時需預支 HK$1,000／隻現金備用金／按金。',
    '已知悉需預付基本房費 50% 作訂金，附加費於尾數收取。',
    '已知悉訂金一經支付，不設退還。',
    '已閱讀並同意入住須知及寄養條款。',
    '已如實申報健康狀況。',
    '如遇緊急情況，同意 LittleLand 安排獸醫診治，並承擔醫療、交通及陪診等相關費用。'
  ];

  function detailedQuoteMarkup() {
    const price = currentPricing();
    const rows = [
      { label: '房型', amount: price.room ? `${price.room.name} · ${money(price.room.price)}／晚` : '尚未選擇' },
      { label: '晚數', amount: price.nights ? `${price.nights} 晚` : '尚未選擇' },
      { label: '寵物種類／數量', amount: state.form.species ? `${SPECIES[state.form.species].label} · ${price.quantity || '—'} 隻` : '尚未選擇' },
      { label: '基本房費', amount: money(price.baseRoomFee) },
      { label: '額外寵物費', amount: money(price.extraPetFee), surcharge: true },
      { label: '週末短住附加費（週五／六／日入住 1 晚）', amount: money(price.weekendFee), surcharge: true },
      ...price.serviceItems.map((item) => ({ label: item.label, amount: money(item.amount), surcharge: true })),
      { label: '附加費合計', amount: money(price.totalSurcharges), surcharge: true }
    ];
    return `<div class="quote-title"><strong>費用明細</strong><span class="quote-caption">Mock Pricing 預覽</span></div>
      ${rows.map((row) => `<div class="quote-line${row.surcharge ? ' quote-surcharge' : ''}"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(row.amount)}</span></div>`).join('')}
      <div class="quote-line total"><span>預計住宿總額</span><span>${money(price.estimatedTotal)}</span></div>
      <div class="quote-emphasis"><div class="emphasis-box emphasis-deposit"><span class="emphasis-icon" aria-hidden="true">🌱</span><span>現在需支付訂金<br><strong>${money(price.depositAmount)}</strong><br>基本房費 50%</span></div></div>
      <div class="quote-line"><span>預計尾數（入住當日支付）</span><span>${money(price.remainingBalance)}</span></div>
      <div class="balance-payment-reminder"><strong>尾數付款安排</strong><div class="balance-breakdown"><span>基本房費餘額 ${money(price.baseRoomFee - price.depositAmount)}</span><span>＋</span><span>附加費合計 ${money(price.totalSurcharges)}</span><span>＝ ${money(price.remainingBalance)}</span></div><p>請於入住當日支付預計尾數；附加費包含在尾數內。</p></div>
      <div class="cash-deposit-reminder"><strong>💰 現金備用金／按金 HK$1,000／隻</strong><span>合計 ${money(price.cashDeposit)}</span><p>請於入住當日準備，不計入住宿總額、訂金或尾數。</p></div>`;
  }

  function reviewTiles() {
    const price = currentPricing();
    const petNames = state.form.pets.map((pet) => pet.name.trim()).filter(Boolean);
    const values = [
      ['入住／退房', `${formatDate(state.form.checkin)} ${state.form.checkinTime || ''} → ${formatDate(state.form.checkout)} ${state.form.checkoutTime || ''}`],
      ['毛孩', `${SPECIES[state.form.species]?.label || '—'} · ${price.quantity || '—'} 隻${petNames.length ? `（${petNames.join('、')}）` : ''}`],
      ['房型', price.room ? price.room.name : '—']
    ];
    const rows = values.map(([label, value]) => `<div class="review-tile"><small>${label}</small><strong>${escapeHtml(value)}</strong></div>`).join('');
    return `${rows}<div class="review-tile"><small>家長</small><strong id="reviewParentName">${escapeHtml(state.form.parentName.trim() || '—')}</strong></div>`;
  }

  function stepFive() {
    const healthReview = state.form.pets.some((pet) => ['vetVisit', 'infectiousDisease', 'chronicDisease', 'medication'].some((key) => pet[key] === 'yes'));
    return `${sectionHeading('💌', '最後確認一下', '留下聯絡資料，看看照顧安排與費用預覽。', 'STEP 05')}
      <section class="form-section"><h3 class="form-section-title"><span aria-hidden="true">📲</span>家長聯絡資料</h3><div class="field-grid">
        ${field('parentName', '家長姓名', { required: true, placeholder: '請輸入姓名' })}
        ${field('phone', '香港電話（8 位數字）', { required: true, type: 'tel', placeholder: '例如：61234567', extra: 'inputmode="numeric" maxlength="8" autocomplete="tel-national"' })}
        ${field('email', 'Email', { required: true, type: 'email', placeholder: 'name@example.com', extra: 'autocomplete="email"' })}
        ${field('emergency1', '第 1 位緊急聯絡人', { required: true, placeholder: '姓名及聯絡電話' })}
        ${field('emergency2', '第 2 位緊急聯絡人', { required: true, placeholder: '姓名及聯絡電話' })}
        ${field('vet', '指定獸醫／診所', { placeholder: '如有需要可填寫', full: true })}
      </div></section>
      ${contactFoodServices()}
      <section class="form-section"><h3 class="form-section-title"><span aria-hidden="true">🧾</span>預約內容確認</h3><div class="review-summary">${reviewTiles()}</div>${healthReview ? notice('yellow', '🔔', '健康資料需由 LittleLand 人工確認（HEALTH_REVIEW_REQUIRED）。') : ''}<div class="quote-box" id="detailedQuote">${detailedQuoteMarkup()}</div>
        ${notice('yellow', '⚠️', '<strong>訂金一經支付，不設退還。</strong>')}
      </section>
      <section class="form-section"><h3 class="form-section-title"><span aria-hidden="true">🤍</span>提交前請確認</h3><p class="field-help">六項同意都需要勾選，才能繼續。</p><div class="terms-list">${TERMS.map((term, index) => `<label class="term-item"><input type="checkbox" data-term-index="${index}" ${state.terms[index] ? 'checked' : ''}><span>${escapeHtml(term)}</span></label>`).join('')}</div><p class="terms-error" id="termsError" ${state.terms.every(Boolean) ? 'hidden' : ''}>請勾選以上六項同意事項。</p></section>
      ${notice('blue', '💬', '提交後的下一頁是<strong>模擬完成畫面</strong>。本示範不會傳送任何預約資料、建立正式預約或處理付款。')}`;
  }

  function updateStepper() {
    document.querySelectorAll('[data-step-indicator]').forEach((item) => {
      const n = Number(item.dataset.stepIndicator);
      item.classList.toggle('is-current', n === state.step);
      item.classList.toggle('is-complete', n < state.step);
      if (n === state.step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    el.stepProgress.style.width = `${((state.step - 1) / 4) * 100}%`;
  }

  function renderStep() {
    refreshAvailability();
    if (state.completed) {
      el.stepContent.innerHTML = completionMarkup();
      el.stepper.hidden = true;
      el.wizardActions.hidden = true;
      el.summaryCard.hidden = false;
      updateSummary();
      launchConfetti();
      return;
    }
    el.stepper.hidden = false;
    el.wizardActions.hidden = false;
    updateStepper();
    const views = { 1: stepOne, 2: stepTwo, 3: stepThree, 4: stepFour, 5: stepFive };
    el.stepContent.innerHTML = views[state.step]();
    el.backButton.disabled = state.step === 1;
    el.nextButton.innerHTML = state.step === 5 ? '模擬提交申請 <span aria-hidden="true">✦</span>' : '下一步 <span aria-hidden="true">→</span>';
    el.actionHint.textContent = state.step === 5 ? '僅展示模擬流程，不會傳送資料' : `第 ${state.step}／5 步 · 約 3 分鐘完成`;
    el.formAlert.hidden = true;
    updateSummary();
  }

  function updateSummary() {
    if (!el.summaryPreview) return;
    const price = currentPricing();
    const entries = [
      ['入住日期', state.form.checkin ? `${formatDate(state.form.checkin)} · ${state.form.checkinTime || '時段未選'}` : '尚未選擇'],
      ['退房日期', state.form.checkout ? `${formatDate(state.form.checkout)} · ${state.form.checkoutTime || '時段未選'}` : '尚未選擇'],
      ['房型', price.room ? price.room.name : '尚未選擇'],
      ['毛孩', state.form.species ? `${SPECIES[state.form.species].label} · ${price.quantity || '—'} 隻` : '尚未選擇'],
      ['晚數', price.nights ? `${price.nights} 晚` : '—']
    ];
    el.summaryPreview.innerHTML = entries.map(([label, value]) => `<div class="preview-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    const reviewParentName = document.getElementById('reviewParentName');
    if (reviewParentName) reviewParentName.textContent = state.form.parentName.trim() || '—';
    const invalidRoomQuantity = Boolean(state.form.roomId) && !quantityIsValid();
    el.summaryTotal.textContent = invalidRoomQuantity ? '待修正' : money(price.estimatedTotal);
    el.summaryDeposit.textContent = invalidRoomQuantity ? '待修正' : money(price.depositAmount);
    const pricingHint = document.getElementById('summaryValidationHint');
    if (pricingHint) pricingHint.hidden = !invalidRoomQuantity;
    const checkoutInput = document.getElementById('checkout');
    if (checkoutInput) {
      const today = localDateValue(new Date());
      checkoutInput.min = state.form.checkin && state.form.checkin >= today ? state.form.checkin : today;
    }
    const inlineQuote = document.getElementById('detailedQuote');
    if (inlineQuote && state.step === 5 && !state.completed) inlineQuote.innerHTML = detailedQuoteMarkup();
    const banner = document.getElementById('availabilityBanner');
    if (banner) {
      banner.dataset.status = state.availability;
      document.getElementById('availabilityLabel').textContent = AVAILABILITY[state.availability];
      document.getElementById('availabilityMeta').textContent = datesAreValid() ? `${dateNights()} 晚 · 示範房態` : '選擇有效日期後顯示示範房態';
    }
    document.querySelectorAll('.room-status').forEach((node) => {
      const status = roomAvailabilityFor(datesAreValid());
      node.dataset.status = status;
      node.textContent = AVAILABILITY[status];
    });
  }

  function displayError(message, targetSelector) {
    el.formAlert.textContent = message;
    el.formAlert.hidden = false;
    if (targetSelector) {
      const target = document.querySelector(targetSelector);
      if (target) {
        target.setAttribute('aria-invalid', 'true');
        target.focus({ preventScroll: true });
      }
    }
    el.formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function validateDates() {
    const checkin = parseDate(state.form.checkin);
    const checkout = parseDate(state.form.checkout);
    const today = parseDate(localDateValue(new Date()));
    if (!checkin) return { message: '請選擇有效的入住日期。', target: '#checkin' };
    if (!checkout) return { message: '請選擇有效的退房日期。', target: '#checkout' };
    if (checkin < today) return { message: '入住日期不可早於今日。', target: '#checkin' };
    if (checkout <= checkin) return { message: '退房日期必須晚於入住日期，最少入住一晚。', target: '#checkout' };
    if (!state.form.checkinTime) return { message: '請選擇入住時段。', target: '#checkinTime' };
    if (!state.form.checkoutTime) return { message: '請選擇退房時段。', target: '#checkoutTime' };
    return null;
  }

  function validatePets() {
    const quantity = quantityNumber();
    const room = selectedRoom();
    if (!Number.isInteger(quantity) || quantity < 1) return { message: '毛孩數量必須是大於或等於 1 的整數。', target: '#quantity' };
    if (!room) return { message: '請先選擇房型。', target: '.room-card input' };
    if (quantity > room.max) return { message: `所選房型最多入住 ${room.max} 隻，請更改數量或房型。`, target: '#quantity' };
    ensurePetCount();
    for (let index = 0; index < quantity; index += 1) {
      const pet = state.form.pets[index];
      const prefix = `#pet-${index}-`;
      const required = [
        ['name', '請填寫每隻毛孩的名稱。'], ['breed', '請填寫每隻毛孩的品種。'],
        ['ageValue', '請填寫每隻毛孩的年齡。'], ['sex', '請選擇每隻毛孩的性別。']
      ];
      if (state.form.species !== 'hamster') required.push(['sterilized', '請填寫每隻毛孩的絕育情況。']);
      required.push(
        ['recentSurgery', '請回答最近 30 日是否接受過手術。'],
        ['vetVisit', '請回答最近看獸醫的情況。'],
        ['infectiousDisease', '請回答是否有傳染病。'],
        ['chronicDisease', '請回答是否有慢性疾病。'],
        ['medication', '請回答是否正在服用藥物。']
      );
      if (state.form.species !== 'hamster' && pet.sex === 'female') required.push(['pregnant', '請回答是否懷孕。']);
      if (state.form.species !== 'hamster') {
        required.push(['fleaTreatment', '請回答一個月內杜蝨處理情況。']);
      }
      for (const [key, message] of required) {
        if (!String(pet[key] || '').trim()) return { message, target: `${prefix}${key}` };
      }
      const age = Number(pet.ageValue);
      if (!Number.isFinite(age) || age <= 0) return { message: '年齡必須是大於 0 的數值。', target: `${prefix}ageValue` };
      const ageInMonths = age * (pet.ageUnit === 'year' ? 12 : 1);
      if (ageInMonths < SPECIES[state.form.species].minimumAge) return { message: `${SPECIES[state.form.species].label}最低入住年齡為 ${SPECIES[state.form.species].minimumAge} 個月，這隻毛孩未達最低年齡。`, target: `${prefix}ageValue` };
      if (state.form.species !== 'hamster' && pet.sex === 'female' && pet.pregnant === 'yes') return { message: '懷孕中的毛孩不可接受一般入住。', target: `${prefix}pregnant` };
      if (pet.recentSurgery === 'yes') return { message: '最近 30 日內接受手術的毛孩不可接受一般入住。', target: `${prefix}recentSurgery` };
      for (const [yesKey, detailKey, detailName] of [
        ['vetVisit', 'vetDetails', '最近看獸醫的詳情'],
        ['infectiousDisease', 'infectiousDetails', '傳染病詳情'],
        ['chronicDisease', 'chronicDetails', '慢性疾病詳情'],
        ['medication', 'medicationDetails', '正在服用藥物的詳情']
      ]) {
        if (pet[yesKey] === 'yes' && !pet[detailKey].trim()) return { message: `請補充${detailName}。`, target: `${prefix}${detailKey}` };
      }
    }
    return null;
  }

  function validateContact() {
    if (!state.form.parentName.trim()) return { message: '請填寫家長姓名。', target: '#parentName' };
    if (!/^\d{8}$/.test(state.form.phone.trim())) return { message: '請輸入有效的香港 8 位電話號碼。', target: '#phone' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.form.email.trim())) return { message: '請輸入有效的 Email 地址。', target: '#email' };
    if (!state.form.emergency1.trim()) return { message: '請填寫第 1 位緊急聯絡人。', target: '#emergency1' };
    if (!state.form.emergency2.trim()) return { message: '請填寫第 2 位緊急聯絡人。', target: '#emergency2' };
    return null;
  }

  function validateStep(step) {
    if (step === 1) return validateDates();
    if (step === 2 && !state.form.species) return { message: '請選擇寵物種類。', target: '[data-field="species"]' };
    if (step === 3) return validatePetsRoomOnly();
    if (step === 4) return validatePets();
    if (step === 5) {
      const contactError = validateContact();
      if (contactError) return contactError;
      const petError = validatePets();
      if (petError) return petError;
      if (!state.terms.every(Boolean)) {
        const termsError = document.getElementById('termsError');
        if (termsError) termsError.hidden = false;
        return { message: '請先勾選全部六項同意事項。', target: '[data-term-index="0"]' };
      }
    }
    return null;
  }

  function validatePetsRoomOnly() {
    if (!state.form.roomId) return { message: '請選擇一種房型。', target: '.room-card input' };
    const quantity = quantityNumber();
    if (!Number.isInteger(quantity) || quantity < 1) return { message: '毛孩數量必須是大於或等於 1 的整數。', target: '#quantity' };
    const room = selectedRoom();
    if (room && quantity > room.max) return { message: `此房型最多入住 ${room.max} 隻，請更改數量或選擇其他房型。`, target: '#quantity' };
    return null;
  }

  function advance() {
    const error = validateStep(state.step);
    if (error) return displayError(error.message, error.target);
    el.formAlert.hidden = true;
    if (state.step < 5) {
      state.step += 1;
      saveDraft();
      renderStep();
      el.stepContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      simulateSubmit();
    }
  }

  function goBack() {
    if (state.completed || state.step <= 1) return;
    state.step -= 1;
    el.formAlert.hidden = true;
    renderStep();
    el.stepContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function simulateSubmit() {
    // Demonstration only: no API request and no customer data is transmitted.
    clearDraft();
    const stamp = (state.form.checkin || localDateValue(new Date())).replace(/-/g, '');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    state.mockBookingId = `DEMO-LL-${stamp}-${suffix}`;
    state.completed = true;
    renderStep();
    el.stepContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function completionMarkup() {
    const price = currentPricing();
    const names = state.form.pets.map((pet) => pet.name.trim()).filter(Boolean).join('、');
    const petType = SPECIES[state.form.species]?.label || '寵物';
    const petDescription = `${petType} · ${price.quantity || '—'} 隻${names ? `（${names}）` : ''}`;
    const dateDescription = `${formatDate(state.form.checkin)} ${state.form.checkinTime} → ${formatDate(state.form.checkout)} ${state.form.checkoutTime} · ${price.nights} 晚`;
    const whatsappMessage = [
      '你好 LittleLand！我已提交預約申請，麻煩盡快協助確認並告知訂金安排，謝謝。',
      `預約申請編號：${state.mockBookingId}`,
      `家長：${state.form.parentName}`,
      `寵物：${petDescription}`,
      `房型：${price.room ? price.room.name : '—'}`,
      `入住：${formatDate(state.form.checkin)} ${state.form.checkinTime}`,
      `退房：${formatDate(state.form.checkout)} ${state.form.checkoutTime}`,
      `預計住宿總額：${money(price.estimatedTotal)}`,
      `訂金：${money(price.depositAmount)}`,
      `預計尾數（入住當日支付）：${money(price.remainingBalance)}`,
      `現金備用金／按金：${money(price.cashDeposit)}（HK$1,000／隻，入住當日準備，不計入住宿總額）`
    ].join('\n');
    const whatsappHref = `https://wa.me/85262886598?text=${encodeURIComponent(whatsappMessage)}`;
    return `<div class="completion-screen"><div class="completion-badge" aria-hidden="true">🎉</div>
      <h2>已收到您的預約申請！</h2>
      <p>謝謝你把毛孩的照顧需要告訴我們。LittleLand 將確認預約及提供訂金付款安排。</p>
      <span class="demo-label">⚠ 模擬示範 · 沒有建立正式預約</span>
      <div><span class="booking-reference">示範編號：${escapeHtml(state.mockBookingId)}</span></div>
      <div class="completion-details"><h3>本次畫面摘要</h3>
        ${completionRow('家長', state.form.parentName)}
        ${completionRow('寵物', petDescription)}
        ${completionRow('房型', price.room ? price.room.name : '—')}
        ${completionRow('入住／退房', dateDescription)}
        ${completionRow('住宿總額', money(price.estimatedTotal))}
        ${completionRow('訂金（基本房費 50%）', money(price.depositAmount))}
        ${completionRow('預計尾數（入住當日支付）', money(price.remainingBalance))}
        ${completionRow('現金備用金／按金', money(price.cashDeposit))}
      </div>
      ${notice('green', '🌱', '<strong>LittleLand 將確認預約及提供訂金付款安排。</strong> 完成訂金付款及確認後，房間才正式保留。')}
      ${notice('yellow', '⚠️', '<strong>訂金一經支付，不設退還。</strong>')}
      <div class="cash-deposit-reminder"><strong>💰 現金備用金／按金 HK$1,000／隻</strong><span>合計 ${money(price.cashDeposit)}</span><p>請於入住當日準備，不計入住宿總額、訂金或尾數。</p></div>
      <div class="completion-actions"><a class="button button-primary" href="${escapeHtml(whatsappHref)}" target="_blank" rel="noopener noreferrer">📲 WhatsApp LittleLand · 62886598 <span aria-hidden="true">↗</span></a></div>
      <p class="whatsapp-draft-note">按下後會開啟已填好預約摘要的 WhatsApp 草稿；訊息會由你確認後才發送。</p>
      <div class="completion-actions"><button type="button" class="button button-quiet" data-reset>返回預約首頁</button></div>
    </div>`;
  }

  function completionRow(label, value) {
    return `<div class="completion-detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function launchConfetti() {
    if (!el.confettiLayer || el.confettiLayer.childElementCount) return;
    const colors = ['#ed91bd', '#a77bdd', '#8dc9a1', '#f0c96d', '#8fc5e6', '#f5a889'];
    for (let index = 0; index < 56; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[index % colors.length];
      piece.style.setProperty('--duration', `${1.8 + Math.random() * 1.7}s`);
      piece.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 180)}px`);
      piece.style.animationDelay = `${Math.random() * .65}s`;
      el.confettiLayer.appendChild(piece);
    }
    window.setTimeout(() => { el.confettiLayer.replaceChildren(); }, 4700);
  }

  let toastTimer;
  function toast(message) {
    if (!el.toastRegion) return;
    el.toastRegion.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.toastRegion.replaceChildren(); }, 2600);
  }

  function handleBoundField(target) {
    if (target.dataset.termIndex !== undefined) {
      const index = Number(target.dataset.termIndex);
      if (Number.isInteger(index) && index >= 0 && index < state.terms.length) state.terms[index] = target.checked;
      const error = document.getElementById('termsError');
      if (error) error.hidden = state.terms.every(Boolean);
      return;
    }
    if (target.dataset.petField !== undefined) {
      const index = Number(target.dataset.petIndex);
      const key = target.dataset.petField;
      if (Number.isInteger(index) && state.form.pets[index] && key in state.form.pets[index]) {
        state.form.pets[index][key] = target.value;
        if (key === 'sex' && target.value === 'male') state.form.pets[index].pregnant = '';
        saveDraft();
        if (state.step === 4 && ['sex', 'vetVisit', 'infectiousDisease', 'chronicDisease', 'medication'].includes(key)) renderStep();
        else updateSummary();
      }
      return;
    }
    const key = target.dataset.field;
    if (!key || !(key in state.form)) return;
    if (target.type === 'checkbox') state.form[key] = target.checked;
    else state.form[key] = target.value;

    if (key === 'species') {
      state.form.roomId = '';
      state.form.foodMain = '';
      state.form.hay = '';
      state.form.vegetables = '';
      if (state.form.species === 'hamster') {
        state.form.pets.forEach((pet) => {
          pet.sterilized = '';
          pet.pregnant = '';
          pet.fleaTreatment = '';
        });
      }
      ensurePetCount();
      renderStep();
    } else if (key === 'quantity') {
      if (Number.isInteger(quantityNumber()) && quantityNumber() > 0 && quantityNumber() <= 8) ensurePetCount();
      updateQuantityFeedback();
      if (state.step === 4) renderStep();
    } else if (key === 'roomId') {
      updateRoomSelection();
      updateQuantityFeedback();
    }
    if (key === 'checkin' || key === 'checkout') refreshAvailability();
    saveDraft();
    updateSummary();
  }

  function updateRoomSelection() {
    document.querySelectorAll('.room-card').forEach((card) => {
      const input = card.querySelector('input[type="radio"]');
      card.classList.toggle('is-selected', Boolean(input && input.checked));
    });
    const quantity = document.getElementById('quantity');
    if (quantity) quantity.max = String(selectedRoom()?.max || 1);
    const copy = document.querySelector('.quantity-copy p');
    if (copy) copy.textContent = selectedRoom() ? `此房型最多 ${selectedRoom().max} 隻。` : '選擇房型後查看可入住數量。';
  }

  function updateQuantityFeedback() {
    const error = document.getElementById('quantityError');
    if (!error) return;
    const room = selectedRoom();
    error.textContent = getQuantityError();
    error.hidden = !room || quantityIsValid();
    const input = document.getElementById('quantity');
    if (input) input.setAttribute('aria-invalid', String(Boolean(room && !quantityIsValid())));
  }

  function resetForm() {
    state.form = cloneInitialForm();
    state.terms = Array(6).fill(false);
    state.step = 1;
    state.completed = false;
    state.mockBookingId = '';
    state.availability = 'unknown';
    clearDraft();
    el.stepper.hidden = false;
    el.wizardActions.hidden = false;
    el.summaryCard.hidden = false;
    renderStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('已開始新的預約示範。');
  }

  el.nextButton.addEventListener('click', advance);
  el.backButton.addEventListener('click', goBack);
  el.stepContent.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('input[type="checkbox"], input[type="radio"], select')) return;
    handleBoundField(target);
  });
  el.stepContent.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-field], [data-pet-field], [data-term-index]')) handleBoundField(target);
  });
  el.stepContent.addEventListener('click', (event) => {
    if (event.target.closest('[data-reset]')) resetForm();
  });
  el.stepContent.addEventListener('focusin', (event) => {
    event.target.removeAttribute('aria-invalid');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.matches('input:not([type="checkbox"]):not([type="radio"])')) {
      if (state.step < 5) { event.preventDefault(); advance(); }
    }
  });

  function handleSpeciesIllustration(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('.species-illustration')) return;
    const fallback = image.previousElementSibling;
    if (!fallback || !fallback.classList.contains('species-fallback')) return;
    if (event.type === 'load') fallback.remove();
    if (event.type === 'error') image.remove();
  }
  document.addEventListener('load', handleSpeciesIllustration, true);
  document.addEventListener('error', handleSpeciesIllustration, true);

  ensurePetCount();
  refreshAvailability();
  renderStep();
})();
