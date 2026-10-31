# LittleLand V3.0 — TEST Google Sheets 資料結構

**Schema 版本：** 1.0（2026-10-30）
**環境：** 僅限 `LittleLand_TEST`；不連接或複製正式 LittleLand 資料。
**工作表：** `Bookings`、`Pets`、`Payments`、`Rooms`、`Logs`、`IdempotencyKeys`、`Staff`、`Sessions`。

## 安全及共通規則

每張表第一列為下列順序的 `camelCase` 欄名；一列代表一筆該類記錄。使用穩定業務 ID 作為主鍵，不以 Google Sheets row number 作 ID。日期使用 `YYYY-MM-DD`，時間戳使用 ISO 8601 並明確保留時區，金額儲存為 HKD 數值，布林欄儲存 `TRUE`／`FALSE`。JSON 欄位以合法 JSON 字串存放。此句所指只有表頭的狀態是 2026-10-30 初始建立時；後續經明確授權的 TEST E2E 已加入合成 Bookings／Pets／Logs／IdempotencyKeys 資料。除這些標示為 TEST 的記錄外，不放任何正式客人資料；Production 不連接。

訂單 ID 格式為 `TEST-LL-...`，不可使用 row number。前端報價只供預覽；TEST Create Booking API 會重新計價，並保存價格／政策／房規 snapshot，避免改價影響舊訂單。`pricing.js` 是目前已驗收的規則參照；本試算表不另建會與後端計價規則衝突的房價或容量來源。

## `Bookings` — 一筆訂單一列

**主鍵：** `bookingId`。**關聯：** `Pets.bookingId`、`Payments.bookingId`、`Logs.entityId`、`IdempotencyKeys.bookingId`。

```text
bookingId, createdAt, updatedAt, recordVersion, bookingStatus,
checkinDate, checkinTime, earlyCheckin, checkoutDate, checkoutTime, lateCheckout, nights,
species, roomTypeId, quantity, allocatedRoomIdsJson,
parentName, phone, email, emergency1, emergency2, vet,
foodMain, hay, feeding, vegetables,
groomingOnce, groomingDaily, medicine, serviceItemsJson,
roomPrice, priceVersion, policyVersion, roomRuleVersion,
baseRoomFee, extraPetFee, weekendFee, serviceFees, totalSurcharges, estimatedTotal, depositAmount, remainingBalance, cashDepositAmount,
depositStatus, balanceStatus, cashDepositStatus,
cashDepositCollected, cashDepositCollectedAt, cashDepositUsedAmount, cashDepositRefundedAmount, cashDepositRefundedAt, cashDepositNote,
consentCashDeposit, consentDepositAndBalance, consentDepositNonRefundable, consentBoardingTerms, consentHealthDeclaration, consentEmergencyVet, consentedAt,
followUpRequired, lastContactedAt, lastContactedBy, followUpNote
```

日期、時段、房型、物種、數量、家長及緊急聯絡欄位對應已接受前台的表單；`emergency1`／`emergency2` 儲存前台現有的兩位緊急聯絡人值，`vet` 儲存選填獸醫／診所。飲食資料在目前 UI 是訂單層欄位，故存於本表；倉鼠長擺糧，`feeding` 留空，不套用兔／天竺鼠每日次數或星期日／假期次數提醒。`serviceItemsJson` 保存逐項服務名稱與當時金額，其他服務旗標保存當時選擇。

六個同意欄分別對應：HK$1,000／隻現金備用金／按金、基本房費 50% 訂金及附加費於尾數收取、訂金不退款、入住須知／寄養條款、健康申報屬實、緊急獸醫安排及相關費用；`consentedAt` 記錄同意時間。`recordVersion` 供未來更新衝突偵測，不改變訂單商業狀態。`allocatedRoomIdsJson` 在 schema 初始化時留空，不做房間分配；`PENDING_CONFIRMATION` 及 `PENDING_DEPOSIT` 預約亦必須保存空陣列 `[]`，不暫留實體房。

`bookingStatus` 僅使用 V3.0 狀態：`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CONFIRMED`、`CHECKED_IN`、`CHECKED_OUT`、`COMPLETED`、`CANCELLED`。只有 `CONFIRMED`、`CHECKED_IN` 佔房；`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 均不佔房。客人提交為 `PENDING_CONFIRMATION`，員工確認申請後可轉 `PENDING_DEPOSIT`，收到訂金並準備確認時須在鎖內重新檢查最新房態；只有成功分配合法實體房後才可轉 `CONFIRMED` 並開始佔房。若其他申請先確認導致無房，不自動取消其他待付訂金預約，留待員工人工聯絡。`PENDING_DEPOSIT` 無固定付款期限，不自動倒數、取消或釋放房間。員工 follow-up 欄位只作人工提醒，不自動改變 Booking Status，且不得顯示於客人前台。

付款狀態與 `bookingStatus` 分開：`depositStatus` 為 `UNPAID`／`PAID`／`REFUNDED`；`balanceStatus` 為 `UNPAID`／`PAID`；`cashDepositStatus` 為 `NOT_COLLECTED`／`COLLECTED`／`PARTIALLY_USED`／`REFUNDED`。

金額欄位是訂單建立時保存的計價 snapshot：`baseRoomFee`、`extraPetFee`、`weekendFee`、`serviceFees`、`totalSurcharges`、`estimatedTotal`、`depositAmount`、`remainingBalance`。訂金固定為 `baseRoomFee * 0.5`，不可用 `estimatedTotal * 0.5`；`cashDepositAmount = quantity * HK$1,000`，絕不可併入住宿總額、訂金或尾數。`cashDepositCollected` 是是否已收取的布林欄；收取時間、已使用額、退款額／時間及備註分欄保存。提早入住、延遲退房、梳毛、餵藥等費用須以 `serviceItemsJson`／`serviceFees` 保存，並由未來後端依 V3.0 重算。

## `Pets` — 每隻毛孩一列

**主鍵：** `petId`。**外鍵：** `bookingId`。

```text
petId, bookingId, petNumber, name, breed, ageValue, ageUnit, ageInMonths, sex, sterilized, pregnant, recentSurgery30Days, vetVisit, vetDetails, infectiousDisease, infectiousDetails, chronicDisease, chronicDetails, medication, medicationDetails, specialCare, fleaTreatment, healthReviewStatus, createdAt, updatedAt
```

一張訂單按寵物數量建立相同數量的 Pet 記錄。年齡保留使用者輸入數值與月／歲單位，另保存換算後 `ageInMonths`。沿用目前已接受的前台修訂：兔子最低 3 個月、天竺鼠最低 3 個月、倉鼠最低 2 個月；最近手術欄位表示最近 30 日。兔／天竺鼠的健康欄位依前台顯示，倉鼠不適用的絕育、懷孕及杜蝨欄位留空。需人工覆核時 `healthReviewStatus` 儲存 `HEALTH_REVIEW_REQUIRED`，不需要覆核時留空；不得自動批准入住。

## `Payments` — 付款／退款紀錄

**主鍵：** `paymentId`。**外鍵：** `bookingId`。

```text
paymentId, bookingId, paymentType, amount, currency, paymentStatus, paymentMethod, transactionReference, paidAt, recordedByStaffId, refundAmount, refundedAt, note, createdAt
```

`paymentType` 用來區分既定的訂金、尾數、現金按金紀錄；`paymentStatus` 須與相應類型的 V3.0 狀態一致。`currency` 使用 `HKD`。付款方式、支付服務、交易種類細節及額外狀態若原規格未定義，保留欄位但不自行建立政策。本次不建立付款列、不連接支付服務、不收取或退還款項。

## `Rooms` — 實體房及虛擬房型主檔

**主鍵：** `roomId`。房價及物種別入住上限以 V3.0／Pricing Engine 規則為準，不在本表複製。

```text
roomId, roomTypeId, displayName, roomKind, compositionOptionsJson, allocationPriority, isActive
```

初始化器只補入以下固定主檔。`roomKind` 為 `PHYSICAL` 或 `VIRTUAL`；虛擬房不得算作新增實體房。

| roomId | roomTypeId | displayName | roomKind | compositionOptionsJson | allocationPriority |
|---|---|---|---|---|---:|
| S1 | PRIVATE_SUITE | 獨立套房空間 | PHYSICAL | `[]` | 1 |
| S2 | PRIVATE_SUITE | 獨立套房空間 | PHYSICAL | `[]` | 2 |
| S3 | PRIVATE_SUITE | 獨立套房空間 | PHYSICAL | `[]` | 3 |
| A1 | DELUXE_ROOM | 豪華房 | PHYSICAL | `[]` | 1 |
| A2 | DELUXE_ROOM | 豪華房 | PHYSICAL | `[]` | 2 |
| A3 | DELUXE_ROOM | 豪華房 | PHYSICAL | `[]` | 3 |
| B1 | STANDARD_ROOM | 標準房 | PHYSICAL | `[]` | 1 |
| B2 | STANDARD_ROOM | 標準房 | PHYSICAL | `[]` | 2 |
| C1 | HAMSTER_BOX | 整理箱 | PHYSICAL | `[]` | 1 |
| F1 | OWN_CAGE | 自備籠 | PHYSICAL | `[]` | 1 |
| SS1 | DELUXE_SUITE | 豪華套房 | VIRTUAL | `[["S1","S2"],["S2","S3"]]` | 1 |
| SSR1 | VERY_DELUXE_SUITE | 非常.豪華套房 | VIRTUAL | `[["S1","S2","S3"]]` | 1 |

分配優先次序：獨立套房 S1→S2→S3；豪華套房 S1+S2→S2+S3（禁止 S1+S3）；豪華房 A1→A2→A3；標準房 B1→B2；整理箱 C1；自備籠 F1。SS1／SSR1 僅是虛擬房 ID，不是額外房間。

## `Logs` — 操作紀錄

**主鍵：** `logId`。

```text
logId, createdAt, actorType, actorStaffId, action, entityType, entityId, requestId, summary, changedFieldsJson
```

記錄未來的重要操作與精簡變更摘要。不得存明文密碼、原始 Session token，或不必要的完整個人資料；保留期尚未由規格定義，本次不設定。

## `IdempotencyKeys` — 防重複提交

**主鍵：** `idempotencyKey`。

```text
idempotencyKey, operation, payloadHash, state, bookingId, requestId, responseCode, responseSnapshotJson, createdAt, updatedAt
```

相同 key 重送不得建立第二張訂單。TEST Create Booking API 的 `state` 是技術狀態 `PROCESSING`／`COMPLETED`／`FAILED`，不與 Booking Status 混用；不設定自動 TTL 或刪除。完成請求重播精簡 response snapshot；可安全重試的 `FAILED` 請求須確認尚未開始 Booking／Pets／Logs 寫入，才可重用同一 key；任何部分寫入不確定性保持 `PROCESSING` 並交由人工 reconciliation。Unit tests 使用 mock；使用者另行授權的 TEST E2E／壓力驗收可建立合成 key／booking，Production 永不使用。

## `Staff` — 員工資料結構

**主鍵：** `staffId`。

```text
staffId, username, displayName, role, passwordHash, passwordSalt, isActive, createdAt, updatedAt, lastLoginAt
```

角色僅用 `VIEWER`、`STAFF`、`ADMIN`。本次不建立員工帳號、不存明文密碼。密碼 hash 演算法由後續登入實作階段另行依安全規格決定。

## `Sessions` — 員工登入 Session 資料結構

**主鍵：** `sessionId`。**外鍵：** `staffId`。

```text
sessionId, staffId, tokenHash, roleSnapshot, createdAt, expiresAt, revokedAt, lastSeenAt
```

只保存 hash 後的 token，不保存原始 token；本次不建立 Session。V3.0 未定義的 Session 時限及資料保留期不在本次自行決定或啟用。

## 手動初始化方式

1. 複製 `LittleLand_TEST` 試算表 ID（不是網址中的其他參數），在將來的 Apps Script 專案 Script Properties 設定 `LITTLELAND_TEST_SPREADSHEET_ID`。
2. 將 `apps-script/InitializeTestSheets.gs` 加入該 TEST 專案，確認 Script Property 仍指向 `LittleLand_TEST`。
3. 手動執行 `initializeLittleLandTestSheets()`。初始化器會同時檢查 Script Property ID、目標 ID 及試算表名稱；任何一項缺失／不符即停止。
4. 初始化器只建立缺少的八個工作表、補上空白表頭及按 `roomId` 冪等補入 12 筆固定 Rooms 主檔。遇到額外分頁、不符表頭、重複／未知房間 ID 或內容不一致便停止，不清空、不覆寫、不刪除既有資料。

本次的實際 TEST Spreadsheet 以 Google Workspace Sheets API 建立及初始化；Apps Script source 僅為後續手動重複初始化方法，不部署 API、不建立 Staff Login、不連接正式資料。
