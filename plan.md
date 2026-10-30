# TASK-002 — Pricing Engine

## 目標與範圍

在 `feature/pricing-engine` 實作一個純 JavaScript、無副作用的 LittleLand Pricing Engine，依 LittleLand V3.0 已確認規則，把住宿日期、物種／房型、數量及所選服務轉成完整費用分解。模組可在瀏覽器和 Node.js 使用，供後續 TASK-003／TASK-008 接用；本次不將它接入 Booking UI，不呼叫 API、不建立 Apps Script/Sheets、不實作前端驗證、付款、房態或後台，不部署、不合併。

## 實作決定

- 新增 `booking/pricing.js`，以 UMD/全域命名空間方式同時支援瀏覽器與 CommonJS；不引入依賴。匯出唯讀房型目錄、`calculatePricing(input)` 及明確的 `PricingError`。
- 輸入使用 ISO `YYYY-MM-DD` 日期、`species`、`roomId`、`quantity` 及服務選項；計價模組自行根據可信的內建房型目錄決定單價及上限，不接受呼叫方傳入價格。
- 日期使用 UTC 日界線計算晚數和星期幾，避免時區/DST 導致跨日誤差。拒絕不存在的日期、退房不晚於入住、未知物種/房型、非正整數數量、超過該物種房型上限及無效/重複服務選項，並回傳可機器判斷的錯誤碼；本模組不判斷日期是否早於今日（屬日期/預約驗證，不是計價公式）。
- 回傳包含房型/數量/晚數、基本房費、額外寵物費、週末短住費、逐項服務費、附加費總額、住宿總額、基本房費 50% 訂金、入住當日尾數及不計入住宿價款的現金按金。
- 使用 Node.js 內建 `node:test`／`assert` 建立無第三方依賴測試。保留 TASK-001 的 UI 原狀；此 task 只新增獨立引擎、測試及專案任務紀錄。

## 專案結構

- `booking/pricing.js`：房型與上限目錄、輸入驗證、純計價函式及可辨識錯誤。
- `tests/pricing.test.js`：定價矩陣、指定公式樣本、週末邊界、服務、按金隔離及無效輸入回歸測試。
- `TODO.md`：保留已完成 TASK-001，新增本 TASK 的完整接受條件及進度。

## 設計／品牌

本任務不改變視覺介面，保持現有 LittleLand 品牌設計不變；計價引擎與 UI 解耦，避免核心計價邏輯綁定於 hosting 或前端顯示文案。
