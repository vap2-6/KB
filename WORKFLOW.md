# MealFlow System Specifications & Technical Workflow

## System Architecture Boundaries
- **Database Engine**: Relational MySQL (`rkmvc_mealflow_db`).
- **Data Integrity Rule**: No `LONGTEXT` JSON state blobs for runtime logs. All scans must execute via relational transactional writes.
- **Security Rule**: Plaintext credentials files (`student_credentials.csv`) are strictly prohibited on disk. Passwords must be hashed using a secure algorithm (e.g., bcrypt) inside the database. Real credentials are delivered exclusively via transaction-based SMTP execution loops.
- **Context Isolation**: State mutations utilizing `request.user` are forbidden. Thread isolation must utilize Flask's native global application container (`flask.g.user`).
- **Unified Server Routing**: Single Flask backend process running on port 5050 serving all Blueprints (`/api/admin`, `/api/staff`, `/api/canteen`, `/api/student`) and static SPA bundles (`/staff`, `/canteen`, `/student`, `/admin`, `/register`).

---

## 1. Student Registration Pipeline & Media Asset Ingestion

### File Storage Infrastructure
The application root requires a persistent directory named `uploads/` broken down into strict asset subdirectories. Media must be safely stored on the server file-system while only their relative paths are committed to the MySQL database fields:
- `uploads/student_master_img/` -> Stores student master identification photographs (Target Database Column: `student_image_path`).
- `uploads/income_proofs/` -> Stores income certificate documents/PDFs (Target Database Column: `income_proof_path`).
- `uploads/signatures/` -> Stores student digital verification signatures (Target Database Column: `signature_path`).

### Frontend Registration User Experience
1. **Application Intake**: The Student Portal homepage provides a "Sign Up" trigger routing users to a detailed structural entry form. This form automatically fetches and displays the student's passport photo from `student_master_img` upon Department Roll Number verification.
2. **Double-Pass Confirmation (Review Stage)**: Clicking the "Review" button stops form processing, freezes input fields, generates temporary browser object blob URLs (`URL.createObjectURL`) to show previews of the uploaded files, and displays a serialized data preview back to the student for visual layout verification.
3. **Submission State**: Confirming the preview transmits a multipart form-data (`multipart/form-data`) payload to the backend API admin register endpoint. On `status 200 OK`, the modal unmounts, presenting a clear persistent validation alert: *"Your application has been successfully submitted and sent to the Administrator for verification."*

### Backend Data Rules
- Parse incoming binary files using an isolated disk storage buffer pipeline (e.g., Multer for Node, Werkzeug Secure Filename for Python).
- Rename each file utilizing a distinct tracking pattern (e.g., `student_id_timestamp.ext`) to mitigate server namespace overwrites.
- Move the processed binary fragments into their respective subdirectories inside `uploads/`.
- Insert a tracking record into the `meal_registrations` table with an initial tracking state of `status = 'Pending'`, populating the string path columns (`student_image_path`, `income_proof_path`, `signature_path`) with clean relative path strings (e.g., `/uploads/student_master_img/243301034021.jpg`).

---

## 2. Administrative Control Portal

### Notification Engine & Queue Management
- **Live Polish Tracking**: When an Admin logs in, an asynchronous polling query triggers to check for `Pending` rows in `meal_registrations`. The counts dynamically update a global navbar notification bell icon.
- **Queue Interface**: Clicking the notification bell fires a slide-out overlay drawer or routes the Admin to the **Registration Requests** tab. This tab mounts a clean paginated data matrix showing pending registrations with actionable single-click "Approve" and "Reject" workflows.

### Structural UI Restructuring: Registration Request Tab
The profile inspection layout inside the registration approval accordion panel expands into a dedicated visual validation interface when the admin clicks the "View Details" selector:
1. **Biometric Panel Group**: A dedicated visual container rendering the student's identification image right beside their digital validation signature asset.
2. **Document Inspection Segment**: A clickable hyperlink container displaying the filename string or mounting an embed preview component for the income certificate document path retrieved from the database.
3. **Media Asset Fallback Handler**: If any image path evaluates to an empty string, null reference, or file-not-found state on disk, the UI must gracefully mount a clear structural fallback state card (e.g., *"No Document Attached"* or a neutral graphic avatar) without breaking page styling wrappers.

### Administrative Action Loops & Transactional SMTP
When an Admin triggers a choice toggle, the backend processes an atomic lifecycle mutation:

#### Case A: If Action == 'Approve'
1. Update `meal_registrations.status` to `'Approved'`.
2. Generate a fresh record inside the primary relational `students` / `student_meals` table, passing along the file tracking paths (`student_image_path`, `income_proof_path`, `signature_path`).
3. Use the student's unique **Academic Register Number** (`student_id`) directly as their permanent primary key and portal login handle (eliminating redundant duplicate fields).
4. Issue a default fallback plaintext string: `'pass123'`. 
5. Instantly hash this string using a secure encoder and save the crypt string inside the `password_hash` column.
6. Fire a transactional SMTP email via **Gmail SMTP (`://gmail.com`)** using your system's secure Google App Password credentials:
   - **Recipient**: The specific student's registered email string.
   - **Payload**: Clear confirmation of account approval along with their public Login Username (Register Number) and the temporary plaintext password `'pass123'`.
7. Purge the plaintext variable string out of backend operational memory stack frames instantly.

#### Case B: If Action == 'Reject'
1. Update `meal_registrations.status` to `'Rejected'`.
2. Fire a transactional SMTP email notifying the student that their registration profile was rejected. No database credentials profile or user accounts are spawned.

#### Security & Visibility Auditing
- Plaintext credentials must never touch a text file or backup log asset on disk.
- Admins possess locked permissions: They **cannot** manually forge, alter, or inject structural tokens directly into the engine. They can exclusively review system-wide logs within the **Token & Distribution** analytics board.

### Automated & Manual Academic Year Migration Engine
1. **Meal Windows Configuration Integration**:
   - The Meal Windows section in the Admin Portal contains an **"Automated Student Year Migration"** card with dedicated date (`Year Migration Date`) and time (`Year Migration Time`) input fields.
   - The manual **"Promote Academic Year"** trigger button on the Student Roster page remains fully functional for manual testing and instant triggers.
2. **Automated Progression Logic & Loophole Mitigations**:
   - **Batch Migration Sequence**: Promotes student academic years atomically (`3rd Year` &rarr; `Graduated`, `2nd Year` &rarr; `3rd Year`, `1st Year` &rarr; `2nd Year`), setting meal eligibility for graduated students (`forenoon_meal = 0`, `afternoon_meal = 0`).
   - **Automatic Annual Roll-Forward**: When migration occurs, the configured date automatically advances to the exact same day and time in the next year (`+1 Year`).
   - **Immediate Execution for Past Input**: If the set date and time are in the past (or present), migration executes **immediately** upon saving (`PUT /api/meal-config`), and the displayed schedule rolls forward to the upcoming year.
   - **Catch-Up Infinite Loop Prevention**: When advancing past dates, the backend advances by +1 year iteratively until `next_date > NOW()`, guaranteeing exactly one execution without cascading multiple past-year migrations.
   - **Leap Year (Feb 29) Exception Handling**: Scheduling on Feb 29 in a leap year falls back gracefully to Feb 28 in non-leap years.
   - **Thread Safety & Background Monitoring**: Managed with database row locks (`SELECT FOR UPDATE`) and monitored by a background daemon worker thread (`YearMigrationSchedulerThread`) polling every 30 seconds.

---

## 3. Staff & Canteen Operation Portals

### Complete Token State Lifecycle Matrix
| Database `status` | `approved_at` | `redeemed_at` | Description / UI Mapping |
| :--- | :--- | :--- | :--- |
| `'active'` / `'token_issued'` | `NULL` | `NULL` | Fresh token generated for today. Scannable by canteen/staff. |
| `'approved'` / `'staff_verified'` | `TIMESTAMP` | `NULL` | Staff approved/verified token. Valid for canteen redemption. |
| `'redeemed'` / `'claimed'` | `TIMESTAMP` | `TIMESTAMP` | Canteen staff distributed meal. Cannot be used again today. |
| `'rejected'` | `TIMESTAMP` | `NULL` | Token rejected by staff/canteen. Can generate fresh token. |
| `'expired'` | `NULL`/`TIMESTAMP` | `NULL` | Token 30-min lifetime passed or date < CURDATE. Can generate fresh token. |

---

### Module A: Approval Staff Workflow (STAFF101)
The Approval Staff interface manages manual identity checking and token provisioning.

1. **Dual Ingest Pipeline & QR Code Type Differentiation**:
   - **Student Identity QR Scan (Student ID / `sid`)**: Returns student profile details ONLY. Automatically opens `IssueTokenModal`.
   - **Token QR Scan (`TOK-...` / `tu`)**: Returns token details. Automatically opens `VerifyTokenModal`.
   - **Manual Mode**: Typing `register_number` into input bar executes the identical Student ID flow.
2. **Unified Verification View Mapping Modal (`IssueTokenModal`)**: 
   When a student profile is requested, the modal displays:
   - Full Academic Name, Profile Photograph, and Registration Number.
   - **Live Session Eligibility Crosscheck**: Checks current server time session against `student_meals.forenoon_meal` and `student_meals.afternoon_meal`.
   - **In-Modal Status Alerts (at Bottom of Unified Window)**:
     - **Active Token Banner**: Displays **"Token is active"** (amber banner) if student has an active/approved token for today.
     - **Claimed Token Banner**: Displays **"Token is claimed"** (blue banner) if student has a claimed/redeemed token for today.
     - **Ineligibility Banner**: Displays **"NOT ELIGIBLE FOR FORENOON MEAL"** or **"NOT ELIGIBLE FOR AFTERNOON MEAL"**.
3. **Session & Token Action Enforcement**:
   - If **Token is Active** or **Claimed**: Generate button is **disabled** (`cursor-not-allowed`) displaying `"TOKEN IS ACTIVE"` or `"TOKEN IS CLAIMED"`.
   - If **Token is Expired**, **Rejected**, or **None exists**: Generate button is **enabled** (`"GENERATE TOKEN"`), creating a fresh `status = 'active'` token upon click.
   - If Staff clicks **"Reject"**: Calls token status update `status = 'rejected'`, leaving `redeemed_at = NULL` and logging audit denial.

---

### Module B: Canteen Staff Verification Workflow (CANTEEN01)
The Canteen Staff handles real-time gate validation during dining distributions.

1. **Scan Ingest Matrix & Origin Resolution**:
   - Webcam and hardware scanners send payload to `/api/scan`.
   - Network fetches dynamically resolve `window.location.origin` (supporting localhost, local Wi-Fi, and LAN IP addresses without host resolution errors).
2. **Token Verification Modal (`VerifyTokenModal`)**:
   - Displayed when a **Token QR** is scanned. Shows student name, reg number, photo, meal type, and token status.
3. **State Commit Handlers**:
   - **Approve Button**: Sets token `status = 'approved'`, `approved_by = staff_id`, `approved_at = CURRENT_TIMESTAMP`, leaving `redeemed_at = NULL`.
   - **Redeem / Claim Button**: Sets token `status = 'redeemed'`, `redeemed_by = canteen_id`, `redeemed_at = CURRENT_TIMESTAMP`.
   - **Reject Button**: Sets token `status = 'rejected'`, `approved_by = canteen_id`, `approved_at = CURRENT_TIMESTAMP`, leaving `redeemed_at = NULL`.
4. **Dashboard Metrics & Verification Badges**:
   - **Stat Card 4 Metric Aggregation**: Named **`REJECTED / EXPIRED`**, aggregating both `'rejected'` and `'expired'` tokens.
   - **Status Badges**: `Active` (Emerald), `Approved` (Blue), `Redeemed / Claimed` (Indigo), `Expired` (Amber/Rose), `Rejected` (Rose).

---

### Automatic Token Expiry Lifecycle & Database State Transitions
- **Database Auto-Expiration Query**: Executed atomically on token endpoints:
  ```sql
  UPDATE meal_tokens 
  SET status = 'expired' 
  WHERE status IN ('active', 'awaiting_scan', 'approved', 'token_issued', 'staff_verified')
    AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) 
      OR (expiry_time IS NULL AND TIMESTAMPDIFF(SECOND, created_at, NOW()) > 1800)
      OR DATE(created_at) < CURDATE())
  ```
- **Real-Time UI Expiry Transition**: When countdown timer hits zero, token dynamically transitions to `'expired'`, unmounting QR code displays and showing **"Token Expired"**.

---

## 4. Student Portal & Live State Synchronization

### Initial Authentication Guard & Dynamic DB Query Binding
- **Dynamic Relational Query**: The student authentication endpoint (`POST /api/student/api/auth/login`) extracts `register_no` (Student Register Number) and `password` from incoming JSON payloads, querying the `student_meals` table (`student_id = register_no`). Passwords are verified dynamically using `bcrypt.checkpw(password, stored_hash)` with zero hardcoded credential shortcuts.
- **Mandatory Password Reset Lock**: If the authenticated password matches the default setup phrase (`pass123`), the API response explicitly includes `{"require_password_reset": true}`. Upon receiving this flag, the Student Portal locks navigation, disables backdrop click dismissals, unrenders close `X` buttons, and enforces password change completion before granting access.

### Non-Expanding Token Cards & Modal QR Presentation
- **Fixed-Height Meal Token Cards**: Cards (`Breakfast Token` & `Lunch Token`) remain uniform and fixed-size.
- **Interactive Popup Modal Trigger**: Active tokens render **"OPEN QR CODE"** button. Clicking opens modal overlay displaying scannable QR Code image and live countdown timer.
- **Automatic Expiration Handling**: If timer expires during view, modal dynamically switches to **"Token Expired"**.

### Real-Time Canteen Token History View
- **Server-Driven Token Log**: History tab polls real-time database entries matching student's registration ID (`student_reg`).
- **Dynamic History Cards**: History entries render:
  - **Meal Indicator**: Breakfast Token (coffee icon) / Lunch Token (utensils icon).
  - **Token Identifier Badge**: Explicit token tracking code (e.g., `TOK-1784981404`).
  - **Formatted Timestamp**: Formatted date and time string (e.g., `Jul 25, 2026 at 05:40 PM`).
  - **Status Badges**: Distinct color-coded status badges — `Active` (Emerald), `Approved` (Blue), `Redeemed / Claimed` (Indigo), `Expired` (Rose), `Rejected` (Rose).

---

## 5. Global Audit & Ledger Synchronization Requirement
Every transaction state change, application review step, token generation execution, or scanning claim trigger must write atomic transitional entries into relational tracking tables (`meal_distribution_log`, `scan_audit_log`, `meal_tokens`).
Everyday token generation report should be generated as PDF file and stored in a persistent directory regularly.

---

## 6. Student Registration Form Specifications

### Department Number Validation Constraint
- **Exact 13-Digit Requirement**: Strictly enforces an exact 13-digit numeric requirement (`/^\d{13}$/`).
- **Auto-fetching using Department Number**: Applicant entering 13-digit department number automatically triggers database lookup. **If student is already registered, form displays message "Already registered with this Department Number" and disables form.**  
- **Input Guarding & Form Validation**: Non-numeric characters stripped on input; submission blocked unless Department Number contains exactly 13 digits.

### Date of Birth (DOB) & Automatic Age Engine
- **Dynamic Age Calculation**: Computes applicant's exact age in years from DOB, displaying real-time Age badge (`Age: 20 Yrs`).
- **MySQL Table Column Mapping (`meal_registrations`)**: Schema maintains `age INT` column next to `date_of_birth VARCHAR(50)`, populated automatically on submission.

### Forgot Password - All Login Pages
- Forgot Password button on login page redirects to Forgot Password page.
- Checks database for user (student and staff login pages).
- Form asks for registration number and email address.
- Validates registration number and email match; if valid, sends email with randomly generated password.
- Updates database password hash with new randomly generated password for that user.
- Separate login pages and forgot password pages for students and staff.

---

## 7. System API Endpoint Contracts & Database Operations

### API 1: Token QR Scan Ingestion (`POST /api/scan`)
- **Endpoint**: `POST /api/scan`
- **Payload**: `{"payload": "<TOK-ID or Student ID>"}`
- **Response**:
  ```json
  {
    "scanned_type": "token_qr",
    "token": {
      "token_id": "TOK-1786371491",
      "student_reg": "2433010340220",
      "meal_type": "Lunch",
      "status": "approved",
      "created_at": "2026-11-08T01:18:11",
      "generated_at": "2026-11-08T01:18:11"
    },
    "student": {
      "reg_no": "2433010340220",
      "name": "Kishore",
      "department": "CSE",
      "year": "3rd Year"
    }
  }
  ```

### API 2: Token Generation / Issuance (`POST /api/tokens`)
- **Endpoint**: `POST /api/tokens`
- **Payload**: `{"student_reg": "2433010340220", "meal_type": "Lunch", "staff_id": "STAFF101"}`
- **Executed MySQL Query**:
  ```sql
  INSERT INTO meal_tokens (token_uid, student_id, cached_student_name, meal_type, status, scanned_by, created_at, expiry_time)
  VALUES ('TOK-1786371491', '2433010340220', 'Kishore', 'afternoon', 'active', 'STAFF101', NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE));
  ```
- **Response**: `HTTP 201 Created: {"message": "Token issued successfully", "token_id": "TOK-1786371491"}`

### API 3: Staff Token Approval (`PATCH /api/tokens/<token_id>`)
- **Endpoint**: `PATCH /api/tokens/<token_id>`
- **Payload**: `{"status": "approved", "staff_id": "STAFF101"}`
- **Executed MySQL Query**:
  ```sql
  UPDATE meal_tokens
  SET status = 'approved', approved_by = 'STAFF101', approved_at = CURRENT_TIMESTAMP
  WHERE token_uid = 'TOK-1786371491';
  ```
- **Response**: `HTTP 200 OK: {"message": "Token updated successfully"}`

### API 4: Canteen Meal Redemption (`PATCH /api/tokens/<token_id>`)
- **Endpoint**: `PATCH /api/tokens/<token_id>` (or `POST /api/redeem`)
- **Payload**: `{"status": "redeemed", "staff_id": "CANTEEN01"}`
- **Executed MySQL Query**:
  ```sql
  UPDATE meal_tokens
  SET status = 'redeemed', redeemed_by = 'CANTEEN01', redeemed_at = CURRENT_TIMESTAMP, approved_by = COALESCE(approved_by, 'CANTEEN01'), approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP)
  WHERE token_uid = 'TOK-1786371491';
  ```
- **Response**: `HTTP 200 OK: {"message": "Meal redeemed successfully"}`

### API 5: Student Active Token Polling (`GET /api/student/active-token`)
- **Endpoint**: `GET /api/student/active-token?student_id=<REG_NO>`
- **Executed MySQL Query**:
  ```sql
  SELECT * FROM meal_tokens
  WHERE student_id = '2433010340220' AND created_at >= CURDATE() AND status IN ('active', 'approved', 'expired', 'redeemed', 'rejected')
  ORDER BY created_at DESC;
  ```
- **Response**: Returns token objects with `token_uid`, `meal_type`, `status`, `expires_at`, and `server_current_time`.
