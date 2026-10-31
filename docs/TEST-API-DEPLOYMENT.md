# LittleLand TEST Apps Script Web App Deployment

**Environment:** TEST only

**Apps Script project:** `LittleLand TEST Booking API`

**Deployment:** Version 1, created 2026-10-31 04:55 (Google Apps Script display time)

**Deployment ID:** `AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i`

## API URL

[LittleLand TEST Apps Script API](https://script.google.com/macros/s/AKfycby6ecJFVBzQHAwGXS9VZlMLOQ3q3DbZh12Ssjg5nxUBGn1S61Sq_MGzZpmIgNm5EQ_i/exec)

## Deployment and data boundary

- Deployment type: Web App.
- Execute as: project owner (`hklittleland@gmail.com`).
- Access: Anyone (anonymous callers can reach the endpoint, as required for the public guest booking UI).
- The script property `LITTLELAND_TEST_SPREADSHEET_ID` is bound to `LittleLand_TEST`. The spreadsheet ID is intentionally not copied into this repository.
- The Apps Script authorization requests the Google Sheets scope `https://www.googleapis.com/auth/spreadsheets`. Application code uses the TEST allow-list and exact `LittleLand_TEST` title checks; it rejects caller-supplied spreadsheet IDs. Do not point the property at Production.
- This URL is publicly callable. `POST` can create TEST booking records; do not submit real customer data or use this endpoint for Production. The current verification made no POST calls and created no booking, pet, payment, log, or idempotency rows.

## Verification

On 2026-10-31, an anonymous, read-only `GET` to `action=availability` for `2026-11-01` through `2026-11-02`, `rabbit`, `DELUXE_ROOM`, quantity `1` returned HTTP 200 with `success: true`, `code: OK`, and `data.available: true`. No write operation was performed.

The existing automated suite was run with:

```sh
node --test tests/apps-script/*.test.js tests/pricing.test.js
```

Result: 60 passed, 0 failed. These are mocked Apps Script tests; they do not replace later end-to-end testing through the guest UI.
