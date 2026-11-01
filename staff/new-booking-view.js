(function (root) {
  "use strict";
  const Form = root.LittleLandStaffBookingForm;
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  const value = (input) => esc(input == null ? "" : input);
  const money = (amount) => `HK$${Number(amount || 0).toLocaleString("zh-HK")}`;
  const labelForSpecies = (species) => {
    const definition = Form.speciesDefinition(species);
    return definition ? `${definition.icon} ${definition.label}` : "寵物";
  };
  const blankDraft = () => ({
    checkin: "", checkout: "", checkinTime: "", checkoutTime: "", species: "", roomId: "", quantity: 1,
    pets: [], parentName: "", phone: "", email: "", emergency1: "", emergency2: "", vet: "",
    foodMain: "", hay: "", feeding: "", vegetables: "", groomingOnce: false, groomingDaily: false,
    medicine: "none", earlyCheckin: false, lateCheckout: false, terms: Form.TERMS.map(() => false),
  });
  const field = (label, name, current, type = "text", attributes = "") => `<div class="field"><label for="${esc(name)}">${esc(label)}</label><input id="${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${value(current)}" ${attributes}></div>`;
  const selectOptions = (items, selected) => items.map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}" ${String(selected || "") === String(optionValue) ? "selected" : ""}>${esc(optionLabel)}</option>`).join("");
  const selectField = (label, name, current, items, required = false) => `<div class="field"><label for="${esc(name)}">${esc(label)}</label><select id="${esc(name)}" name="${esc(name)}" ${required ? "required" : ""}><option value="">請選擇</option>${selectOptions(items, current)}</select></div>`;
  const petField = (index, label, key, current, type = "text", attributes = "") => `<div class="field"><label>${esc(label)}</label><input type="${esc(type)}" value="${value(current)}" data-pet-field="${index}:${esc(key)}" ${attributes}></div>`;
  const petSelect = (index, label, key, current, items, required = true) => `<div class="field"><label>${esc(label)}</label><select data-pet-field="${index}:${esc(key)}" ${required ? "required" : ""}><option value="">請選擇</option>${selectOptions(items, current)}</select></div>`;
  const yesNo = [["yes", "是"], ["no", "否"]];

  function petMarkup(pet, index, species) {
    const animal = Form.speciesDefinition(species);
    const minimumAge = animal ? animal.minimumAgeMonths : 1;
    const details = [
      ["vetVisit", "最近是否看獸醫", "vetDetails", "獸醫診斷／治療詳情"],
      ["infectiousDisease", "是否有傳染病", "infectiousDetails", "傳染病詳情"],
      ["chronicDisease", "是否有慢性疾病", "chronicDetails", "慢性疾病詳情"],
      ["medication", "目前是否服藥", "medicationDetails", "藥物名稱／劑量／餵藥說明"],
    ];
    const healthFields = details.map(([key, title, detailKey, detailLabel]) => `<div class="health-question"><div class="grid two">${petSelect(index, title, key, pet[key], yesNo)}</div><div class="field pet-health-detail" data-detail-for="${index}:${key}" ${pet[key] === "yes" ? "" : "hidden"}><label>${esc(detailLabel)}（回答是時必填）</label><input value="${value(pet[detailKey])}" data-pet-field="${index}:${detailKey}" placeholder="請輸入資料"></div></div>`).join("");
    const nonHamsterFields = species === "hamster" ? "" : `<div class="grid two">${petSelect(index, "是否已絕育", "sterilized", pet.sterilized, yesNo)}${petSelect(index, "一個月內是否做過杜蝨處理", "fleaTreatment", pet.fleaTreatment, yesNo)}</div><div class="grid two" data-pregnancy-wrap="${index}" ${pet.sex === "female" ? "" : "hidden"}>${petSelect(index, "是否懷孕", "pregnant", pet.pregnant, yesNo)}</div>`;
    const needsReview = details.some(([key]) => pet[key] === "yes");
    return `<article class="pet-form-card"><div class="pet-form-head"><h3>${esc(labelForSpecies(species))} · 第 ${index + 1} 隻</h3><span class="meta">最低入住年齡 ${minimumAge} 個月</span></div><div class="grid two">${petField(index, "寵物名稱", "name", pet.name, "text", "required maxlength=80")}${petField(index, "品種", "breed", pet.breed, "text", "required maxlength=100")}${petField(index, "年齡數值", "ageValue", pet.ageValue, "number", "required min=0.1 step=0.1 placeholder=請輸入年齡")}${petSelect(index, "年齡單位", "ageUnit", pet.ageUnit, [["month", "月"], ["year", "歲"]])}${petSelect(index, "性別", "sex", pet.sex, [["male", "男孩子"], ["female", "女孩子"]])}${nonHamsterFields}</div><section class="pet-health"><h4>健康資料</h4><div class="notice warning pet-review-notice" data-health-review-for="${index}" ${needsReview ? "" : "hidden"}>這隻寵物需人工健康覆核；請填妥相關詳情，建立後由員工跟進。</div><div class="grid two">${petSelect(index, "最近 30 日是否接受過手術", "recentSurgery", pet.recentSurgery, yesNo)}</div>${healthFields}<div class="field"><label>特殊照顧／備註</label><textarea data-pet-field="${index}:specialCare" maxlength="1000" placeholder="可留空">${value(pet.specialCare)}</textarea></div></section></article>`;
  }

  function roomSelectMarkup(draft) {
    const rooms = Form.roomOptions(draft.species);
    const choices = rooms.map((room) => [room.id, `${room.label} · ${money(room.pricePerNight)}/晚 · 最多 ${room.maxPets} 隻`]);
    return `<option value="">${draft.species ? "請選擇房型" : "先選擇寵物種類"}</option>${choices.map(([id, label]) => `<option value="${esc(id)}" ${String(draft.roomId || "") === id ? "selected" : ""}>${esc(label)}</option>`).join("")}`;
  }

  function quoteMarkup(draft) {
    const validation = Form.validateAvailabilityInput(draft);
    if (validation) return `<div class="empty">選擇有效入住日期、退房日期、寵物種類、房型及數量後，即時顯示費用摘要。</div>`;
    try {
      const quote = Form.calculateQuote(draft);
      const rows = [
        ["基本房費", quote.baseRoomFee, ""],
        ["額外寵物費", quote.extraPetFee, quote.extraPetFee ? "surcharge" : ""],
        ["週末短住附加費", quote.weekendFee, quote.weekendFee ? "surcharge" : ""],
        ...quote.serviceItems.map((item) => [item.label, item.amount, "surcharge"]),
      ];
      return `<div class="new-booking-price-meta">${esc(labelForSpecies(draft.species))} · ${esc(Form.roomOptions(draft.species).find((room) => room.id === draft.roomId)?.label || draft.roomId)} · ${quote.nights} 晚 · ${Number(draft.quantity)} 隻</div><div class="price-lines">${rows.map(([label, amount, kind]) => `<div class="price-line ${kind}"><span>${esc(label)}</span><strong>${money(amount)}</strong></div>`).join("")}<div class="price-line total-surcharge"><span>附加費合計</span><strong>${money(quote.totalSurcharges)}</strong></div><div class="price-line estimated-total"><span>預計住宿總額</span><strong>${money(quote.estimatedTotal)}</strong></div><div class="price-line deposit"><span>現需支付訂金（基本房費 50%）</span><strong>${money(quote.depositAmount)}</strong></div><div class="price-line"><span>預計尾數（入住時繳付）</span><strong>${money(quote.remainingBalance)}</strong></div><div class="price-line cash-deposit"><span>現金備用金／按金（不計入住宿總額）</span><strong>${money(quote.cashDeposit)}</strong></div></div><p class="meta">訂金依基本房費計算；尾數於入住時繳付。現金備用金／按金按每隻 HK$1,000 計，並非住宿收入。</p>`;
    } catch (error) {
      return `<div class="notice warning">費用暫時無法計算：${esc(error.message || "請檢查日期、房型及數量。")}</div>`;
    }
  }

  function availabilityLabel(availability) {
    const state = availability && availability.status;
    const labels = { CHECKING: "查詢中", AVAILABLE: "可預訂", UNAVAILABLE: "不可預訂", UNKNOWN: "暫時無法確認" };
    const classes = { CHECKING: "status-orange", AVAILABLE: "status-green", UNAVAILABLE: "status-red", UNKNOWN: "status-gray" };
    const text = labels[state] || "暫時無法確認";
    return `<span id="availabilityStatus" class="badge ${classes[state] || "status-gray"}" role="status" aria-live="polite">${text}</span><span id="availabilityMessage" class="meta">${esc(availability && availability.message || "請選擇日期、物種、房型及數量後查詢。")}</span>`;
  }

  function render({ draft: suppliedDraft, availability, pending }) {
    if (!Form) return `<section class="card"><div class="error">新增預約表單元件未載入，請重新整理頁面。</div></section>`;
    const draft = suppliedDraft || blankDraft();
    const quantity = Number(draft.quantity);
    const petCount = draft.species && Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 5) : 0;
    const pets = Array.from({ length: petCount }, (_, index) => petMarkup((draft.pets || [])[index] || {}, index, draft.species));
    const food = Form.FOOD[draft.species] || { main: [], hay: [] };
    const mainChoices = (food.main || []).filter(Boolean).map((item) => [item, item]);
    const hayChoices = (food.hay || []).filter(Boolean).map((item) => [item, item]);
    const hamster = draft.species === "hamster";
    const terms = Form.TERMS.map((term, index) => `<label class="consent-row"><input type="checkbox" data-term-index="${index}" ${draft.terms && draft.terms[index] ? "checked" : ""}><span>${esc(term)}</span></label>`).join("");
    const speciesOptions = Form.SPECIES.map((item) => [item.id, `${item.icon} ${item.label}`]);
    const times = Form.TIME_SLOTS.map((item) => [item, item]);
    const healthReview = (draft.pets || []).some((pet) => ["vetVisit", "infectiousDisease", "chronicDisease", "medication"].some((key) => pet[key] === "yes"));
    return `<div class="page-head"><div><h1>新增預約</h1><p>員工代客建立 TEST 預約；所有個資只在本頁暫存，沒有電話自動查找或預填。</p></div></div><div class="notice warning"><strong>重要：</strong>新預約會以「待確認」建立，不會分配或保留實體房間。收到訂金並準備確認時，系統須重新檢查最新房態。</div><form id="newBookingForm" class="new-booking-form" novalidate><section class="card"><h2>1. 入住日期、時間與房型</h2><div class="grid two">${field("入住日期", "checkin", draft.checkin, "date", `required min="${Form.hongKongToday()}"`)}${field("退房日期", "checkout", draft.checkout, "date", `required min="${Form.hongKongToday()}"`)}${selectField("入住時間", "checkinTime", draft.checkinTime, times, true)}${selectField("退房時間", "checkoutTime", draft.checkoutTime, times, true)}${selectField("寵物種類", "species", draft.species, speciesOptions, true)}<div class="field"><label for="roomId">房型</label><select id="roomId" name="roomId" required>${roomSelectMarkup(draft)}</select></div><div class="field"><label for="quantity">寵物數量</label><input id="quantity" name="quantity" type="number" min="1" max="5" step="1" value="${value(draft.quantity)}" required><span class="meta" id="quantityLimit">請先選擇物種及房型，系統會顯示該房型入住上限。</span></div></div><div class="row availability-row"><button class="btn secondary" type="button" id="checkStaffAvailability" ${pending ? "disabled" : ""}>查詢 TEST 房態</button>${availabilityLabel(availability)}</div><p class="meta">房態只顯示可預訂／不可預訂，不顯示實體房號或其他客人資料。若不可預訂，仍可建立待確認申請，但須員工確認並跟進，不會保留房間。</p></section><section class="card"><h2>2. 寵物資料與健康申報</h2><p class="meta">年齡最少：兔子 3 個月、天竺鼠 3 個月、倉鼠 2 個月。懷孕或最近 30 日接受過手術的寵物不可按一般住宿流程建立。</p><div id="newBookingPets">${pets.join("") || `<div class="empty">先選擇寵物種類及數量，逐隻填寫寵物資料。</div>`}</div>${healthReview ? `<div class="notice warning">健康資料包含需人工覆核項目；建立後仍須由員工跟進。</div>` : ""}</section><section class="card"><h2>3. 家長聯絡資料</h2><div class="grid two">${field("家長姓名", "parentName", draft.parentName, "text", "required maxlength=100 autocomplete=name")}${field("香港電話（8 位）", "phone", draft.phone, "tel", "required inputmode=tel autocomplete=tel placeholder=例如12345678")}${field("Email", "email", draft.email, "email", "required autocomplete=email")}${field("第 1 位緊急聯絡人姓名及電話", "emergency1", draft.emergency1, "text", "required placeholder=請輸入姓名及電話")}${field("第 2 位緊急聯絡人姓名及電話", "emergency2", draft.emergency2, "text", "required placeholder=請輸入姓名及電話")}${field("指定獸醫／診所（選填）", "vet", draft.vet, "text", "maxlength=200")}</div><p class="meta">此為員工代客輸入，不會按電話號碼自動帶入舊預約或其他客人資料。</p></section><section class="card"><h2>4. 飲食與額外服務</h2><div class="grid two">${selectField("主糧（可留空）", "foodMain", draft.foodMain, mainChoices)}${!hamster ? selectField("牧草（可留空）", "hay", draft.hay, hayChoices) : ""}${!hamster ? selectField("每日餵食次數（倉鼠不適用）", "feeding", draft.feeding, [["每日一次", "每日一次"], ["每日兩次／早晚各一次", "每日兩次／早晚各一次"]]) : ""}${!hamster ? selectField("是否提供新鮮蔬菜", "vegetables", draft.vegetables, [["是", "是"], ["否", "否"]]) : ""}</div>${!hamster ? `<p class="meta">星期日／公眾假期只餵一次，按雙倍份量準備。</p>` : `<p class="notice info">倉鼠採長擺糧，不需選擇餵食次數或假期餵食提醒。</p>`}<fieldset class="service-options"><legend>額外服務（會即時更新費用）</legend><label class="choice-row"><input type="checkbox" name="groomingOnce" ${draft.groomingOnce ? "checked" : ""}>單次梳毛（HK$70 一次）</label><label class="choice-row"><input type="checkbox" name="groomingDaily" ${draft.groomingDaily ? "checked" : ""}>每日梳毛（HK$50 × 晚數）</label><div class="field"><label>每日餵藥（兩種不可同時選擇）</label><div class="choice-row"><label><input type="radio" name="medicine" value="none" ${draft.medicine === "none" ? "checked" : ""}>不需要</label><label><input type="radio" name="medicine" value="once" ${draft.medicine === "once" ? "checked" : ""}>每日 1 次（HK$80 × 晚數）</label><label><input type="radio" name="medicine" value="twice" ${draft.medicine === "twice" ? "checked" : ""}>每日 2 次（HK$150 × 晚數）</label></div></div><label class="choice-row"><input type="checkbox" name="earlyCheckin" ${draft.earlyCheckin ? "checked" : ""}>提早入住一次（HK$200）</label><label class="choice-row"><input type="checkbox" name="lateCheckout" ${draft.lateCheckout ? "checked" : ""}>延遲退房一次（17:00 後，HK$200）</label></fieldset></section><section class="card pricing-summary"><h2>5. 費用摘要</h2><div id="newBookingQuote" aria-live="polite">${quoteMarkup(draft)}</div></section><section class="card"><h2>6. 條款與確認</h2><p class="meta">請先確認客人已逐項閱讀及同意，員工代為勾選；未完成六項確認不能提交。</p><div class="consent-list">${terms}</div>${healthReview ? `<div class="notice warning">健康資料須由員工人工覆核；本表單不會自動批准健康風險。</div>` : ""}<button class="btn create-booking-btn" type="submit" ${pending ? "disabled" : ""}>${pending ? "正在提交 TEST 預約…" : "建立待確認預約"}</button><p class="meta">建立成功後才會顯示 Booking ID；本操作不會發送 WhatsApp 或付款請求。</p></section></form>`;
  }

  function readDraft(form, existing) {
    const draft = Object.assign(blankDraft(), existing || {});
    const getValue = (name) => { const control = form.elements.namedItem(name); return control ? control.value : draft[name] || ""; };
    ["checkin", "checkout", "checkinTime", "checkoutTime", "species", "roomId", "parentName", "phone", "email", "emergency1", "emergency2", "vet", "foodMain", "hay", "feeding", "vegetables"].forEach((key) => { draft[key] = getValue(key); });
    const quantityValue = getValue("quantity");
    draft.quantity = quantityValue === "" ? "" : Number(quantityValue);
    ["groomingOnce", "groomingDaily", "earlyCheckin", "lateCheckout"].forEach((key) => { const control = form.elements.namedItem(key); draft[key] = !!(control && control.checked); });
    const selectedMedicine = form.querySelector('input[name="medicine"]:checked');
    if (selectedMedicine) draft.medicine = selectedMedicine.value;
    draft.terms = Array.from(form.querySelectorAll("[data-term-index]"), (control) => control.checked);
    const count = Number.isInteger(draft.quantity) && draft.quantity > 0 && draft.quantity <= 5 ? draft.quantity : 0;
    if (count) {
      const pets = [];
      for (let index = 0; index < count; index += 1) {
        const pet = Object.assign({}, (draft.pets || [])[index] || {});
        form.querySelectorAll(`[data-pet-field^="${index}:"]`).forEach((control) => {
          const key = control.dataset.petField.slice(control.dataset.petField.indexOf(":") + 1);
          pet[key] = control.value;
        });
        pets.push(pet);
      }
      draft.pets = pets;
    }
    return draft;
  }

  function availabilityKey(draft) {
    return [draft.checkin, draft.checkout, draft.species, draft.roomId, draft.quantity].join("|");
  }
  function statusText(node, data) {
    if (!node) return;
    const state = data && data.status || "UNKNOWN";
    const labels = { CHECKING: "查詢中", AVAILABLE: "可預訂", UNAVAILABLE: "不可預訂", UNKNOWN: "暫時無法確認" };
    const classes = { CHECKING: "status-orange", AVAILABLE: "status-green", UNAVAILABLE: "status-red", UNKNOWN: "status-gray" };
    const badge = node.querySelector("#availabilityStatus"), message = node.querySelector("#availabilityMessage");
    if (badge) { badge.textContent = labels[state] || labels.UNKNOWN; badge.className = `badge ${classes[state] || classes.UNKNOWN}`; }
    if (message) message.textContent = data && data.message || "請選擇日期、物種、房型及數量後查詢。";
  }
  function applyRoomLimits(form, draft) {
    const room = Form.roomOptions(draft.species).find((item) => item.id === draft.roomId);
    const quantity = form.elements.namedItem("quantity"), hint = form.querySelector("#quantityLimit");
    if (quantity) {
      quantity.max = room ? String(room.maxPets) : "5";
      quantity.setCustomValidity(room && Number(quantity.value) > room.maxPets ? `此房型最多 ${room.maxPets} 隻，請調整數量或房型。` : "");
    }
    if (hint) hint.textContent = room ? `${room.label}最多 ${room.maxPets} 隻；更改房型不會自動減少寵物數量。` : "請先選擇物種及房型，系統會顯示該房型入住上限。";
  }
  function showQuote(form, draft) {
    const container = form.querySelector("#newBookingQuote");
    if (container) container.innerHTML = quoteMarkup(draft);
  }
  function updateDetails(form, fieldName, fieldValue) {
    const match = fieldName.match(/^(\d+):([^:]+)$/);
    if (!match) return;
    const index = match[1], key = match[2];
    if (key === "sex") {
      const wrapper = form.querySelector(`[data-pregnancy-wrap="${index}"]`);
      const pregnancy = form.querySelector(`[data-pet-field="${index}:pregnant"]`);
      if (wrapper) wrapper.hidden = fieldValue !== "female";
      if (pregnancy && fieldValue !== "female") pregnancy.value = "";
    }
    const detail = form.querySelector(`[data-detail-for="${index}:${key}"]`);
    if (detail) detail.hidden = fieldValue !== "yes";
  }
  function updateHealthNotice(form, draft) {
    form.querySelectorAll("[data-health-review-for]").forEach((notice) => {
      const pet = (draft.pets || [])[Number(notice.dataset.healthReviewFor)] || {};
      notice.hidden = !["vetVisit", "infectiousDisease", "chronicDisease", "medication"].some((key) => pet[key] === "yes");
    });
  }

  async function bind(context) {
    if (!Form) return;
    const form = context.app.querySelector("#newBookingForm");
    if (!form) return;
    let availabilityTimer = null, requestSequence = 0;
    const state = context.store.state;
    const save = () => {
      state.newBookingDraft = readDraft(form, state.newBookingDraft);
      updateHealthNotice(form, state.newBookingDraft);
      return state.newBookingDraft;
    };
    const updateAvailabilityView = () => statusText(form, state.newBookingAvailability);
    const checkAvailability = async () => {
      const draft = save(), key = availabilityKey(draft);
      const invalid = Form.validateAvailabilityInput(draft);
      if (invalid) {
        state.newBookingAvailability = { status: "UNKNOWN", key, message: "請先選擇有效日期、物種、房型及數量。" };
        updateAvailabilityView();
        return null;
      }
      const sequence = ++requestSequence;
      state.newBookingAvailability = { status: "CHECKING", key, message: "正在查詢 TEST 房態…" };
      updateAvailabilityView();
      try {
        const result = await context.api.request("availability", Form.availabilityInput(draft), context.store.token);
        if (sequence !== requestSequence) return null;
        if (!result || typeof result.available !== "boolean") throw new Error("房態回應格式無效。");
        state.newBookingAvailability = { status: result.available ? "AVAILABLE" : "UNAVAILABLE", key, message: result.available ? "目前可建立申請；實體房間只會於確認訂金時重新檢查。" : "目前不可預訂；仍可建立待確認申請，但不佔房並須人工跟進。" };
        updateAvailabilityView();
        return result.available;
      } catch (error) {
        if (sequence !== requestSequence) return null;
        if (context.handleAuth(error)) { context.paint(); return null; }
        state.newBookingAvailability = { status: "UNKNOWN", key, message: "暫時無法確認；請檢查網絡後重試。" };
        updateAvailabilityView();
        return null;
      }
    };
    const scheduleAvailability = () => {
      requestSequence += 1;
      state.newBookingAvailability = { status: "UNKNOWN", key: availabilityKey(save()), message: "資料有更新，準備重新查詢房態…" };
      updateAvailabilityView();
      if (availabilityTimer) clearTimeout(availabilityTimer);
      availabilityTimer = setTimeout(() => { checkAvailability(); }, 350);
    };
    const rebuildDynamicFields = (reason) => {
      let draft = save();
      if (reason === "species") {
        if (!Form.roomOptions(draft.species).some((room) => room.id === draft.roomId)) draft.roomId = "";
        const room = form.elements.namedItem("roomId");
        if (room) room.innerHTML = roomSelectMarkup(draft);
      }
      if (reason === "quantity") {
        const quantity = Number(draft.quantity);
        if (Number.isInteger(quantity) && quantity > 0 && quantity <= 5) {
          const pets = (draft.pets || []).slice(0, quantity);
          while (pets.length < quantity) pets.push({});
          draft.pets = pets;
        }
      }
      state.newBookingDraft = draft;
      const petContainer = form.querySelector("#newBookingPets");
      if (petContainer) {
        const quantity = Number(draft.quantity), count = Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 5) : 0;
        petContainer.innerHTML = count ? Array.from({ length: count }, (_, index) => petMarkup((draft.pets || [])[index] || {}, index, draft.species)).join("") : `<div class="empty">請輸入 1 至 5 隻寵物；超出房型上限不可提交。</div>`;
      }
      applyRoomLimits(form, draft);
      updateHealthNotice(form, draft);
      showQuote(form, draft);
    };

    applyRoomLimits(form, save());
    form.addEventListener("input", (event) => {
      const draft = save();
      showQuote(form, draft);
      if (event.target.dataset && event.target.dataset.petField) updateDetails(form, event.target.dataset.petField, event.target.value);
      if (["checkin", "checkout", "species", "roomId", "quantity"].includes(event.target.name)) scheduleAvailability();
    });
    form.addEventListener("change", (event) => {
      const target = event.target;
      if (target.dataset && target.dataset.petField) updateDetails(form, target.dataset.petField, target.value);
      if (target.name === "species") rebuildDynamicFields("species");
      else if (target.name === "quantity") rebuildDynamicFields("quantity");
      else {
        const draft = save();
        showQuote(form, draft);
        if (["checkin", "checkout", "roomId"].includes(target.name)) applyRoomLimits(form, draft);
      }
      if (["checkin", "checkout", "species", "roomId", "quantity"].includes(target.name)) scheduleAvailability();
    });
    const checkButton = form.querySelector("#checkStaffAvailability");
    if (checkButton) checkButton.onclick = () => { checkAvailability(); };

    form.onsubmit = async (event) => {
      event.preventDefault();
      if (context.isPending()) return;
      const draft = save();
      const validation = Form.validateDraft(draft);
      if (validation) { context.setError(validation); context.paint(); return; }
      const key = availabilityKey(draft);
      let available = state.newBookingAvailability && state.newBookingAvailability.key === key && ["AVAILABLE", "UNAVAILABLE"].includes(state.newBookingAvailability.status)
        ? state.newBookingAvailability.status === "AVAILABLE" : await checkAvailability();
      if (available === null) {
        context.setError("房態目前暫時無法確認，未建立預約；請重試房態查詢。");
        context.paint();
        return;
      }
      if (!available && !root.confirm("目前房態不可預訂。仍可建立一張不佔房的待確認申請，但需員工人工聯絡客人跟進。確認繼續？")) return;
      let request;
      try {
        const existingKey = state.newBookingIdempotencyKey || root.crypto && root.crypto.randomUUID && root.crypto.randomUUID() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        request = Form.buildRequest(draft, existingKey);
        const fingerprint = JSON.stringify({ form: request.form, terms: request.terms, clientQuote: request.clientQuote });
        const stableKey = state.newBookingPayloadFingerprint === fingerprint && state.newBookingIdempotencyKey ? state.newBookingIdempotencyKey : (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        state.newBookingIdempotencyKey = stableKey;
        state.newBookingPayloadFingerprint = fingerprint;
        request = Form.buildRequest(draft, stableKey);
      } catch (error) {
        context.setError(error.message || "表單資料未能驗證。");
        context.paint();
        return;
      }
      context.setError("");
      context.setPending(true);
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = "正在提交 TEST 預約…"; }
      form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
      try {
        const result = await context.api.request("createBooking", { request }, context.store.token);
        const bookingId = String(result && result.bookingId || "");
        if (!bookingId || result.bookingStatus !== "PENDING_CONFIRMATION" || (Array.isArray(result.allocatedRoomIds) && result.allocatedRoomIds.length > 0)) throw new Error("TEST API 回應未能確認這張預約為待確認且未分配房間；表單保留，請先核對 TEST 資料。");
        state.newBookingDraft = blankDraft();
        state.newBookingAvailability = null;
        state.newBookingIdempotencyKey = "";
        state.newBookingPayloadFingerprint = "";
        context.readCache.clear();
        const reference = root.LittleLandBookingReference ? root.LittleLandBookingReference.format(bookingId) : bookingId;
        context.toast(`TEST 預約 ${reference} 已建立為待確認；沒有分配實體房間。`);
        context.router.go("detail", bookingId);
      } catch (error) {
        if (!context.handleAuth(error)) context.setError(error.message || "建立失敗；資料仍保留，請重試。");
      } finally {
        context.setPending(false);
        if (context.router.current().page === "new-booking") context.paint();
      }
    };
  }

  root.LittleLandStaffNewBookingView = Object.freeze({ blankDraft, render, bind, readDraft, quoteMarkup });
})(window);
