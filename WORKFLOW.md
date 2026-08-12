# MealFlow System Specifications & Technical Workflow

## System Architecture Boundaries
- **Database Engine**: Relational MySQL (`rkmvc_mealflow_db`).
- **Data Integrity Rule**: No `LONGTEXT` JSON state blobs for runtime logs. All scans must execute via relational transactional writes.
- **Security Rule**: Plaintext credentials files (`student_credentials.csv`) are strictly prohibited on disk. Passwords must be hashed using a secure algorithm (e.g., bcrypt) inside the database. Real credentials are delivered exclusively via transaction-based SMTP execution loops.
- **Context Isolation**: State mutations utilizing `request.user` are forbidden. Thread isolation must utilize Flask's native global application container (`flask.g.user`).

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

---

## 3. Staff Operation Portals

### Module A: Approval Staff Workflow(STAFF101)
The Approval Staff interface manages manual identity checking and token provisioning.

1. **Dual Ingest Pipeline (QR Scanner & Manual Entry Entrypoint)**:
   - **QR Mode**: Scanning the student’s persistent identity QR code from their portal pulls their academic `register_number`.
   - **Manual Mode**: If the student lacks a device or the code is unreadable, typing the `register_number` into the input bar and pressing enter **must execute the identical interface flow**. Both actions must launch the **Unified Verification View Mapping modal**.
2. **Unified Verification View Mapping Modal**: 
   When a student profile is requested, the modal displays:
   - Full Academic Name, Profile Photograph, and Registration Number.
   - **Live Session Eligibility Crosscheck**: The system checks the current server time session against the student's profile flags inside the database (`student_meals.forenoon_meal` and `student_meals.afternoon_meal`).
3. **Session Eligibility Enforcement & Control Locks**:
   - **Forenoon Session (07:00 AM - 10:00 AM)**: If a student presents their code but their record shows `forenoon_meal = 0`, the modal must print a highly visible warning: **"NOT ELIGIBLE FOR FORENOON MEAL"**. The **"Issue"** button must remain visible but switch to a completely disabled, un-clickable state.
   - **Afternoon Session (12:00 PM - 07:00 PM)**: If a student presents their code but their record shows `afternoon_meal = 0`, the modal must print a highly visible warning: **"NOT ELIGIBLE FOR AFTERNOON MEAL"**. The **"Issue"** button must remain visible but switch to a completely disabled, un-clickable state.
4. **Token Generation Lifecycle Engine**: 
   - If the student is confirmed eligible and the staff clicks the enabled **"Issue"** button, the backend creates a fresh entry inside the physical `meal_tokens` table with `status = 'Active'` and records a server-verified `generated_at` timestamp.
   - If the staff flags data tampering or bad behavior, they click **"Reject"** to log an audit cancellation.

### Module B: Canteen Staff Verification Workflow (CANTEEN01)
The Canteen Staff handles real-time gate validation during dining distributions.

1. **Scan Ingest Matrix**: The operator uses a barcode hardware peripheral or webcam reader tool to ingest the student's token QR code hash payload.
2. **Unified Verification View Mapping Modal**: 
   When a student profile is requested, the modal displays:
   - Full Academic Name, Profile Photograph, and Registration Number.
3. **Physical Verification Lock**: The Canteen Staff must inspect the screen profile photo and visually check the student standing in line.
4. **State Commit Handlers**: The staff clicks one of two explicit interaction buttons:
   - **Claim Button**: Sets the database token status to `'Claimed'`, logs the timestamp, and creates a relational transaction row inside the `meal_distribution_log` table tracking the operating staff user account.
   - **Reject Button**: Sets the database token status to `'Rejected'`, tracking a denial execution string.
5. **Dashboard Metrics & Verification Badges**:
   - **Stat Card 4 Metric Aggregation**: Must strictly be named **`REJECTED / EXPIRED`** and aggregate both `'rejected'` and `'expired'` tokens in state calculations (`rejectedTokens = tokens.filter(t => t.status === 'rejected' || t.status === 'expired').length`).
   - **Token API & Verification Status Mapping**: The backend mapping (`map_db_token_to_frontend`) preserves `'expired'` tokens as `"status": "expired"`, allowing the UI to display explicit **`EXPIRED`** rose status badges (distinct from `'rejected'`).

---

### Automatic Token Expiry Lifecycle & Database State Transitions
- **Database Auto-Expiration Query**: When token endpoints (`GET /api/staff/tokens`, `GET /api/student/active-token`) or Admin Portal physical table syncs (`_get_physical_mysql_tables`, `_lazy_expire_tokens`) execute, the backend automatically runs an atomic MySQL update query:
  ```sql
  UPDATE meal_tokens 
  SET status = 'expired' 
  WHERE status IN ('active', 'awaiting_scan', 'approved', 'token_issued', 'staff_verified')
    AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) 
      OR (expiry_time IS NULL AND TIMESTAMPDIFF(SECOND, created_at, NOW()) > 1800))
  ```
- **Real-Time UI Expiry Transition**: When a token's 30-minute lifetime expires or countdown timer hits zero (`timeLeftSeconds <= 0`), the token's status dynamically transitions from `'active'` to `'expired'` in both MySQL database tables and frontend states. The popup modal and token cards automatically update from **"Active"** / **"OPEN QR CODE"** to **"Token Expired"** with all QR code displays safely unmounted.

---

## 4. Student Portal & Live State Synchronization

### Initial Authentication Guard & Dynamic DB Query Binding
- **Dynamic Relational Query**: The student authentication endpoint (`POST /api/student/api/auth/login`) extracts `register_no` (Student Register Number) and `password` from incoming JSON payloads, querying the `student_meals` table (`student_id = register_no`). Passwords are verified dynamically using `bcrypt.checkpw(password, stored_hash)` with zero hardcoded credential shortcuts.
- **Mandatory Password Reset Lock**: If the authenticated password matches the default setup phrase (`pass123`), the API response explicitly includes `{"require_password_reset": true}`. Upon receiving this flag, the Student Portal locks navigation, disables backdrop click dismissals, unrenders close `X` buttons, and enforces password change completion before granting access.

### Non-Expanding Token Cards & Modal QR Presentation
- **Fixed-Height Meal Token Cards**: Meal Token cards (`Breakfast Token` & `Lunch Token`) remain uniform and fixed-size without expanding downward to embed QR codes directly inside the card body.
- **Interactive Popup Modal Trigger**: Active tokens render an interactive **"OPEN QR CODE"** button. Clicking this button opens a dedicated popup modal overlay that displays the scannable QR Code image, live expiration countdown timer, and scannable status.
- **Automatic Expiration Handling**: If the countdown timer expires while viewing the modal, the popup modal dynamically switches its view from the active QR code to a clean **"Token Expired"** indicator card.

### Real-Time Canteen Token History View
- **Server-Driven Token Log**: The Student Portal **History** tab (`activeTab === 'history'`) polls real-time database entries from `meal_tokens` matching the logged-in student's registration ID (`student_reg`).
- **Dynamic History Cards**: History entries render:
  - **Meal Indicator**: Breakfast Token (coffee icon) / Lunch Token (utensils icon).
  - **Token Identifier Badge**: Explicit token tracking code (e.g. `TOK-1784981404`).
  - **Formatted Timestamp**: Formatted date and time string (e.g. `Jul 25, 2026 at 05:40 PM`).
  - **Status Badges**: Distinct color-coded status badges — `Active / Issued` (Emerald), `Staff Verified & Redeemed` (Blue), `Expired` (Rose), or `Rejected` (Rose).

---

## 5. Global Audit & Ledger Synchronization Requirement
Every transaction state change, application review step, token generation execution, or scanning claim trigger must write atomic transitional entries into their respective relational tracking tables (`meal_distribution_log`, `scan_audit_log`, `meal_tokens`).
Everyday token generation report should be generated as pdf file and stored in a folder regularly.

---

## 6. Student Registration Form Specifications


### Department Number Validation Constraint
- **Exact 13-Digit Requirement**: The Department Number field strictly enforces an exact 13-digit numeric requirement (`/^\d{13}$/`).
- **Auto fetching using Department Number** : When the applicant enters the 13 digit department number, the form automatically fetches the student details from the database and fills the form. **If the student is already registered, the form should display a message "Already registered with this Department Number" and disable the form.**  
- **Input Guarding & Form Validation**: Non-numeric characters are automatically stripped on input, and form submission validation prevents progress unless the Department Number contains exactly 13 digits.

### Date of Birth (DOB) & Automatic Age Engine
- **Dynamic Age Calculation**: The form automatically computes the applicant's exact age in years from their entered Date of Birth, displaying a real-time Age badge (`Age: 20 Yrs`).
- **MySQL Table Column Mapping (`meal_registrations`)**: The `meal_registrations` table schema explicitly maintains an `age INT` column placed next to `date_of_birth VARCHAR(50)`, populated automatically on form submission.

### Forget Password - All login pages
- Forget Password button in the login page should redirect to the Forget Password page.
- On click of  Forget Password button, should check the database for the user (for both  student and staff login pages).
- The Forget Password page should have a form to enter the registration number and email address.
- When the submit button in the Forget Password page is clicked, the form should check if the registration number and email address are correct and if true send a email to the particular email address with a randomly generated password.
- And the randomly generated password should be updated in the database for the particular user. So when the user logs in with the randomly generated password, he should be able to login successfully.

- Separate login page for students and staff, and also separate pages for their forget password page.

---

## 7. Automated Student Academic Year Migration Engine

### Overview & Progression Flow
The Admin Portal provides an automated scheduled migration tool that advances student academic years automatically without manual intervention:
1. **Academic Progression Logic**:
   - `1st Year` → `2nd Year`
   - `2nd Year` → `3rd Year`
   - `3rd Year` → `Graduated`
2. **Meal Eligibility Locking**: When students reach `Graduated` status, their meal eligibility indicators (`forenoon_meal` and `afternoon_meal`) are automatically set to `0` (disabled).
3. **Automated Annual Scheduling (+1 Year Roll-Forward)**:
   - When the scheduled date/time (`year_migration_date` in `app_state`) arrives or is set in the past, the backend automatically triggers student progression.
   - Upon completion, the system automatically advances the scheduled date to the exact same date and time **one year in the future** (e.g. `2026-08-11T06:00` → `2027-08-11T06:00`).
4. **Flexible Date Format Normalization**: Backend date parsers accept multiple date string formats (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`).
5. **Draft Persistence**: Admin input values in `MealWindows.tsx` automatically persist across browser refreshes via `localStorage` draft saving.

---

## 8. Guest Permitting & Dispatch Module

### Staff Portal Guest Workflow
The Staff Portal includes a dedicated **Guest Passes / Guest Permitting** module (`activeTab === 'volunteers'`) for guests, event volunteers, and duty staff.

1. **Pass Permitting Form**: Staff members fill out guest details (Name, Role/Purpose, Mobile Number, Email, Number of QR Tokens / Pass Count: `1 Pass` or `2 Passes`, Valid Date, Notes).
2. **Dedicated Database Architecture (`guest_tokens` Table)**:
   - Stores guest passes in a completely independent `guest_tokens` relational table (`id`, `token_uid`, `guest_name`, `guest_role`, `phone_no`, `email`, `pass_count`, `claimed_count`, `valid_date`, `status`).
   - **Zero dependency or pollution on `student_meals`**.
3. **GUS- Token Format Prefix**:
   - Guest tokens use an explicit **`GUS-`** prefix (e.g. `GUS-1786468102`) to be instantly recognizable from student tokens (`TOK-xxxx`).
4. **Multi-Channel Dispatch Engine**:
   - **WhatsApp Dispatch**: Generates formatted click-to-send WhatsApp messages (`https://wa.me/...`) containing the guest name, role/purpose, `GUS-` token ID, pass count, valid date, and counter claiming instructions.
   - **Branded Email Dispatch**: Invokes `send_volunteer_pass_email()` in `admin_backend/email_service.py` to send an HTML email pass containing an embedded `GUS-` QR code payload.
   - **Resend Email Feature**: Allows staff to re-trigger email pass delivery directly from the guest pass history table (`POST /api/staff/volunteer-tokens/resend-email`).
5. **Canteen Scanning & Multi-Claim Tracking**:
   - Canteen staff scan the `GUS-` QR code.
   - The backend validates the pass against `guest_tokens` and tracks `claimed_count` up to `pass_count`. When `claimed_count >= pass_count`, status transitions to `claimed`.

---

## 9. NCC Student Expansion & Student Category System

The service expands coverage to **NCC Students / Cadets** alongside **Regular Students**:

1. **Database Schema Attribute**:
   - `student_category` (`VARCHAR(20) DEFAULT 'Regular'`) attribute present in `student_meals` and `meal_registrations`.
   - Supports `'Regular'` and `'NCC'` values.
2. **Registration Form Selection**:
   - Registration form includes a **Student Category** selector allowing applicants to register as `Regular Student` or `NCC Student / Cadet`.
3. **Approval Pipeline Sync**:
   - When registration applications are approved by admins, `_sync_approved_registrations_to_student_meals()` automatically copies `student_category` into `student_meals`.
4. **Multi-Portal Badging & Filtering**:
   - **Admin Portal**: Displays `NCC Cadet` badges on pending requests and student details table, with category filtering (`All Categories`, `Regular Students`, `NCC Cadets`).
   - **Staff & Canteen Portals**: Render explicit `NCC Cadet` badges in verification view modals and gate scan popups.
   - **Student Portal**: Displays `Student Category: NCC Cadet` or `Regular Student` on the student profile dashboard card.

