(function (root) {
  "use strict";

  function text(value) {
    return value == null ? "" : String(value);
  }

  function esc(value) {
    return text(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function firstValue(object, keys) {
    object = object || {};
    for (var index = 0; index < keys.length; index += 1) {
      var value = object[keys[index]];
      if (value != null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function normalizedStatus(booking) {
    return text(firstValue(booking, ["bookingStatus", "status"])).trim().toUpperCase();
  }

  function dateText(value, placeholder) {
    var result = text(value).trim();
    return result ? result.slice(0, 10) : "{" + placeholder + "}";
  }

  function hkToday() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== "literal") values[part.type] = part.value; });
    return values.year + "-" + values.month + "-" + values.day;
  }

  function dateInteger(value) {
    var match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return NaN;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function daysUntil(date, today) {
    var target = dateInteger(date);
    var current = dateInteger(today);
    return Number.isFinite(target) && Number.isFinite(current) ? Math.round((target - current) / 86400000) : NaN;
  }

  function nights(booking) {
    var count = Number(firstValue(booking, ["nights", "stayNights"]));
    if (Number.isInteger(count) && count > 0) return String(count);
    var arrival = dateInteger(booking && booking.checkinDate);
    var departure = dateInteger(booking && booking.checkoutDate);
    if (Number.isFinite(arrival) && Number.isFinite(departure) && departure > arrival) {
      return String(Math.round((departure - arrival) / 86400000));
    }
    return "{晚數}";
  }

  function speciesIcon(species) {
    var normalized = text(species).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (normalized === "rabbit" || normalized === "bunny" || normalized === "兔子" || normalized === "兔") return "🐰";
    if (normalized === "guinea_pig" || normalized === "guineapig" || normalized === "guinea pig" || normalized === "天竺鼠") return "🐽";
    if (normalized === "hamster" || normalized === "倉鼠") return "🐹";
    return "🐾";
  }

  function roomName(booking, roomNames) {
    var value = firstValue(booking, ["roomTypeName", "roomName"]);
    if (value) return text(value);
    var id = text(firstValue(booking, ["roomTypeId", "roomType"]));
    return (roomNames && roomNames[id]) || (id && !/^[A-Z0-9_]+$/.test(id) ? id : "{房型}");
  }

  function petNames(pets) {
    var names = (Array.isArray(pets) ? pets : []).map(function (pet) {
      return text(firstValue(pet, ["name", "petName"])).trim();
    }).filter(Boolean);
    return names.length ? names.join("、") : "{寵物名}";
  }

  function depositIsPaid(booking, payments) {
    var status = normalizedStatus(booking);
    if (["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED"].indexOf(status) >= 0) return true;
    var depositStatus = text(firstValue(booking, ["depositStatus", "depositPaymentStatus"])).toUpperCase();
    if (["PAID", "RECEIVED", "COLLECTED", "CONFIRMED"].indexOf(depositStatus) >= 0) return true;
    return (Array.isArray(payments) ? payments : []).some(function (payment) {
      var kind = text(firstValue(payment, ["paymentType", "type"])).toUpperCase();
      var state = text(firstValue(payment, ["paymentStatus", "status"])).toUpperCase();
      return (kind === "DEPOSIT" || kind === "DEPOSIT_PAYMENT") && ["PAID", "RECEIVED", "COLLECTED", "CONFIRMED"].indexOf(state) >= 0;
    });
  }

  function roomIsAssigned(options) {
    var rooms = Array.isArray(options.allocatedRooms) ? options.allocatedRooms : [];
    return rooms.length > 0 && options.roomConflict !== true;
  }

  function phoneForWhatsApp(booking) {
    var digits = text(firstValue(booking, ["phone", "customerPhone"])).replace(/\D/g, "");
    if (digits.indexOf("852") === 0 && digits.length === 11) return digits;
    if (digits.length === 8) return "852" + digits;
    return "";
  }

  function paidEarlyCheckoutRefund(payments, adjustments) {
    var candidates = [];
    (Array.isArray(payments) ? payments : []).forEach(function (payment) {
      var kind = text(firstValue(payment, ["paymentType", "type"])).toUpperCase();
      var reason = text(firstValue(payment, ["note", "reason", "description"]));
      var state = text(firstValue(payment, ["paymentStatus", "status"])).toUpperCase();
      if ((kind === "REFUND" || kind === "REFUND_PAYMENT") && /提早退房|提前退房|早退/.test(reason) && ["PAID", "RECORDED", "COMPLETED"].indexOf(state) >= 0) {
        candidates.push(Math.abs(Number(payment.amount || 0)));
      }
    });
    if (!candidates.length) {
      (Array.isArray(adjustments) ? adjustments : []).forEach(function (adjustment) {
        var kind = text(firstValue(adjustment, ["adjustmentType", "type"])).toUpperCase();
        var reason = text(firstValue(adjustment, ["reason", "description"]));
        var state = text(firstValue(adjustment, ["status"])).toUpperCase();
        if ((kind === "REFUND" || kind === "REFUND_PAYMENT") && /提早退房|提前退房|早退/.test(reason) && ["REVERSED", "VOID", "CANCELLED"].indexOf(state) < 0) {
          candidates.push(Math.abs(Number(adjustment.amount || 0)));
        }
      });
    }
    if (!candidates.length) return "";
    return candidates.reduce(function (sum, amount) { return sum + amount; }, 0).toLocaleString("en-HK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function substitute(template, values) {
    var result = template;
    Object.keys(values).forEach(function (key) {
      var value = values[key];
      if (value !== "" && value != null) result = result.split("{" + key + "}").join(String(value));
    });
    return result;
  }

  function moneyValue(value, placeholder) {
    if (value == null || String(value).trim() === "") return "{" + placeholder + "}";
    var number = Number(value);
    if (!Number.isFinite(number)) return "{" + placeholder + "}";
    return number.toLocaleString("en-HK", { minimumFractionDigits: Number.isInteger(number) ? 0 : 2, maximumFractionDigits: 2 });
  }

  function isHttpsUrl(value) {
    try {
      var parsed = new URL(text(value).trim());
      return parsed.protocol === "https:" && Boolean(parsed.hostname);
    } catch (_) {
      return false;
    }
  }

  function whatsAppUrl(phone, draft) {
    return "https://wa.me/" + text(phone) + "?text=" + encodeURIComponent(text(draft));
  }

  function makeTemplates() {
    return [
      {
        id: "deposit-arrangement",
        title: "確認付款訊息",
        body: [
          "感謝您的預訂 ~ ",
          "👩🏻‍💻已確定資料如下:",
          "🐰{寵物名}🛏️ {房型}(共{晚數}晚)",
          "入住日期 *{入住日期}*  `_Check-In時間 🕰️{入住時間}_`  ",
          "退房日期 *{退房日期}*  `_Check-Out時間 🕰️{退房時間}_`  ",
          "> 請按時出席，並預留約15-30分鐘時間辦理相關手續。",
          "",
          "🛋️入住流程🌟",
          "▶️我們將為小動物進行簡單身體檢查，確保身體狀況適合寄養。如有異常情況。本公司擁有絕對酌情權，決定接受或拒絕任何動物入住。",
          "▶️家長需簽署【入住須知及寄養條款】及填寫【健康申報表】。",
          "▶️入住時需 *繳清房費尾數* 及 *所有額外收費*。",
          "▶️⭕ *提交 _現金HK$1,000_ 作備用金/按金*⭕",
          "",
          "❤️ *入住前準備* 🧡",
          "1️⃣請提供小動物清晰正面相，以作房卡之用。",
          "2️⃣請於入住前提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。",
          "3️⃣請保留小動物2-3天的💩💩，於入住時提供職員參考以辨健康狀況。",
          "-------------------------------------------------------------------------------------------------------------🖊️",
          "📋現附上【入住須知及寄養條款】以供參考 。",
          "💰費用詳情：",
          "基本房費：HK${基本房費}",
          "附加費合計：HK${附加費合計}",
          "預計住宿總額：HK${住宿總額}",
          "現需支付訂金（基本房費 50%）：HK${訂金}",
          "入住時需繳付尾數：HK${尾數}（入住時需付清尾數及所有額外收費）",
          "現金備用金／按金：HK${現金備用金}（入住當日另備，不計入住宿總額）",
          "⚠️訂金不設退回／退款。",
          "💳 _*請透過此連結繳付50%住宿費訂金，作保留房間之用。*_",
          "{付款連結}",
          "請完成付款後於網站/WHATSAPP回傳付款憑證，Thanks ~",
        ].join("\n"),
      },
      {
        id: "checkin-reminder",
        title: "入住前提醒",
        body: [
          "🏡入住提示    | {寵物圖示}{寵物名}📆  仲有2日就要入住酒店拉~🥰",
          "日期:{入住日期}",
          "入住時間:{入住時間} ",
          "***預留 _15-30分鐘_ 時間辦理入住手續及帶備按金 💵1000現金(*每位小動物)_***",
          "🐾地址:觀塘｜成業街19-21號成業工業大廈13樓16室",
          "",
          "💡小提示",
          "1.可帶同小動物平日使用的小毛巾/屋仔，增加安全感💕",
          "2. 請保留小動物2-3天的💩💩",
          "---------------------------------------------------------------------------------------------------",
          "*請於今日/明天提供滴蝨証明，如相片(需顯示滴蝨日期)、醫療記錄等。*",
          "*＊如將自行準備用品，請再告知物品內容（如水樽、廁所等）**",
        ].join("\n"),
      },
      {
        id: "deposit-received",
        title: "訂金已收確認",
        body: [
          "✅ 訂金已收到，謝謝！",
          "房間已為您保留。",
          "入住日期：{入住日期}",
          "如有任何問題，歡迎聯絡我們～",
        ].join("\n"),
      },
      {
        id: "booking-cancelled",
        title: "取消確認",
        body: [
          "已為您取消預訂。",
          "如已支付訂金，將按條款處理退款。",
          "如有疑問，歡迎聯絡我們～",
        ].join("\n"),
      },
      {
        id: "early-checkout",
        title: "提早退房確認",
        body: [
          "已為您安排提早退房。",
          "原退房日期：{原退房日期}",
          "新退房日期：{新退房日期}",
          "退款金額：HK${退款金額}",
          "如有疑問，歡迎聯絡我們～",
        ].join("\n"),
      },
    ];
  }

  function buildMessages(options) {
    options = options || {};
    var booking = options.booking || {};
    var pets = Array.isArray(options.pets) ? options.pets : [];
    var payments = Array.isArray(options.payments) ? options.payments : [];
    var adjustments = Array.isArray(options.adjustments) ? options.adjustments : [];
    var status = normalizedStatus(booking);
    var depositPaid = depositIsPaid(booking, payments);
    var assigned = roomIsAssigned(options);
    var hasConflict = options.roomConflict === true;
    var checkinDate = dateText(booking.checkinDate, "入住日期");
    var checkoutDate = dateText(booking.checkoutDate, "退房日期");
    var checkinTime = text(firstValue(booking, ["checkinTime", "checkInTime"])) || "{入住時間}";
    var checkoutTime = text(firstValue(booking, ["checkoutTime", "checkOutTime"])) || "{退房時間}";
    var species = firstValue(pets[0], ["species"]) || firstValue(booking, ["species"]);
    var today = options.todayISO || hkToday();
    var daysToCheckin = daysUntil(booking.checkinDate, today);
    var actualCheckout = dateText(booking.actualCheckoutDate, "新退房日期");
    var isEarly = Boolean(booking.actualCheckoutDate && booking.checkoutDate && dateInteger(booking.actualCheckoutDate) < dateInteger(booking.checkoutDate));
    var refundAmount = paidEarlyCheckoutRefund(payments, adjustments);
    var paymentLink = text(firstValue(booking, ["paymentLink", "depositPaymentLink", "paymentUrl"]));
    var totalRaw = firstValue(booking, ["currentTotal", "estimatedTotal"]);
    var baseFeeRaw = firstValue(booking, ["baseRoomFee"]);
    var surchargeRaw = firstValue(booking, ["displaySurcharges", "totalSurcharges"]);
    var depositRaw = firstValue(booking, ["depositAmount"]);
    var balanceRaw = firstValue(booking, ["remainingBalance"]);
    var totalNumber = totalRaw === "" ? NaN : Number(totalRaw);
    var baseFeeNumber = baseFeeRaw === "" ? NaN : Number(baseFeeRaw);
    var depositNumber = depositRaw !== "" ? Number(depositRaw) : Number.isFinite(baseFeeNumber) ? baseFeeNumber * 0.5 : NaN;
    var surchargeNumber = surchargeRaw !== "" ? Number(surchargeRaw)
      : Number.isFinite(totalNumber) && Number.isFinite(baseFeeNumber) ? totalNumber - baseFeeNumber : NaN;
    var balanceNumber = balanceRaw !== "" ? Number(balanceRaw)
      : Number.isFinite(totalNumber) && Number.isFinite(depositNumber) ? totalNumber - depositNumber : NaN;
    var cashRaw = firstValue(booking, ["cashDepositAmount", "cashDeposit"]);
    var quantity = Number(firstValue(booking, ["quantity"]) || pets.length || 0);
    var cashNumber = cashRaw !== "" ? Number(cashRaw) : quantity > 0 ? quantity * 1000 : NaN;
    var values = {
      "寵物名": petNames(pets),
      "寵物圖示": speciesIcon(species),
      "房型": roomName(booking, options.roomNames),
      "晚數": nights(booking),
      "入住日期": checkinDate,
      "退房日期": checkoutDate,
      "原退房日期": checkoutDate,
      "入住時間": checkinTime,
      "退房時間": checkoutTime,
      "新退房日期": actualCheckout,
      "付款連結": paymentLink,
      "基本房費": moneyValue(baseFeeRaw, "基本房費"),
      "附加費合計": moneyValue(surchargeNumber, "附加費合計"),
      "住宿總額": moneyValue(totalNumber, "住宿總額"),
      "訂金": moneyValue(depositNumber, "訂金"),
      "尾數": moneyValue(balanceNumber, "尾數"),
      "現金備用金": moneyValue(cashNumber, "現金備用金"),
      "退款金額": refundAmount,
    };
    var templates = makeTemplates();

    function result(template, eligible, reason, replacements) {
      var body = substitute(template.body, replacements || values);
      return {
        id: template.id,
        title: template.title,
        text: body,
        eligible: Boolean(eligible),
        reason: reason || "",
        missingFields: Array.from(body.matchAll(/\{[^{}\n]+\}/g)).map(function (match) { return match[0]; }),
        phone: phoneForWhatsApp(booking),
        paymentLink: template.id === "deposit-arrangement" ? paymentLink : "",
      };
    }

    var depositReason = status !== "PENDING_DEPOSIT"
      ? "只適用於員工已轉為「待付訂金」的預約。"
      : depositPaid
        ? "系統已記錄訂金，不需再發付款安排訊息。"
        : hasConflict
          ? "此預約有房態衝突，請先處理後再聯絡客人。"
          : "";
    var reminderReason = status !== "CONFIRMED"
      ? "只適用於已收訂金並確認房間的預約。"
      : !depositPaid
        ? "系統尚未記錄已收訂金。"
        : !assigned
          ? "尚未成功分配實體房間。"
          : hasConflict
            ? "此預約有房態衝突，暫不可發送。"
            : daysToCheckin !== 2
              ? "此模板原文固定寫「仲有2日」，只可於入住前剛好 2 日使用。"
              : "";
    var confirmedReason = status !== "CONFIRMED"
      ? "只有預約狀態為「已確認」才可發送。"
      : !depositPaid
        ? "系統尚未記錄已收訂金。"
        : !assigned
          ? "尚未成功分配實體房間。"
          : hasConflict
            ? "此預約有房態衝突，暫不可發送。"
            : "";
    var cancellationReason = status !== "CANCELLED" ? "此訊息只適用於已取消預約。" : "";
    var earlyCheckoutReason = !isEarly || ["CHECKED_OUT", "COMPLETED"].indexOf(status) < 0
      ? "尚未記錄早於原退房日的實際退房。"
      : "";

    var messages = [
      result(templates[0], !depositReason, depositReason),
      result(templates[1], !reminderReason, reminderReason),
      result(templates[2], !confirmedReason, confirmedReason),
      result(templates[3], !cancellationReason, cancellationReason),
      result(templates[4], !earlyCheckoutReason, earlyCheckoutReason),
    ];
    return messages.map(function (message) {
      var paymentLinkReady = message.id !== "deposit-arrangement" || isHttpsUrl(message.paymentLink);
      message.copyable = message.eligible && message.missingFields.length === 0 && paymentLinkReady;
      message.openable = message.copyable && Boolean(message.phone);
      return message;
    });
  }

  function render(options) {
    var messages = buildMessages(options);
    var cards = messages.map(function (message, index) {
      var complete = message.missingFields.length === 0;
      var needsPaymentLink = message.id === "deposit-arrangement";
      var linkReady = !needsPaymentLink || isHttpsUrl(message.paymentLink);
      var initialHelp = !message.eligible
        ? message.reason
        : !linkReady
          ? "請在下方輸入訂金付款連結（HTTPS）；付款連結未填妥前不能複製或開啟 WhatsApp。"
          : !complete
            ? "草稿仍有待填欄位：" + message.missingFields.join("、") + "。填妥並核對後才可複製／開啟。"
            : message.phone
              ? "草稿已填妥；請先核對內容，再手動傳送。"
              : "草稿已填妥；此訂單電話格式未確認，仍可複製草稿。";
      var copyDisabled = !message.copyable;
      var openDisabled = !message.openable;
      var paymentInput = needsPaymentLink
        ? '<label class="whatsapp-payment-link"><span>訂金付款連結（必填，HTTPS）</span><input type="url" inputmode="url" autocomplete="url" data-wa-payment-link aria-label="訂金付款連結" placeholder="https://…" value="' + esc(message.paymentLink) + '"' + (!message.eligible ? " disabled" : "") + '></label>'
        : "";
      var openControl = '<a class="btn" data-wa-open' + (openDisabled ? ' role="button" aria-disabled="true" tabindex="-1"' : ' href="' + esc(whatsAppUrl(message.phone, message.text)) + '" target="_blank" rel="noopener noreferrer" aria-disabled="false"') + '>開啟 WhatsApp</a>';
      return '<article class="whatsapp-template-card" data-wa-card data-wa-eligible="' + (message.eligible ? "true" : "false") +
        '" data-wa-phone="' + esc(message.phone) + '" data-wa-reason="' + esc(message.reason) + '" data-wa-requires-payment-link="' + (needsPaymentLink ? "true" : "false") + '"><header class="whatsapp-template-heading">' +
        '<span class="whatsapp-template-number">' + (index + 1) + '</span><div><h3>' + esc(message.title) + '</h3><p class="whatsapp-template-state ' +
        (message.eligible ? "is-available" : "is-unavailable") + '">' + (message.eligible ? "符合使用條件" : "暫不可使用") + '</p></div></header>' +
        '<p class="whatsapp-template-help" data-wa-help>' + esc(initialHelp) + '</p>' + paymentInput + '<label class="whatsapp-draft-label">訊息草稿（可編輯）</label>' +
        '<textarea rows="12" data-wa-draft aria-label="' + esc(message.title) + ' WhatsApp 草稿" ' + (!message.eligible ? "readonly" : "") + '>' +
        esc(message.text) + '</textarea><div class="whatsapp-template-actions"><button class="btn secondary" type="button" data-wa-copy' +
        (copyDisabled ? " disabled" : "") + '>複製草稿</button>' + openControl + '</div></article>';
    }).join("");
    return '<section class="card whatsapp-message-panel"><header><h2>WhatsApp 訊息草稿</h2><p>固定顯示五款核准模板；按預約狀態標示可用原因。只建立草稿，不會自動傳送。</p></header><div class="whatsapp-template-list">' + cards + '</div></section>';
  }

  async function copyDraft(rootObject, draft) {
    var value = draft.value;
    var clipboardPromise = null;
    try {
      var clipboard = rootObject.navigator && rootObject.navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === "function") clipboardPromise = clipboard.writeText(value);
    } catch (_) {}
    var legacyCopied = false;
    function selectDraft() {
      draft.focus();
      if (typeof draft.select === "function") draft.select();
      if (typeof draft.setSelectionRange === "function") draft.setSelectionRange(0, value.length);
    }
    try {
      selectDraft();
      legacyCopied = Boolean(rootObject.document && rootObject.document.execCommand && rootObject.document.execCommand("copy"));
    } catch (_) {}
    if (legacyCopied) {
      if (clipboardPromise && typeof clipboardPromise.catch === "function") clipboardPromise.catch(function () {});
      return { copied: true, selected: false };
    }
    if (clipboardPromise) {
      try { await clipboardPromise; return { copied: true, selected: false }; } catch (_) {}
    }
    try { selectDraft(); } catch (_) {}
    return { copied: false, selected: true };
  }

  function bind(app, toast) {
    if (!app) return;
    app.querySelectorAll("[data-wa-card]").forEach(function (card) {
      var draft = card.querySelector("[data-wa-draft]");
      var copyButton = card.querySelector("[data-wa-copy]");
      var openButton = card.querySelector("[data-wa-open]");
      var paymentInput = card.querySelector("[data-wa-payment-link]");
      var help = card.querySelector("[data-wa-help]");
      var eligible = card.dataset.waEligible === "true";
      var phone = card.dataset.waPhone || "";
      var requiresPaymentLink = card.dataset.waRequiresPaymentLink === "true";
      var previousPaymentLink = paymentInput ? paymentInput.value.trim() : "";

      function refresh() {
        if (!draft) return;
        var missing = Array.from(draft.value.matchAll(/\{[^{}\n]+\}/g)).map(function (match) { return match[0]; });
        var linkValue = paymentInput ? paymentInput.value.trim() : "";
        var paymentLinkReady = !requiresPaymentLink || (isHttpsUrl(linkValue) && draft.value.indexOf(linkValue) >= 0);
        var complete = eligible && missing.length === 0 && paymentLinkReady;
        if (copyButton) copyButton.disabled = !complete;
        if (openButton) {
          var url = complete && phone ? whatsAppUrl(phone, draft.value) : "";
          if (url) {
            openButton.setAttribute("href", url);
            openButton.setAttribute("target", "_blank");
            openButton.setAttribute("rel", "noopener noreferrer");
            openButton.setAttribute("aria-disabled", "false");
            openButton.setAttribute("tabindex", "0");
          } else {
            openButton.removeAttribute("href");
            openButton.setAttribute("aria-disabled", "true");
            openButton.setAttribute("tabindex", "-1");
          }
        }
        if (!eligible) {
          if (help) help.textContent = card.dataset.waReason || "此預約狀態沒有可用模板。";
        } else if (missing.length) {
          if (help) help.textContent = "草稿仍有待填欄位：" + missing.join("、") + "。填妥並核對後才可複製／開啟。";
        } else if (!paymentLinkReady) {
          if (help) help.textContent = "請輸入有效 HTTPS 訂金付款連結，並保留在草稿中；完成後即可複製或開啟 WhatsApp。";
        } else if (!phone) {
          if (help) help.textContent = "草稿已填妥；此訂單電話格式未確認，仍可複製草稿。";
        } else if (help) {
          help.textContent = "草稿已填妥；請先核對內容，再手動傳送。";
        }
      }

      if (draft && eligible) draft.addEventListener("input", refresh);
      if (paymentInput && eligible && draft) paymentInput.addEventListener("input", function () {
        var nextPaymentLink = paymentInput.value.trim();
        if (previousPaymentLink && draft.value.indexOf(previousPaymentLink) >= 0) {
          draft.value = draft.value.replace(previousPaymentLink, nextPaymentLink || "{付款連結}");
        } else if (draft.value.indexOf("{付款連結}") >= 0) {
          draft.value = draft.value.replace("{付款連結}", nextPaymentLink || "{付款連結}");
        }
        previousPaymentLink = nextPaymentLink;
        refresh();
      });
      if (copyButton) copyButton.addEventListener("click", async function () {
        if (!eligible || !draft || /\{[^{}\n]+\}/.test(draft.value)) return;
        if (requiresPaymentLink && (!paymentInput || !isHttpsUrl(paymentInput.value) || draft.value.indexOf(paymentInput.value.trim()) < 0)) return;
        var result = await copyDraft(root, draft);
        if (result.copied) {
          if (typeof toast === "function") toast("WhatsApp 草稿已複製；請核對後手動傳送。", "success");
        } else {
          if (help) help.textContent = "Safari 未允許自動複製；草稿已選取，請長按文字框並選擇「複製」。";
          if (typeof toast === "function") toast("草稿已選取；請在文字框長按並選擇「複製」。", "error");
        }
      });
      if (openButton) openButton.addEventListener("click", function () {
        if (openButton.getAttribute("aria-disabled") === "true") return;
        if (typeof toast === "function") toast("已開啟 WhatsApp 草稿；請核對後手動傳送。", "success");
      });
      refresh();
    });
  }

  var api = Object.freeze({
    buildMessages: buildMessages,
    render: render,
    bind: bind,
    copyDraft: copyDraft,
    speciesIcon: speciesIcon,
  });
  root.LittleLandWhatsAppMessages = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
