(function (root) {
  "use strict";

  const roomNames = {
    DELUXE_ROOM: "豪華房",
    PRIVATE_SUITE: "獨立套房",
    DELUXE_SUITE: "豪華套房",
    VERY_DELUXE_SUITE: "非常.豪華套房",
    STANDARD_ROOM: "標準房",
    HAMSTER_BOX: "整理箱",
    OWN_CAGE: "自備籠",
  };
  const speciesNames = { RABBIT: "兔子", GUINEA_PIG: "天竺鼠", HAMSTER: "倉鼠" };
  const statusNames = {
    PENDING_CONFIRMATION: "已收到申請，待確認",
    PENDING_DEPOSIT: "待付訂金",
    CONFIRMED: "已確認",
    CHECKED_IN: "入住中",
    CHECKED_OUT: "已退房",
    COMPLETED: "已完成",
    CANCELLED: "已取消",
  };
  const fieldNames = {
    male: "男孩子", female: "女孩子", yes: "是", no: "否", YES: "是", NO: "否",
    true: "是", false: "否", month: "個月", year: "歲",
  };

  function esc(value) {
    return String(value == null || value === "" ? "—" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }
  function value(object, ...keys) {
    for (const key of keys) if (object && object[key] != null && object[key] !== "") return object[key];
    return "";
  }
  function money(amount) {
    if (amount == null || amount === "" || !Number.isFinite(Number(amount))) return "—";
    const number = Number(amount);
    const digits = Number.isInteger(number) ? 0 : 2;
    return `HK$${number.toLocaleString("zh-HK", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
  }
  function signedMoney(amount) {
    const number = Number(amount);
    if (!Number.isFinite(number)) return "—";
    return number < 0 ? `-${money(Math.abs(number))}` : money(number);
  }
  function display(input) {
    if (input == null || input === "") return "—";
    const translated = fieldNames[String(input)];
    if (translated != null) return translated;
    if (typeof input === "object") {
      if (Array.isArray(input)) return input.map(display).join("、");
      const name = input.name || input.contactName || "";
      const phone = input.phone || input.contactPhone || "";
      return [name, phone].filter(Boolean).join(" · ") || JSON.stringify(input);
    }
    return String(input);
  }
  function yesNo(input) {
    if (input === true || ["true", "yes", "1"].includes(String(input).toLowerCase())) return "是";
    if (input === false || ["false", "no", "0"].includes(String(input).toLowerCase())) return "否";
    return display(input);
  }
  function shortReference(booking, supplied) {
    if (supplied) return String(supplied);
    const id = String(value(booking, "bookingId", "id") || "");
    const match = id.match(/^TEST-LL-\d{8}-([A-Z0-9]{8})$/i);
    return match ? match[1].toUpperCase() : id.slice(-8);
  }
  function allocatedPhysicalRooms(booking) {
    const allowed = new Set(["S1", "S2", "S3", "A1", "A2", "A3", "B1", "B2", "C1", "F1"]);
    let raw = booking && (booking.allocatedRoomIds || booking.allocatedRoomIdsJson);
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { raw = []; }
    }
    if (!Array.isArray(raw)) return [];
    return Array.from(new Set(raw.map((id) => String(id || "")).filter((id) => allowed.has(id))));
  }
  function parseServices(booking, supplied) {
    if (Array.isArray(supplied) && supplied.length) return supplied;
    const raw = booking && (booking.serviceItemsJson || booking.servicesJson);
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) { return []; }
    }
    return [];
  }
  function currentAdjustment(entry) {
    const type = String(entry.type || "").toUpperCase();
    const status = String(entry.status || "").toUpperCase();
    if (type === "SURCHARGE") return ["ACTIVE", "PAID", "REVERSED"].includes(status);
    if (type === "REVERSAL") return ["ACTIVE", "PAID", "RECORDED"].includes(status);
    return false;
  }
  function adjustmentLabel(type) {
    return ({ SURCHARGE: "員工增加項目", REVERSAL: "員工減免／撤銷項目" })[String(type || "").toUpperCase()] || "費用調整";
  }
  function paymentLabel(payment) {
    return ({ DEPOSIT: "訂金", BALANCE: "住宿尾數", CASH_DEPOSIT: "現金備用金／按金", REFUND: "退款" })[String(payment.paymentType || "").toUpperCase()] || String(payment.paymentType || "付款");
  }
  function paymentStatus(input) {
    return ({ PAID: "已收", UNPAID: "未收", REFUNDED: "已退款", PENDING: "待處理", FAILED: "失敗" })[String(input || "").toUpperCase()] || display(input);
  }
  function formatDate(input) {
    if (!input) return "—";
    const text = String(input);
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
  }
  function stayNights(booking) {
    const nights = Number(booking.nights || 0);
    if (Number.isFinite(nights) && nights > 0) return Math.ceil(nights);
    const start = Date.parse(`${String(booking.checkinDate || "").slice(0, 10)}T00:00:00Z`);
    const end = Date.parse(`${String(booking.checkoutDate || "").slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 86400000) : 1;
  }
  function dateLabel(checkinDate, offset) {
    const parts = String(checkinDate || "").slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !part)) return "";
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offset));
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  function infoRows(rows) {
    return rows.map(([label, val]) => `<div class="info-row"><b>${esc(label)}</b><span>${esc(display(val))}</span></div>`).join("");
  }
  function serviceLabel(service) {
    return typeof service === "string" ? service : value(service, "label", "name", "serviceName", "serviceId", "id");
  }
  function serviceAmount(service) {
    return typeof service === "object" ? value(service, "amount", "fee", "total") : "";
  }
  function servicePet(service, pets) {
    if (typeof service !== "object") return "";
    const snapshot = value(service, "petNameSnapshot", "petName");
    if (snapshot) return snapshot;
    const petId = value(service, "petId", "petIdSnapshot");
    if (!petId) return "";
    const linkedPet = (pets || []).find((pet) => String(pet.petId || "") === String(petId));
    return linkedPet ? value(linkedPet, "name", "petName") : "";
  }
  function adjustmentPet(entry, pets) {
    const snapshot = value(entry, "petNameSnapshot", "petName");
    if (snapshot) return snapshot;
    const petId = value(entry, "petId", "petIdSnapshot");
    if (!petId) return "";
    const linkedPet = (pets || []).find((pet) => String(pet.petId || "") === String(petId));
    return linkedPet ? value(linkedPet, "name", "petName") : "";
  }

  function render(input, options) {
    const data = input || {};
    const opts = options || {};
    const booking = data.booking || data.detail || {};
    const pets = Array.isArray(data.pets) ? data.pets.filter((pet) => !["REMOVED", "ARCHIVED"].includes(String(pet.petStatus || "").toUpperCase())) : [];
    const payments = Array.isArray(data.payments) ? data.payments : [];
    const adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
    const services = parseServices(booking, data.services);
    const currentAdjustments = adjustments.filter(currentAdjustment).filter((entry) => Number(entry.amount || 0) !== 0);
    const reference = shortReference(booking, opts.shortReference);
    const quantity = Number(booking.quantity || pets.length || 0);
    const nights = stayNights(booking);
    const physicalRooms = allocatedPhysicalRooms(booking);
    const physicalRoomLabel = physicalRooms.length
      ? physicalRooms.join("＋")
      : ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(String(booking.bookingStatus || "").toUpperCase())
        ? "待系統自動分配"
        : "未分配（請核對房態）";
    const manualAdjustmentTotal = currentAdjustments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const currentTotal = Number(booking.estimatedTotal || 0) + manualAdjustmentTotal;
    const cashDepositAmount = Number(booking.cashDepositAmount || booking.cashDeposit || quantity * 1000);
    const collectedCashDeposit = Number(booking.cashDepositCollectedAmount || (booking.cashDepositCollected ? cashDepositAmount : 0));
    const assetBase = String(opts.assetBase || "assets/booking-print/");
    const logo = opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="LittleLand">` : "";
    const generatedAt = opts.generatedAt || new Intl.DateTimeFormat("zh-HK", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong",
    }).format(new Date());

    const feeRows = [["基本房費", `${roomNames[booking.roomTypeId] || display(booking.roomTypeId)} · ${money(booking.roomPrice)} × ${nights || "—"} 晚`, booking.baseRoomFee]];
    if (Number(booking.extraPetFee || 0) !== 0) feeRows.push(["額外寵物費", `${Math.max(0, quantity - 1)} 隻額外寵物 · 每隻每晚 HK$50`, booking.extraPetFee]);
    if (Number(booking.weekendFee || 0) !== 0) feeRows.push(["週末短住附加費", "入住日為星期五／六／日並只住一晚", booking.weekendFee]);
    const pricedServices = services.filter((service) => Number(serviceAmount(service) || 0) !== 0);
    if (pricedServices.length) {
      pricedServices.forEach((service) => {
        const petName = servicePet(service, pets);
        const label = serviceLabel(service);
        const petScope = petName ? `寵物：${petName}` : /梳毛|餵藥|藥物|groom|medicine/i.test(label) ? "毛孩未指定" : "整張預約";
        feeRows.push(["額外服務", `${label} · ${petScope}`, serviceAmount(service)]);
      });
    } else if (Number(booking.serviceFees || 0) !== 0) {
      feeRows.push(["額外服務費合計", "未有逐項服務明細", booking.serviceFees]);
    }
    currentAdjustments.forEach((entry) => {
      const petName = adjustmentPet(entry, pets);
      feeRows.push([adjustmentLabel(entry.type), [value(entry, "description"), petName ? `寵物：${petName}` : ""].filter(Boolean).join(" · "), entry.amount]);
    });
    const feeMarkup = feeRows.map(([label, note, amount]) => `<tr><td>${esc(label)}</td><td>${esc(note)}</td><td class="numeric">${amount === "" ? "—" : signedMoney(amount)}</td></tr>`).join("");
    const surchargeTotalsMarkup = `${Number(booking.totalSurcharges || 0) !== 0 ? `<div><span>附加費合計（系統費用）</span><b>${esc(money(booking.totalSurcharges))}</b></div>` : ""}${manualAdjustmentTotal !== 0 ? `<div><span>人工附加費／減項淨額</span><b>${esc(signedMoney(manualAdjustmentTotal))}</b></div>` : ""}`;
    const paymentMarkup = payments.length
      ? payments.map((payment) => `<tr><td>${esc(paymentLabel(payment))}</td><td>${esc(paymentStatus(payment.paymentStatus))}</td><td class="numeric">${esc(money(payment.amount))}</td><td>${esc(formatDate(payment.paidAt || payment.createdAt))}</td></tr>`).join("")
      : '<tr><td colspan="4" class="muted">尚無付款紀錄</td></tr>';
    const refundEntries = adjustments.filter((entry) => String(entry.type || "").toUpperCase() === "REFUND");
    const refundMarkup = refundEntries.map((entry) => `<li>${esc(value(entry, "description", "reason") || "退款")}：${esc(money(Math.abs(Number(entry.amount || 0))))}</li>`).join("");
    const cashRemaining = Math.max(0, Number(booking.cashDepositRefundDue != null
      ? booking.cashDepositRefundDue
      : collectedCashDeposit - Number(booking.cashDepositUsedAmount || 0) - Number(booking.cashDepositRefundedAmount || 0)));

    const mainPage = `<section class="sheet">
      <header class="brand-row"><div class="brand-lockup">${logo}<div class="brand">LittleLand <small>小寵物酒店服務</small></div></div><div class="test-tag">TEST 測試列印</div></header>
      <h1>入住資料核對及收費詳情</h1>
      <div class="notice">請家長於入住時核對下列預約資料及費用。如資料有誤，請先聯絡員工更正。本文件不代表尚未確認的預約已獲房間保留。</div>
      <div class="ref-row"><strong>訂單短編號</strong><span class="ref">${esc(reference || "—")}</span><span class="status">${esc(statusNames[booking.bookingStatus] || display(booking.bookingStatus))}</span></div>
      <div class="meta-line">列印時間：${esc(generatedAt)}　·　住宿：${esc(nights || "—")} 晚</div>
      <section class="block"><h2>家長及住宿資料</h2><div class="two-col">${infoRows([
        ["家長姓名", value(booking, "parentName", "customerName")], ["聯絡電話", booking.phone],
        ["Email", booking.email], ["指定獸醫／診所", booking.vet],
        ["緊急聯絡人 1", booking.emergency1], ["緊急聯絡人 2", booking.emergency2],
        ["入住日期／時間", `${formatDate(booking.checkinDate)} ${display(booking.checkinTime)}`],
        ["退房日期／時間", `${formatDate(booking.checkoutDate)} ${display(booking.checkoutTime)}`],
        ["寵物種類／數量", `${speciesNames[booking.species] || display(booking.species)} · ${quantity || "—"} 隻`],
        ["房型", roomNames[booking.roomTypeId] || display(booking.roomTypeId)],
        ["實體房間（系統自動分配）", physicalRoomLabel],
      ])}</div></section>
      <section class="block"><h2>住宿及收費明細</h2><table class="fees"><thead><tr><th>項目</th><th>說明</th><th class="numeric">金額</th></tr></thead><tbody>${feeMarkup}</tbody></table>
        <div class="totals">${surchargeTotalsMarkup}<div class="grand"><span>目前住宿總額（不含現金按金）</span><b>${esc(money(currentTotal))}</b></div>
        <div><span>應付訂金（基本房費 50%） · ${esc(paymentStatus(booking.depositStatus))}</span><b>${esc(money(booking.depositAmount))}</b></div>
        <div><span>預計尾數 · ${esc(paymentStatus(booking.balanceStatus))}</span><b>${esc(money(booking.remainingBalance))}</b></div>
        <div class="cash"><span>入住當日現金備用金／按金（每隻 HK$1,000，不計入住宿總額）</span><b>${esc(money(cashDepositAmount))}</b></div>
        <div><span>已收／已使用／已退／尚餘現金按金</span><b>${esc([collectedCashDeposit, booking.cashDepositUsedAmount || 0, booking.cashDepositRefundedAmount || 0, cashRemaining].map(money).join(" / "))}</b></div></div>
        <p class="small-note">尾數於入住時繳付；現金備用金／按金獨立處理，不計入住宿總額、訂金或尾數。訂金收取及退款情況以付款紀錄為準。</p>
      </section>
      <footer>TEST 測試文件 · 原始入住條款頁原樣附入；醫藥及日常照顧表按訂單資料另行編排。　WhatsApp +852 62886598</footer>
    </section>`;

    const paymentPage = `<section class="sheet">
      <header class="brand-row"><div class="brand-lockup">${logo}<div class="brand">LittleLand <small>小寵物酒店服務</small></div></div><div class="test-tag">TEST 測試列印</div></header>
      <h1>付款及入住當日核對</h1>
      <div class="notice">請員工與家長核對訂金、尾數及現金備用金／按金；實際收款及退款以付款紀錄為準。現金按金不計入住宿總額。</div>
      <div class="ref-row"><strong>訂單短編號</strong><span class="ref">${esc(reference || "—")}</span><span class="status">${esc(statusNames[booking.bookingStatus] || display(booking.bookingStatus))}</span></div>
      <section class="block"><h2>付款紀錄</h2><table class="payments"><thead><tr><th>類別</th><th>狀態</th><th class="numeric">金額</th><th>日期</th></tr></thead><tbody>${paymentMarkup}</tbody></table>${refundMarkup ? `<p class="refund-title">已記錄退款</p><ul>${refundMarkup}</ul>` : ""}</section>
      <section class="block"><h2>入住日款項核對</h2><div class="two-col">${infoRows([
        ["目前住宿總額", money(currentTotal)], ["訂金應收／狀態", `${money(booking.depositAmount)} · ${paymentStatus(booking.depositStatus)}`],
        ["住宿尾數／狀態", `${money(booking.remainingBalance)} · ${paymentStatus(booking.balanceStatus)}`], ["現金按金應收", money(cashDepositAmount)],
        ["已收現金按金", money(collectedCashDeposit)], ["已使用／已退／尚餘", `${money(booking.cashDepositUsedAmount || 0)} / ${money(booking.cashDepositRefundedAmount || 0)} / ${money(cashRemaining)}`],
      ])}</div>
        <p>入住時尾數實收：HK$________________　付款方式：________________　收取時間：________________</p>
        <p>現金備用金／按金：□ 已收　□ 未收　　退款／使用備註：________________________________</p>
      </section>
      <div class="signature-row"><div>家長核對／確認簽署：________________________</div><div>日期：________________</div></div>
      <div class="signature-row"><div>員工收款／核對簽署：________________________</div><div>日期：________________</div></div>
      <footer>TEST 測試文件 · 訂單短編號 ${esc(reference)}　·　WhatsApp +852 62886598</footer>
    </section>`;

    const hamster = String(booking.species || "").toUpperCase() === "HAMSTER";
    const feedText = String(booking.feeding || "");
    const feedingTwice = /2|兩|二/.test(feedText);
    const feedCount = hamster ? 0 : feedingTwice ? 2 : 1;
    const medicineService = services.find((service) => /餵藥|藥物|medicine/i.test(String(serviceLabel(service))));
    const medicationSource = [value(medicineService || {}, "label", "name", "serviceId"), booking.medicine, ...pets.map((pet) => pet.medicationDetails || "")].join(" ");
    const medicationTimes = /2\s*次|兩次|二次|twice/i.test(medicationSource) || /^(2|two|twice)$/i.test(String(booking.medicine || "").trim()) ? 2 : 1;
    const carePages = [];
    const segments = Math.max(1, Math.ceil(nights / 10));
    pets.forEach((pet, petIndex) => {
      for (let segment = 0; segment < segments; segment += 1) {
        const species = speciesNames[pet.species] || speciesNames[booking.species] || display(booking.species);
        const name = value(pet, "name", "petName");
        const startOffset = segment * 10;
        const dateCells = Array.from({ length: 10 }, (_, day) => {
          const offset = startOffset + day;
          return offset < nights ? `<th><span>第${offset + 1}日</span><b>${esc(dateLabel(booking.checkinDate, offset) || "日期未設定")}</b></th>` : `<th class="outside"><span>第${offset + 1}日</span><b>—</b></th>`;
        }).join("");
        const rows = [
          ["飲用水／水瓶", "補充清潔及飲水觀察"],
          ["墊材／環境", "檢查並按需要更換"],
        ];
        if (hamster) {
          rows.push(["主糧檢查／補充", value(booking, "foodMain") || "長擺糧"]);
        } else {
          rows.push(["主糧 · 第 1 次", value(booking, "foodMain") || "按家長指示"]);
          if (feedCount > 1) rows.push(["主糧 · 第 2 次", value(booking, "foodMain") || "按家長指示"]);
          rows.push(["牧草", value(booking, "hay") || "按家長指示"]);
          if (yesNo(booking.vegetables) !== "否") rows.push(["新鮮蔬菜", yesNo(booking.vegetables) === "是" ? "已選提供" : "按家長指示"]);
          rows.push(["零食／保健品", "按家長指示"]);
        }
        if (yesNo(pet.medication) === "是") {
          rows.push(["眼／耳藥水", "按家長指示及用藥資料"]);
          rows.push(["藥膏／外用藥", "按家長指示及用藥資料"]);
          rows.push(["藥物 · 第 1 次", value(pet, "medicationDetails") || "請核對藥名／劑量／時間"]);
          if (medicationTimes > 1) rows.push(["藥物 · 第 2 次", value(pet, "medicationDetails") || "請核對藥名／劑量／時間"]);
        }
        rows.push(["健康／食慾／排便觀察", "記錄異常並即時通知員工"]);
        if (value(pet, "specialCare")) rows.push(["特別照顧", value(pet, "specialCare")]);
        rows.push(["梳毛／日常整理", "按家長指示及照顧需要"]);
        const dailyRows = rows.map(([label, note]) => `<tr><th>${esc(label)}</th>${Array.from({ length: 10 }, (_, day) => {
          const active = startOffset + day < nights;
          return `<td class="check-cell${active ? "" : " outside"}">${active ? "□" : ""}</td>`;
        }).join("")}<td class="note-cell">${esc(note)}</td></tr>`).join("");
        const foodNote = hamster
          ? `倉鼠長擺糧；不設餵食次數／假期提醒。主糧：${value(booking, "foodMain") || "—"}`
          : `主糧：${value(booking, "foodMain") || "—"} · ${feedText || "每日一次"}${feedingTwice ? "；星期日／公眾假期僅餵一次、雙倍份量" : ""} · 牧草：${value(booking, "hay") || "—"}`;
        const healthRows = [
          ["性別", display(pet.sex)],
          ["最近 30 日手術", yesNo(pet.recentSurgery30Days)],
          ["最近看獸醫", value(pet, "vetDetails") ? `${yesNo(pet.vetVisit)} · ${value(pet, "vetDetails")}` : yesNo(pet.vetVisit)],
          ["傳染病／慢性病", `${yesNo(pet.infectiousDisease)}／${yesNo(pet.chronicDisease)}`],
          ["用藥／特別照顧", `${yesNo(pet.medication)}／${value(pet, "specialCare") || "—"}`],
        ];
        if (!hamster) {
          healthRows.splice(1, 0, ["絕育", yesNo(pet.sterilized)]);
          healthRows.push(["一個月內杜蝨", yesNo(pet.fleaTreatment)]);
          if (String(pet.sex || "").toLowerCase() === "female") healthRows.splice(2, 0, ["懷孕", yesNo(pet.pregnant)]);
        }
        carePages.push(`<section class="sheet care-sheet">
          <header class="brand-row"><div class="brand-lockup">${logo}<div class="brand">LittleLand <small>小寵物酒店服務</small></div></div><div class="test-tag">TEST 測試列印</div></header>
          <div class="care-title-row"><h1>每日照顧及餵藥紀錄</h1><span class="cute-tag">${hamster ? "🐹" : booking.species === "GUINEA_PIG" ? "🐽" : "🐰"} 毛孩專屬照顧表</span></div>
          <div class="care-identity"><div><b>家長</b>${esc(value(booking, "parentName", "customerName"))}</div><div><b>電話</b>${esc(booking.phone)}</div><div><b>緊急聯絡人 1</b>${esc(booking.emergency1)}</div><div><b>緊急聯絡人 2</b>${esc(booking.emergency2)}</div><div><b>毛孩</b>${esc(name)} · ${esc(species)}</div><div><b>年齡／品種</b>${esc(`${display(pet.ageValue)} ${display(pet.ageUnit)} · ${value(pet, "breed") || "—"}`)}</div><div><b>訂單編號</b>${esc(reference)}</div><div><b>房型</b>${esc(roomNames[booking.roomTypeId] || display(booking.roomTypeId))}</div><div><b>實體房間（本預約寵物共用）</b>${esc(physicalRoomLabel)}</div></div>
          <section class="care-card diet-card"><h2>🍽 飲食及照顧指示</h2><p>${esc(foodNote)}</p>${!hamster && yesNo(booking.vegetables) === "是" ? `<p>新鮮蔬菜：已選提供</p>` : ""}<p>飲食／日常注意：${esc(value(pet, "specialCare") || "按家長指示")}</p></section>
          <section class="care-card health-card"><h2>🩺 健康與用藥資料（已由預約資料帶入）</h2><div class="health-grid">${infoRows(healthRows)}<div class="info-row"><b>藥物資料</b><span>${esc(yesNo(pet.medication) === "是" ? value(pet, "medicationDetails") || "有申報用藥，請員工入住時覆核" : "未申報需餵藥")}</span></div></div></section>
          <section class="care-card checklist-card"><div class="checklist-heading"><h2>📅 每日照顧打勾表</h2><span>第 ${segment + 1}/${segments} 張 · 每格為一個住宿日</span></div><div class="table-wrap"><table class="care-grid"><thead><tr><th class="task-col">照顧項目</th>${dateCells}<th class="note-col">內容／提示</th></tr></thead><tbody>${dailyRows}</tbody></table></div></section>
          <div class="care-footnote">此表以預約資料預填；餵藥前請核對藥名、劑量、餵藥時間及家長交代。資料不完整時先聯絡家長，不自行推斷用藥方式。${feedingTwice && !hamster ? "星期日／公眾假期主糧按雙倍份量餵一次。" : ""}</div>
          <div class="signature-row"><div>照顧員工核對：______________________</div><div>家長確認：________________　日期：____________</div></div>
          <footer>TEST 測試文件 · 毛孩 ${petIndex + 1}/${pets.length} · 住宿日期 ${esc(formatDate(booking.checkinDate))} 至 ${esc(formatDate(booking.checkoutDate))}</footer>
        </section>`);
      }
    });
    if (!pets.length) carePages.push(`<section class="sheet care-sheet"><header class="brand-row"><div class="brand">LittleLand <small>小寵物酒店服務</small></div><div class="test-tag">TEST 測試列印</div></header><h1>每日照顧及餵藥紀錄</h1><p>此預約尚未載入寵物資料，請勿自行補填。</p></section>`);

    const appendices = [
      ["terms-page-1.png", "入住須知及寄養條款（原稿第 1 頁）"],
      ["terms-page-2.png", "入住須知及寄養條款（原稿第 2 頁）"],
    ].map(([file, alt]) => `<section class="appendix"><img src="${esc(assetBase + file)}" alt="${esc(alt)}"></section>`).join("");
    const title = `LittleLand 入住資料 ${reference || ""}`.trim();
    const autoPrint = opts.autoPrint === false ? "" : "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},350);});</script>";
    return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${styles}</style></head><body>${mainPage}${paymentPage}${carePages.join("")}${appendices}${autoPrint}</body></html>`;
  }

  const styles = `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; color: #292532; font: 9.4pt/1.4 Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
    body { background: #eeeaf2; }
    .sheet { position: relative; width: 210mm; min-height: 297mm; margin: 10px auto; padding: 10mm 13mm 14mm; background: #fff; page-break-after: always; break-after: page; box-shadow: 0 2px 14px #0002; }
    .brand-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7960a8; padding-bottom: 4mm; margin-bottom: 4mm; }
    .brand-lockup { display: flex; align-items: center; gap: 3mm; }
    .logo { width: 13mm; height: 13mm; object-fit: contain; }
    .brand { font-size: 18pt; font-weight: 800; color: #624696; letter-spacing: .04em; }
    .brand small { display: block; color: #6f6877; font-size: 8pt; font-weight: 500; letter-spacing: .1em; }
    .test-tag { border: 1px solid #b33f4b; color: #9d2c3c; border-radius: 3mm; padding: 1.3mm 2.5mm; font-weight: 700; font-size: 8pt; }
    h1 { margin: 0 0 2.5mm; font-size: 17pt; color: #3e3156; }
    h2 { margin: 0 0 2mm; font-size: 10.5pt; color: #60458e; }
    .notice { padding: 2.5mm 3.5mm; margin: 0 0 3mm; background: #fff6dc; border-left: 3px solid #e6ae3a; color: #664b1a; font-size: 8.5pt; }
    .ref-row { display: flex; gap: 4mm; align-items: center; margin: 2mm 0; font-size: 10.5pt; }
    .ref { font-size: 16pt; letter-spacing: .12em; font-weight: 800; color: #6b4caf; }
    .status { margin-left: auto; padding: 1mm 3mm; background: #f0eafa; border-radius: 10mm; font-size: 8pt; }
    .meta-line { color: #706b76; font-size: 8pt; margin-bottom: 3mm; }
    .block { margin: 3mm 0; padding: 2.5mm 3mm; border: 1px solid #ded9e6; border-radius: 2mm; break-inside: avoid; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; column-gap: 6mm; row-gap: 1mm; }
    .info-row { display: grid; grid-template-columns: 29mm minmax(0,1fr); gap: 1.5mm; border-bottom: 1px dotted #ddd; padding: .9mm 0; overflow-wrap: anywhere; font-size: 8.5pt; }
    .info-row b { color: #5b5362; }
    .fees, .payments { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .fees th, .fees td, .payments th, .payments td { padding: 1.2mm 1.5mm; border-bottom: 1px solid #e4e1e8; text-align: left; vertical-align: top; }
    .fees th, .payments th { background: #f3eff9; color: #46365f; }
    .fees th:last-child, .payments th:last-child { white-space: nowrap; }
    .numeric { text-align: right !important; white-space: nowrap; }
    .totals { margin-top: 2mm; border-top: 1px solid #cfc8da; padding-top: 1.5mm; }
    .totals > div { display: flex; justify-content: space-between; gap: 5mm; padding: .9mm 0; font-size: 8.4pt; }
    .totals .grand { font-size: 11pt; font-weight: 800; border-top: 1px solid #b9a9d3; margin-top: 1mm; padding-top: 1.5mm; color: #5c3f92; }
    .totals .cash { background: #eaf4fb; padding: 1.5mm; border-radius: 1.5mm; }
    .small-note, .muted { color: #6d6873; font-size: 7.5pt; }
    .refund-title { font-weight: 700; color: #8f3c3c; margin-bottom: 0; }
    .signature-row { display: flex; justify-content: space-between; gap: 6mm; margin: 5mm 0 2mm; padding-top: 3mm; border-top: 1px solid #aaa; font-size: 8.5pt; }
    .sheet footer { position: absolute; bottom: 4mm; left: 13mm; right: 13mm; color: #776f82; font-size: 7pt; border-top: 1px solid #ddd; padding-top: 1.5mm; }
    .care-sheet { padding: 8mm 9mm 13mm; }
    .care-sheet .brand-row { margin-bottom: 2.5mm; padding-bottom: 2.5mm; }
    .care-title-row { display: flex; align-items: center; justify-content: space-between; gap: 3mm; }
    .care-title-row h1 { font-size: 15pt; }
    .cute-tag { border-radius: 5mm; background: #f8eaf1; color: #764d73; padding: 1.5mm 3mm; font-size: 8pt; white-space: nowrap; }
    .care-identity { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5mm 4mm; background: #faf5fb; border: 1px solid #e7dced; border-radius: 2mm; padding: 2mm 3mm; margin: 2mm 0; font-size: 8pt; }
    .care-identity div { display: flex; gap: 2mm; min-width: 0; overflow-wrap: anywhere; }
    .care-identity b { color: #71528c; white-space: nowrap; }
    .care-card { border: 1px solid #e3dce9; border-radius: 2mm; padding: 2mm 3mm; margin: 2mm 0; break-inside: avoid; }
    .diet-card { background: #fff8ef; border-color: #f0ddc4; }
    .health-card { background: #f7f8ff; border-color: #dadcf0; }
    .care-card p { margin: 1mm 0; font-size: 8pt; }
    .health-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 5mm; }
    .health-grid .info-row { grid-template-columns: 31mm minmax(0,1fr); font-size: 7.6pt; }
    .checklist-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; }
    .checklist-heading span { font-size: 7.3pt; color: #766b7d; }
    .table-wrap { width: 100%; }
    .care-grid { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 6.3pt; }
    .care-grid th, .care-grid td { border: 1px solid #bdb4c8; padding: .8mm .5mm; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    .care-grid thead th { background: #eee9f7; color: #51415f; height: 11mm; }
    .care-grid thead th span, .care-grid thead th b { display: block; font-weight: 700; }
    .care-grid thead th b { color: #5a4779; margin-top: .5mm; }
    .care-grid .task-col { width: 35mm; }
    .care-grid .note-col { width: 25mm; }
    .care-grid tbody th { text-align: left; background: #fff1e9; color: #4d4452; font-size: 6.5pt; font-weight: 700; }
    .care-grid tbody th small { display: block; color: #7d7180; font-weight: 400; }
    .care-grid .check-cell { height: 7.2mm; font-size: 10pt; color: #69528a; }
    .care-grid .note-cell { text-align: left; font-size: 6pt; color: #6b6470; }
    .care-grid .outside { background: #f5f3f6; color: #aaa; }
    .care-footnote { margin: 2mm 0; padding: 1.5mm 2mm; background: #fff4d7; border-radius: 1.5mm; font-size: 7pt; color: #665329; }
    .care-sheet .signature-row { margin: 2mm 0 0; padding-top: 2mm; font-size: 7.5pt; }
    .appendix { width: 210mm; height: 297mm; margin: 10px auto; background: #fff; page-break-after: always; break-after: page; }
    .appendix img { display: block; width: 210mm; height: 297mm; object-fit: contain; }
    .appendix:last-child { page-break-after: auto; break-after: auto; }
    @media print { html, body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .appendix { margin: 0; } }
    @media screen and (max-width: 760px) {
      body { padding: 0; }
      .sheet, .appendix { width: 100%; min-height: 0; height: auto; margin: 0 0 10px; padding: 16px; }
      .appendix { padding: 0; aspect-ratio: 210/297; }
      .appendix img { width: 100%; height: 100%; }
      .sheet footer { position: static; margin-top: 20px; }
      .two-col, .health-grid { grid-template-columns: 1fr; }
      .care-identity { grid-template-columns: 1fr 1fr; }
      .care-grid { font-size: 5.8pt; }
      .care-grid .task-col { width: 26mm; }
      .care-grid .note-col { width: 20mm; }
      .care-grid .check-cell { font-size: 8pt; }
      .ref-row { flex-wrap: wrap; }
      .status { margin-left: 0; }
    }
  `;

  const api = Object.freeze({ render });
  root.LittleLandBookingPrint = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
