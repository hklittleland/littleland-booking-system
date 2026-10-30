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


# TASK-004 — Google Sheets TEST Schema + Initialization（已核准・已完成）

## 範圍與安全界線

本次只規劃及交付 V3.0 所指定的 TEST Google Spreadsheet 資料結構、schema 文件、可重複且非破壞式的初始化腳本，以及一份新的 `LittleLand_TEST` 試算表。沿用原始規格的八個工作表名稱：`Bookings`、`Pets`、`Payments`、`Rooms`、`Logs`、`IdempotencyKeys`、`Staff`、`Sessions`。不得讀取、匯入、連接、複製或修改任何正式 LittleLand 客人資料或正式試算表；不得建立真實預約、付款、員工帳號或登入 Session。

不執行 TASK-003 Frontend Validation（使用者已明確跳過）；不實作 TASK-005 Inventory Engine、TASK-006 Availability API、TASK-007 Create Booking API、Staff Login/Auth API、付款系統、部署或 Production。前台及 `booking/pricing.js` 維持原狀。

## 資料模型

每張表第一列為固定 camelCase 欄名；每一筆記錄一列，以獨立業務 ID 為主鍵，不以 Google Sheet row number 當 ID。`Bookings` 保存一張訂單一列及日期／時段、物種／Room Type ID／數量、聯絡欄位、目前前台的訂單層飲食選項、服務選項、六項同意、房費和各費用 snapshot、價格／政策／房規版本、預約狀態、付款狀態、現金按金紀錄及員工 follow-up 欄位。保留 V3.0 的訂單狀態、三種付款狀態、費用公式、訂金僅按基本房費 50% 計算、現金按金 `qty * 1000` 且不併入住宿金額等既定規則。

`Pets` 每隻毛孩一列，以 `petId` 關聯 `bookingId`，保存已接受前台欄位：名稱、品種、年齡數值／月或歲／換算月齡、性別、絕育、懷孕、最近 30 日手術、獸醫／傳染病／慢性病／服藥詳情、特殊照顧、杜蝨及 `healthReviewStatus`；需要人工覆核時存入既定值 `HEALTH_REVIEW_REQUIRED`。倉鼠不適用欄位留空；不把需人工覆核轉成自動批准入住。

`Payments` 作付款／退款紀錄明細並關聯 `bookingId`，保留付款種類、金額、狀態、方法、交易參考、付款／退款時間及員工記錄者；不連支付服務也不預填付款資料。`Rooms` 保存 V3.0 實體房及虛擬組合主檔：10 個實體房（S1–S3、A1–A3、B1–B2、C1、F1）及虛擬房 SS1／SSR1，明確以 `roomKind` 區分 PHYSICAL/VIRTUAL，使用組合選項記錄 SS1 僅可 S1+S2 或 S2+S3、SSR1 固定 S1+S2+S3；SS1/SSR1 不可計作額外實體房。房價及物種別入住上限仍以已驗收的 `pricing.js`／V3.0 規則為準，不在 Rooms 內建立衝突的容量或價格來源。

`Logs` 保存事件時間、操作者類型／員工 ID、操作、對象、request ID 及精簡變更摘要；不記錄密碼、原始 Session token 或不必要的完整個人資料。`IdempotencyKeys` 保存唯一 key、操作範圍、payload hash、處理狀態、結果 Booking ID 及可重用回應資料；規格未訂保留期限，本次不設定自動 TTL。`Staff` 只建立欄位，不初始化任何員工；保存 username、角色、active 狀態及密碼 hash／salt 欄位，絕不存明文密碼。`Sessions` 只建立欄位，不產生 Session；只保存 token hash，不保存原始 token。密碼 hash 算法、Session 期限、資料保留期及付款方法政策未由規格定義，本次不自行決定或啟用。

## 初始化方式與實際交付

建立 `docs/SHEETS-SCHEMA.md`，逐表列出欄名、資料用途、主鍵／關聯、允許的既定狀態值、敏感資料注意事項及 TEST 初始化範圍。建立 `apps-script/InitializeTestSheets.gs`，提供手動 `initializeLittleLandTestSheets()`：Apps Script Script Property `LITTLELAND_TEST_SPREADSHEET_ID` 必須已設定，且與傳入／目標 spreadsheet ID 完全相同；試算表名稱必須精確為 `LittleLand_TEST`。只建立缺少的工作表／空白表頭；若有額外分頁、表頭不符、未知／重複房間 ID 或已存在房間資料與 seed 不符則停止並保留原資料，不清空、不覆寫、不刪除；以 `roomId` 冪等補入固定的 10 個實體房及 2 個虛擬房主檔；不建立任何客人、寵物、付款、員工、Session 或 idempotency 測試記錄。腳本只作初始化，不是可部署 API。

已透過 Google Workspace Sheets 工具先搜尋同名 TEST 檔，確認不存在後，在預設 My Drive 建立一份新的 `LittleLand_TEST`，設定 timezone 為 `Asia/Hong_Kong`，未設定共享；回讀確認名稱、正好八個分頁、八張表頭及 12 筆 Rooms seed。`Staff`、`Sessions` 及其他含個人資料的表保持只有表頭，沒有測試客資。Apps Script initializer 為 source-only，尚未部署或執行；未連接正式試算表，未讀取或修改正式資料。

## 專案結構、依賴與版本控制

- `docs/SHEETS-SCHEMA.md`：八表資料字典與 TEST 安全界線。
- `apps-script/InitializeTestSheets.gs`：有名稱與既有表頭保護的手動 TEST 初始化器；不部署、不提供 API。
- `booking/pricing.js`：現有價格目錄的唯讀參照；不複製為第二個權威價格來源。
- `TODO.md`：計畫獲核准後才更新 TASK-004 的完整驗收條件及狀態；保留 TASK-001、TASK-002 已完成紀錄。
- 外部 Google Sheets：新建且僅限 TEST 的 `LittleLand_TEST`，八個工作表。

以新 feature branch `feature/test-sheets-schema` 開發，只同步到正式 GitHub repository `hklittleland/littleland-booking-system`；不合併 `develop` 或 `main`，不部署網站。完成文件／初始化器及 TEST spreadsheet 後執行可用的檢查、讀回八表與表頭、比對 Rooms seed，再停止回報，等待使用者驗收後才進行下一個 Task。

## 視覺／品牌

本 Task 不改前台介面；既有 LittleLand 柔和風格維持不變。Google Sheets 使用清晰可讀的純資料表結構，不增加與資料操作無關的裝飾或客戶端功能。


### TEST 初始化器安全加固

在 Apps Script Script Properties 設定 `LITTLELAND_TEST_SPREADSHEET_ID` 作為唯一允許的 TEST spreadsheet ID；`initializeLittleLandTestSheets(spreadsheetId)` 須同時驗證傳入／設定 ID 相同且名稱精確為 `LittleLand_TEST`。未設定、ID 不一致或名稱不符一律停止；不得提供預設 Production ID 或自動尋找正式試算表。
