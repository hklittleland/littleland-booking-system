/* Staff TEST booking fee/refund/pet-count controls. Submission is delegated to app.js. */
(function (root) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function money(value) {
    var amount = Number(value || 0);
    return "HK$" + (Number.isFinite(amount) ? amount : 0).toLocaleString("en-HK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function activePets(pets) {
    return (Array.isArray(pets) ? pets : []).filter(function (pet) {
      return ["", "ACTIVE", "STAYING"].indexOf(String(pet.petStatus || "").toUpperCase()) >= 0;
    });
  }

  function refundedFor(payment, payments) {
    var ledgerTotal = (Array.isArray(payments) ? payments : []).filter(function (row) {
      return row.paymentType === "REFUND" &&
        (String(row.sourcePaymentId || "") === String(payment.paymentId) ||
          String(row.transactionReference || "") === String(payment.paymentId));
    }).reduce(function (sum, row) {
      return sum + Number(row.amount || 0);
    }, 0);
    return Math.max(Number(payment.refundAmount || 0), ledgerTotal);
  }

  function yesNo(label, name, required) {
    return '<label>' + escapeHtml(label) + '</label><select name="' + escapeHtml(name) + '" required>' +
      '<option value="">請選擇</option><option value="yes">是</option><option value="no">否</option></select>';
  }

  function detailsField(label, name, source) {
    return '<label>' + escapeHtml(label) + '</label><input name="' + escapeHtml(name) + '" type="text" data-detail-for="' + escapeHtml(source) + '">';
  }

  function roomLimit(species, roomTypeId) {
    var catalog = root.LittleLandPricing && root.LittleLandPricing.ROOM_CATALOG;
    var speciesRooms = catalog && catalog[species];
    var room = speciesRooms && speciesRooms[roomTypeId];
    return room ? Number(room.maxPets) : 0;
  }

  function newPetFields(species, index) {
    var hamster = species === "hamster";
    var minMonths = hamster ? 2 : 3;
    var prefix = "newPets[" + index + "].";
    return '<fieldset class="new-pet-fields" data-new-pet-fields data-pet-index="' + index + '" disabled><legend>新增寵物 ' + (index + 1) + ' 的資料</legend>' +
      '<label>寵物名稱</label><input name="' + prefix + 'name" required>' +
      '<label>品種</label><input name="' + prefix + 'breed" required>' +
      '<label>年齡（' + (hamster ? '倉鼠至少 2 個月' : '兔子／天竺鼠至少 3 個月') + '）</label><div class="field-inline"><input name="' + prefix + 'ageValue" type="number" min="' + minMonths + '" step="0.1" data-age-value required><select name="' + prefix + 'ageUnit" data-age-unit required><option value="month">月</option><option value="year">歲</option></select></div>' +
      '<label>性別</label><select name="' + prefix + 'sex" required><option value="">請選擇</option><option value="male">男孩子</option><option value="female">女孩子</option></select>' +
      (hamster ? "" : yesNo("絕育", prefix + "sterilized", true)) +
      (hamster ? "" : '<div data-pregnancy-wrap hidden>' + yesNo("懷孕", prefix + "pregnant", true) + '</div>') +
      yesNo("最近 30 日是否接受過手術？", prefix + "recentSurgery", true) +
      yesNo("最近看獸醫？", prefix + "vetVisit", true) + detailsField("看獸醫詳情（如選是必填）", prefix + "vetDetails", prefix + "vetVisit") +
      yesNo("有傳染病？", prefix + "infectiousDisease", true) + detailsField("傳染病詳情（如選是必填）", prefix + "infectiousDetails", prefix + "infectiousDisease") +
      yesNo("有慢性疾病？", prefix + "chronicDisease", true) + detailsField("慢性疾病詳情（如選是必填）", prefix + "chronicDetails", prefix + "chronicDisease") +
      yesNo("正在服藥？", prefix + "medication", true) + detailsField("藥物詳情（如選是必填）", prefix + "medicationDetails", prefix + "medication") +
      '<label>特殊照顧</label><textarea name="' + prefix + 'specialCare" rows="2"></textarea>' +
      (hamster ? "" : yesNo("一個月內有杜蝨處理？", prefix + "fleaTreatment", true)) +
      '</fieldset>';
  }

  function feePreset(key, nights) {
    var count = Math.max(1, Math.floor(Number(nights) || 1));
    var presets = {
      groom_once: { description: "單次梳毛", unit: 70, multiplier: 1, unitLabel: "次" },
      groom_daily: { description: "每日梳毛", unit: 50, multiplier: count, unitLabel: "晚" },
      medicine_once: { description: "每日餵藥 1 次", unit: 80, multiplier: count, unitLabel: "晚" },
      medicine_twice: { description: "每日餵藥 2 次", unit: 150, multiplier: count, unitLabel: "晚" },
    };
    var preset = presets[String(key || "")];
    if (!preset) return null;
    var total = Math.round(preset.unit * preset.multiplier * 100) / 100;
    var billingBasis = key === "groom_once" ? "ONCE" : "PER_NIGHT";
    return {
      description: preset.description,
      amount: preset.unit,
      billingBasis: billingBasis,
      formula: "HK$" + preset.unit + " × " + preset.multiplier + " " + preset.unitLabel + " = " + money(total),
    };
  }

  function renderPetAdjustmentControls(options) {
    options = options || {};
    var booking = options.booking || {};
    var pet = options.pet || {};
    var adjustments = Array.isArray(options.adjustments) ? options.adjustments : [];
    var pending = Boolean(options.pending);
    var petId = String(pet.petId || "");
    var petName = String(pet.name || pet.petName || "此毛孩");
    if (!petId) {
      return '<div class="pet-fee-tools notice">此毛孩資料缺少寵物 ID，暫不能新增個別附加費；請先檢查預約資料。</div>';
    }
    var rows = adjustments.filter(function (item) {
      return String(item.petId || "") === petId || (!item.petId && String(item.petNameSnapshot || "") === petName);
    }).map(function (item) {
      var signed = Number(item.amount || 0);
      var colorClass = signed < 0 ? "money-credit" : "money-charge";
      return '<article class="change-line"><div><strong>' + escapeHtml(item.description || item.type || "費用調整") + '</strong>' +
        '<p>' + escapeHtml(item.reason || "") + '</p><small>' + escapeHtml(item.createdAt || "") + ' · ' +
        escapeHtml(item.createdByStaffName || item.createdByStaffId || "") + ' · ' + escapeHtml(item.status || "") +
        '</small></div><strong class="' + colorClass + '">' + (signed < 0 ? "−" : "+") +
        escapeHtml(money(Math.abs(signed))) + '</strong></article>';
    }).join("") || '<p class="muted">此毛孩暫無附加費紀錄。</p>';
    var disabled = pending ? " disabled" : "";
    if (booking.bookingStatus === "CANCELLED") {
      return '<section class="pet-fee-tools"><strong>🐾 ' + escapeHtml(petName) + ' 個別附加費</strong>' +
        '<p class="muted">已取消預約不可新增費用；保留此毛孩的歷史紀錄。</p><div class="pet-fee-ledger">' + rows + '</div></section>';
    }
    return '<details class="pet-fee-tools"><summary>🐾 為「' + escapeHtml(petName) + '」新增／減少附加費</summary>' +
      '<p class="muted">這張表只會套用到 ' + escapeHtml(petName) + '；其他毛孩的費用不會改變。不同毛孩需不同服務或金額時，請在各自資料卡分開記錄。</p>' +
      '<form class="field pet-fee-form" data-pet-adjustment-form data-pet-id="' + escapeHtml(petId) + '" data-pet-name="' +
      escapeHtml(petName) + '" data-nights="' + escapeHtml(booking.nights || 1) + '" autocomplete="off">' +
      '<label>常用項目（預填單次金額或每晚單價）</label><select data-pet-fee-preset name="preset"' + disabled + '>' +
      '<option value="">自訂項目</option><option value="groom_once">單次梳毛 · HK$70 一次</option>' +
      '<option value="groom_daily">每日梳毛 · HK$50 × 晚數</option><option value="medicine_once">每日餵藥 1 次 · HK$80 × 晚數</option>' +
      '<option value="medicine_twice">每日餵藥 2 次 · HK$150 × 晚數</option></select>' +
      '<p class="field-help" data-pet-fee-preset-help>每日服務按每晚單價及住宿晚數計算；單次服務不會因延長住宿而自動重收。</p>' +
      '<label>項目名稱</label><input name="description" data-pet-fee-description maxlength="160" required' + disabled + '>' +
      '<label>操作</label><select name="direction" data-pet-fee-direction' + disabled + '><option value="add">新增收費</option><option value="reduce">減少／抵扣</option></select>' +
      '<label>計費方式</label><select name="billingBasis" data-pet-fee-basis' + disabled + '><option value="ONCE">一次性</option><option value="PER_NIGHT">每晚計算</option></select>' +
      '<label data-pet-fee-amount-label>一次性金額（HK$）</label><input name="amount" data-pet-fee-amount type="number" min="0.01" step="0.01" inputmode="decimal" required' + disabled + '>' +
      '<label>原因</label><textarea name="reason" rows="2" maxlength="500" required' + disabled + '></textarea>' +
      '<button class="btn" type="submit"' + disabled + '>儲存「' + escapeHtml(petName) + '」費用</button></form>' +
      '<div class="pet-fee-ledger"><h4>此毛孩附加費紀錄</h4>' + rows + '</div></details>';
  }

  function render(options) {
    options = options || {};
    var booking = options.booking || {};
    var pets = activePets(options.pets);
    var payments = Array.isArray(options.payments) ? options.payments : [];
    var adjustments = Array.isArray(options.adjustments) ? options.adjustments : [];
    var pending = Boolean(options.pending);
    var maxPets = roomLimit(booking.species, booking.roomTypeId);
    var addCapacity = Math.max(0, maxPets - pets.length);
    var adjustmentTotal = adjustments.filter(function (item) {
      return ["SURCHARGE", "REVERSAL"].indexOf(String(item.type)) >= 0;
    }).reduce(function (sum, item) {
      return sum + Number(item.amount || 0);
    }, 0);
    var currentTotal = Number(booking.estimatedTotal || 0) + adjustmentTotal;
    var netPaid = payments.filter(function (item) {
      return item.paymentStatus === "PAID" && ["DEPOSIT", "BALANCE", "ADJUSTMENT", "REFUND"].indexOf(String(item.paymentType)) >= 0;
    }).reduce(function (sum, item) {
      return sum + (item.paymentType === "REFUND" ? -1 : 1) * Number(item.amount || 0);
    }, 0);
    var depositPaid = booking.depositStatus === "PAID" || payments.some(function (payment) {
      return payment.paymentType === "DEPOSIT" && payment.paymentStatus === "PAID";
    });
    var creditDue = depositPaid ? Math.max(0, netPaid - currentTotal) : 0;
    var depositExceedsTotal = !depositPaid ? Math.max(0, Number(booking.depositAmount || 0) - currentTotal) : 0;
    var eligiblePayments = payments.filter(function (payment) {
      return payment.paymentStatus === "PAID" && ["DEPOSIT", "BALANCE", "ADJUSTMENT"].indexOf(String(payment.paymentType)) >= 0 &&
        Number(payment.amount || 0) - refundedFor(payment, payments) > 0;
    });
    var disabled = pending ? " disabled" : "";
    var adjustmentRows = adjustments.map(function (item) {
      var signed = Number(item.amount || 0);
      var colorClass = signed < 0 ? "money-credit" : "money-charge";
      var subject = item.petNameSnapshot ? " · 🐾 " + escapeHtml(item.petNameSnapshot) : "";
      return '<article class="change-line"><div><strong>' + escapeHtml(item.description || item.type || "費用調整") + '</strong>' + subject +
        '<p>' + escapeHtml(item.reason || "") + '</p><small>' + escapeHtml(item.createdAt || "") + ' · ' + escapeHtml(item.createdByStaffName || item.createdByStaffId || "") + ' · ' + escapeHtml(item.status || "") + '</small></div>' +
        '<strong class="' + colorClass + '">' + (signed < 0 ? "−" : "+") + escapeHtml(money(Math.abs(signed))) + '</strong></article>';
    }).join("") || '<p class="muted">暫無人工附加費或更正紀錄。</p>';
    var paymentOptions = eligiblePayments.map(function (payment) {
      var refundable = Math.max(0, Number(payment.amount || 0) - refundedFor(payment, payments));
      return '<option value="' + escapeHtml(payment.paymentId) + '" data-refundable="' + escapeHtml(refundable) + '">' +
        escapeHtml(payment.paymentType) + ' · ' + escapeHtml(payment.paymentId) + ' · 已收 ' + escapeHtml(money(payment.amount)) + ' · 尚可退 ' + escapeHtml(money(refundable)) + '</option>';
    }).join("");
    var refundPanel = '<details class="change-panel"><summary>記錄部分退款（手動）</summary>' +
      (eligiblePayments.length ? '<form id="bookingRefundForm" class="field change-form"><label>退款來源（已收住宿款）</label><select name="sourcePaymentId" id="refundSourcePayment" required>' + paymentOptions + '</select>' +
        '<p class="refund-limit" id="refundAvailable">尚可退：' + escapeHtml(money(Math.max(0, Number(eligiblePayments[0].amount || 0) - refundedFor(eligiblePayments[0], payments)))) + '</p>' +
        '<label>退款金額（HK$）</label><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required>' +
        '<label>退款原因</label><textarea name="reason" rows="2" maxlength="500" required></textarea>' +
        '<label class="check-row"><input name="confirmRefund" type="checkbox" required' + disabled + '>我已在系統外實際完成退款；本頁只記錄，不會執行付款</label>' +
        '<button class="btn secondary"' + disabled + '>記錄部分退款</button></form>' : '<p class="muted">沒有可退款的已收住宿付款；現金按金不在此表單處理。</p>') +
      '<p class="muted">現金按金須使用獨立現金按金流程退還，不計入住宿款可退金額。</p></details>';
    var petOptions = pets.map(function (pet) {
      return '<label class="check-row"><input type="checkbox" name="petIds" value="' + escapeHtml(pet.petId) + '"' + disabled + '>套用於 ' +
        escapeHtml(pet.name || pet.petName || pet.petId) + '</label>';
    }).join("") || '<p class="muted">未有可選取的入住寵物；可建立 booking-level 費用。</p>';
    var removeOptions = pets.map(function (pet) {
      return '<label class="check-row"><input type="checkbox" name="removePetIds" value="' + escapeHtml(pet.petId) + '"' + disabled + '>移除 ' +
        escapeHtml(pet.name || pet.petName || pet.petId) + '</label>';
    }).join("") || '<p class="muted">沒有可移除的入住寵物。</p>';

    if (booking.bookingStatus === "CANCELLED") {
      return '<section class="card booking-changes"><h2>已取消預約 · 退款及歷史紀錄</h2><p class="muted">已取消預約不接受新的費用或寵物數量更改；如有已收住宿款，仍可記錄已在系統外實際完成的部分退款。</p>' +
        refundPanel +
        '<div class="change-ledger"><h3>費用更正紀錄</h3>' + adjustmentRows + '</div></section>';
    }

    return '<section class="card booking-changes"><h2>持續調整訂單</h2>' +
      '<div class="current-settlement"><p>目前住宿總額（含人工附加費）<strong>' + escapeHtml(money(currentTotal)) + '</strong></p>' +
      '<p>' + (depositPaid ? "目前未收住宿尾數" : "扣除應收訂金後預計尾數") + ' <strong>' + escapeHtml(money(booking.remainingBalance || 0)) + '</strong></p>' +
      (creditDue > 0 ? '<p class="money-credit">多收／待人工退款 ' + escapeHtml(money(creditDue)) + '；不會自動退款。</p>' : "") +
      (depositExceedsTotal > 0 ? '<p class="notice">目前住宿總額低於應收訂金 ' + escapeHtml(money(depositExceedsTotal)) + '；訂金仍按基本房費 50% 計算，請人工核對費用調整。</p>' : "") +
      '<small>現金備用金／按金獨立計算，不加入住宿總額、訂金或尾數。</small></div>' +
      '<details class="change-panel"><summary>整張預約／多隻寵物費用調整（進階）</summary>' +
      '<form id="bookingAdjustmentForm" class="field change-form"><label>項目說明</label><input name="description" maxlength="160" required>' +
      '<label>操作</label><select name="direction"><option value="add">新增收費</option><option value="reduce">減少／抵扣</option></select>' +
      '<label>每項／每隻金額（HK$）</label><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required>' +
      '<fieldset><legend>適用範圍（進階）</legend><p class="muted">單隻毛孩的梳毛／餵藥請使用上方對應毛孩資料卡的專屬表單；這裏適合整張預約費用或多隻毛孩同額的批次操作。不同金額請逐隻記錄。</p>' + petOptions + '</fieldset>' +
      '<label>原因</label><textarea name="reason" rows="2" maxlength="500" required></textarea>' +
      '<button class="btn"' + disabled + '>儲存費用更改</button></form></details>' +
      refundPanel +
      '<details class="change-panel"><summary>增加／移除入住寵物</summary>' +
      '<p class="notice">移除寵物會保留歷史資料，並以更正紀錄撤銷該寵物尚有效的個別附加費；已收款不會自動退回。</p>' +
      '<form id="bookingPetCountForm" class="field change-form"><fieldset><legend>移除入住寵物</legend>' + removeOptions + '</fieldset>' +
      '<label class="check-row"><input type="checkbox" name="addPet" value="yes"' + disabled + '>同時新增寵物</label>' +
      '<label>新增數量</label><input name="addCount" type="number" min="1" max="' + addCapacity + '" value="1" inputmode="numeric" disabled' + disabled + '>' +
      '<p class="muted" data-add-limit-note>此房型最多入住 ' + maxPets + ' 隻；可新增 ' + addCapacity + ' 隻（如同時移除寵物，系統會重新計算）。</p>' +
      '<div data-new-pets-container data-species="' + escapeHtml(String(booking.species || "")) + '" data-current-quantity="' + pets.length + '" data-pet-limit="' + maxPets + '"></div>' +
      '<label>變更原因</label><textarea name="reason" rows="2" maxlength="500" required></textarea>' +
      '<button class="btn"' + disabled + '>儲存入住寵物更改</button></form></details>' +
      '<div class="change-ledger"><h3>附加費／更正明細</h3>' + adjustmentRows + '</div></section>';
  }

  function bind(app) {
    if (!app) return;
    app.querySelectorAll("[data-pet-adjustment-form]").forEach(function (form) {
      var presetSelect = form.querySelector("[data-pet-fee-preset]");
      var descriptionInput = form.querySelector("[data-pet-fee-description]");
      var amountInput = form.querySelector("[data-pet-fee-amount]");
      var basisSelect = form.querySelector("[data-pet-fee-basis]");
      var amountLabel = form.querySelector("[data-pet-fee-amount-label]");
      var helper = form.querySelector("[data-pet-fee-preset-help]");
      if (!presetSelect) return;
      function refreshBasis() {
        var basis = basisSelect ? basisSelect.value : "ONCE";
        if (amountLabel) amountLabel.textContent = basis === "PER_NIGHT" ? "每晚單價（HK$）" : "一次性金額（HK$）";
        var selectedPreset = feePreset(presetSelect.value, form.dataset.nights);
        if (selectedPreset && helper) {
          var nights = Math.max(1, Math.floor(Number(form.dataset.nights) || 1));
          var unit = Number(amountInput && amountInput.value || selectedPreset.amount);
          var total = basis === "PER_NIGHT" ? unit * nights : unit;
          helper.textContent = "HK$" + unit + (basis === "PER_NIGHT" ? " × " + nights + " 晚" : " 一次") + " = " + money(total) + "；仍可修改單價。";
        } else if (helper) {
          helper.textContent = basis === "PER_NIGHT"
            ? "輸入每晚單價；延長住宿時系統會按新增住宿晚數重新計算。"
            : "輸入一次性總額；延長住宿時不會自動重複收費。";
        }
      }
      presetSelect.addEventListener("change", function () {
        var preset = feePreset(presetSelect.value, form.dataset.nights);
        if (!preset) {
          if (descriptionInput) descriptionInput.value = "";
          if (amountInput) amountInput.value = "";
          if (basisSelect) basisSelect.value = "ONCE";
          refreshBasis();
          return;
        }
        if (descriptionInput) descriptionInput.value = preset.description;
        if (amountInput) amountInput.value = preset.amount.toFixed(2);
        if (basisSelect) basisSelect.value = preset.billingBasis;
        refreshBasis();
      });
      if (basisSelect) basisSelect.addEventListener("change", refreshBasis);
      if (amountInput) amountInput.addEventListener("input", refreshBasis);
      refreshBasis();
    });
    var petForm = app.querySelector("#bookingPetCountForm");
    if (petForm) {
      var addToggle = petForm.querySelector('[name="addPet"]');
      var addCount = petForm.querySelector('[name="addCount"]');
      var container = petForm.querySelector("[data-new-pets-container]");
      var note = petForm.querySelector("[data-add-limit-note]");
      var currentQuantity = Number(container && container.dataset.currentQuantity || 0);
      var maxPets = Number(container && container.dataset.petLimit || 0);
      var species = String(container && container.dataset.species || "");

      function bindPetFields(fieldset) {
        var index = Number(fieldset.dataset.petIndex);
        var prefix = "newPets[" + index + "].";
        var minimumMonths = species === "hamster" ? 2 : 3;
        var ageValue = fieldset.querySelector('[name="' + prefix + 'ageValue"]');
        var ageUnit = fieldset.querySelector('[name="' + prefix + 'ageUnit"]');
        function refreshAgeMinimum() {
          if (!ageValue || !ageUnit) return;
          ageValue.min = String(ageUnit.value === "year" ? minimumMonths / 12 : minimumMonths);
          ageValue.step = ageUnit.value === "year" ? "0.01" : "0.1";
        }
        if (ageUnit) ageUnit.addEventListener("change", refreshAgeMinimum);
        refreshAgeMinimum();
        var sex = fieldset.querySelector('[name="' + prefix + 'sex"]');
        var pregnancyWrap = fieldset.querySelector("[data-pregnancy-wrap]");
        function refreshPregnancy() {
          if (!pregnancyWrap || !sex) return;
          var show = sex.value === "female";
          pregnancyWrap.hidden = !show;
          var select = pregnancyWrap.querySelector("select");
          if (select) { select.disabled = !show; select.required = show; if (!show) select.value = ""; }
        }
        if (sex) sex.addEventListener("change", refreshPregnancy);
        refreshPregnancy();
        [["vetVisit", "vetDetails"], ["infectiousDisease", "infectiousDetails"], ["chronicDisease", "chronicDetails"], ["medication", "medicationDetails"]].forEach(function (pair) {
          var select = fieldset.querySelector('[name="' + prefix + pair[0] + '"]');
          var input = fieldset.querySelector('[name="' + prefix + pair[1] + '"]');
          if (!select) return;
          function refreshDetails() { if (input) input.required = select.value === "yes"; }
          select.addEventListener("change", refreshDetails);
          refreshDetails();
        });
      }

      function refreshNewPets() {
        if (!container || !addToggle || !addCount) return;
        var removeCount = petForm.querySelectorAll('[name="removePetIds"]:checked').length;
        var allowed = Math.max(0, maxPets - currentQuantity + removeCount);
        addCount.max = String(allowed);
        addCount.disabled = !addToggle.checked || allowed < 1;
        if (Number(addCount.value || 0) > allowed) addCount.value = String(allowed || 1);
        var desired = addToggle.checked ? Math.min(Math.max(0, Number(addCount.value || 1)), allowed) : 0;
        while (container.children.length > desired) container.removeChild(container.lastElementChild);
        while (container.children.length < desired) {
          var index = container.children.length;
          container.insertAdjacentHTML("beforeend", newPetFields(species, index));
          bindPetFields(container.lastElementChild);
        }
        Array.from(container.children).forEach(function (fieldset) { fieldset.disabled = !addToggle.checked; });
        if (note) note.textContent = allowed > 0
          ? "此房型最多入住 " + maxPets + " 隻；目前可新增 " + allowed + " 隻（如同時移除寵物，系統會重新計算）。"
          : "目前已達此房型入住上限；如需更換寵物，請先勾選移除項目。";
      }
      if (addToggle) addToggle.addEventListener("change", refreshNewPets);
      if (addCount) addCount.addEventListener("input", refreshNewPets);
      petForm.querySelectorAll('[name="removePetIds"]').forEach(function (input) { input.addEventListener("change", refreshNewPets); });
      refreshNewPets();
    }

    var refundForm = app.querySelector("#bookingRefundForm");
    if (refundForm) {
      var selectPayment = refundForm.querySelector("#refundSourcePayment");
      var amountInput = refundForm.querySelector('[name="amount"]');
      var limitText = refundForm.querySelector("#refundAvailable");
      function updateRefundLimit() {
        if (!selectPayment || !amountInput) return;
        var selected = selectPayment.options[selectPayment.selectedIndex];
        var limit = Number(selected && selected.dataset.refundable || 0);
        amountInput.max = String(limit);
        if (limitText) limitText.textContent = "尚可退：" + money(limit);
      }
      selectPayment.addEventListener("change", updateRefundLimit);
      updateRefundLimit();
    }
  }

  root.LittleLandBookingChangesView = Object.freeze({
    render: render,
    renderPetAdjustmentControls: renderPetAdjustmentControls,
    feePreset: feePreset,
    bind: bind,
    activePets: activePets,
    roomLimit: roomLimit,
    refundedFor: refundedFor,
    newPetFields: newPetFields,
  });
})(window);
