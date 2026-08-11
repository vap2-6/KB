# MealFlow System Technical Reference — Variables, Functions, APIs & Fallbacks

This document provides a comprehensive technical reference for all variables, state hooks, backend functions, database schema columns, API contracts, and default fallback values across the MealFlow application modules.

---

## 1. System Constants & Default Fallback Values

| Context / Module | Variable / Property | Type | Default Fallback Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Meal Windows** | `bfStart` | `string` | `'07:30'` (07:30 AM) | Forenoon meal window start time |
| **Meal Windows** | `bfEnd` | `string` | `'10:00'` (10:00 AM) | Forenoon meal window end time |
| **Meal Windows** | `bfExpiry` | `number` | `30` (minutes) | Token validity duration after generation |
| **Meal Windows** | `lunchStart` | `string` | `'12:00'` (12:00 PM) | Afternoon meal window start time |
| **Meal Windows** | `lunchEnd` | `string` | `'14:30'` (02:30 PM) | Afternoon meal window end time |
| **Meal Windows** | `lunchExpiry` | `number` | `30` (minutes) | Token validity duration after generation |
| **Year Migration** | `year_migration_date` | `string` | `''` (ISO format string) | Scheduled date and time for automated student year migration |
| **Token Validity** | `TOKEN_EXPIRY_MINUTES` | `number` | `30` (minutes) | Lifetime of an active issued meal token |
| **Student Auth** | `DEFAULT_PASSWORD` | `string` | `'pass123'` | Plaintext fallback password assigned to new students |
| **Server Routing** | `PORT` | `number` | `5050` | Primary Flask server port for API and SPA static routes |
| **Network Host** | `hostBase` | `string` | `window.location.origin` | Dynamic host URL resolution for LAN & local IP fetches |

---

## 2. Frontend State Variables & Custom Hooks

### Staff Portal (`frontend-staff/src/App.tsx`)
- `session`: Current logged-in staff session (`staffId`, `role`, `displayName`, `token`).
- `activeTab`: Currently active navigation view (`"dashboard"` | `"students"` | `"export"` | `"settings"`).
- `tokens`: List of all tokens for today fetched from `GET /api/staff/tokens`.
- `students`: List of all student records fetched from `GET /api/students`.
- `currentStudent`: Student object active in `IssueTokenModal`.
- `currentTokenData`: Token and Student payload active in `VerifyTokenModal`.
- `existingToken`: Today's existing token status (if any) passed to `IssueTokenModal`.
- `autoApproveScans`: Boolean toggle for auto-approving QR scan events without modal prompt.

### Canteen Portal (`frontend-canteen/src/App.tsx`)
- `session`: Current logged-in canteen staff session (`staffId`, `role`, `displayName`).
- `activeTab`: Currently active view (`"dashboard"` | `"students"` | `"export"` | `"settings"`).
- `tokens`: List of today's tokens fetched from `GET /api/canteen/tokens`.
- `currentStudent`: Active student in `IssueTokenModal`.
- `currentTokenData`: Active token and student object in `VerifyTokenModal`.
- `existingToken`: Today's token status passed to `IssueTokenModal`.
- `autoApproveScans`: Boolean toggle for automatic redemption upon QR scan.

### Admin Portal (`frontend-admin/src/components/MealWindows.tsx`)
- `migDate`: Controlled state string (`YYYY-MM-DD`) bound to Year Migration Date input.
- `migTime`: Controlled state string (`HH:mm`) bound to Year Migration Time input.

### Student Portal (`frontend-stud/src/App.tsx`)
- `loggedInStudent`: Authenticated student profile (`id`, `roll`, `name`, `email`, `dept`, `year`, `forenoon_meal`, `afternoon_meal`).
- `breakfastToken`: Active breakfast token state (`status`, `qrCodeUrl`, `expiresAtMs`, `tokenId`).
- `lunchToken`: Active lunch token state (`status`, `qrCodeUrl`, `expiresAtMs`, `tokenId`).
- `breakfastTimeLeft` / `lunchTimeLeft`: Remaining validity seconds for live countdown ticker.
- `mealWindowConfig`: Admin-configured timing bounds (`bfStart`, `bfEnd`, `lunchStart`, `lunchEnd`).
- `tokenHistory`: Historical transaction logs rendered in History tab.

---

## 3. Core Frontend & Backend Functions

### Frontend Functions
- `isTimeInWindow(start24, end24, expiryMins)`: Checks if current time is within configured window bounds.
- `getMealState(mealName, isEligible, isWindowActive)`: Computes current state (`'open'`, `'closed'`, `'claimed'`, `'expired'`, `'rejected'`, `'pending_approval'`) for Breakfast or Lunch.
- `handleScanSuccess(rawPayload, displayLabel)`: Routes scanned QR code (Student QR vs Token QR).
- `handleConfirmIssue(mealType)`: Calls `POST /api/tokens` to issue fresh token.
- `handleApproveVerify()`:
  - In **Staff Portal**: Sends `{ status: "approved" }` to `PATCH /api/tokens/<id>`.
  - In **Canteen Portal**: Sends `{ status: "redeemed" }` to `PATCH /api/tokens/<id>`.

### Backend Service Functions (`backend/admin_backend/app.py`, `backend/backend_staff/app.py`, `backend/backend_canteen/app.py`)
- `_execute_year_migration(conn)`: Executes transactional SQL updates promoting academic years (`3rd` -> `Graduated`, `2nd` -> `3rd`, `1st` -> `2nd`).
- `_check_and_run_automated_year_migration(conn)`: Evaluates if `year_migration_date <= NOW()`, executes migration, and advances scheduled date by +1 year iteratively.
- `_add_one_year(dt)`: Safe date addition helper handling leap-year Feb 29 to non-leap year Feb 28 conversions.
- `map_db_token_to_frontend(db_token)`: Maps database row to JSON representation preserving `'active'`, `'approved'`, `'redeemed'`, `'expired'`, `'rejected'` statuses.
- `_find_token_and_student(cursor, search_ids, ...)`: Identifies scanned type (`token_qr` vs `student_qr`) and returns token & student objects.
- `_decode_qr_payload(payload_str)`: Decodes plaintext, JSON, or base64 QR payload formats.
- `issue_token()`: Inserts fresh token into `meal_tokens` with 30-minute expiry relative to `NOW()`.
- `update_token(token_id)` (Staff): Updates status to `'approved'`, `'rejected'`, or `'expired'`.
- `redeem_token(token_id)` (Canteen): Updates status to `'redeemed'`, sets `redeemed_by` and `redeemed_at = CURRENT_TIMESTAMP`.

---

## 4. API Endpoints & Request/Response Contracts

| Endpoint | Method | Service | Purpose | Request Body | Response Payload |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/scan` | `POST` | Staff / Canteen | Ingest QR code payload | `{"payload": "TOK-..."}` | `{"scanned_type": "token_qr"\|"student_qr", "token": {...}, "student": {...}}` |
| `/api/tokens` | `POST` | Staff / Canteen | Issue new meal token | `{"student_reg": "...", "meal_type": "Breakfast"}` | `{"message": "Token generated successfully", "token_id": "TOK-..."}` |
| `/api/tokens/<id>` | `PATCH` | Staff | Approve / Reject token | `{"status": "approved"\|"rejected", "staff_id": "..."}` | `{"message": "Token updated successfully"}` |
| `/api/tokens/<id>` | `PATCH` | Canteen | Redeem / Reject token | `{"status": "redeemed"\|"rejected", "staff_id": "..."}` | `{"message": "Meal redeemed successfully"}` |
| `/api/staff/tokens` | `GET` | Staff / Canteen | Fetch today's tokens list | None | `[{"token_id": "TOK-...", "status": "approved", ...}]` |
| `/api/student/active-token` | `GET` | Student API | Poll student active tokens | None | `{"tokens": [...], "active_token": {...}}` |
| `/api/public/meal-config` | `GET` | Admin / Public | Get meal window timings & year migration schedule | None | `{"forenoon": {...}, "afternoon": {...}, "year_migration_date": "2027-08-15T10:00"}` |
| `/api/meal-config` | `PUT` | Admin | Update meal windows & year migration schedule | `{"days": [...], "forenoon": {...}, "afternoon": {...}, "year_migration_date": "2026-08-10T10:00"}` | `{"days": [...], "forenoon": {...}, "afternoon": {...}, "year_migration_date": "2027-08-10T10:00"}` |

---

## 5. Database Schema & Status Enums

### Table: `meal_tokens`
```sql
CREATE TABLE meal_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_uid VARCHAR(50) NOT NULL UNIQUE,
  student_id VARCHAR(50) NOT NULL,
  cached_student_name VARCHAR(100),
  meal_type ENUM('forenoon', 'afternoon') NOT NULL,
  status ENUM('active','awaiting_scan','staff_verified','approved','rejected','token_issued','redeemed','claimed','expired') NOT NULL DEFAULT 'active',
  scanned_by VARCHAR(50),
  scanned_at TIMESTAMP NULL,
  approved_by VARCHAR(50) NULL,
  approved_at TIMESTAMP NULL,
  redeemed_by VARCHAR(50) NULL,
  redeemed_at TIMESTAMP NULL,
  expiry_time TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `scan_audit_log`
```sql
CREATE TABLE scan_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scanner_id VARCHAR(50) NOT NULL,
  scanner_role ENUM('approval_staff', 'canteen_staff') NOT NULL,
  scan_type ENUM('student_id_qr', 'token_qr') NOT NULL,
  payload VARCHAR(512) NOT NULL,
  student_id VARCHAR(50),
  token_uid VARCHAR(50),
  result ENUM('success', 'invalid_token', 'already_redeemed', 'expired', 'out_of_window', 'duplicate_meal', 'not_eligible') NOT NULL,
  detail VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
