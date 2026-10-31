# LittleLand TASK-009 — TEST Booking 壓力／房態驗收

**日期：** 2026-10-31
**環境：** `LittleLand_TEST` + TEST Apps Script Web App Version 2；未連接 Production
**分支：** `feature/test-booking-api`
**資料：** 只使用虛構測試客人及寵物資料；沒有真實客戶資料或付款。

## 驗收總結

- 經現有 TEST API 成功建立 10 張新 `PENDING_CONFIRMATION` Booking；逐張以 Apps Script 回應及 `LittleLand_TEST` Sheets 讀回資料核對。
- 新增 23 筆 `Pets`，數量逐張與 Booking `quantity` 一致。
- 十張新單的 `allocatedRoomIdsJson` 均為 `[]`。原有一張合成待確認 TEST Booking 的暫定 `A1` allocation 已按新規則清除，並保留 `TEST_RULE_MIGRATION` Log。沒有任何待確認預約佔房。
- 同 key 重送第 1 張訂單，API 回傳原 Booking ID；沒有新增 Booking、Pets、CREATE Log 或 Idempotency row。
- 以故意加 HK$1 的 client quote 測試錯誤處理，API 回 `PRICE_CLIENT_MISMATCH`；沒有建立 Booking/Pets/Payment，只新增一筆不含個資的 `REJECT_BOOKING` Log。重送失敗 key 回放相同拒絕，沒有第二筆拒絕 Log。
- Google Sheets 最終讀回（非只採用 API 回應）：`Bookings` 11 筆（原有 1 + 本次 10）、`Pets` 24 筆（原有 1 + 本次 23）、`Payments` 0 筆、`Logs` 13 筆、`IdempotencyKeys` 12 筆（原有 1 + 本次 11）。本次 10 筆 CREATE Logs 及 1 筆拒絕 Log 均存在；拒絕 Log 個資掃描 0 命中。
- 所有 11 筆待確認預約的 allocation 都是空陣列。現有 `CONFIRMED`／`CHECKED_IN` booking 實體 allocation 的重疊掃描結果為 0 組雙重分配；目前 TEST Sheet 沒有 active allocation。
- 十組完整價格與 canonical `booking/pricing.js` 回算一致；`depositAmount = baseRoomFee × 50%`，`cashDeposit = quantity × HK$1,000`，現金按金未納入住宿總額、訂金或尾數。

## 十組 TEST Booking — 身分、日期及房態

十張新單全部狀態為 `PENDING_CONFIRMATION`。依規則此狀態不佔房，因此實際分配均為 `[]`；API 不會在此階段分配實體房號。

| # | TEST Booking ID | 寵物／房型 | 入住 → 退房（晚數） | 數量 | 狀態／實際 allocation |
|---:|---|---|---|---:|---|
| 1 | `TEST-LL-20261031-C9F6561F` | 兔子／豪華房 `DELUXE_ROOM` | 2026-11-03 → 2026-11-05（2） | 1 | `PENDING_CONFIRMATION`／`[]` |
| 2 | `TEST-LL-20261031-3C9B42E8` | 兔子／獨立套房 `PRIVATE_SUITE` | 2026-11-04 → 2026-11-05（1） | 2 | `PENDING_CONFIRMATION`／`[]` |
| 3 | `TEST-LL-20261031-7AA3263B` | 兔子／豪華套房 `DELUXE_SUITE` | 2026-11-06 → 2026-11-07（1） | 3 | `PENDING_CONFIRMATION`／`[]` |
| 4 | `TEST-LL-20261031-8F4AFEFD` | 兔子／非常.豪華套房 `VERY_DELUXE_SUITE` | 2026-11-07 → 2026-11-09（2） | 3 | `PENDING_CONFIRMATION`／`[]` |
| 5 | `TEST-LL-20261031-6273F198` | 天竺鼠／標準房 `STANDARD_ROOM` | 2026-11-10 → 2026-11-13（3） | 1 | `PENDING_CONFIRMATION`／`[]` |
| 6 | `TEST-LL-20261031-D7F4B959` | 天竺鼠／豪華房 `DELUXE_ROOM` | 2026-11-03 → 2026-11-05（2） | 3 | `PENDING_CONFIRMATION`／`[]` |
| 7 | `TEST-LL-20261031-7312D88B` | 天竺鼠／獨立套房 `PRIVATE_SUITE` | 2026-11-14 → 2026-11-17（3） | 3 | `PENDING_CONFIRMATION`／`[]` |
| 8 | `TEST-LL-20261031-E137D84C` | 天竺鼠／豪華套房 `DELUXE_SUITE` | 2026-11-20 → 2026-11-24（4） | 5 | `PENDING_CONFIRMATION`／`[]` |
| 9 | `TEST-LL-20261031-9CECA2C7` | 倉鼠／整理箱 `HAMSTER_BOX` | 2026-11-15 → 2026-11-16（1） | 1 | `PENDING_CONFIRMATION`／`[]` |
| 10 | `TEST-LL-20261031-A6B517B6` | 倉鼠／自備籠 `OWN_CAGE` | 2026-11-16 → 2026-11-18（2） | 1 | `PENDING_CONFIRMATION`／`[]` |

## 十組價格（HKD）

「附加費合計」包含額外寵物費、週末費及服務費；現金按金獨立計算，不納入住宿金額。

| # | 基本房費 | 額外寵物費 | 週末費 | 服務費 | 附加費合計 | 住宿總額 | 訂金 | 尾數 | 現金按金 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 356 | 0 | 0 | 370 | 370 | 726 | 178 | 548 | 1,000 |
| 2 | 278 | 50 | 0 | 330 | 380 | 658 | 139 | 519 | 2,000 |
| 3 | 350 | 100 | 250 | 220 | 570 | 920 | 175 | 745 | 3,000 |
| 4 | 1,200 | 200 | 0 | 300 | 500 | 1,700 | 600 | 1,100 | 3,000 |
| 5 | 294 | 0 | 0 | 70 | 70 | 364 | 147 | 217 | 1,000 |
| 6 | 356 | 200 | 0 | 160 | 360 | 716 | 178 | 538 | 3,000 |
| 7 | 834 | 300 | 0 | 800 | 1,100 | 1,934 | 417 | 1,517 | 3,000 |
| 8 | 1,400 | 800 | 0 | 590 | 1,390 | 2,790 | 700 | 2,090 | 5,000 |
| 9 | 65 | 0 | 250 | 80 | 330 | 395 | 32.50 | 362.50 | 1,000 |
| 10 | 100 | 0 | 0 | 0 | 0 | 100 | 50 | 50 | 1,000 |

服務內容及費用：#1 單次梳毛 70、每日梳毛 100、提早入住 200；#2 每日梳毛 50、每日餵藥一次 80、延遲退房 200；#3 單次梳毛 70、每日餵藥兩次 150；#4 每日梳毛 100、提早入住 200；#5 單次梳毛 70；#6 每日餵藥一次 160；#7 每日餵藥兩次 450、每日梳毛 150、延遲退房 200；#8 單次梳毛 70、每日餵藥一次 320、提早入住 200；#9 每日餵藥一次 80；#10 無額外服務。只有 #3（星期五入住、1 晚）及 #9（星期日入住、1 晚）收 HK$250 週末費；星期六入住但超過 1 晚的 #4、#7 週末費均為 0。

## 更新後佔房規則及重疊驗收

- 只有 `CONFIRMED`、`CHECKED_IN` 佔用實體房。`PENDING_CONFIRMATION`、`PENDING_DEPOSIT`、`CANCELLED`、`CHECKED_OUT`、`COMPLETED` 不佔房。Guest Create Booking 只檢查當下房態，成功時一律保存 `allocatedRoomIdsJson=[]`。
- **A — 重疊與不重複佔房：** 實際 TEST API 以不同 idempotency keys 並行提交 #1 與 #6；兩者同為 `DELUXE_ROOM`、日期均為 2026-11-03 至 2026-11-05。兩筆都完成為待確認申請、均無 allocation，提交後房態仍可預訂。Mock 測試亦驗證已佔用實體房發生歷史重疊時 fail closed（`ROOM_OVERLAP_DETECTED`）。
- **B — S1 佔用：** mock `CONFIRMED` fixture 佔 S1 時，`DELUXE_SUITE` 可用合法替代組合 S2+S3；沒有 S1+S3。
- **C — S2 佔用：** mock `CONFIRMED` fixture 佔 S2 時，`DELUXE_SUITE` 不可預訂，allocation 為空；不得以 S1+S3 代替。
- **D — S1+S2 佔用：** mock `DELUXE_SUITE` 佔 S1+S2 時，重疊期間 `PRIVATE_SUITE` 只剩 S3。
- **E — 非常.豪華套房：** mock `VERY_DELUXE_SUITE` 佔 S1+S2+S3 後，重疊期間 `PRIVATE_SUITE`、`DELUXE_SUITE`、`VERY_DELUXE_SUITE` 均不可用。
- **F — 退房日等於新入住日：** mock 半開區間測試確認可以沿用同一實體房；真正日期重疊不可雙重使用。
- **G — 防重複提交：** live 同 key／同 payload 重送 #1，回傳同一 Booking ID；Sheets 中每個 stress idempotency key 各唯一一列，沒有第二筆 Booking/Pets/CREATE Log。
- **H — 新規則取代舊預期：** 客人申請仍是 pending，故兩筆可共存；舊版「同時提交只准一筆成功」不再適用。實際平行提交時 #1 先完成，#6 第一次因 Apps Script Script Lock 得到 `LOCK_TIMEOUT`（`retryable=true`，尚未 claim key、沒有 Booking/Log），以相同 key 重試後成功建立 #6；這不是房態拒絕，也沒有重複寫入。只在收到訂金、準備轉 `CONFIRMED` 的未來流程中，才應競爭最後一間房並只允許一筆成功確認。
- 員工將 `PENDING_DEPOSIT` 轉為 `CONFIRMED` 的交易/API 尚未建立；需在未來 Staff 流程中實作「鎖內重查最新房態 → 合法實體分配 → 狀態更新」的原子操作。本次只以 mock inventory 驗證 B–F，不偽造 live 確認或已收訂金資料。

## 拒絕紀錄、錯誤處理及隱私

- 報價不一致測試只把合法報價的 `estimatedTotal` 改高 HK$1。API 回 `PRICE_CLIENT_MISMATCH`，Sheet 沒有新增 Booking、Pet 或 Payment；建立一筆 `FAILED` Idempotency row 及一筆 `REJECT_BOOKING` Log。
- 使用相同失敗 key 重播，仍回 `PRICE_CLIENT_MISMATCH`，不建立第二筆 Log。
- 對 TEST `Logs` 欄位執行去識別化掃描，未發現合成家長姓名、電話、Email 或寵物名稱／品種；拒絕 Log 只保存 request/error metadata，不保存表單。
- 初始 #6 `LOCK_TIMEOUT` 發生於 key claim 前，沒有 `IdempotencyKeys`、Booking 或 Log side effect；以原 key 安全重試後完成。

## 房態預檢、Pricing 及 automated suite

- Create 前對十組日期／物種／房型各做 TEST Availability 查詢，十組均回 `available=true`；建立待確認重疊申請後，再查 #1 時段仍回 `available=true`。
- 每張 Sheet 金額 snapshot 與 API server recalculation／已驗收 `booking/pricing.js` 一致；逐張核對房價、晚數、基本房費、額外寵物費、週末費、服務費、附加費合計、總額、訂金、尾數、現金按金及逐項服務費合計。公式檢查通過：`depositAmount = baseRoomFee × 0.5`；`remainingBalance = estimatedTotal - depositAmount`；`cashDeposit = quantity × 1000`；現金按金不進入住宿總額。
- 執行完整 automated suite：

  ```sh
  node --test tests/apps-script/*.test.js tests/pricing.test.js tests/booking-api-client.test.js
  ```

  結果：**72 passed / 0 failed**。所有 `apps-script/*.gs`（由 stdin 提供給 `node --check`）、`booking/api-client.js`、`booking/booking.js`、mock harness 語法檢查通過。

## 已知限制與邊界

1. GAS Script Lock 會序列化並行寫入；同時提交不同 key 時，競爭中的請求可能收到可重試 `LOCK_TIMEOUT`。本次以相同 key 重試後成功、無重複資料。若需要降低客人手動重試，未來可另行改善 UI/API backoff，但不應繞過鎖。
2. 員工確認訂金／轉 `CONFIRMED` API 及 Staff Dashboard 尚未建立。因此，最後一間房的「兩位待付訂金客人競爭確認，只確認一筆」目前不能做 live E2E 驗收；不得把 pending 建單測試誤稱為已驗證確認交易。
3. TEST Web App 設為匿名可呼叫，公開 POST 可能新增 TEST 記錄。此端點只供合成 TEST 資料，不可提交真實客人資料或改指向 Production。
4. 本次沒有合併到 `develop` 或 `main`，沒有付款、Production 或 Staff 功能變更。
